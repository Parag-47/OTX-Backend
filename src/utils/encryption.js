import crypto from "crypto";

// Ensure ENCRYPTION_KEY is available and exactly 32 bytes
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  console.error("CRITICAL: ENCRYPTION_KEY must be exactly 32 characters long.");
}

const ALGORITHM = "aes-256-gcm";

/**
 * Encrypts a plain text string using AES-256-GCM
 * @param {string} text - The text to encrypt
 * @returns {string} - The encrypted string in format: iv:authTag:encryptedData
 */
export function encrypt(text) {
  if (!text) return text;
  
  // Generate random Initialization Vector (16 bytes)
  const iv = crypto.randomBytes(16);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  
  // Encrypt the text
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  // Get the auth tag (16 bytes)
  const authTag = cipher.getAuthTag().toString("hex");
  
  // Return IV, authTag, and encrypted data concatenated with colons
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string that was encrypted with encrypt()
 * @param {string} hash - The encrypted string in format: iv:authTag:encryptedData
 * @returns {string} - The original plain text
 */
export function decrypt(hash) {
  if (!hash || !hash.includes(":")) return hash;
  
  try {
    const parts = hash.split(":");
    if (parts.length !== 3) throw new Error("Invalid hash format");
    
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error.message);
    throw new Error("Failed to decrypt data");
  }
}
