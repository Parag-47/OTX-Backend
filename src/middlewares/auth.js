import ApiError from "../utils/ApiError.js";

// async function checkAuthentication (req, res, next) {
//   if (!req.session.userId) return res.redirect("/oauth/Not Authenticated!");
//   return next();
// }

async function checkAuthentication(req, res, next) {
  try {
    // Check if session exists AND user exists inside session
    if (!req.session || !req.session.userId) {
      throw new ApiError(401, "Not authenticated");
    }

    // Attach user to req for convenience (downstream access)
    req.userId = req.session.userId;

    next();
  } catch (err) {
    next(err);
  }
}

export default checkAuthentication;
