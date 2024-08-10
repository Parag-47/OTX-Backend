
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

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

export default myPassport;