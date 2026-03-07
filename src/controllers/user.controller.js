import bcrypt from "bcrypt";
import crypto from "crypto";
import { User } from "../models/user.model.js";
import { Token } from "../models/token.model.js";
import { Inquiry } from "../models/inquiry.model.js";
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
  delete userObj.password;
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

  const emailResult = await SENDMAIL(email, link);

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
      req.session.userId = existingUser._id;
      return res.redirect(`/?profilePic=${googleUser.picture}`);
    }

    // Create new user
    const newUser = await User.create({
      email: googleUser.email,
      name: googleUser.name,
      verified_email: googleUser.verified_email,
    });

    if (!newUser) throw new ApiError(500, "Failed To Create User!");

    req.session.userId = newUser._id;
    res.redirect(`/?profilePic=${googleUser.picture}`);
  } catch (error) {
    console.log("Error In Callback: ", error);
    res.redirect(`/oauth/Failed To Authenticate!`);
  }
}

const signup = asyncHandler(async (req, res) => {
  if (req.session.userId) return res.redirect("/");

  let { phone, email, password, name } = req.body;

  if (email) email = email.toLowerCase();

  const existedUser = await User.findOne({
    $or: [
      { phone: { $exists: true, $eq: phone } },
      { email: { $exists: true, $eq: email } },
    ],
  });

  if (existedUser)
    throw new ApiError(
      400,
      "This Email Or Phone Number Is Already Registered!"
    );

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    email: email,
    password: hashedPassword,
    name: name,
  });

  if (!newUser) throw new ApiError(500, "Failed To Create User!");

  // Send verification email using helper function
  await sendVerificationEmail(email, newUser._id);

  req.session.userId = newUser._id;
  res
    .status(200)
    .json(new ApiResponse(200, true, "User registered successfully!"));
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
  let { phone, email, password } = req.body;

  if (email) email = email.toLowerCase();

  const user = await User.findOne({
    $or: [
      { phone: { $exists: true, $eq: phone } },
      { email: { $exists: true, $eq: email } },
    ],
  });

  if (!user) throw new ApiError(404, "User doesn't exist!");

  if (!user.password)
    throw new ApiError(
      400,
      "Password Not Set For This Account Please Set The Password Or Use Google Sign On!"
    );

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) throw new ApiError(400, "Incorrect Password!");

  req.session.regenerate((err) => {
    if (err) throw new ApiError(500, "Session regeneration failed");

    // Attach auth data to the new session
    req.session.userId = user._id;

    // Return user data (sanitized)
    const userData = sanitizeUser(user);

    res.status(200).json(new ApiResponse(200, userData, "Login Successful!"));
  });
});

const logout = asyncHandler(async (req, res) => {
  await new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  res.clearCookie("sessionId", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

const forgetPassword = asyncHandler(async (req, res) => {
  let { email } = req.body;

  email = email.toLowerCase();

  const user = await User.findOne({ email });
  if (!user) throw new ApiError(400, "No user found with this email!");

  // Generate reset token
  const token = createToken(email);
  if (!token) throw new ApiError(500, "Failed to create reset token!");

  // Create token in database with type and expiry
  const newToken = await Token.create({
    userId: user._id,
    token: token,
    type: "password_reset",
    expiresAt: Date.now() + 3600000, // 1 hour from now
  });

  if (!newToken) throw new ApiError(500, "Failed to save reset token!");

  // Build reset link
  const ORIGIN =
    process.env.NODE_ENV === "production"
      ? process.env.PROD_ORIGIN
      : process.env.DEV_ORIGIN;

  const resetLink = `${ORIGIN}/api/v1/user/resetPassword?token=${token}`;

  // Send email
  const emailResult = await SENDMAIL(email, resetLink);

  if (!emailResult.success) {
    console.error("Failed to send reset email:", emailResult.error);
    throw new ApiError(500, "Failed to send reset email!");
  }

  console.log("Password reset email sent!", emailResult.messageId);

  res.status(200).json({
    success: true,
    message: "Password reset link sent successfully! Link expires in 1 hour.",
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.query;
  const { password, confirmPassword } = req.body;

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
  ).select("-__v -password -resetPasswordTokenHash -resetPasswordExpiresAt");

  if (!updatedUser) throw new ApiError(500, "Failed TO Update User!");

  res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Updated Successfully!"));
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
  ).select("-__v -password -resetPasswordTokenHash -resetPasswordExpiresAt");

  if (!user) throw new ApiError(404, "User not found!");

  // Send verification email using helper function
  await sendVerificationEmail(email, user._id);

  res.status(200).json({
    success: true,
    message:
      "Email updated successfully! Please check your inbox to verify your new email.",
    data: user,
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
  ).select("-__v -password -resetPasswordTokenHash -resetPasswordExpiresAt");

  if (!user) throw new ApiError(404, "User not found!");

  res.status(200).json({
    success: true,
    message: "Phone number updated successfully!",
    data: user,
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
  const userId = req.userId;

  const user = await User.findById(userId).select(
    "-__v -password -resetPasswordTokenHash -resetPasswordExpiresAt"
  );
  if (!user) throw new ApiError(404, "User not found!");

  res
    .status(200)
    .json(new ApiResponse({ statusCode: 200, success: true, data: user }));
});

export {
  googleAuth,
  googleAuthCallback,
  signup,
  verifyEmail,
  login,
  logout,
  forgetPassword,
  resetPassword,
  updateAccountInfo,
  updateEmail,
  updatePhoneNumber,
  enquiry,
  getUserProfile,
};
