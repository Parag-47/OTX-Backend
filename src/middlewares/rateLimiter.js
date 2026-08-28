import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { valkey } from "../db/valkey.js";

const defaultHandler = (req, res, next, options) => {
  res.status(options.statusCode).json({ message: options.message });
};

// Global limiter: 1000 requests per 15 minutes
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Increased to 1000 to prevent blocking legitimate users navigating the SPA
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
  message: "Too many requests from this IP, please try again after 15 minutes",
  skip: (req) => req.method === "OPTIONS", // Exclude CORS preflight requests
  store: new RedisStore({
    sendCommand: (...args) => valkey.call(...args),
    prefix: "rl:global:", // Unique prefix
  }),
});

// OTP limiter: 3 requests per 5 minutes
export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
  message: "Too many OTP requests, please try again after 5 minutes",
  skip: (req) => req.method === "OPTIONS", // Exclude CORS preflight requests
  store: new RedisStore({
    sendCommand: (...args) => valkey.call(...args),
    prefix: "rl:otp:", // Unique prefix
  }),
});

// Auth limiter: 5 requests per 5 minutes
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
  message: "Too many authentication attempts, please try again later 5 minutes",
  skip: (req) => req.method === "OPTIONS", // Exclude CORS preflight requests
  store: new RedisStore({
    sendCommand: (...args) => valkey.call(...args),
    prefix: "rl:auth:", // Unique prefix
  }),
});

// Withdrawal limiter: 10 requests per 1 hour
export const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10, // Increased for easier testing and legitimate multiple attempts
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
  message: "Too many withdrawal requests, please try again after 1 hour",
  skip: (req) => req.method === "OPTIONS", // Exclude CORS preflight requests
  keyGenerator: (req) => {
    // Limit per user account rather than IP if logged in, prevents shared IP blocking
    const ipFallback = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    return req.session?.userId || req.user?._id || `fallback-ip-${ipFallback}`;
  },
  store: new RedisStore({
    sendCommand: (...args) => valkey.call(...args),
    prefix: "rl:withdrawal:", // Unique prefix
  }),
});

// PIN Change limiter: 3 requests per 1 hour
export const pinChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
  message: "Too many PIN change attempts. Try again after 1 hour.",
  skip: (req) => req.method === "OPTIONS", // Exclude CORS preflight requests
  keyGenerator: (req) => {
    const ipFallback = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    return req.session?.userId || req.user?._id || `fallback-ip-${ipFallback}`;
  },
  store: new RedisStore({
    sendCommand: (...args) => valkey.call(...args),
    prefix: "rl:pinchange:", // Unique prefix
  }),
});

