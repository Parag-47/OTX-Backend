import axios from "axios";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { User } from "../models/user.model.js";
import { Token } from "../models/token.model.js";
import { Inquiry } from "../models/inquiry.model.js";
import { Profile } from "../models/profile.model.js";
import { Kyc } from "../models/kyc.model.js";
import { Demat } from "../models/demat.model.js";
import { Order } from "../models/order.model.js";
import { Stock } from "../models/stock.model.js";
import { Wallet } from "../models/wallet.model.js";
import { WalletTransaction } from "../models/walletTransaction.model.js";
import { Counter } from "../models/counter.model.js";
import { WithdrawalRequest } from "../models/withdrawal.model.js";
import { AccountClosure } from "../models/accountClosure.model.js";
import { createCashfreeOrder, verifyCashfreeSignature, cashfreeClient } from "../services/cashfree.service.js";
import { verifyCashfreeWebhookSignature } from "../utils/cashfree.utils.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { generateAndCacheOtp, verifyOtp } from "../utils/otpCache.js";
import { logAdminAction } from "../utils/adminLogger.js";

import { valkey } from "../db/valkey.js";

import {
  trustedDomains,
  isTrustedEmail,
  SENDMAIL,
  createToken,
  isValidToken,
} from "../services/mail.services.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import generateResetToken from "../utils/generateResetToken.js";
import {
  GOOGLE_AUTH_URI,
  getGoogleOAuthTokens,
  getGoogleUser,
} from "../services/googleOauth.services.js";

const frontendOrigin =
  process.env.NODE_ENV === "production"
    ? process.env.PROD_FRONTEND_ORIGIN
    : process.env.DEV_FRONTEND_ORIGIN;

async function verifyAndConsumeToken(token) {
  const decodedToken = isValidToken(token);
  if (!decodedToken) {
    await Token.findOneAndDelete({ token: token });
    throw new ApiError(400, "Invalid or expired token!");
  }

  const tokenDoc = await Token.findOneAndDelete({ token: token });
  if (!tokenDoc) throw new ApiError(400, "Token not found or already used!");

  return tokenDoc;
}

/**
 * Get user data without sensitive fields
 * @param {Object} user - Mongoose user document
 * @returns {Object} Sanitized user object
 */
function sanitizeUser(user) {
  const userObj = user.toObject();
  delete userObj.pin; // Replaced password with pin
  delete userObj.__v;
  delete userObj.resetPasswordTokenHash;
  delete userObj.resetPasswordExpiresAt;
  return userObj;
}

/**
 * Send verification email to user
 * @param {string} email - User email
 * @param {string} userId - User ID for token
 */
async function sendVerificationEmail(email, userId) {
  const token = createToken(email);
  if (!token) throw new ApiError(500, "Failed to create token!");

  const newToken = await Token.create({
    userId: userId,
    token: token,
  });

  if (!newToken) throw new ApiError(500, "Failed to save token!");

  const ORIGIN =
    process.env.NODE_ENV === "production"
      ? process.env.PROD_ORIGIN
      : process.env.DEV_ORIGIN;

  const link = `${ORIGIN}/api/v1/user/verifyEmail?token=${token}`;

  const emailResult = await SENDMAIL("EMAIL_VERIFICATION", email, link);

  if (!emailResult.success) {
    console.error("Failed to send verification email:", emailResult.error);
    throw new ApiError(
      500,
      "Failed to send verification email. Please try again later."
    );
  }

  console.log("Verification email sent successfully!", emailResult.messageId);
}

async function googleAuth(req, res) {
  try {
    res.redirect(GOOGLE_AUTH_URI);
  } catch (error) {
    console.log("Error In Redirect: ", error);
    res.redirect(`/oauth/Failed To Authenticate!`);
  }
}

async function googleAuthCallback(req, res) {
  try {
    const { error, code } = req.query;
    if (error) {
      console.log("Error In Callback: ", error);
      return res.redirect(`/oauth/Failed To Authenticate!`);
    }

    const tokens = await getGoogleOAuthTokens(code);

    if (!tokens) throw new ApiError(500, "Empty Tokens Received!");

    const googleUser = await getGoogleUser(tokens);

    if (!googleUser) throw new ApiError(500, "Google Profile Not Received!");

    const existingUser = await User.findOne({ email: googleUser.email });
    if (existingUser) {
      if (existingUser.role === "admin") {
        throw new ApiError(403, "Admins must login using phone and PIN only.");
      }
      await new Promise((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) return reject(new ApiError(500, "Session regeneration failed"));
          resolve();
        });
      });

      req.session.userId = existingUser._id;
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) return reject(new ApiError(500, "Session save failed"));
          resolve();
        });
      });

      return res.redirect(
        `${frontendOrigin}/?profilePic=${googleUser.picture}&email=${googleUser.email}&name=${googleUser.name}`
      );
    }

    // Create new user
    const newUser = await User.create({
      email: googleUser.email,
      name: googleUser.name,
      verified_email: googleUser.verified_email,
    });

    if (!newUser) throw new ApiError(500, "Failed To Create User!");

    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(new ApiError(500, "Session regeneration failed"));
        resolve();
      });
    });

    req.session.userId = newUser._id;

    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) return reject(new ApiError(500, "Session save failed"));
        resolve();
      });
    });

    return res.redirect(
      `${frontendOrigin}/?profilePic=${googleUser.picture}&email=${googleUser.email}&name=${googleUser.name}`
    );
  } catch (error) {
    console.log("Error In Callback: ", error);
    res.redirect(`/oauth/Failed To Authenticate!`);
  }
}

const sendOtp = asyncHandler(async (req, res) => {
  const { phone, name, email, pin } = req.body;

  // Early lead capture: if signup fields are provided, save the unverified user
  if (name && email && pin) {
    const formattedEmail = email.toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ phone }, { email: formattedEmail }],
    });

    if (existingUser) {
      if (existingUser.verified_phone) {
        throw new ApiError(400, "This Email or Phone Number is already registered!");
      }

      // SECURITY: If the existing record was matched by email but the submitted phone
      // differs, reject the request. Allowing a phone rebind here would let an attacker
      // who knows another user's email redirect the OTP to their own phone and take
      // over an unverified account before the real owner completes registration.
      if (existingUser.phone && String(existingUser.phone) !== String(phone)) {
        throw new ApiError(400, "This email is already associated with a different phone number. Please use that number to continue.");
      }

      // If it exists but is unverified and the phone matches, allow updating other
      // details (in case they made a typo in name/PIN on a previous attempt).
      existingUser.name = name;
      existingUser.email = formattedEmail;
      existingUser.phone = phone;
      existingUser.pin = await bcrypt.hash(pin, 10);
      await existingUser.save();
    } else {
      // Create new unverified user
      const hashedPin = await bcrypt.hash(pin, 10);
      await User.create({
        email: formattedEmail,
        phone,
        pin: hashedPin,
        name,
        verified_phone: false,
        verified_email: false,
      });
    }
  } else {
    // This is a Login/PIN reset OTP request (name/email/pin are absent).
    // Verify that the user exists in the database.
    const user = await User.findOne({ phone });
    if (!user) {
      throw new ApiError(404, "This phone number is not registered. Please sign up first!");
    }
  }

  await generateAndCacheOtp(phone);
  return res.status(200).json(new ApiResponse(200, true, "OTP sent successfully!"));
});

const signup = asyncHandler(async (req, res) => {
  let { phone, otp } = req.body;

  // Verify OTP from cache
  const isOtpValid = await verifyOtp(phone, otp);
  if (!isOtpValid) throw new ApiError(400, "Invalid or Expired OTP!");

  // Find the pre-registered user
  const user = await User.findOne({ phone });
  if (!user) {
    throw new ApiError(404, "Registration session not found. Please request OTP again.");
  }

  // Activate and verify the user
  user.verified_phone = true;
  user.verified_email = false;
  await user.save();

  const oldSessionId = await valkey.get(`user_session:${user._id}`);
  if (oldSessionId) {
    await valkey.del(`OTX:${oldSessionId}`);
  }

  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(new ApiError(500, "Session regeneration failed"));
      resolve();
    });
  });

  req.session.userId = user._id;
  await valkey.set(`user_session:${user._id}`, req.sessionID);

  await new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) return reject(new ApiError(500, "Session save failed"));
      resolve();
    });
  });

  return res.status(200).json(new ApiResponse(200, true, "User registered successfully!", sanitizeUser(user)));
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;

  // Use helper function to verify and consume token
  const tokenDoc = await verifyAndConsumeToken(token);

  // Update user's email verification status
  const user = await User.findByIdAndUpdate(
    tokenDoc.userId,
    { verified_email: true },
    { new: true }
  );

  if (!user) throw new ApiError(500, "Failed To Verify Email!");

  res
    .status(200)
    .json(new ApiResponse(200, true, "Email Verified Successfully!"));
});

const login = asyncHandler(async (req, res) => {
  const { phone, pin } = req.body;

  const user = await User.findOne({ phone }).select("+pin");

  if (!user) throw new ApiError(404, "User doesn't exist!");

  if (!user.verified_phone) {
    throw new ApiError(403, "Please complete phone verification using OTP before logging in with PIN.");
  }

  if (!user.pin)
    throw new ApiError(400, "PIN not set for this account! Please sign in via Google or reset PIN.");

  if (user.accountStatus === "Closed") {
    throw new ApiError(403, "ACCOUNT_CLOSED");
  }

  const isPinValid = await bcrypt.compare(pin, user.pin);

  if (!isPinValid) throw new ApiError(400, "Incorrect PIN!");

  const oldSessionId = await valkey.get(`user_session:${user._id}`);
  if (oldSessionId) {
    await valkey.del(`OTX:${oldSessionId}`);
  }

  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(new ApiError(500, "Session regeneration failed"));
      resolve();
    });
  });

  req.session.userId = user._id;
  await valkey.set(`user_session:${user._id}`, req.sessionID);

  if (user.role === "admin") {
    await logAdminAction(req, user._id, "LOGIN", "Admin logged in via PIN");
  }

  await new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) return reject(new ApiError(500, "Session save failed"));
      resolve();
    });
  });

  return res.status(200).json(new ApiResponse(200, true, "Login Successful!", sanitizeUser(user)));
});

const loginOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  // invalid or expire OTP
  const isOtpValid = await verifyOtp(phone, otp);
  if (!isOtpValid) throw new ApiError(400, "Invalid or Expired OTP!");
  // user not found
  const user = await User.findOne({ phone });
  if (!user) throw new ApiError(404, "User doesn't exist! Please sign up first.");

  if (!user.verified_phone) {
    user.verified_phone = true;
    await user.save();
  }

  if (user.role === "admin") {
    throw new ApiError(403, "Admins must login using phone and PIN only.");
  }

  if (user.accountStatus === "Closed") {
    throw new ApiError(403, "ACCOUNT_CLOSED");
  }

  const oldSessionId = await valkey.get(`user_session:${user._id}`);
  if (oldSessionId) {
    await valkey.del(`OTX:${oldSessionId}`);
  }

  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(new ApiError(500, "Session regeneration failed"));
      resolve();
    });
  });

  req.session.userId = user._id;
  await valkey.set(`user_session:${user._id}`, req.sessionID);

  await new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) return reject(new ApiError(500, "Session save failed"));
      resolve();
    });
  });

  return res.status(200).json(new ApiResponse(200, true, "OTP Login Successful!", sanitizeUser(user)));
});

const logout = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  if (userId) {
    const user = await User.findById(userId);
    if (user && user.role === "admin") {
      await logAdminAction(req, user._id, "LOGOUT", "Admin logged out");
    }
    try {
      await valkey.del(`user_session:${userId}`);
    } catch (valkeyErr) {
      console.error("Failed to delete user_session from Valkey:", valkeyErr);
    }
  }

  await new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) return reject(new ApiError(500, "Logout session destruction failed"));
      resolve();
    });
  });

  const isTunnel =
    req.headers["x-forwarded-proto"] === "https" ||
    req.headers.host?.includes("devtunnels.ms") ||
    req.headers.host?.includes("ngrok") ||
    req.headers.origin?.includes("devtunnels.ms") ||
    req.headers.origin?.includes("ngrok");

  res.clearCookie("sessionId", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || isTunnel,
    sameSite: isTunnel ? "none" : "lax",
    domain: process.env.NODE_ENV === "production" ? ".onetimex.in" : undefined,
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

const forgetPin = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  const user = await User.findOne({ phone });
  if (!user) throw new ApiError(400, "No user found with this phone number!");

  res.status(200).json(new ApiResponse(200, true, "Phone number verified. Please use Login with OTP."));
});

const resetPin = asyncHandler(async (req, res) => {
  const { pin, otp } = req.body;
  const userId = req.session.userId || req.user?._id;

  // Step 1: Fetch user to get phone number
  const user = await User.findById(userId).select("phone");
  if (!user) throw new ApiError(404, "User not found");

  // Step 2: Verify OTP first — before changing PIN
  const isOtpValid = await verifyOtp(user.phone, otp);
  if (!isOtpValid) {
    throw new ApiError(400, "Invalid or expired OTP. Request a new one.");
  }

  // Step 3: Hash new PIN
  const hashedPin = await bcrypt.hash(pin, 10);

  // Step 4: Update PIN in DB
  await User.findByIdAndUpdate(userId, { pin: hashedPin });

  return res.status(200).json(
    new ApiResponse(200, true, "PIN updated successfully.")
  );
});


const resetPassword = asyncHandler(async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  if (password !== confirmPassword)
    throw new ApiError(400, "Passwords do not match!");

  // Verify token is valid
  const decodedToken = isValidToken(token);
  if (!decodedToken) {
    // Clean up invalid token
    await Token.findOneAndDelete({ token: token });
    throw new ApiError(400, "Invalid or malformed reset token!");
  }

  // Find and delete token (consume it) - check type and expiry
  const tokenDoc = await Token.findOneAndDelete({
    token: token,
    type: "password_reset",
    expiresAt: { $gt: Date.now() },
  });

  if (!tokenDoc)
    throw new ApiError(400, "Invalid, expired, or already used reset token!");

  // Find user
  const user = await User.findById(tokenDoc.userId);
  if (!user) throw new ApiError(404, "User not found!");

  // Hash new password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Update password
  user.password = hashedPassword;
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpiresAt = undefined;
  await user.save();



  res.status(200).json({
    success: true,
    message:
      "Password reset successfully! You can now login with your new password.",
  });
});

const updateAccountInfo = asyncHandler(async (req, res) => {
  const update = {};
  for (const key of Object.keys(req.body)) {
    if (
      req.body[key] !== "" &&
      req.body[key] !== undefined &&
      req.body[key] !== null
    ) {
      update[key] = req.body[key];
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.session.userId,
    { $set: update },
    { new: true }
  );

  if (!updatedUser) throw new ApiError(500, "Failed TO Update User!");

  res
    .status(200)
    .json(new ApiResponse(200, true, "Updated Successfully!", sanitizeUser(updatedUser)));
});

const updateEmail = asyncHandler(async (req, res) => {
  let { email } = req.body;

  // Check if email already exists for another user
  const existingUser = await User.findOne({
    email,
    _id: { $ne: req.session.userId },
  });

  if (existingUser) {
    throw new ApiError(409, "Email already registered with another account!");
  }

  // Update user email and reset verification status
  const user = await User.findByIdAndUpdate(
    req.session.userId,
    {
      email,
      verified_email: false,
    },
    { new: true, runValidators: true }
  );

  if (!user) throw new ApiError(404, "User not found!");

  // Send verification email using helper function
  await sendVerificationEmail(email, user._id);

  res.status(200).json({
    success: true,
    message:
      "Email updated successfully! Please check your inbox to verify your new email.",
    data: sanitizeUser(user),
  });
});

const updatePhoneNumber = asyncHandler(async (req, res) => {
  let { phone } = req.body;

  // Convert to number for storage
  const phoneNumber = Number(phone);

  // Check if phone already exists for another user
  const existingUser = await User.findOne({
    phone: phoneNumber,
    _id: { $ne: req.session.userId },
  });

  if (existingUser) {
    throw new ApiError(
      409,
      "Phone number already registered with another account!"
    );
  }

  // Update user phone
  const user = await User.findByIdAndUpdate(
    req.session.userId,
    {
      phone: phoneNumber,
      verified_phone: false,
    },
    { new: true, runValidators: true }
  );

  if (!user) throw new ApiError(404, "User not found!");

  res.status(200).json({
    success: true,
    message: "Phone number updated successfully!",
    data: sanitizeUser(user),
  });
});

const enquiry = asyncHandler(async (req, res) => {
  const { name, email, phone, inquiryType, message } = req.body;

  // Create inquiry
  const inquiry = await Inquiry.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: String(phone).trim(),
    inquiryType,
    message: message.trim(),
  });

  if (!inquiry) {
    throw new ApiError(500, "Failed to submit inquiry!");
  }

  res.status(201).json({
    success: true,
    message:
      "Your inquiry has been submitted successfully! We'll get back to you soon.",
    data: inquiry,
  });
});

const getUserProfile = asyncHandler(async (req, res) => {
  const userId = req.session.userId;

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found!");

  res
    .status(200)
    .json(new ApiResponse(200, true, "Profile fetched successfully!", sanitizeUser(user)));
});

/**
 * GET /api/v1/user/profile/full
 * Returns user account info + extended profile (Personal Details page)
 */
const getFullProfile = asyncHandler(async (req, res) => {
  const userId = req.session.userId;

  // Fetch user, their profile, and active orders in parallel
  const [user, profile, orders] = await Promise.all([
    User.findById(userId).select("-__v -password"),
    Profile.findOne({ userId }).select("-__v"),
    Order.find({ userId, status: { $ne: "rejected" } }).select("quantity pricePerShare").lean()
  ]);

  if (!user) throw new ApiError(404, "User not found!");

  return res.status(200).json(
    new ApiResponse(
      200,
      true,
      "Profile fetched successfully",
      {
        // Account-level fields
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        broker: user.broker,
        traderType: user.traderType,
        source: user.source,
        verified_email: user.verified_email,
        verified_phone: user.verified_phone,
        // Extended profile fields (null if not yet filled)
        profile: {
          gender: profile?.gender,
          dateOfBirth: profile?.dateOfBirth,
          fathersName: profile?.fathersName,
          incomeRange: profile?.incomeRange,
          // Calculate total investment (baseAmount in Rupees) from active orders
          investment: orders.reduce((sum, order) => sum + ((order.quantity * order.pricePerShare) / 100), 0),
        },
      }
    )
  );
});

/**
 * PUT /api/v1/user/profile
 * Create or update extended profile (Personal Details screen — Save Details button)
 * Uses upsert: creates a profile doc if none exists, updates if it does.
 */
const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.session.userId;

  // AJV middleware already validated req.body, so we can use it directly
  const update = req.body;

  // Upsert: create if not exists, update if exists
  const profile = await Profile.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true, upsert: true, runValidators: true, select: "-__v" }
  );

  if (!profile) throw new ApiError(500, "Failed to update profile!");

  return res.status(200).json(
    new ApiResponse(200, true, "Profile updated successfully!", profile)
  );
});

/**
 * GET /api/v1/user/kyc
 * Fetch KYC details, decrypting PAN and Aadhaar
 */
const getKycDetails = asyncHandler(async (req, res) => {
  const userId = req.session.userId;

  const kyc = await Kyc.findOne({ userId }).select("-__v -createdAt -updatedAt").lean();

  if (!kyc) {
    return res.status(200).json(
      new ApiResponse(200, true, "No KYC details found", null)
    );
  }

  let panNumber = null;
  let aadhaarNumber = null;

  if (kyc.panNumber) {
    try {
      panNumber = decrypt(kyc.panNumber);
    } catch (e) {
      panNumber = kyc.panNumber;
    }
  }

  if (kyc.aadhaarNumber) {
    try {
      aadhaarNumber = decrypt(kyc.aadhaarNumber);
    } catch (e) {
      aadhaarNumber = kyc.aadhaarNumber;
    }
  }

  const sanitizedKyc = {
    _id: kyc._id,
    panNumber,
    aadhaarNumber,
    address: kyc.address || null,
    isVerified: kyc.isVerified || false,
  };

  return res.status(200).json(
    new ApiResponse(200, true, "KYC fetched successfully", sanitizedKyc)
  );
});

/**
 * PUT /api/v1/user/kyc
 * Update KYC details, encrypting PAN and Aadhaar before saving
 */
const updateKycDetails = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const { panNumber, aadhaarNumber, address, accountNumber, ifscCode, accountHolderName, bankName } = req.body;

  const update = {};

  if (address !== undefined) update.address = address;
  if (accountHolderName !== undefined) update.accountHolderName = accountHolderName.trim();
  if (bankName !== undefined) update.bankName = bankName.trim();

  // Encrypt sensitive fields before saving (findOneAndUpdate bypasses pre-save hooks)
  if (accountNumber !== undefined) update.accountNumber = encrypt(accountNumber);
  if (ifscCode !== undefined) update.ifscCode = encrypt(ifscCode.toUpperCase().trim());

  if (panNumber) {
    update.panNumber = encrypt(panNumber);
  }

  if (aadhaarNumber) {
    update.aadhaarNumber = encrypt(aadhaarNumber);
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "No valid fields provided to update!");
  }

  const kyc = await Kyc.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true, upsert: true, runValidators: true, select: "-__v -createdAt -updatedAt" }
  ).lean();

  if (!kyc) throw new ApiError(500, "Failed to update KYC details!");

  // Return the decrypted values to the frontend
  if (kyc.panNumber) kyc.panNumber = decrypt(kyc.panNumber);
  if (kyc.aadhaarNumber) kyc.aadhaarNumber = decrypt(kyc.aadhaarNumber);
  if (kyc.accountNumber) kyc.accountNumber = decrypt(kyc.accountNumber);
  if (kyc.ifscCode) kyc.ifscCode = decrypt(kyc.ifscCode);

  return res.status(200).json(
    new ApiResponse(200, true, "KYC details updated successfully!", kyc)
  );
});

/**
 * GET /api/v1/user/demat
 * Fetch Demat details, decrypting DP ID and Client ID
 */
const getDematDetails = asyncHandler(async (req, res) => {
  const userId = req.session.userId;

  const demat = await Demat.findOne({ userId }).select("-__v -createdAt -updatedAt").lean();

  if (!demat) {
    return res.status(200).json(
      new ApiResponse(200, true, "No Demat details found", null)
    );
  }

  // Return masked values to the frontend to prevent PII exposure
  if (demat.dpId) {
    let rawDpId;
    try {
      rawDpId = decrypt(demat.dpId);
    } catch (e) {
      rawDpId = demat.dpId;
    }
    demat.dpId = "********" + String(rawDpId).slice(-4);
  }
  if (demat.clientId) {
    let rawClientId;
    try {
      rawClientId = decrypt(demat.clientId);
    } catch (e) {
      rawClientId = demat.clientId;
    }
    demat.clientId = "********" + String(rawClientId).slice(-4);
  }

  return res.status(200).json(
    new ApiResponse(200, true, "Demat details fetched successfully", demat)
  );
});

/**
 * PUT /api/v1/user/demat
 * Update Demat details, encrypting DP ID and Client ID
 */
const updateDematDetails = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const { dpName, dpId, clientId, nomineeName } = req.body;

  const update = {};
  if (dpName !== undefined) update.dpName = dpName.trim();
  if (dpId !== undefined) update.dpId = encrypt(dpId.trim().toUpperCase());
  if (clientId !== undefined) update.clientId = encrypt(clientId.trim());
  if (nomineeName !== undefined) update.nomineeName = nomineeName.trim();

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "No valid fields provided to update!");
  }

  const demat = await Demat.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true, upsert: true, runValidators: true, select: "-__v -createdAt -updatedAt" }
  ).lean();

  if (!demat) throw new ApiError(500, "Failed to update Demat details!");

  // Return masked values to the frontend to prevent PII exposure
  if (demat.dpId) {
    const rawDpId = decrypt(demat.dpId);
    demat.dpId = "********" + rawDpId.slice(-4);
  }
  if (demat.clientId) {
    const rawClientId = decrypt(demat.clientId);
    demat.clientId = "********" + rawClientId.slice(-4);
  }


  return res.status(200).json(
    new ApiResponse(200, true, "Demat details updated successfully!", demat)
  );
});

/**
 * GET /api/v1/user/bank
 * Fetch user's bank details, decrypting the account number.
 */
const getBankDetails = asyncHandler(async (req, res) => {
  const userId = req.session.userId;

  const bank = await Kyc.findOne({ userId }).select("accountNumber ifscCode accountHolderName bankName bankVerified").lean();

  if (!bank) {
    return res.status(200).json(
      new ApiResponse(200, true, "No bank details mapped", null)
    );
  }

  if (bank.accountNumber) {
    try {
      bank.accountNumber = decrypt(bank.accountNumber);
    } catch (e) {
      // Legacy plain text fallback
    }
  }

  if (bank.ifscCode) {
    try {
      bank.ifscCode = decrypt(bank.ifscCode);
    } catch (e) {
      // Legacy plain text fallback
    }
  }

  return res.status(200).json(
    new ApiResponse(200, true, "Bank details fetched successfully!", bank)
  );
});

/**
 * PUT /api/v1/user/bank
 * Add or update bank details, encrypting the account number before storing.
 */
const updateBankDetails = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const { accountNumber, ifscCode, accountHolderName, bankName } = req.body;

  const update = {
    accountNumber: encrypt(accountNumber),
    ifscCode: encrypt(ifscCode.toUpperCase().trim()),
  };

  if (accountHolderName !== undefined) {
    update.accountHolderName = accountHolderName.trim();
  }
  if (bankName !== undefined) {
    update.bankName = bankName.trim();
  }

  const bank = await Kyc.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true, upsert: true, runValidators: true, select: "accountNumber ifscCode accountHolderName bankName bankVerified" }
  ).lean();

  if (!bank) throw new ApiError(500, "Failed to update bank details!");

  if (bank.accountNumber) {
    bank.accountNumber = decrypt(bank.accountNumber);
  }

  if (bank.ifscCode) {
    bank.ifscCode = decrypt(bank.ifscCode);
  }

  return res.status(200).json(
    new ApiResponse(200, true, "Bank details updated successfully!", bank)
  );
});

/**
 * POST /api/v1/user/orders
 * Place a buy order. Performs phone verification check, KYC check, and bank details check.
 * Dynamically computes dynamic fee slab (on-the-fly via Mongoose virtuals).
 */
const createOrder = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const { stockId, quantity } = req.body;

  // 1. Fetch user to verify phone authentication
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found!");

  if (!user.verified_phone) {
    throw new ApiError(400, "Your phone number is not verified. Phone verification is required before placing orders.");
  }

  // 2. Verify complete KYC mapping (PAN and Aadhaar)
  const kyc = await Kyc.findOne({ userId });
  if (!kyc || !kyc.panNumber || !kyc.aadhaarNumber) {
    throw new ApiError(400, "KYC check failed. You must complete your KYC details (PAN and Aadhaar) before placing orders.");
  }

  // 3. Verify complete Bank mapping
  const bank = await Kyc.findOne({ userId });
  if (!bank || !bank.accountNumber || !bank.ifscCode) {
    throw new ApiError(400, "Bank mapping failed. You must register your bank details (Account Number and IFSC) before placing orders.");
  }

  // 4. Fetch Stock to verify pricing and available quantity
  const stock = await Stock.findById(stockId);
  if (!stock) throw new ApiError(404, "Stock not found!");

  if (!stock.isActive) {
    throw new ApiError(400, "This stock is currently not active for trading.");
  }

  if (stock.availableQuantity < quantity) {
    throw new ApiError(400, `Insufficient stock quantity. Only ${stock.availableQuantity} shares are available.`);
  }

  // 4b. Verify Wallet Balance
  const baseAmount = quantity * stock.currentPrice;
  const baseAmountInRupees = baseAmount / 100;

  // Calculate dynamic fee percentage based on slabs
  let feePercentage = 2.0;
  if (baseAmountInRupees <= 200000) feePercentage = 2.0;
  else if (baseAmountInRupees <= 300000) feePercentage = 1.9;
  else if (baseAmountInRupees <= 400000) feePercentage = 1.8;
  else if (baseAmountInRupees <= 500000) feePercentage = 1.7;
  else {
    const excess = baseAmountInRupees - 500000;
    const slabIndex = Math.ceil(excess / 100000);
    const rate = 1.70 - (slabIndex * 0.01);
    feePercentage = Math.max(rate, 1.65);
  }

  const transactionFee = Math.round(baseAmount * (feePercentage / 100));
  const gst = Math.round(transactionFee * 0.18);
  const totalPayable = baseAmount + transactionFee + gst;

  // 5. Start MongoDB ACID Transaction for all writes
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Generate custom sequential Order ID atomically within session
    const counter = await Counter.findByIdAndUpdate(
      'orderId',
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );
    const customOrderId = `OTX${1000 + counter.seq}`;

    // 6. Deduct wallet (atomic within session)
    const updatedWallet = await Wallet.findOneAndUpdate(
      { userId, balance: { $gte: totalPayable } },
      { $inc: { balance: -totalPayable } },
      { new: true, session }
    );
    if (!updatedWallet) {
      throw new ApiError(400, "Insufficient wallet balance to complete this order.");
    }

    // 7. Deduct stock (atomic within session)
    const updatedStock = await Stock.findOneAndUpdate(
      { _id: stockId, availableQuantity: { $gte: quantity } },
      { $inc: { availableQuantity: -quantity } },
      { new: true, session }
    );
    if (!updatedStock) {
      throw new ApiError(400, "Stock sold out or insufficient quantity available during processing.");
    }

    // 8. Both Wallet and Stock succeeded, create the Order document safely
    const [order] = await Order.create(
      [
        {
          userId,
          stockId,
          quantity,
          pricePerShare: stock.currentPrice, // Snapshotted purchase price in Paise
          status: "pending",
          orderId: customOrderId,
        },
      ],
      { session }
    );

    // 9. Log successful payment transaction
    await WalletTransaction.create(
      [
        {
          userId,
          transactionId: `PAY_${order._id}`,
          depositAmount: 0,
          gatewayFee: 0,
          gst: 0,
          totalAmount: totalPayable,
          type: "payment",
          status: "success",
          paymentDetails: { orderId: order._id },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // 10. Populate stock details for the client response
    const populatedOrder = await Order.findById(order._id)
      .populate("stockId", "name logo sector");

    return res.status(201).json(
      new ApiResponse(201, true, "Order initiated successfully! Awaiting admin approval.", populatedOrder)
    );
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    session.endSession();
  }
});

/**
 * GET /api/v1/user/orders
 * Fetch authenticated user's order history.
 */
const getUserOrders = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const orders = await Order.find({ userId })
    .populate("stockId", "name logo ipoExpected currentPrice")
    .sort({ createdAt: -1 });

  const responseOrders = orders.map(order => ({
    _id: order._id,
    orderId: order.orderId,
    stockId: {
      _id: order.stockId?._id,
      name: order.stockId?.name,
      logo: order.stockId?.logo,
      ipoExpected: order.stockId?.ipoExpected,
      currentPrice: order.stockId?.currentPrice,
    },
    quantity: order.quantity,
    pricePerShare: order.pricePerShare,
    status: order.status,
    createdAt: order.createdAt,
    baseAmount: order.baseAmount,
    transactionFee: order.transactionFee,
    gst: order.gst,
    totalPayable: order.totalPayable,
    refundAmount: order.refundAmount,
  }));

  return res .status(200).json(
    new ApiResponse(200, true, "User orders fetched successfully!", responseOrders)
  );
});

/**
 * GET /api/v1/user/portfolio/summary
 * Fetch summary of the user's investments including total invested, current value, and overall returns.
 */
const getPortfolioSummary = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  
  const orders = await Order.find({ userId })
    .populate("stockId", "currentPrice")
    .lean();

  let approvedInvested = 0; // Capital deployed in approved (executed) orders only
  let pendingPayable = 0;   // Capital committed to orders still awaiting approval
  let currentValue = 0;

  let totalOrders = 0;
  let approvedOrders = 0;
  let pendingOrders = 0;
  let rejectedOrders = 0;

  orders.forEach(order => {
    totalOrders++;

    if (order.status === "rejected") {
      rejectedOrders++;
      return; // skip — no capital deployed
    }

    if (order.status === "approved") {
      approvedOrders++;
      // Use stored totalPayable if available, otherwise recompute
      const paid = order.totalPayable || (() => {
        const base = order.quantity * order.pricePerShare;
        const baseInRupees = base / 100;
        let feePercentage = 2.0;
        if (baseInRupees <= 200000) feePercentage = 2.0;
        else if (baseInRupees <= 300000) feePercentage = 1.9;
        else if (baseInRupees <= 400000) feePercentage = 1.8;
        else if (baseInRupees <= 500000) feePercentage = 1.7;
        else {
          const excess = baseInRupees - 500000;
          const slabIndex = Math.ceil(excess / 100000);
          feePercentage = Math.max(1.70 - slabIndex * 0.01, 1.65);
        }
        const fee = Math.round(base * (feePercentage / 100));
        return base + fee + Math.round(fee * 0.18);
      })();
      approvedInvested += paid;

      const currentMarketPrice = order.stockId?.currentPrice || order.pricePerShare;
      currentValue += (order.quantity * currentMarketPrice);
    }

    if (order.status === "pending") {
      pendingOrders++;
      const base = order.quantity * order.pricePerShare;
      const baseInRupees = base / 100;
      let feePercentage = 2.0;
      if (baseInRupees <= 200000) feePercentage = 2.0;
      else if (baseInRupees <= 300000) feePercentage = 1.9;
      else if (baseInRupees <= 400000) feePercentage = 1.8;
      else if (baseInRupees <= 500000) feePercentage = 1.7;
      else {
        const excess = baseInRupees - 500000;
        const slabIndex = Math.ceil(excess / 100000);
        feePercentage = Math.max(1.70 - slabIndex * 0.01, 1.65);
      }
      const fee = Math.round(base * (feePercentage / 100));
      pendingPayable += (order.totalPayable || (base + fee + Math.round(fee * 0.18)));
    }
  });

  // Returns are meaningful only for approved capital vs current market value
  const overallReturns = currentValue - approvedInvested;
  let returnPercent = 0;
  if (approvedInvested > 0) {
    returnPercent = parseFloat(((overallReturns / approvedInvested) * 100).toFixed(2));
  }

  // totalInvested = approved capital only (consistent with returns calculation)
  const totalInvested = approvedInvested;

  return res.status(200).json(
    new ApiResponse(200, true, "Portfolio summary fetched successfully!", {
      totalInvested,    // approved orders only — used for return %
      pendingPayable,   // capital locked in pending orders (separate, not included in returns)
      currentValue,
      overallReturns,
      returnPercent,
      totalOrders,
      approvedOrders,
      pendingOrders,
      rejectedOrders
    })
  );
});

/**
 * GET /api/v1/user/orders/:id
 * Fetch detailed information for a specific order.
 * Returns full payment breakdown: baseAmount, transactionFee, GST, totalPayable.
 */
const getOrderDetails = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;

  // Support both orderId (e.g. OTX1001) and MongoDB _id
  const query = mongoose.isValidObjectId(id)
    ? { _id: id, userId }
    : { orderId: id, userId };

  const order = await Order.findOne(query)
    .populate("stockId", "name logo sector currentPrice")
    .lean();

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Compute fee breakdown (same slab logic as order.model.js virtuals)
  const baseAmount = order.quantity * order.pricePerShare;
  const baseAmountInRupees = baseAmount / 100;

  let feePercentage = 2.0;
  if (baseAmountInRupees <= 200000) feePercentage = 2.0;
  else if (baseAmountInRupees <= 300000) feePercentage = 1.9;
  else if (baseAmountInRupees <= 400000) feePercentage = 1.8;
  else if (baseAmountInRupees <= 500000) feePercentage = 1.7;
  else {
    const excess = baseAmountInRupees - 500000;
    const slabIndex = Math.ceil(excess / 100000);
    feePercentage = Math.max(1.70 - slabIndex * 0.01, 1.65);
  }

  const transactionFee = Math.round(baseAmount * (feePercentage / 100));
  const gst = Math.round(transactionFee * 0.18);
  const totalPayable = baseAmount + transactionFee + gst;
  const refundAmount = order.status === "rejected" ? totalPayable : 0;

  // Build a clean, production-ready response
  const responseData = {
    orderId: order.orderId,
    stock: order.stockId || null,
    quantity: order.quantity,
    pricePerShare: order.pricePerShare,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    // Payment breakdown (all values in Paise)
    paymentBreakdown: {
      baseAmount,
      feePercentage,
      transactionFee,
      gst,
      totalPayable,
      refundAmount,
    },
    // Human-readable amounts in Rupees
    paymentBreakdownInRupees: {
      baseAmount: (baseAmount / 100).toFixed(2),
      transactionFee: (transactionFee / 100).toFixed(2),
      gst: (gst / 100).toFixed(2),
      totalPayable: (totalPayable / 100).toFixed(2),
      refundAmount: (refundAmount / 100).toFixed(2),
    },
  };

  return res.status(200).json(
    new ApiResponse(200, true, "Order details fetched successfully!", responseData)
  );
});

/**
 * GET /api/v1/user/wallet/balance
 * Fetch authenticated user's wallet balance.
 */
const getWalletBalance = asyncHandler(async (req, res) => {
  const userId = req.session.userId;

  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({ userId, balance: 0 });
  }

  return res.status(200).json(
    new ApiResponse(200, true, "Wallet balance fetched successfully!", {
      balance: wallet.balance, // in Paise
      balanceInRupees: wallet.balance / 100
    })
  );
});

/**
 * POST /api/v1/user/wallet/deposit/initiate
 * Initiate a deposit using Cashfree.
 * Calculates a 2% gateway fee + 18% GST (on the fee) on top of the net deposit amount.
 */
const initiateDeposit = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const { amount } = req.body; // Net amount the user wants to add to wallet (in Paise)

  if (!amount || amount <= 0) {
    throw new ApiError(400, "Deposit amount must be greater than 0");
  }

  // 1. Fetch user info
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found!");

  if (!user.verified_phone) {
    throw new ApiError(400, "Your phone number must be verified before depositing funds.");
  }

  // 2. Compute dynamic fees (DEPOSITS ARE NOW 100% FREE)
  // gatewayFee = 0
  const gatewayFee = 0;
  // GST = 0
  const gst = 0;
  // totalAmount = amount
  const totalAmount = amount;

  // 3. Generate a unique transaction ID
  const transactionId = `TXN_${Date.now()}_${crypto.randomInt(1000, 9999)}`;

  // Convert totalAmount to Rupees string with 2 decimal places for Cashfree
  const totalAmountInRupees = (totalAmount / 100).toFixed(2);

  // 4. Create Cashfree Order
  let cashfreeOrder;
  try {
    cashfreeOrder = await createCashfreeOrder(transactionId, totalAmountInRupees, {
      id: user._id,
      phone: user.phone,
      email: user.email,
      name: user.name
    });
  } catch (error) {
    console.error("Cashfree order creation error:", error.response?.data || error.message);
    throw new ApiError(500, `Payment gateway integration error: ${error.response?.data?.message || error.message}`);
  }

  // 5. Save pending transaction in db
  await WalletTransaction.create({
    userId,
    transactionId,
    depositAmount: amount,
    gatewayFee,
    gst,
    totalAmount,
    type: "deposit",
    status: "pending",
  });



  return res.status(201).json(
    new ApiResponse(201, true, "Deposit initiated successfully!", {
      transactionId,
      depositAmount: amount,
      gatewayFee,
      gst,
      totalAmount,
      paymentSessionId: cashfreeOrder.payment_session_id,
      paymentLink: cashfreeOrder.payment_link
    })
  );
});

/**
 * POST /api/v1/user/wallet/webhook
 * Securely verify and handle Cashfree PG webhooks (Idempotent + verified amounts).
 */
const handleCashfreeWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-webhook-signature"];
  const timestamp = req.headers["x-webhook-timestamp"];
  const rawBodyString = req.rawBody ? req.rawBody.toString("utf8") : "";
  const { data, type } = req.body;

  // ── Guard: ignore payloads with no type ─────────────────────────
  if (!type) {
    return res.status(200).json({ success: true, message: "Ignored: no type" });
  }

  // ── Timestamp Replay Attack Protection ──────────────────────────
  // Reject webhooks older/newer than 5 minutes — prevents replay attacks
  const webhookAge = Math.floor(Date.now() / 1000) - parseInt(timestamp || "0");
  const isStale = Math.abs(webhookAge) > 300;

  if (isStale && process.env.NODE_ENV !== "development") {
    console.warn(`Stale webhook rejected: ${webhookAge}s old | type: ${type}`);
    return res.status(200).json({ success: true, message: "Stale webhook ignored" });
  }

  // ── Smart Signature Routing ──────────────────────────────────────
  // Payout webhooks use CASHFREE_PAYOUT_SECRET
  // Deposit webhooks use CASHFREE_SECRET_KEY
  const isPayoutWebhook = type.startsWith("TRANSFER_");
  let isSignatureValid = false;

  if (isPayoutWebhook) {
    isSignatureValid = verifyCashfreeWebhookSignature(
      rawBodyString, signature, timestamp
    );
  } else {
    isSignatureValid = verifyCashfreeSignature(
      signature, rawBodyString, timestamp
    );
  }

  // Return 200 even on invalid signature — prevents Cashfree retry storm
  if (!isSignatureValid && process.env.NODE_ENV !== "development") {
    console.warn(`Invalid signature for webhook type: ${type}`);
    return res.status(200).json({ success: true, message: "Invalid signature. Ignored." });
  }

  // ===========================================================================
  // PAYOUT WEBHOOK
  // ===========================================================================
  if (isPayoutWebhook) {
    const transferData = data?.transfer || {};
    const transferId = transferData.transferId || transferData.transfer_id;

    if (!transferId) {
      return res.status(200).json({ success: true, message: "Invalid payout payload" });
    }

    const cashfreeRefId = transferData.referenceId
      || transferData.reference_id
      || null;

    // Fetch withdrawal record
    const withdrawal = await WithdrawalRequest.findOne({ withdrawId: transferId });
    if (!withdrawal) {
      return res.status(200).json({ success: true, message: "Withdrawal not found" });
    }

    // Idempotency guard — already finalized
    if (withdrawal.status === "Completed" || withdrawal.status === "Rejected") {
      return res.status(200).json({ success: true, message: "Already finalized. Ignored." });
    }

    // Safety guard — webhook arrived before admin approved
    if (withdrawal.status === "Pending") {
      console.warn(`Webhook for PENDING withdrawal ${transferId}. Ignored.`);
      return res.status(200).json({ success: true, message: "Not approved yet. Ignored." });
    }

    // ── TRANSFER_SUCCESS / TRANSFER_COMPLETED ─────────────────────
    if (type === "TRANSFER_SUCCESS" || type === "TRANSFER_COMPLETED") {
      await WithdrawalRequest.findByIdAndUpdate(withdrawal._id, {
        status: "Completed",     // money confirmed in user's bank
        utrNumber: cashfreeRefId // real bank UTR from Cashfree
      });

      // Update Frontend log state from "pending" to "success"
      await WalletTransaction.findOneAndUpdate(
        { transactionId: withdrawal.withdrawId },
        { status: "success" }
      );

      console.log(`✅ Payout confirmed: ${transferId} | UTR: ${cashfreeRefId}`);
    }

    // ── TRANSFER_FAILED / TRANSFER_REJECTED / TRANSFER_REVERSED ───
    else if ([
      "TRANSFER_FAILED",
      "TRANSFER_REJECTED",
      "TRANSFER_REVERSED"
    ].includes(type)) {

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // 1. Refund full requested amount to wallet
        await Wallet.findOneAndUpdate(
          { userId: withdrawal.userId },
          { $inc: { balance: withdrawal.amount } },
          { session }
        );

        // 2. Audit trail — REV-REFUND record
        await WalletTransaction.create([{
          userId: withdrawal.userId,
          transactionId: `${withdrawal.withdrawId}-REV-REFUND`,
          type: "refund",
          totalAmount: withdrawal.amount,
          depositAmount: withdrawal.amount,
          gatewayFee: 0,
          gst: 0,
          status: "success",
          description: `Auto-refund: ${type} for ${withdrawal.withdrawId}`
        }], { session });

        // 3. Mark original withdrawal transaction failed
        await WalletTransaction.findOneAndUpdate(
          { transactionId: withdrawal.withdrawId },
          { status: "failed" },
          { session }
        );

        // 4. Mark withdrawal rejected
        await WithdrawalRequest.findByIdAndUpdate(
          withdrawal._id,
          {
            status: "Rejected",
            rejectionReason: `Webhook: ${type} received from bank.`
          },
          { session }
        );



        await session.commitTransaction();
        console.error(`🚨 Payout reversed: ${transferId}. Wallet auto-refunded.`);

      } catch (refundError) {
        await session.abortTransaction();
        console.error(
          `CRITICAL: Reversal refund failed for ${transferId}!`,
          refundError
        );

        // Best-effort: persist an ops-facing record so the admin can identify
        // this withdrawal needs manual reconciliation. Runs outside the aborted
        // session so it succeeds even if the session itself had issues.
        try {
          await WalletTransaction.create([{
            userId: withdrawal.userId,
            transactionId: `${withdrawal.withdrawId}-REV-FAILED`,
            type: "refund",
            totalAmount: withdrawal.amount,
            depositAmount: 0,
            gatewayFee: 0,
            gst: 0,
            status: "failed",
            description: `CRITICAL: Auto-refund FAILED for ${type} on ${withdrawal.withdrawId}. Manual intervention required.`
          }]);
        } catch (opsRecordError) {
          // If even this fails, we still need to log — the 5xx below will trigger a Cashfree retry
          console.error("CRITICAL: Could not persist ops refund failure record:", opsRecordError);
        }

        // Return 5xx so Cashfree knows this webhook was NOT successfully processed
        // and will retry delivery — giving us another chance to complete the refund.
        return res.status(500).json({ success: false, message: "Refund processing failed. Retry required." });

      } finally {
        session.endSession(); // always runs
      }

      // Only reached when the refund transaction committed successfully
      return res.status(200).json({ success: true, message: "Payout reversal processed and wallet refunded" });
    }

    return res.status(200).json({ success: true, message: "Payout webhook processed" });
  }

  // ===========================================================================
  // DEPOSIT WEBHOOK
  // ===========================================================================
  else {
    if (!data?.order || !data?.payment) {
      return res.status(200).json({ success: true, message: "Invalid deposit payload" });
    }

    const orderId = data.order.order_id;
    const paymentAmount = data.payment.payment_amount;
    const paymentStatus = data.payment.payment_status;

    // Only process SUCCESS payments
    if (
      paymentStatus !== "SUCCESS" ||
      (type !== "PAYMENT_SUCCESS" && type !== "ORDER_PAID")
    ) {
      await WalletTransaction.findOneAndUpdate(
        { transactionId: orderId, status: "pending" },
        { status: "failed", paymentDetails: req.body }
      );
      return res.status(200).json({ success: true, message: "Non-success payment logged" });
    }

    // Idempotency — only process if still "pending"
    const txn = await WalletTransaction.findOneAndUpdate(
      { transactionId: orderId, status: "pending" },
      { status: "success", paymentDetails: req.body },
      { new: true }
    );

    if (!txn) {
      return res.status(200).json({ success: true, message: "Already processed. Ignored." });
    }

    // Amount verification
    const paymentAmountInPaise = Math.round(paymentAmount * 100);
    if (paymentAmountInPaise !== txn.totalAmount) {
      txn.status = "failed";
      txn.paymentDetails = {
        ...req.body,
        error: `Mismatch: got ₹${paymentAmount}, expected ₹${txn.totalAmount / 100}`
      };
      await txn.save();
      console.error(`CRITICAL: Amount mismatch for order ${orderId}`);
      // TODO: Alert ops team
      // Return 200 — prevents Cashfree retry storm
      return res.status(200).json({ success: true, message: "Mismatch logged internally" });
    }

    // Credit wallet atomically
    await Wallet.findOneAndUpdate(
      { userId: txn.userId },
      { $inc: { balance: txn.depositAmount } },
      { new: true, upsert: true }
    );

    return res.status(200).json({ success: true, message: "Wallet credited successfully" });
  }
});

/**
 * POST /api/v1/user/wallet/verify-payment
 * Called by frontend after Cashfree redirects back.
 * Directly polls Cashfree API to verify payment and credit wallet.
 * This is a fallback for when webhooks are not delivered (e.g. tunnel issues in dev).
 */
const verifyPaymentAndCredit = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const { orderId } = req.body;

  if (!orderId) throw new ApiError(400, "orderId is required");

  // 1. Find the transaction (any status except already-credited)
  const txn = await WalletTransaction.findOne({ transactionId: orderId, userId });
  if (!txn) {
    console.error(`[verify-payment] Transaction not found: orderId=${orderId}, userId=${userId}`);
    throw new ApiError(404, "Transaction not found. Please contact support.");
  }

  // 2. If already credited, just return the balance
  if (txn.status === "success") {
    const wallet = await Wallet.findOne({ userId });
    return res.status(200).json(
      new ApiResponse(200, true, "Already credited", { balance: wallet?.balance || 0 })
    );
  }

  // If previously failed, reset to pending so we can re-check with Cashfree
  if (txn.status === "failed") {
    txn.status = "pending";
    await txn.save();
    console.log(`[verify-payment] Reset failed transaction ${orderId} to pending for re-check`);
  }

  // 3. Poll Cashfree API to check real payment status
  const baseUrl = process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

  const cfRes = await cashfreeClient.get(`${baseUrl}/orders/${orderId}/payments`);

  const payments = cfRes.data;
  const successfulPayment = Array.isArray(payments)
    ? payments.find((p) => p.payment_status === "SUCCESS")
    : null;

  if (!successfulPayment) {
    // Payment not yet successful
    txn.status = "failed";
    await txn.save();
    return res.status(200).json(
      new ApiResponse(200, false, "Payment not successful", { balance: 0 })
    );
  }

  // Security Check: Verify if the amount paid matches the amount requested
  // Cashfree returns payment_amount in Rupees, our DB stores totalAmount in Paise
  const paidAmountInPaise = Math.round(successfulPayment.payment_amount * 100);
  if (paidAmountInPaise !== txn.totalAmount) {
    console.error(`[verify-payment] Amount mismatch for ${orderId}. Expected: ${txn.totalAmount}, Paid: ${paidAmountInPaise}`);
    txn.status = "failed";
    await txn.save();
    return res.status(400).json(
      new ApiResponse(400, false, "Payment amount mismatch detected. Transaction failed.", { balance: 0 })
    );
  }

  // 4. Idempotency: mark success atomically
  const updated = await WalletTransaction.findOneAndUpdate(
    { transactionId: orderId, status: "pending" },
    { status: "success", paymentDetails: successfulPayment },
    { new: true }
  );

  if (!updated) {
    // Already credited by webhook — just return balance
    const wallet = await Wallet.findOne({ userId });
    return res.status(200).json(
      new ApiResponse(200, true, "Already credited", { balance: wallet?.balance || 0 })
    );
  }

  // 5. Credit the wallet
  const wallet = await Wallet.findOneAndUpdate(
    { userId },
    { $inc: { balance: updated.depositAmount } },
    { new: true, upsert: true }
  );

  console.log(`[verify-payment] Credited ₹${updated.depositAmount / 100} to User ${userId} for ${orderId}`);

  return res.status(200).json(
    new ApiResponse(200, true, "Wallet credited successfully!", { balance: wallet.balance })
  );
});

/**
 * GET /api/v1/user/wallet/transactions
 * Retrieve transaction history for the authenticated user.
 */
const getWalletTransactions = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const transactions = await WalletTransaction.find({ userId }).sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, true, "Transactions retrieved successfully", transactions)
  );
});

/**
 * GET /api/v1/user/stocks
 * Public endpoint — returns all active stocks from the database.
 * No authentication required so unauthenticated users can browse the market.
 * Authentication is only enforced at the order placement step.
 */
const getPublicStocks = asyncHandler(async (_req, res) => {
  const stocks = await Stock.find({ isActive: true }).sort({ name: 1 });

  return res.status(200).json(
    new ApiResponse(200, true, "Active stocks fetched successfully!", stocks)
  );
});
/**
 * POST /api/v1/user/wallet/withdraw
 * User requests withdrawal of funds to their verified bank account.
 */
/*
SECURITY: Uses MongoDB _id for routing (unguessable BOLA protection).
OTXW1001 withdrawId is display-only — never used in API URLs.
Ownership verified via userId: req.user._id on all user routes.
ACID Transaction & DB Cooldown Constraints active.
*/
const requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount } = req.body; // Amount requested in paise

  // Enforce limits (amounts in Paise: 100000 = ₹1,000 min, 10000000 = ₹1,00,000 max)
  if (!amount || amount < 100000 || amount > 10000000) {
    throw new ApiError(400, "Withdrawal amount must be between ₹1,000 (minimum) and ₹1,00,000 (maximum).");
  }

  const userId = req.user._id;

  // Verify Bank Details exist for the user
  const bank = await Kyc.findOne({ userId });
  if (!bank || !bank.accountNumber || !bank.ifscCode) {
    throw new ApiError(400, "Please complete your Bank verification before requesting a withdrawal.");
  }

  // Option A (Inclusive Fee Math)
  const requestedAmount = amount;
  const feeAmount = Math.round(requestedAmount * 0.02);
  const gstAmount = Math.round(feeAmount * 0.18);
  const totalDeductions = feeAmount + gstAmount;
  const netAmountToBank = requestedAmount - totalDeductions;

  const totalDeduction = requestedAmount; // We deduct exactly what they requested

  // Start MongoDB ACID Transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Step 1: Atomically find wallet and deduct ONLY if sufficient balance exists
    const wallet = await Wallet.findOneAndUpdate(
      { userId, balance: { $gte: totalDeduction } },
      { $inc: { balance: -totalDeduction } },
      { new: true, session }
    );

    if (!wallet) {
      throw new ApiError(400, "Insufficient wallet balance.");
    }

    // Step 2: Generate Custom Withdrawal ID
    const counter = await Counter.findByIdAndUpdate(
      { _id: "withdrawId" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );
    const customWithdrawId = `OTXW${1000 + counter.seq}`;

    // Step 3: Create Withdrawal Request
    // Note: The unique partial index on { userId: 1, status: 1 } will automatically
    // throw an E11000 duplicate key error here if the user already has a "Pending" request,
    // thereby aborting the transaction and rolling back the wallet deduction.
    const withdrawal = new WithdrawalRequest({
      withdrawId: customWithdrawId,
      userId,
      amount: totalDeduction,
      feeAmount,
      gstAmount,
      netAmountToBank,
      bankDetails: {
        accountNumber: bank.accountNumber,
        ifscCode: bank.ifscCode,
        accountHolder: bank.accountHolderName,
        bankName: bank.bankName,
      },
      status: "Pending",
    });

    await withdrawal.save({ session });

    // Step 4: Log Wallet Transaction
    await WalletTransaction.create(
      [
        {
          userId,
          transactionId: customWithdrawId,
          type: "withdrawal",
          totalAmount: totalDeduction,
          depositAmount: 0,
          gatewayFee: feeAmount,
          gst: gstAmount,
          netAmountToBank: netAmountToBank, // Explicit tracking
          description: `Withdrawal: ₹${requestedAmount / 100} requested. Fee: ₹${totalDeductions / 100}. Bank receives: ₹${netAmountToBank / 100}`,
          status: "pending",
        },
      ],
      { session }
    );

    // Commit Transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json(
      new ApiResponse(200, true, "Withdrawal request submitted successfully", {
        withdrawId: customWithdrawId,
        netAmountToBank,
      })
    );
  } catch (error) {
    // Abort Transaction only if it hasn't been committed yet
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    console.error("Withdrawal Error:", JSON.stringify(error, null, 2), error.message);

    // If it's already a known ApiError (e.g. 400 Insufficient balance), re-throw directly
    if (error instanceof ApiError) {
      throw error;
    }

    // Only catch the specific DB Cooldown Index for Pending requests
    if (error.code === 11000 && error.keyPattern && error.keyPattern.userId && error.keyPattern.status) {
      throw new ApiError(400, "You already have a pending withdrawal request.");
    }

    // If it's a different 11000 error (e.g., withdrawId clash) or unexpected failure, throw 500
    throw new ApiError(500, "Transaction failed: " + error.message);
  }
});

/*
SECURITY: Uses MongoDB _id for routing (unguessable BOLA protection).
OTXW1001 withdrawId is display-only — never used in API URLs.
Ownership verified via userId: req.user._id on all user routes.
ACID Transaction & DB Cooldown Constraints active.
*/
const getUserWithdrawals = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Strict projection to ensure 100% network tab security
  const rawWithdrawals = await WithdrawalRequest.find({ userId })
    .select("-__v -userId -updatedAt -processedBy")
    .sort({ createdAt: -1 })
    .lean();

  const withdrawals = rawWithdrawals.map(w => {
    let maskedAccount = null;
    if (w.bankDetails && w.bankDetails.accountNumber) {
      try {
        const decryptedAcc = decrypt(w.bankDetails.accountNumber);
        maskedAccount = "XXXX" + decryptedAcc.slice(-4);
      } catch (err) {
        // Fallback if it wasn't encrypted for some reason
        maskedAccount = "XXXX" + w.bankDetails.accountNumber.slice(-4);
      }
    }

    let plainIfsc = null;
    if (w.bankDetails && w.bankDetails.ifscCode) {
      try {
        plainIfsc = decrypt(w.bankDetails.ifscCode);
      } catch (err) {
        // Fallback: value was stored unencrypted
        plainIfsc = w.bankDetails.ifscCode;
      }
    }

    return {
      ...w,
      bankDetails: w.bankDetails
        ? {
            bankName: w.bankDetails.bankName || null,
            accountHolder: w.bankDetails.accountHolder || null,
            accountNumber: maskedAccount,
            ifscCode: plainIfsc,
          }
        : null,
    };
  });

  return res.status(200).json(
    new ApiResponse(200, true, "User withdrawals fetched successfully", withdrawals)
  );
});

/**
 * GET /api/v1/user/withdrawals/:id
 * Fetch detailed information for a specific withdrawal request.
 * Returns full fee breakdown, bank details, processing info, and timeline.
 */
const getWithdrawalDetails = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  // Find by withdrawId (e.g. OTXW1001) and ensure ownership
  const withdrawal = await WithdrawalRequest.findOne({
    withdrawId: id,
    userId
  })
  .populate("processedBy", "name")
  .lean();

  if (!withdrawal) {
    throw new ApiError(404, "Withdrawal request not found");
  }

  // Build a clean, production-ready response
  const responseData = {
    withdrawId: withdrawal.withdrawId,
    status: withdrawal.status,
    // Fee breakdown (all values in Paise)
    feeBreakdown: {
      requestedAmount: withdrawal.amount,
      feeAmount: withdrawal.feeAmount,
      gstAmount: withdrawal.gstAmount,
      totalDeductions: withdrawal.feeAmount + withdrawal.gstAmount,
      netAmountToBank: withdrawal.netAmountToBank,
    },
    // Human-readable amounts in Rupees
    feeBreakdownInRupees: {
      requestedAmount: (withdrawal.amount / 100).toFixed(2),
      feeAmount: (withdrawal.feeAmount / 100).toFixed(2),
      gstAmount: (withdrawal.gstAmount / 100).toFixed(2),
      totalDeductions: ((withdrawal.feeAmount + withdrawal.gstAmount) / 100).toFixed(2),
      netAmountToBank: (withdrawal.netAmountToBank / 100).toFixed(2),
    },
    // Bank details (encrypted in DB, shown masked)
    bankDetails: {
      accountHolder: withdrawal.bankDetails?.accountHolder || null,
      bankName: withdrawal.bankDetails?.bankName || null,
      // Mask account number for security (show last 4 digits only)
      accountNumber: (() => {
        if (!withdrawal.bankDetails?.accountNumber) return null;
        try {
          const decrypted = decrypt(withdrawal.bankDetails.accountNumber);
          return "XXXX" + decrypted.slice(-4);
        } catch (e) {
          return "XXXX" + withdrawal.bankDetails.accountNumber.slice(-4);
        }
      })(),
      ifscCode: (() => {
        if (!withdrawal.bankDetails?.ifscCode) return null;
        try {
          return decrypt(withdrawal.bankDetails.ifscCode);
        } catch (e) {
          // Fallback: value was stored unencrypted
          return withdrawal.bankDetails.ifscCode;
        }
      })(),
    },
    // Processing info
    processedBy: withdrawal.processedBy?.name || null,
    processedAt: withdrawal.processedAt || null,
    utrNumber: withdrawal.utrNumber || null,
    cashfreeReferenceId: withdrawal.cashfreeReferenceId || null,
    rejectionReason: withdrawal.rejectionReason || null,
    adminNote: withdrawal.adminNote || null,
    // Timeline
    createdAt: withdrawal.createdAt,
  };

  return res.status(200).json(
    new ApiResponse(200, true, "Withdrawal details fetched successfully", responseData)
  );
});

/**
 * POST /api/v1/user/profile/request-closure
 * User initiates an account closure request
 */
const requestAccountClosure = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  if (req.user.accountStatus === "Closed") {
    throw new ApiError(400, "Your account is already closed.");
  }
  if (req.user.accountStatus === "OnHold") {
    throw new ApiError(400, "Your account closure request is already pending review.");
  }

  // Calculate snapshot
  // "pending" matches the Order schema enum exactly (lowercase).
  // Previously used "Pending_Admin_Approval" which never matched any DB document,
  // causing this snapshot to always show 0 pending orders — a misleading count for admins.
  const pendingOrders = await Order.countDocuments({ userId, status: "pending" });
  const pendingWithdrawals = await WithdrawalRequest.countDocuments({ userId, status: "Pending" });
  const wallet = await Wallet.findOne({ userId });
  const walletBalance = wallet ? wallet.balance : 0;

  // Create closure request
  await AccountClosure.create({
    userId,
    state: "Pending",
    pendingSnapshot: {
      pendingOrders,
      pendingWithdrawals,
      walletBalance,
    }
  });

  // Update user status to OnHold
  await User.findByIdAndUpdate(userId, { accountStatus: "OnHold" });

  return res.status(200).json(
    new ApiResponse(200, true, "Account closure request submitted successfully. Our team will contact you shortly.")
  );
});

/**
 * GET /api/v1/user/export-data
 * Allows both active and closed users (within 30 days) to download their ledger data.
 */
const exportUserData = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Check 30-day grace period for closed accounts
  if (req.user.accountStatus === "Closed") {
    const closure = await AccountClosure.findOne({ userId, state: "Approved" }).sort({ processedAt: -1 });
    if (closure && closure.processedAt) {
      const daysSinceClosure = (new Date() - closure.processedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceClosure > 30) {
        throw new ApiError(403, "Your 30-day data grace period has expired.", "GRACE_PERIOD_EXPIRED");
      }
    }
  }

  const user = await User.findById(userId).select("name email phone");
  const wallet = await Wallet.findOne({ userId });
  const transactions = await WalletTransaction.find({ userId }).sort({ createdAt: -1 });
  const orders = await Order.find({ userId }).sort({ createdAt: -1 });
  const withdrawals = await WithdrawalRequest.find({ userId }).sort({ createdAt: -1 });

  const exportData = {
    userInfo: user,
    walletBalance: wallet ? wallet.balance / 100 : 0,
    walletTransactions: transactions,
    orders: orders,
    withdrawals: withdrawals,
    exportedAt: new Date()
  };

  return res.status(200).json(
    new ApiResponse(200, true, "Data exported successfully", exportData)
  );
});

const sendVerificationOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  // Check if phone already exists for another user
  const existingUser = await User.findOne({
    phone,
    _id: { $ne: req.session.userId },
  });

  if (existingUser) {
    throw new ApiError(400, "Phone number already registered with another account!");
  }

  await generateAndCacheOtp(phone);
  return res.status(200).json(new ApiResponse(200, true, "OTP sent successfully via WhatsApp!"));
});

const verifyPhoneOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  // Check if phone already exists for another user just in case
  const existingUser = await User.findOne({
    phone,
    _id: { $ne: req.session.userId },
  });

  if (existingUser) {
    throw new ApiError(400, "Phone number already registered with another account!");
  }

  const isOtpValid = await verifyOtp(phone, otp);
  if (!isOtpValid) throw new ApiError(400, "Invalid or Expired OTP!");

  const updatedUser = await User.findByIdAndUpdate(
    req.session.userId,
    {
      phone: Number(phone),
      verified_phone: true,
    },
    { new: true }
  );

  if (!updatedUser) throw new ApiError(404, "User not found!");

  res.status(200).json(new ApiResponse(200, true, "Phone number verified successfully!", sanitizeUser(updatedUser)));
});

export {
  googleAuth,
  googleAuthCallback,
  sendOtp,
  signup,
  verifyEmail,
  login,
  loginOtp,
  logout,
  forgetPin,
  resetPin,
  resetPassword,
  updateAccountInfo,
  updateEmail,
  updatePhoneNumber,
  enquiry,
  getUserProfile,
  getFullProfile,
  updateProfile,
  getKycDetails,
  updateKycDetails,
  getDematDetails,
  updateDematDetails,
  getBankDetails,
  updateBankDetails,
  createOrder,
  getUserOrders,
  getPortfolioSummary,
  getWalletBalance,
  initiateDeposit,
  handleCashfreeWebhook,
  verifyPaymentAndCredit,
  getWalletTransactions,
  getPublicStocks,
  requestWithdrawal,
  getUserWithdrawals,
  getOrderDetails,
  getWithdrawalDetails,
  requestAccountClosure,
  exportUserData,
  sendVerificationOtp,
  verifyPhoneOtp,
};
