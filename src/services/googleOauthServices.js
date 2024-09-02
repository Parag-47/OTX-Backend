import axios from "axios";

const oauth2Endpoint = "https://accounts.google.com/o/oauth2/v2/auth?";
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const GOOGLE_AUTH_URI =
  oauth2Endpoint +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    // state=state_parameter_passthrough_value            //For CSRF Protection
    response_type: "code",
    prompt: "consent",
    access_type: "offline",
    scope:
      "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
  });

async function getGoogleOAuthTokens(code) {
  try {
    const tokenExchangeEndpoint = "https://oauth2.googleapis.com/token?";

    const tokenExchangeResponse = await axios.post(tokenExchangeEndpoint, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    });

    return tokenExchangeResponse.data;
  } catch (error) {
    console.log("Error In getGoogleOAuthTokens: ", error);
    throw new ApiError("Something Went Wrong While Fetching OAuth Tokens");
  }
}

async function getGoogleUser(tokens) {
  const googleUserResponse = await axios.get(
    `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${tokens.access_token}`,
    {
      headers: {
        Authorization: `Bearer ${tokens.id_token}`,
      },
    }
  );
  return googleUserResponse.data;
}

export { GOOGLE_AUTH_URI, getGoogleOAuthTokens, getGoogleUser };