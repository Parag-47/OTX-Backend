import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";

// async function checkAuthentication (req, res, next) {
//   if (!req.session.userId) return res.redirect("/oauth/Not Authenticated!");
//   return next();
// }

// async function checkAuthentication(req, res, next) {
//   try {
//     // Check if session exists AND user exists inside session
//     if (!req?.session || !req.session?.userId) {
//       throw new ApiError(401, "Not authenticated");
//     }

//     const user = await User.findById(req.session.userId).select(
//       "verified_email verified_phone"
//     );

//     if (
//       !user ||
//       (user.verified_email === false && user.verified_phone === false)
//     )
//       throw new ApiError(401, "User doesn't exists or is not verified");

//     // Attach user to req for convenience (downstream access)
//     req.userId = req.session.userId;

//     next();
//   } catch (err) {
//     next(err);
//   }
// }

const checkAuthentication = asyncHandler(async (req, res, next) => {
  if (!req.session?.userId) {
    throw new ApiError(401, "Not authenticated");
  }

  const user = await User.findById(req.session.userId).select(
    "_id role verified_email verified_phone isActive isBanned"
  );

  if (!user) {
    throw new ApiError(401, "User not found");
  }

  if (user.isBanned) {
    throw new ApiError(403, "Your account has been banned");
  }

  req.user = user;

  next();
});

const requireVerified = asyncHandler(async (req, res, next) => {
  if (!req.user?.verified_email && !req.user?.verified_phone) {
    throw new ApiError(403, "Account not verified");
  }

  next();
});

const requireRole = (...roles) =>
  asyncHandler(async (req, _res, next) => {
    if (!roles.includes(req.user?.role)) {
      throw new ApiError(403, "Insufficient permissions");
    }

    next();
  });

export { checkAuthentication, requireVerified, requireRole };
