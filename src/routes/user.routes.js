import { Router } from "express";
import auth from "../middlewares/auth.js";
import myPassport from "../services/passport.js";
import { login } from "../controllers/user.controller.js";

const userRouter = Router();

const googleAuth = myPassport.authenticate("google", {
  scope: ["email", "profile"],
});
const googleAuthCallback = myPassport.authenticate("google", {
  failureRedirect: "/login",
  successRedirect: "/home",
});

userRouter.get("/auth/google", googleAuth);
userRouter.get("/auth/google/callback", googleAuthCallback);
userRouter.get("/login", login);

export default userRouter;