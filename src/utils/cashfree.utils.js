import crypto from "crypto";

/**
 * 3. Webhook Cryptographic Verification
 * Verifies the HMAC-SHA256 signature sent by Cashfree in Webhooks.
 * Cashfree signs the payload using the Secret Key.
 * 
 * @param {string} rawBody - The raw stringified JSON body of the webhook
 * @param {string} signature - The signature from the header (usually x-webhook-signature)
 * @param {string} timestamp - The timestamp from the header (usually x-webhook-timestamp)
 * @returns {boolean} - true if authentic, false if forged
 */
export const verifyCashfreeWebhookSignature = (rawBody, signature, timestamp) => {
  try {
    const secretKey = process.env.CASHFREE_PAYOUT_SECRET;
    
    // In Cashfree API v1.2+, the payload to sign is usually: timestamp + rawBody
    const payloadToSign = `${timestamp}${rawBody}`;
    
    // Generate HMAC SHA256
    const expectedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(payloadToSign)
      .digest("base64");

    return expectedSignature === signature;
  } catch (error) {
    console.error("Webhook Verification Error:", error.message);
    return false;
  }
};
