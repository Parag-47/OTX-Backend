import mongoose from "mongoose";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Kyc } from "../models/kyc.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { User } from "../models/user.model.js";
import { WithdrawalRequest } from "../models/withdrawal.model.js";
import bcrypt from "bcrypt";
import { valkey } from "../db/valkey.js";
import {
  verifyPan as verifyPanService,
  sendAadhaarOtp as sendAadhaarOtpService,
  verifyAadhaarOtp as verifyAadhaarOtpService,
  verifyBankAccount as verifyBankAccountService,
} from "../services/verification.service.js";
import { encrypt, decrypt, hashDeterministic } from "../utils/encryption.js";
import { verifyNameMatch } from "../utils/nameMatcher.js";

/**
 * Helper to mask sensitive strings to only the last 4 digits
 * (e.g. XXXXXXXX1234 or ••••••••1234)
 */
const maskData = (str) => {
  if (!str || str.length < 4) return str;
  return str.slice(-4).padStart(str.length, "X");
};

/**
 * Maps MongoDB duplicate key error (E11000) to clear, user-facing 400 ApiError
 */
const handleDuplicateKeyError = (error) => {
  if (error?.code === 11000 || (error?.name === "MongoServerError" && error?.code === 11000)) {
    const keyPattern = error.keyPattern || {};
    const errString = error.message || "";
    if (keyPattern.panHash || errString.includes("panHash")) {
      throw new ApiError(400, "This PAN card is already linked to another OneTimeX account.");
    }
    if (keyPattern.aadhaarHash || errString.includes("aadhaarHash")) {
      throw new ApiError(400, "This Aadhaar card is already linked and verified with another OneTimeX account.");
    }
    if (keyPattern.bankHash || errString.includes("bankHash")) {
      throw new ApiError(400, "This bank account is already linked to another OneTimeX account.");
    }
    if (keyPattern.userId || errString.includes("userId")) {
      throw new ApiError(400, "A KYC record already exists for this account.");
    }
    throw new ApiError(400, "A duplicate KYC record already exists.");
  }
};

/**
 * Persists KYC document update and AuditLog atomically within a MongoDB session
 * Ensures a failure cannot commit a KYC update without its required audit record.
 */
const saveKycWithAudit = async (kycDoc, auditData) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await kycDoc.save({ session });
    await AuditLog.create([auditData], { session });
    await session.commitTransaction();
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    // Graceful fallback for standalone dev databases lacking replica set support
    if (error.message && error.message.includes("Transaction numbers are only allowed on a replica set member or mongos")) {
      try {
        await kycDoc.save();
        await AuditLog.create(auditData);
        return;
      } catch (fallbackError) {
        handleDuplicateKeyError(fallbackError);
        throw fallbackError;
      }
    }
    handleDuplicateKeyError(error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * GET /api/v1/kyc/status
 * Returns current KYC verification status for the frontend stepper.
 * READ-ONLY — no rate limiter applied.
 */
export const getKycStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const kyc = await Kyc.findOne({ userId }).lean();

  let maskedAccountNumber = null;
  let ifsc = null;
  if (kyc?.accountNumber) {
    try {
      const dec = decrypt(kyc.accountNumber);
      maskedAccountNumber = dec ? `••••••••${dec.slice(-4)}` : null;
    } catch (e) {
      maskedAccountNumber = `••••••••${kyc.accountNumber.slice(-4)}`;
    }
  }

  if (kyc?.ifscCode) {
    try {
      ifsc = decrypt(kyc.ifscCode);
    } catch (e) {
      ifsc = kyc.ifscCode;
    }
  }

  const status = {
    panVerified: kyc?.panVerified || false,
    panName: kyc?.panName || null,
    aadhaarVerified: kyc?.aadhaarVerified || false,
    aadhaarName: kyc?.aadhaarName || null,
    maskedAadhaar: kyc?.aadhaarLast4 ? `XXXXXXXX${kyc.aadhaarLast4}` : null,
    bankVerified: kyc?.bankVerified || false,
    bankRegisteredName: kyc?.bankRegisteredName || kyc?.accountHolderName || null,
    accountHolderName: kyc?.bankRegisteredName || kyc?.accountHolderName || null,
    bankName: kyc?.bankName || null,
    maskedAccountNumber,
    ifscCode: ifsc,
    address: kyc?.address || null,
  };

  return res.status(200).json(
    new ApiResponse(200, true, "KYC status fetched successfully", status)
  );
});

/**
 * STEP 1: Verify PAN Card
 * POST /api/v1/kyc/verify/pan
 * Body: { panNumber }
 *
 * Verifies PAN with Income Tax Department / NSDL via Cashfree.
 * Enforces format validation, account uniqueness, and records audit trail.
 */
export const verifyPan = asyncHandler(async (req, res) => {
  const { panNumber } = req.body;
  const userId = req.user._id;

  if (!panNumber) {
    throw new ApiError(400, "PAN number is required");
  }

  const cleanPan = panNumber.toUpperCase().trim();

  // Strict NSDL / ITD format check: 5 uppercase letters + 4 digits + 1 uppercase letter
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(cleanPan)) {
    throw new ApiError(400, "Invalid PAN number format (e.g. ABCDE1234F)");
  }

  const panHash = hashDeterministic(cleanPan);

  // 1. Check if already verified on THIS account
  let kyc = await Kyc.findOne({ userId });
  if (kyc && kyc.panVerified) {
    throw new ApiError(400, "PAN is already verified on your account");
  }

  // 2. GLOBAL UNIQUENESS CHECK: Ensure PAN is not verified on ANY other account
  let existingPan = await Kyc.findOne({
    panHash,
    panVerified: true,
    userId: { $ne: userId },
  });

  if (!existingPan) {
    // Check legacy records where panHash was not indexed
    const legacyKycs = await Kyc.find({
      panHash: { $exists: false },
      panVerified: true,
      panNumber: { $exists: true, $ne: null },
      userId: { $ne: userId },
    }).lean();

    for (const old of legacyKycs) {
      try {
        const dec = decrypt(old.panNumber);
        if (dec && dec.toUpperCase().trim() === cleanPan) {
          existingPan = old;
          await Kyc.updateOne({ _id: old._id }, { $set: { panHash } }).catch((err) => {
            console.error("Legacy panHash backfill failed:", err?.message);
          });
          break;
        }
      } catch (e) { }
    }
  }

  if (existingPan) {
    throw new ApiError(400, "This PAN card is already linked and verified with another OneTimeX account.");
  }

  // 3. Call Cashfree PAN verification service
  let cashfreeResponse;
  try {
    cashfreeResponse = await verifyPanService(cleanPan);
  } catch (error) {
    console.error("Cashfree PAN Verification API error:", error?.response?.data || error.message);
    const msg = error.response?.data?.message || "Failed to verify PAN with Income Tax Department records";
    throw new ApiError(400, msg);
  }

  // Support both direct response and nested data wrapper
  const resData = cashfreeResponse?.data || cashfreeResponse;
  const isValid =
    resData?.valid === true ||
    resData?.valid === "true" ||
    String(resData?.pan_status || "").toUpperCase() === "VALID";

  const registeredName =
    resData?.registered_name ||
    resData?.registeredName ||
    resData?.name ||
    cashfreeResponse?.registered_name;

  if (!isValid) {
    throw new ApiError(400, resData?.message || "Invalid PAN card details provided or PAN is not active");
  }

  if (!registeredName) {
    throw new ApiError(500, "Failed to retrieve registered name from Income Tax Department (NSDL)");
  }

  // 4. Update KYC record (Encrypted PAN + deterministic hash index)
  if (!kyc) {
    kyc = new Kyc({ userId });
  }

  kyc.panNumber = encrypt(cleanPan);
  kyc.panHash = panHash;
  kyc.panVerified = true;
  kyc.panName = registeredName;

  // 5. Atomic KYC State & Audit Log persistence
  await saveKycWithAudit(kyc, {
    userId,
    action: "KYC_PAN_VERIFIED",
    metadata: {
      panLast4: maskData(cleanPan),
    },
    ipAddress: req.ip || "Unknown",
    userAgent: req.headers["user-agent"] || "Unknown",
  });

  return res.status(200).json(
    new ApiResponse(200, true, "PAN Verified Successfully", { panName: registeredName })
  );
});

/**
 * STEP 2A: Send Aadhaar OTP
 * POST /api/v1/kyc/verify/aadhaar/send
 * Body: { aadhaarNumber }
 *
 * Initiates Paperless Offline e-KYC (OKYC) with UIDAI via Cashfree.
 * ENFORCEMENT: Step 1 (PAN) must be verified first.
 */
export const sendAadhaarOtp = asyncHandler(async (req, res) => {
  const { aadhaarNumber } = req.body;
  const userId = req.user._id;

  if (!aadhaarNumber) {
    throw new ApiError(400, "Aadhaar number is required");
  }

  // 1. Check existing KYC status — PAN must be verified first
  const kyc = await Kyc.findOne({ userId });
  if (!kyc?.panVerified) {
    throw new ApiError(400, "Please complete Step 1 (PAN Verification) first before Aadhaar verification");
  }

  if (kyc.aadhaarVerified) {
    throw new ApiError(400, "Aadhaar is already verified on your account");
  }

  // 2. Validate clean 12-digit format (UIDAI standard: 12 digits, starts with 2-9)
  const cleanAadhaar = String(aadhaarNumber).replace(/\D/g, "");
  if (cleanAadhaar.length !== 12 || !/^[2-9]\d{11}$/.test(cleanAadhaar)) {
    throw new ApiError(400, "Invalid Aadhaar number. Aadhaar must be a 12-digit numeric identity.");
  }

  const aadhaarHash = hashDeterministic(cleanAadhaar);

  // 3. GLOBAL UNIQUENESS CHECK: Ensure Aadhaar is not linked to any other account
  const existingAadhaar = await Kyc.findOne({
    aadhaarHash,
    aadhaarVerified: true,
    userId: { $ne: userId },
  });

  if (existingAadhaar) {
    throw new ApiError(400, "This Aadhaar card is already linked and verified with another OneTimeX account.");
  }

  // 4. Call Cashfree to trigger UIDAI OTP
  let cashfreeResponse;
  try {
    cashfreeResponse = await sendAadhaarOtpService(cleanAadhaar);
  } catch (error) {
    console.error("Cashfree Send Aadhaar OTP error:", error?.response?.data || error.message);
    const msg = error.response?.data?.message || "Failed to send Aadhaar OTP. Please verify your Aadhaar number.";
    throw new ApiError(400, msg);
  }

  const ref_id =
    cashfreeResponse?.ref_id ||
    cashfreeResponse?.reference_id ||
    cashfreeResponse?.data?.ref_id ||
    cashfreeResponse?.data?.reference_id;

  if (!ref_id) {
    throw new ApiError(500, "Failed to initiate verification session with UIDAI");
  }

  // 5. Store session in Valkey with 600-second (10 min) TTL
  // Strict UIDAI Compliance: full 12 digits are NEVER cached; only the last 4 digits and deterministic hash
  const sessionData = JSON.stringify({
    refId: String(ref_id),
    last4: cleanAadhaar.slice(-4),
    hash: aadhaarHash,
  });
  await valkey.setex(`aadhaar_sess:${userId}`, 600, sessionData);

  // Return success without exposing internal ref_id to the client
  return res.status(200).json(
    new ApiResponse(200, true, "OTP sent successfully to your Aadhaar-registered mobile number", null)
  );
});

/**
 * STEP 2B: Verify Aadhaar OTP
 * POST /api/v1/kyc/verify/aadhaar/verify
 * Body: { otp }
 *
 * Verifies OTP with UIDAI, cross-matches UIDAI name with verified NSDL PAN name (>= 70% composite match),
 * records UIDAI-verified address, and purges temporary memory caches.
 */
export const verifyAadhaarOtp = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const userId = req.user._id;

  if (!otp) {
    throw new ApiError(400, "OTP is required");
  }

  const cleanOtp = String(otp).trim();
  if (!/^[0-9]{6}$/.test(cleanOtp)) {
    throw new ApiError(400, "Aadhaar OTP must be exactly 6 digits");
  }

  // 1. Fetch KYC record (PAN must be verified)
  const kyc = await Kyc.findOne({ userId });
  if (!kyc?.panVerified) {
    throw new ApiError(400, "Please verify your PAN card first");
  }

  if (kyc.aadhaarVerified) {
    throw new ApiError(400, "Aadhaar is already verified on your account");
  }

  // 2. Retrieve session from Valkey once before external verification
  const sessionRaw = await valkey.get(`aadhaar_sess:${userId}`);
  if (!sessionRaw) {
    throw new ApiError(400, "OTP session has expired. Please request a new OTP.");
  }

  let session;
  try {
    session = JSON.parse(sessionRaw);
  } catch {
    throw new ApiError(400, "Invalid OTP session data. Please request a new OTP.");
  }

  const { refId, last4: cachedLast4, hash: aadhaarHash } = session || {};
  if (!refId || !cachedLast4 || !aadhaarHash) {
    throw new ApiError(400, "Aadhaar verification session has expired. Please request a new OTP.");
  }

  // 3. Verify OTP with UIDAI via Cashfree
  let cashfreeResponse;
  try {
    cashfreeResponse = await verifyAadhaarOtpService(refId, cleanOtp);
  } catch (error) {
    console.error("Cashfree Verify Aadhaar OTP error:", error?.response?.data || error.message);
    const msg = error.response?.data?.message || "Aadhaar OTP verification failed. Please enter the correct OTP.";
    throw new ApiError(400, msg);
  }

  const resData = cashfreeResponse?.data || cashfreeResponse;
  const status = String(resData?.status || cashfreeResponse?.status || "").toUpperCase();
  const aadhaarName = resData?.name || cashfreeResponse?.name;
  const address = resData?.address || cashfreeResponse?.address;

  if (status !== "VALID" && status !== "SUCCESS") {
    throw new ApiError(400, resData?.message || "Invalid Aadhaar OTP or verification rejected by UIDAI");
  }

  if (!aadhaarName) {
    throw new ApiError(500, "Failed to retrieve verified name from UIDAI records");
  }

  // 4. IDENTITY CROSS-MATCH (PMLA / SEBI standard):
  //    Compares UIDAI aadhaarName against NSDL panName using composite Token Sort + Token Set + Levenshtein.
  //    In production, mock bypass is strictly disabled.
  const nameCheck = verifyNameMatch(kyc.panName, aadhaarName, 70);

  if (!nameCheck.matched) {
    throw new ApiError(
      400,
      "Identity mismatch between your PAN and Aadhaar records. Both documents must belong to the same individual."
    );
  }

  // 5. Global cross-account duplicate check before saving
  const duplicateAadhaar = await Kyc.findOne({
    aadhaarHash,
    aadhaarVerified: true,
    userId: { $ne: userId },
  });
  if (duplicateAadhaar) {
    throw new ApiError(400, "This Aadhaar card is already linked and verified with another OneTimeX account.");
  }

  // 6. Update KYC Model (UIDAI Compliant: NEVER persist 12 digits, store ONLY last-4 digits + non-reversible blind index)
  kyc.aadhaarHash = aadhaarHash;
  kyc.aadhaarVerified = true;
  kyc.aadhaarName = aadhaarName;
  kyc.aadhaarLast4 = cachedLast4;

  // Save official UIDAI address if available
  if (address) {
    kyc.address = String(address).slice(0, 500);
  }

  // 7. Atomic KYC State & Audit Log persistence
  await saveKycWithAudit(kyc, {
    userId,
    action: "KYC_AADHAAR_VERIFIED",
    metadata: {
      aadhaarLast4: `XXXXXXXX${cachedLast4}`,
      similarityScore: nameCheck.score,
    },
    ipAddress: req.ip || "Unknown",
    userAgent: req.headers["user-agent"] || "Unknown",
  });

  // 8. PURGE EPHEMERAL VALKEY SESSION IMMEDIATELY (UIDAI Security & Privacy requirement)
  try {
    await valkey.del(`aadhaar_sess:${userId}`);
  } catch (e) {
    console.error("Valkey cleanup error:", e.message);
  }

  return res.status(200).json(
    new ApiResponse(200, true, "Aadhaar Verified Successfully", {
      aadhaarName,
      address: kyc.address,
    })
  );
});

/**
 * STEP 4: Verify Bank Account (NPCI Penny Drop)
 * POST /api/v1/kyc/verify/bank
 * Body: { accountNumber, ifscCode }
 *
 * Verifies bank account via Cashfree Penny Drop / IMPS real-time sync.
 * Cross-matches account holder name returned by bank with verified PAN identity.
 */
export const verifyBankAccount = asyncHandler(async (req, res) => {
  const { accountNumber, ifscCode } = req.body;
  const userId = req.user._id;

  if (!accountNumber || !ifscCode) {
    throw new ApiError(400, "Bank account number and IFSC code are required");
  }

  const cleanAccount = String(accountNumber).replace(/\D/g, "").trim();
  const cleanIfsc = String(ifscCode).toUpperCase().trim();

  if (cleanAccount.length < 9 || cleanAccount.length > 18) {
    throw new ApiError(400, "Bank account number must be between 9 and 18 digits");
  }

  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(cleanIfsc)) {
    throw new ApiError(400, "Invalid IFSC Code format (e.g. SBIN0001234 or HDFC0000001)");
  }

  // 1. User MUST have verified PAN and Aadhaar first
  const kyc = await Kyc.findOne({ userId });

  if (!kyc?.panVerified || !kyc?.aadhaarVerified) {
    throw new ApiError(400, "Please complete PAN and Aadhaar verification before adding a bank account");
  }

  if (kyc.bankVerified) {
    throw new ApiError(400, "A bank account is already verified on your profile. Remove existing account first to change.");
  }

  // 2. GLOBAL UNIQUENESS CHECK: Ensure this bank account is not linked to any other user
  const bankHash = hashDeterministic(`${cleanAccount}:${cleanIfsc}`);

  const existingBank = await Kyc.findOne({ bankHash, userId: { $ne: userId } });
  if (existingBank) {
    throw new ApiError(400, "This bank account is already linked to another OneTimeX account.");
  }

  // 3. Call Cashfree Bank Account Verification Service (Penny Drop)
  let cashfreeResponse;
  try {
    cashfreeResponse = await verifyBankAccountService(
      cleanAccount,
      cleanIfsc,
      kyc.panName,
      req.user?.phone
    );
  } catch (error) {
    console.error("Cashfree Bank Verification API error:", error?.response?.data || error.message);
    const msg =
      error.response?.data?.message ||
      "Failed to verify bank account with Cashfree. Please check your account number and IFSC.";
    throw new ApiError(400, msg);
  }

  // 4. Validate Cashfree Penny Drop Response
  const resData = cashfreeResponse?.data || cashfreeResponse;
  const accountStatus = String(
    resData?.account_status ||
    resData?.accountStatus ||
    cashfreeResponse?.account_status ||
    cashfreeResponse?.accountStatus ||
    ""
  ).toUpperCase();

  const status = String(resData?.status || cashfreeResponse?.status || "").toUpperCase();

  // Verification must strictly proceed ONLY when accountStatus is explicitly "VALID"
  if (accountStatus !== "VALID" || status === "FAILED") {
    throw new ApiError(
      400,
      resData?.message || cashfreeResponse?.message || "Invalid bank account details. Verification rejected by the beneficiary bank."
    );
  }

  const nameAtBank =
    resData?.name_at_bank ||
    resData?.nameAtBank ||
    resData?.account_holder_name ||
    resData?.accountHolderName ||
    cashfreeResponse?.name_at_bank;

  if (!nameAtBank || typeof nameAtBank !== "string" || !nameAtBank.trim()) {
    throw new ApiError(400, "Unable to verify bank account details. Account holder name not returned by the bank.");
  }

  // 5. IDENTITY CROSS-MATCH (PMLA / SEBI standard):
  //    Bank account holder name MUST match verified PAN name (>= 70% threshold).
  //    In production, zero mock bypass is permitted.
  const nameCheck = verifyNameMatch(kyc.panName, nameAtBank || "", 70);

  if (!nameCheck.matched) {
    throw new ApiError(
      400,
      "Bank account holder name does not match your verified identity. Please use a bank account registered in your own name."
    );
  }

  // 6. Update KYC model with encrypted bank details
  const detectedBankName =
    resData?.bank_name ||
    resData?.bankName ||
    cashfreeResponse?.bank_name ||
    "Verified Bank";

  const utr =
    resData?.utr ||
    resData?.reference_id ||
    cashfreeResponse?.utr ||
    cashfreeResponse?.reference_id ||
    "";

  kyc.accountNumber = cleanAccount; // pre-save hook encrypts automatically
  kyc.ifscCode = cleanIfsc;
  kyc.bankHash = bankHash;
  kyc.bankVerified = true;
  kyc.bankRegisteredName = nameAtBank || kyc.panName;
  kyc.accountHolderName = nameAtBank || kyc.panName;
  kyc.bankName = detectedBankName;
  kyc.bankUtr = String(utr);

  // 7. Atomic KYC State & Audit Log persistence
  await saveKycWithAudit(kyc, {
    userId,
    action: "KYC_BANK_VERIFIED",
    metadata: {
      bankName: kyc.bankName,
      accountLast4: cleanAccount.slice(-4),
      similarityScore: nameCheck.score,
    },
    ipAddress: req.ip || "Unknown",
    userAgent: req.headers["user-agent"] || "Unknown",
  });

  return res.status(200).json(
    new ApiResponse(200, true, "Bank account verified and linked successfully!", {
      bankVerified: true,
      maskedAccountNumber: `••••••••${cleanAccount.slice(-4)}`,
      ifscCode: cleanIfsc,
      bankName: kyc.bankName,
      accountHolderName: kyc.bankRegisteredName,
      utr: kyc.bankUtr,
    })
  );
});

/**
 * Remove/Reset Bank Account
 * DELETE /api/v1/kyc/bank or POST /api/v1/kyc/bank/remove
 * Body: { pin }
 *
 * Security Requirements:
 * 1. OTX PIN mandatory (verified using bcrypt against user.pin)
 * 2. Active/Pending Withdrawal check: Cannot delete bank if a withdrawal is Pending/Approved/Processing
 * 3. Clear bank fields in Kyc document and set bankVerified = false
 * 4. Record AuditLog with action KYC_BANK_REMOVED
 */
export const removeBankAccount = asyncHandler(async (req, res) => {
  const { pin } = req.body;
  const userId = req.user._id;

  if (!pin) {
    throw new ApiError(400, "OTX Security PIN is required to remove bank details");
  }

  // 1. Fetch user with PIN
  const user = await User.findById(userId).select("+pin");
  if (!user || !user.pin) {
    throw new ApiError(400, "Security PIN not found on your account. Please set your PIN first.");
  }

  // 2. Validate PIN with bcrypt
  const isPinValid = await bcrypt.compare(String(pin).trim(), user.pin);
  if (!isPinValid) {
    throw new ApiError(400, "Incorrect OTX PIN. Bank account removal rejected.");
  }

  // 3. Fetch KYC record
  const kyc = await Kyc.findOne({ userId });
  if (!kyc || !kyc.bankVerified) {
    throw new ApiError(400, "No verified bank account found to remove.");
  }

  // 4. Safety Guard: Check for active/pending withdrawal requests
  const pendingWithdrawal = await WithdrawalRequest.findOne({
    userId,
    status: { $in: ["Pending", "Approved", "Processing"] },
  });

  if (pendingWithdrawal) {
    throw new ApiError(
      400,
      "Cannot remove bank account while a withdrawal request is pending or processing. Please wait for the withdrawal to complete."
    );
  }

  // 5. Clear bank details in KYC
  const oldBankName = kyc.bankName;
  kyc.accountNumber = null;
  kyc.ifscCode = null;
  kyc.accountHolderName = null;
  kyc.bankName = null;
  kyc.bankHash = null;
  kyc.bankVerified = false;
  kyc.bankRegisteredName = null;
  kyc.bankUtr = null;

  // 6. Atomic KYC State & Audit Log persistence
  await saveKycWithAudit(kyc, {
    userId,
    action: "KYC_BANK_REMOVED",
    metadata: {
      bankName: oldBankName,
      reason: "User requested bank account removal with verified OTX PIN",
    },
    ipAddress: req.ip || "Unknown",
    userAgent: req.headers["user-agent"] || "Unknown",
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      true,
      "Bank account removed successfully. Please add and verify your new bank account.",
      { bankVerified: false }
    )
  );
});
