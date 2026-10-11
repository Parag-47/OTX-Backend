import axios from "axios";

/**
 * Resolves Cashfree Verification API base URL depending on CASHFREE_ENV
 */
const getVerificationUrl = () => {
  const env = (process.env.CASHFREE_ENV || "sandbox").toLowerCase();
  return env === "production"
    ? "https://api.cashfree.com/verification"
    : "https://sandbox.cashfree.com/verification";
};

// Configured axios client for Cashfree Verification API requests
export const verificationClient = axios.create({
  timeout: 20000, // 20s timeout to allow UIDAI & NPCI penny drop bank settlements
});

// Interceptor to attach credentials dynamically per request
verificationClient.interceptors.request.use((config) => {
  const appId =
    process.env.CASHFREE_VERIFICATION_APP_ID || process.env.CASHFREE_APP_ID;
  const secretKey =
    process.env.CASHFREE_VERIFICATION_SECRET_KEY || process.env.CASHFREE_SECRET_KEY;

  if (!appId || !secretKey) {
    throw new Error("Cashfree verification credentials (x-client-id / x-client-secret) are not configured.");
  }

  config.headers = {
    ...config.headers,
    "x-client-id": appId.trim(),
    "x-client-secret": secretKey.trim(),
    "Content-Type": "application/json",
  };
  return config;
});

/**
 * Verify PAN Card details with NSDL / Income Tax Department via Cashfree
 * @param {string} pan - 10-character PAN string
 * @param {string} [name] - Optional name for verification
 * @returns {Promise<object>} Cashfree verification response
 */
export async function verifyPan(pan, name) {
  const url = `${getVerificationUrl()}/pan`;
  const payload = { pan: pan.toUpperCase().trim() };
  if (name) payload.name = name.trim();

  const response = await verificationClient.post(url, payload);
  return response.data;
}

/**
 * Verify Bank Account via NPCI Penny Drop (Sync)
 * @param {string} bank_account - Clean numeric account number
 * @param {string} ifsc - 11-character IFSC code
 * @param {string} [name] - Verified name on PAN for Penny Drop matching
 * @param {string} [phone] - User's phone number
 * @returns {Promise<object>} Cashfree verification response
 */
export async function verifyBankAccount(bank_account, ifsc, name, phone) {
  const url = `${getVerificationUrl()}/bank-account/sync`;
  const payload = { 
    bank_account: String(bank_account).trim(), 
    ifsc: ifsc.toUpperCase().trim() 
  };
  if (name) payload.name = name.trim();
  if (phone) payload.phone = String(phone).trim();

  const response = await verificationClient.post(url, payload);
  return response.data;
}

/**
 * Send Aadhaar OTP (Offline e-KYC via UIDAI)
 * @param {string} aadhaar_number - 12-digit clean Aadhaar number
 * @returns {Promise<object>} { ref_id: "...", message: "...", status: "SUCCESS" }
 */
export async function sendAadhaarOtp(aadhaar_number) {
  const url = `${getVerificationUrl()}/offline-aadhaar/otp`;
  const payload = { aadhaar_number: String(aadhaar_number).trim() };

  const response = await verificationClient.post(url, payload);
  return response.data;
}

/**
 * Verify Aadhaar OTP with UIDAI via Cashfree
 * @param {string|number} ref_id - Reference ID from sendAadhaarOtp
 * @param {string} otp - 6-digit Aadhaar OTP
 * @returns {Promise<object>} Verified Aadhaar record
 */
export async function verifyAadhaarOtp(ref_id, otp) {
  const url = `${getVerificationUrl()}/offline-aadhaar/verify`;
  const payload = { 
    ref_id: String(ref_id).trim(), 
    otp: String(otp).trim() 
  };

  const response = await verificationClient.post(url, payload);
  return response.data;
}
