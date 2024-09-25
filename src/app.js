import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import cors from "cors";
import hpp from "hpp";
import session from "express-session";
import valkeyStore from "./db/valkey.js";
import userRouter from "./routes/user.routes.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV==="production"? true : false, //Change To True In Production Very Important******
  sameSite: "lax", // Set to strict/lax so it only accept request from same site  
  maxAge: 1000 * 60 * 60 * 24,
};

const sessionOptions = {
  name: "sessionId",
  store: valkeyStore,
  resave: false, // required: force lightweight session keep alive (touch)
  saveUninitialized: false, // false recommended: only save session when data exists
  secret: process.env.SESSION_SECRET,
  cookie: cookieOptions,
  maxAge: 1000 * 60 * 60 * 24,
}

const app = express();

//app.set("trust proxy", 1); //for proxy related issues

app.use(helmet());
app.use(hpp());
app.use(mongoSanitize());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
  })
);
app.use(session(sessionOptions));
app.use(morgan("combined"));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
//app.use(express.static("public"));

app.use("/api/v1/user", userRouter);

app.get("/oauthError/:error", (req, res) => {
  res.send(req.params.error);
});
app.get("/", (req, res) => res.status(302).redirect("https://www.onetimex.in"));
app.get("/home", (req, res) => {
  if (!req.session.userId)
    return res.redirect(`/oauthError/Not Authenticated!`);
  res.status(200).json({ Message: "Successfully Logged In! ", User: req.user });
});

export default app;