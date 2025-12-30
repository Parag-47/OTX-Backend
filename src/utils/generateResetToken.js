import crypto from "crypto";
import bcrypt from "bcrypt";

function generateResetToken() {
  const token = crypto.randomBytes(64).toString("hex"); // 128 char
  const tokenHash = bcrypt.hashSync(token, 10);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 mins

  return { token, tokenHash, expiresAt };
}

export default generateResetToken;
