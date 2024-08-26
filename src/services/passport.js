
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../models/user.model.js";

const myPassport = new passport.Passport();

myPassport.serializeUser((user, cb)=>{
  const data = {
    id: user.id,
    displayName: user.displayName,
    name: user.name,
    emails: user.emails,
    photos: user.photos,
  };
  console.log("Got Serialized: ", user);
  cb(null, data);
});

myPassport.deserializeUser((user, cb)=>{
  console.log("Got Called: ", user);
  cb(null, user);
});

const AUTH_OPTIONS = {
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/api/v1/users/auth/google/callback",
  scope: ["profile"],
  session: true,
};

async function verifyCallback(accessToken, refreshToken, profile, done) {
  // console.log(accessToken);
  // console.log(refreshToken);
  //console.log("Google Profile: ", profile);
  
  try {
    const existingUser = await User.findOne({email: profile.emails[0].value});
    if(existingUser) return done(null, profile);
    const user = await User.create({name: profile.displayName, email: profile.emails[0].value});
    return done(null, profile);
  } catch (error) {
    console.error("Error: ", error);
    return done("Something Went Wrong!", profile);
  }
  
  //Create User Record And If Any Error Pass The Error To Passport Through Callback.
  //Replace Null With The Error.
}

myPassport.use(new GoogleStrategy(AUTH_OPTIONS, verifyCallback));

export default myPassport;