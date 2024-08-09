import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";


import Valkey from "ioredis";
import session from "express-session";
import RedisStore from "connect-redis";

const valkey = new Valkey(process.env.SERVICE_URI);
const redisStore = new RedisStore({
  client: valkey,
  prefix: "OTX:",
});

//valkey.set()


const myPassport = new passport.Passport();

myPassport.serializeUser((user, cb)=>{
  const data = {
    id: user.id,
    displayName: user.displayName,
    name: user.name,
    emails: user.emails,
    photos: user.photos,
  };

  cb(null, user);
});

myPassport.deserializeUser((user, cb)=>{
  cb(null, user);
});

const cookieOptions = {
  httpOnly: true,
  secure: false, //Change To True In Production Very Important******
};

const AUTH_OPTIONS = {
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/callback",
  scope: ["profile"],
};

async function verifyCallback(accessToken, refreshToken, profile, done) {
  console.log(accessToken);
  console.log(refreshToken);
  //console.log("Google Profile: ", profile);
  //Create User Record And If Any Error Pass The Error To Passport Through Callback.
  return done(null, profile); //Replace Null With The Error.
}

myPassport.use(new GoogleStrategy(AUTH_OPTIONS, verifyCallback));

const app = express();

//app.set("trust proxy", 1); //for proxy related issues

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
  })
);
app.use(
  session({
    //name: "session",
    store: redisStore,
    resave: false, // required: force lightweight session keep alive (touch)
    saveUninitialized: false, // recommended: only save session when data exists
    secret: process.env.SESSION_SECRET,
    cookie: cookieOptions,
    maxAge: 1000 * 60,
  }),
);

app.use(myPassport.initialize());
app.use(myPassport.session());
app.use(morgan("combined"));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));

app.get("/", (req, res) => res.status(200).json({ Message: "Hi!" }));
app.get("/home", (req, res) =>
  res.status(200).json({ Message: "Successfully Logged In!" })
);
app.get("/login", (req, res) =>
  res.status(200).json({ Message: "Login Failed Try Again!" })
);

app.get(
  "/auth/google",
  myPassport.authenticate("google", { scope: ["email","profile"] })
);

app.get(
  "/auth/google/callback",
  myPassport.authenticate("google", {
    failureRedirect: "/login",
    successRedirect: "/home",
  })
);

export default app;