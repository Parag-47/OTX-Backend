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
  validateResetPasswordQuery,
  validateResetPassword,
  validateEnquiry,
  validateVerifyEmailQuery,
} from "../validation/jsonSchema.js";
import checkAuthentication from "../middlewares/auth.js";
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
  validate(validateResetPasswordQuery, "query"),
  validate(validateResetPassword),
  resetPassword
);
userRouter.post("/enquiry", validateBody(validateEnquiry), enquiry);

// ==================== PROTECTED ROUTES ====================
userRouter.get("/logout", checkAuthentication, logout);
userRouter.put(
  "/updateAccountInfo",
  checkAuthentication,
  validateBody(validateUpdateAccountInfo),
  updateAccountInfo
);
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

export default userRouter;
