import { Router } from "express";
import validateDto from "../middlewares/validateDto.middleware.js";
import validate from "../validation/jsonSchema.js";
import checkAuthentication from "../middlewares/auth.js";
import {
  googleAuth,
  googleAuthCallback,
  registerUser,
  login,
  logout,
} from "../controllers/user.controller.js";

const userRouter = Router();

userRouter.get("/auth/google", googleAuth);
userRouter.get("/auth/google/callback", googleAuthCallback);
userRouter.post("/register", registerUser);
userRouter.post("/login", checkAuthentication, login);
userRouter.get("/logout", checkAuthentication, logout);

export default userRouter;