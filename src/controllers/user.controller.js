import bcrypt from "bcrypt";
import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  GOOGLE_AUTH_URI,
  getGoogleOAuthTokens,
  getGoogleUser,
} from "../services/googleOauthServices.js";

async function googleAuth(req, res) {
  try {
    res.redirect(GOOGLE_AUTH_URI);
  } catch (error) {
    console.log("Error In Redirect: ", error);
    res.redirect(`http://localhost:3000/oauth/Failed To Authenticate!`);
  }
}

async function googleAuthCallback(req, res) {
  try {
    const { error, code } = req.query;
    if (error) {
      console.log("Error In Callback: ", error);
      return res.redirect(
        `http://localhost:3000/oauth/Failed To Authenticate!`
      );
    }

    const tokens = await getGoogleOAuthTokens(code);

    if (!tokens) throw new ApiError(500, "Empty Tokens Received!");

    const googleUser = await getGoogleUser(tokens);

    if (!googleUser) throw new ApiError(500, "Google Profile Not Received!");

    const existingUser = await User.findOne({ email: googleUser.email });

    if (existingUser) {
      req.session.userId = existingUser._id;
      return res.redirect("/home");
    }

    // Create new user
    const newUser = await User.create({
      email: googleUser.email,
      name: googleUser.name,
    });

    req.session.userId = newUser._id;
    res.redirect("/home");
  } catch (error) {
    console.log("Error In Callback: ", error);
    res.redirect(`http://localhost:3000/oauth/Failed To Authenticate!`);
  }
}

const registerUser = asyncHandler(async (req, res) => {
  if (req.session.userId) res.redirect("/home");

  const { phone, email, password, name } = req.body;

  if (!(phone || email) || !password || !name)
    throw new ApiError(400, "All fields are required!");

  if (email) email = email.toLowerCase();

  const existedUser = await User.findOne({
    $or: [{ phone: phone }, { email: email }],
  });

  if (existedUser)
    throw new ApiError(
      400,
      "This Email Or Phone Number Is Already Registered!"
    );

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    phone,
    email,
    name,
    password: hashedPassword,
  });

  const newUser = await User.findById(user._id).select("-password -__v");

  if (!user)
    throw new ApiError(500, "Something Went Wrong While Registering New User!");

  req.session.userId = newUser._id;

  res.status(302).redirect("/home");
});

const login = asyncHandler(async (req, res) => {
  //if (req.session.userId) return res.redirect("/home");

  const { phone, email, password } = req.body;

  if (!(phone || email) || !password)
    throw new ApiError(400, "Email Id/Phone Number And Password Is Required!");

  if (email) email = email.toLowerCase();

  const user = await User.findOne({
    $or: [{ phone: phone }, { email: email }],
  });

  if (!user) throw new ApiError(404, "User doesn't exist!");

  if (!user.password)
    throw new ApiError(
      400,
      "Password Not Set For This Account Please Set The Password Or Use Google Sign On!"
    );

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) throw new ApiError(400, "Incorrect Password!");

  req.session.userId = user._id;

  res.status(302).redirect("/home");
});

const logout = asyncHandler(async (req, res) => {
  //if (!req.session.userId) throw new ApiError(400, "Please Login!");
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Failed to log out");
    }
  });

  res.clearCookie("sessionId").status(200).redirect("/");
});

const updateAccountInfo = asyncHandler(async (req, res) => {
  

});

export { googleAuth, googleAuthCallback, registerUser, login, logout };