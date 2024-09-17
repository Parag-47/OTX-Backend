import { Router } from "express";
import validateDto from "../middlewares/validateDto.middleware.js";
import validate from "../validation/jsonSchema.js";
import checkAuthentication from "../middlewares/auth.js";
import {
  googleAuth,
  googleAuthCallback,
  signup,
  verifyEmail,
  login,
  logout,
  updateAccountInfo,
} from "../controllers/user.controller.js";

const userRouter = Router();

userRouter.get("/auth/google", googleAuth);
userRouter.get("/auth/google/callback", googleAuthCallback);
userRouter.post("/signup", validateDto(validate), signup);
userRouter.get("/verifyEmail", verifyEmail);
userRouter.post("/login", validateDto(validate), login);
userRouter.get("/logout", checkAuthentication, logout);
userRouter.post("/updateAccountInfo", checkAuthentication, validateDto(validate), updateAccountInfo);

export default userRouter;