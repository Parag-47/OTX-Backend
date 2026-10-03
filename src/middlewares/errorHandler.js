import ApiError from "../utils/ApiError.js";

export const errorHandler = (err, req, res, next) => {
  // If it's already an ApiError, use its properties
  if (err instanceof ApiError) {
    return res.status(err.statuscode || 500).json({
      success: err.success,
      message: err.message,
      errors: err.errors,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    });
  }

  // Handle Mongoose Validation Errors or other unknown errors
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  return res.status(statusCode).json({
    success: false,
    message: message,
    errors: [],
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};
