import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import EMAIL_VERIFICATION_TEMPLATE from "../templates/verifyMail.template.js";
import PASSWORD_RESET_TEMPLATE from "../templates/resetPasswordMail.template.js";
import EMAIL_OTP_TEMPLATE from "../templates/emailOtp.template.js";
import EMAIL_VERIFIED_TEMPLATE from "../templates/emailVerified.template.js";
import { USE_HOSTED_LOGO } from "../templates/sharedStyle.js";

export const trustedDomains = [
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

const smtpPort = Number(process.env.SMTP_PORT) || 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_ID,
    pass: process.env.SMTP_PASSWORD,
  },
});

const EMAIL_TYPES = {
  EMAIL_VERIFICATION: {
    subject: "Verify Your Email Address",
    template: EMAIL_VERIFICATION_TEMPLATE,
    text: (link) =>
      `Verify Your Email Address\n\nPlease verify your email address by visiting the following link:\n${link}\n\nIf you did not request this, please ignore this email.`,
  },
  EMAIL_OTP: {
    subject: "Your OneTimeX Email Verification Code",
    template: EMAIL_OTP_TEMPLATE,
    text: (otp) =>
      `Your OneTimeX Email Verification Code\n\nYour verification code is: ${otp}\n\nThis code will expire in 10 minutes. Do not share this code with anyone.`,
  },
  EMAIL_VERIFIED: {
    subject: "Your Email Has Been Verified - OneTimeX",
    template: EMAIL_VERIFIED_TEMPLATE,
    text: (name) =>
      `Your Email Has Been Verified - OneTimeX\n\nHello ${name || "User"},\n\nYour email address has been successfully verified on OneTimeX.`,
  },
  PASSWORD_RESET: {
    subject: "Reset Your Password",
    template: PASSWORD_RESET_TEMPLATE,
    text: (link) =>
      `Reset Your Password\n\nPlease use the following link to reset your password:\n${link}\n\nIf you did not request a password reset, please ignore this email.`,
  },
};

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Optimized (160x160, ~26KB) email logo — used only as an embedded CID fallback
// when no hosted logo URL is available (e.g. local development).
const primaryLogoPath = path.resolve(__dirname, "../../public/otx-email-logo.png");
const fallbackLogoPath = path.resolve(__dirname, "../../../onetimex/public/otx-email-logo.png");
const logoPath = USE_HOSTED_LOGO
  ? null
  : fs.existsSync(primaryLogoPath)
    ? primaryLogoPath
    : fs.existsSync(fallbackLogoPath)
      ? fallbackLogoPath
      : null;

const SENDMAIL = async (type, email, linkOrOtp) => {
  const config = EMAIL_TYPES[type];

  if (!config) {
    return {
      success: false,
      error: `Unknown email type: "${type}". Valid types: ${Object.keys(EMAIL_TYPES).join(", ")}`,
    };
  }

  const plainText =
    typeof config.text === "function"
      ? config.text(linkOrOtp)
      : `${config.subject}: ${linkOrOtp || ""}`.trim();

  const mailDetails = {
    from: process.env.SMTP_ID,
    to: email,
    subject: config.subject,
    text: plainText,
    html: config.template(linkOrOtp),
    attachments: logoPath
      ? [
        {
          filename: "otx-email-logo.png",
          path: logoPath,
          cid: "otx_logo",
        },
      ]
      : [],
  };

  try {
    const info = await transporter.sendMail(mailDetails);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error(
      `[SENDMAIL] Failed to send ${type} to ${email}:`,
      error.message
    );
    if (error.response)
      console.error("[SENDMAIL] SMTP Response:", error.response);
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

export {
  verifySMTPConnection,
  isTrustedEmail,
  // EMAIL_TYPES,
  SENDMAIL,
  createToken,
  isValidToken,
};
