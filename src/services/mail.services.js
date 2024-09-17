import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import MAIL_TEMPLATE from "../templates/mail.template.js";

const trustedDomains = [
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
  "zoho.com",
  "mail.com",
  "yandex.com",
  "gmx.com",
  "fastmail.com",
  "tutanota.com",
  "comcast.net",
  "verizon.net",
];

function isTrustedEmail(email) {
  const domain = email.split("@")[1];
  return trustedDomains.includes(domain);
}

const transporter = nodemailer.createTransport({
  //service: "gmail",
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_ID,
    pass: process.env.SMTP_PASSWORD,
  },
});

const SENDMAIL = async (email, link, callback) => {
  const mailDetails = {
    from: process.env.SMTP_ID, // sender addresser
    to: email, // receiver email
    subject: "Email Verification! ", // Subject line
    text: `Your Verification Link Is: ${link}`,
    html: MAIL_TEMPLATE(link),
  };

  try {
    const info = await transporter.sendMail(mailDetails);
    callback(info);
  } catch (error) {
    console.error("Error occurred while sending email:", error.message);

    if (error.response) {
      console.error("SMTP Response:", error.response);
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

// function generateAlphanumericOTP(length) {
//   const otp = crypto.randomBytes(length).toString("hex").slice(0, length);
//   console.log("OTP: ", otp);
//   return otp
// }

function createToken(email) {
  //const randomString = crypto.randomBytes(32).toString("hex");
  try {
    if (!email) throw new Error("Email is Empty!");
    const token = jwt.sign({ email }, process.env.JWT_SECRET_KEY, {
      expiresIn: "1h",
    }); // Token expires in 1 hour
    return token;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function isValidToken(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded;
  } catch (error) {
    console.error("Error while decoding token: ", error);
    return null;
  }
}

// verify connection configuration
async function verifySMTPConnection() {
  try {
    const result = await transporter.verify();
    if (result) {
      console.log("SMTP Server is ready to take our messages: ", result);
    }
  } catch (error) {
    console.error("SMTP Connection failed: ", error);
  }
}

export { verifySMTPConnection, isTrustedEmail, SENDMAIL, createToken, isValidToken };