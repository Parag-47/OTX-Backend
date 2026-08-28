import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";


const checkAuthentication = asyncHandler(async (req, res, next) => {
  if (!req.session?.userId) {
    throw new ApiError(401, "Not authenticated");
  }

  const user = await User.findById(req.session.userId).select(
    "_id role verified_email verified_phone isActive isBanned accountStatus"
  );

  if (!user) {
    throw new ApiError(401, "User not found");
  }

  if (user.isBanned) {
    throw new ApiError(403, "Your account has been banned");
  }

  // ALLOW specific routes for closed accounts (30-day grace period for downloading data)
  const allowedClosedRoutes = ["/export-data", "/logout"];
  const isAllowedRoute = allowedClosedRoutes.includes(req.path);

  if (user.accountStatus === "Closed" && !isAllowedRoute) {
    throw new ApiError(
      403,
      "This account has been permanently closed. Contact support@onetimex.in",
      "ACCOUNT_CLOSED"
    );
  }

  req.user = user;
  next();
});

const requireActiveAccount = asyncHandler(async (req, res, next) => {
  if (req.user.accountStatus === "OnHold") {
    throw new ApiError(
      403,
      "Your account is under closure review. Financial actions are disabled.",
      "ACCOUNT_ON_HOLD"
    );
  }
  
  if (req.user.accountStatus === "Closed") {
    throw new ApiError(
      403,
      "This account has been closed.",
      "ACCOUNT_CLOSED"
    );
  }
  
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

export { checkAuthentication, requireVerified, requireRole, requireActiveAccount };
