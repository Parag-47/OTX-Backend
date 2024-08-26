import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import session from "express-session";
import redisStore from "./db/valkey.js";
import auth from "./middlewares/auth.js";
import myPassport from "./services/passport.js";
import userRouter from "./routes/user.routes.js";

const cookieOptions = {
  httpOnly: true,
  secure: false, //Change To True In Production Very Important******
  //sameSite: "none" //uncomment in prod so it only accept request from one site  
};

const sessionOptions = {
  name: "sessionId",
  store: redisStore,
  resave: false, // required: force lightweight session keep alive (touch)
  saveUninitialized: false, // recommended: only save session when data exists
  secret: process.env.SESSION_SECRET,
  cookie: cookieOptions,
  maxAge: 1000 * 60 * 60 * 24,
}

const app = express();

//app.set("trust proxy", 1); //for proxy related issues

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
  })
);
app.use(session(sessionOptions));
app.use(myPassport.initialize());
app.use(myPassport.session());
app.use(morgan("combined"));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use("/api/v1/users", userRouter);

app.get("/", (req, res) => res.status(200).json({ Message: "Hi!" }));
app.get("/home", auth ,(req, res) =>
  res.status(200).json({ Message: "Successfully Logged In!" })
);

export default app;