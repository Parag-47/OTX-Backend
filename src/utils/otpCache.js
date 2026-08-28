// utils/otpCache.js
import { randomInt } from "crypto";
import { valkey } from "../db/valkey.js"; 
import { sendWhatsAppOTP } from "../services/whatsapp.service.js";

import ApiError from "./ApiError.js";

const REDIS_KEY_PREFIX = "OTX:otp:"; 
export async function generateAndCacheOtp(phone) { 
  // Generate a cryptographically secure random 6-digit number (100000 to 999999)
  const otp = randomInt(100000, 1000000).toString(); 
  const redisKey = `${REDIS_KEY_PREFIX}${phone}`; 
  
  const EXPIRY_SECONDS = 5 * 60; // 5-minute TTL 

  // 1. Store OTP in your Valkey cache 
  await valkey.set(redisKey, otp, "EX", EXPIRY_SECONDS);

  if (process.env.NODE_ENV !== "production") {
    const masked = phone.length >= 6 ? `${phone.slice(0, 4)}******${phone.slice(-2)}` : "******";
    console.log(`📱 [DEV ONLY] OTP generated for +91${masked}: ${otp} (Expires in 5 mins)`);
  }

  // INTEGRATION HOOK:
  try {
    await sendWhatsAppOTP(phone, otp);
  } catch (whatsappError) {
    console.error("Delivery failure:", whatsappError.message);
    // Delete the cached OTP since it couldn't be delivered
    await valkey.del(redisKey);
    throw new ApiError(500, `Failed to send OTP via WhatsApp: ${whatsappError.message}`);
  }

  return otp; 
}

/**
 * Atomic Compare-and-Delete Lua script for Valkey/Redis:
 * Compares cached OTP with incoming value and deletes key in a single atomic step.
 * Returns 1 on match & successful deletion, 0 otherwise.
 */
const VERIFY_OTP_LUA = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  else
    return 0
  end
`;

export async function verifyOtp(phone, incomingOtp) { 
  if (!phone || !incomingOtp) return false;

  const redisKey = `${REDIS_KEY_PREFIX}${phone}`; 
  try {
    const result = await valkey.eval(
      VERIFY_OTP_LUA,
      1,
      redisKey,
      String(incomingOtp).trim()
    ); 

    // result === 1 means the OTP matched and was deleted atomically
    return result === 1;
  } catch (error) {
    console.error("Valkey OTP verification error:", error.message);
    return false;
  }
}