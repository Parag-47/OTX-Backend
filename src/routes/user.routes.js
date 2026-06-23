import { Router } from "express";
import {
  validateBody,
  validateQuery,
} from "../middlewares/validateDto.middleware.js";

import {
  validateSignup,
  validateLogin,
  validateUpdateAccountInfo,
  validateUpdateEmail,
  validateUpdatePhone,
  validateForgetPassword,
  validateResetPassword,
  validateEnquiry,
  validateVerifyEmailQuery,
  validateUpdateProfile,
  validateUpdateKyc,
} from "../validation/jsonSchema.js";

import {
  checkAuthentication,
  requireVerified,
  requireRole,
} from "../middlewares/auth.js";

import {
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
  getFullProfile,
  updateProfile,
  getKycDetails,
  updateKycDetails,
} from "../controllers/user.controller.js";

const userRouter = Router();

// ==================== AUTH ROUTES ====================
userRouter.get("/auth/google", googleAuth);
userRouter.get("/auth/google/callback", googleAuthCallback);

// ==================== PUBLIC ROUTES ====================
userRouter.post("/signup", validateBody(validateSignup), signup);

userRouter.get(
  "/verifyEmail",
  validateQuery(validateVerifyEmailQuery),
  verifyEmail
);

userRouter.post("/login", validateBody(validateLogin), login);

userRouter.post(
  "/forgetPassword",
  validateBody(validateForgetPassword),
  forgetPassword
);

userRouter.post(
  "/resetPassword",
  validateBody(validateResetPassword),
  resetPassword
);

userRouter.post("/enquiry", validateBody(validateEnquiry), enquiry);

// ==================== PROTECTED ROUTES ====================

// logout only needs authentication
userRouter.get("/logout", checkAuthentication, logout);

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

// ==================== KYC ROUTES ====================

userRouter.get("/kyc", checkAuthentication, getKycDetails);

userRouter.put(
  "/kyc",
  checkAuthentication,
  validateBody(validateUpdateKyc),
  updateKycDetails
);

export default userRouter;
