import { Router } from "express";
import {
  validateBody,
  validateQuery,
} from "../middlewares/validateDto.middleware.js";

import {
  otpLimiter,
  authLimiter,
  withdrawalLimiter,
  pinChangeLimiter,
} from "../middlewares/rateLimiter.js";

import {
  validateSignup,
  validateLogin,
  validateLoginOtp,
  validateSendOtp,
  validateUpdateAccountInfo,
  validateUpdateEmail,
  validateUpdatePhone,
  validateForgetPin,
  validateResetPassword,
  validateEnquiry,
  validateVerifyEmailQuery,
  validateUpdateProfile,
  validateUpdateKyc,
  validateResetPin,
  validateUpdateDemat,
  validateUpdateBank,
  validateCreateOrder,
  validateSendVerificationOtp,
  validateVerifyPhoneOtp,
} from "../validation/jsonSchema.js";

import {
  checkAuthentication,
  requireVerified,
  requireRole,
  requireActiveAccount,
} from "../middlewares/auth.js";

import {
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
  getOrderDetails,
  getWalletBalance,
  initiateDeposit,
  handleCashfreeWebhook,
  verifyPaymentAndCredit,
  getWalletTransactions,
  getPublicStocks,
  requestWithdrawal,
  getUserWithdrawals,
  getWithdrawalDetails,
  exportUserData,
  requestAccountClosure,
  sendVerificationOtp,
  verifyPhoneOtp,
} from "../controllers/user.controller.js";

const userRouter = Router();

// ==================== PUBLIC ROUTES ====================

userRouter.get("/stocks", getPublicStocks); // Allows users to browse without login

// ==================== AUTH ROUTES ====================
userRouter.get("/auth/google", googleAuth);
userRouter.get("/auth/google/callback", googleAuthCallback);

// ==================== PUBLIC ROUTES ====================
userRouter.post("/send-otp", otpLimiter, validateBody(validateSendOtp), sendOtp);
userRouter.post("/signup", authLimiter, validateBody(validateSignup), signup);

userRouter.get(
  "/verifyEmail",
  validateQuery(validateVerifyEmailQuery),
  verifyEmail
);

userRouter.post("/login", authLimiter, validateBody(validateLogin), login);
userRouter.post("/login-otp", authLimiter, validateBody(validateLoginOtp), loginOtp);

userRouter.post(
  "/forgetPin",
  authLimiter,
  validateBody(validateForgetPin),
  forgetPin
);

userRouter.post(
  "/resetPassword",
  authLimiter,
  validateBody(validateResetPassword),
  resetPassword
);

userRouter.post("/enquiry", validateBody(validateEnquiry), enquiry);


// ==================== PROTECTED ROUTES ====================

// logout only needs authentication
userRouter.get("/logout", checkAuthentication, logout);

// phone verification routes for logged in users
userRouter.post(
  "/send-verification-otp",
  checkAuthentication,
  otpLimiter,
  validateBody(validateSendVerificationOtp),
  sendVerificationOtp
);

userRouter.post(
  "/verify-phone-otp",
  checkAuthentication,
  validateBody(validateVerifyPhoneOtp),
  verifyPhoneOtp
);

// verified account required
userRouter.put(
  "/updateAccountInfo",
  checkAuthentication,
  requireVerified,
  validateBody(validateUpdateAccountInfo),
  updateAccountInfo
);

// allow updating verification info even if unverified
userRouter.put(
  "/updateEmail",
  checkAuthentication,
  validateBody(validateUpdateEmail),
  updateEmail
);

userRouter.put(
  "/updatePhone",
  checkAuthentication,
  validateBody(validateUpdatePhone),
  updatePhoneNumber
);

userRouter.post(
  "/reset-pin",
  pinChangeLimiter,
  checkAuthentication,
  requireVerified,
  validateBody(validateResetPin),
  resetPin
);

// profile accessible after login
userRouter.get("/profile", checkAuthentication, getUserProfile);

// ==================== PROFILE ROUTES ====================

// GET full profile (user + extended profile details) — Personal Details screen
userRouter.get("/profile/full", checkAuthentication, getFullProfile);

// PUT create or update extended profile — Save Details button on Personal Details screen
userRouter.put(
  "/profile",
  checkAuthentication,
  validateBody(validateUpdateProfile),
  updateProfile
);

// POST request account closure
userRouter.post("/profile/request-closure", checkAuthentication, requestAccountClosure);

// GET export user data (allowed for Closed accounts)
userRouter.get("/export-data", checkAuthentication, exportUserData);

// ==================== KYC ROUTES ====================

userRouter.get("/kyc", checkAuthentication, getKycDetails);

userRouter.post(
  "/withdraw",
  withdrawalLimiter,
  checkAuthentication,
  requireVerified,
  requireActiveAccount,
  requestWithdrawal
);

userRouter.get(
  "/withdrawals",
  checkAuthentication,
  getUserWithdrawals
);

userRouter.get(
  "/withdrawals/:id",
  checkAuthentication,
  getWithdrawalDetails
);

userRouter.put(
  "/kyc",
  checkAuthentication,
  validateBody(validateUpdateKyc),
  updateKycDetails
);

// ==================== DEMAT ROUTES ====================

userRouter.get("/demat", checkAuthentication, getDematDetails);

userRouter.put(
  "/demat",
  checkAuthentication,
  validateBody(validateUpdateDemat),
  updateDematDetails
);

// ==================== BANK ROUTES ====================

userRouter.get("/bank", checkAuthentication, getBankDetails);

userRouter.put(
  "/bank",
  checkAuthentication,
  validateBody(validateUpdateBank),
  updateBankDetails
);

// ==================== ORDER & PORTFOLIO ROUTES ====================

userRouter.post(
  "/orders",
  checkAuthentication,
  requireActiveAccount,
  validateBody(validateCreateOrder),
  createOrder
);

userRouter.get("/orders", checkAuthentication, getUserOrders);
userRouter.get("/portfolio/summary", checkAuthentication, getPortfolioSummary);
userRouter.get("/orders/:id", checkAuthentication, getOrderDetails);

// ==================== WALLET ROUTES ====================

userRouter.get("/wallet/balance", checkAuthentication, getWalletBalance);
userRouter.get("/wallet/transactions", checkAuthentication, getWalletTransactions);
userRouter.post("/wallet/deposit/initiate", checkAuthentication, requireActiveAccount, initiateDeposit);
userRouter.post("/wallet/verify-payment", checkAuthentication, verifyPaymentAndCredit); // Direct Cashfree API verify (webhook fallback)
userRouter.post("/wallet/webhook", handleCashfreeWebhook); // cashfree webhook is public (verifies hmac internally)

export default userRouter;
