import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import cors from "cors";
import hpp from "hpp";
import session from "express-session";
import valkeyStore from "./db/valkey.js";
import userRouter from "./routes/user.routes.js";
import adminRouter from "./routes/admin.routes.js";
import whatsappRouter from "./routes/whatsapp.routes.js";
import { globalLimiter } from "./middlewares/rateLimiter.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", //Always Set True In Production Very Important******
  sameSite: "lax",
  domain: process.env.NODE_ENV === "production" ? ".onetimex.in" : undefined,
  maxAge: 1000 * 60 * 60 * 24,
};

const sessionOptions = {
  name: "sessionId",
  store: valkeyStore,
  resave: false, // required: force lightweight session keep alive (touch)
  saveUninitialized: false, // false recommended: only save session when data exists
  secret: process.env.SESSION_SECRET,
  cookie: cookieOptions,
  // maxAge: 1000 * 60 * 60 * 24, // Max age should be in cookies option
};

const app = express();

// Enable trust proxy so Express & express-rate-limit correctly recognize forwarded HTTPS/IP headers
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
  })
);
app.use(hpp());
app.use(mongoSanitize());

// Rate Limiting with Webhook Exemption (Cashfree + WhatsApp)
app.use((req, res, next) => {
  if (
    req.path === "/api/v1/user/wallet/webhook" ||
    req.path === "/api/v1/webhooks/whatsapp"
  ) {
    return next();
  }
  return globalLimiter(req, res, next);
});

app.use(session(sessionOptions));

// Dynamic cookie adaptation for HTTPS devtunnels / Port Forwarding (e.g. mobile testing)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    const isTunnel =
      req.headers.host?.includes("devtunnels.ms") ||
      req.headers.host?.includes("ngrok") ||
      req.headers.origin?.includes("devtunnels.ms") ||
      req.headers.origin?.includes("ngrok");

    if (isTunnel && req.session && req.session.cookie) {
      req.session.cookie.sameSite = "none";
      req.session.cookie.secure = true;
    }
  }
  next();
});

const rawOrigins =
  process.env.NODE_ENV === "production"
    ? process.env.CORS_ORIGIN || process.env.PROD_FRONTEND_ORIGIN || "https://onetimex.in"
    : process.env.CORS_ORIGIN || process.env.DEV_FRONTEND_ORIGIN || "http://localhost:3000";

const allowedOrigins = rawOrigins
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env.NODE_ENV !== "production") {
  ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"].forEach(
    (devOrigin) => {
      if (!allowedOrigins.includes(devOrigin)) {
        allowedOrigins.push(devOrigin);
      }
    }
  );
}

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production") {
    if (
      /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin) ||
      /^https:\/\/.*\.devtunnels\.ms$/.test(origin) ||
      /^https:\/\/.*\.ngrok(-free)?\.app$/.test(origin) ||
      /^https:\/\/.*\.ngrok\.io$/.test(origin) ||
      /^https:\/\/.*\.loca\.lt$/.test(origin)
    ) {
      return true;
    }
  }
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
  })
);
app.use(morgan("combined"));

// WhatsApp Webhook Route (raw body parser mounted BEFORE global express.json() for signature verification)
app.use(
  "/api/v1/webhooks/whatsapp",
  express.raw({ type: "application/json" }),
  whatsappRouter
);

app.use(
  express.json({
    limit: "16kb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "16kb" }));


app.use("/api/v1/user", userRouter);
app.use("/api/v1/admin", adminRouter);

app.get("/oauthError/:error", (req, res) => {
  return res.send(req.params.error);
});

app.get("/", (req, res) => {
  if (process.env.NODE_ENV === "production")
    return res.status(302).redirect(process.env.PROD_FRONTEND_ORIGIN);
  return res.status(302).redirect(process.env.DEV_FRONTEND_ORIGIN);
});



// Mount Centralized Error Handler (must be at the end)
app.use(errorHandler);

export default app;
