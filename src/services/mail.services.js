import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import EMAIL_VERIFICATION_TEMPLATE from "../templates/verifyMail.template.js";
import PASSWORD_RESET_TEMPLATE from "../templates/resetPasswordMail.template.js";

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

const EMAIL_TYPES = {
  EMAIL_VERIFICATION: {
    subject: "Verify Your Email Address",
    template: EMAIL_VERIFICATION_TEMPLATE,
  },
  PASSWORD_RESET: {
    subject: "Reset Your Password",
    template: PASSWORD_RESET_TEMPLATE,
  },
};

const SENDMAIL = async (type, email, link) => {
  const config = EMAIL_TYPES[type];

  if (!config) {
    return {
      success: false,
      error: `Unknown email type: "${type}". Valid types: ${Object.keys(EMAIL_TYPES).join(", ")}`,
    };
  }

  const mailDetails = {
    from: process.env.SMTP_ID,
    to: email,
    subject: config.subject,
    text: `${config.subject}: ${link}`,
    html: config.template(link),
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
