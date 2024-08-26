import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

const register = asyncHandler(async (req, res) => {
  if (req.isAuthenticated()) console.log("rec");
    console.log("Test: ", req.session, req.session.user, req.user, req.log, req.local);
  res.send("OK");
});

const login = asyncHandler(async (req, res) => {
  console.log(req.user);
  if (!req.isAuthenticated()) {
    throw new ApiError(400, "Login Failed Try Again!");
  }
  res.status(302).redirect("/home");
});

export { register, login };