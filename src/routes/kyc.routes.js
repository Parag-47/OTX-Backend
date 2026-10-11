import { Router } from "express";
import { checkAuthentication } from "../middlewares/auth.js";
import { kycVerifyLimiter } from "../middlewares/rateLimiter.js";
import { validateBody } from "../middlewares/validateDto.middleware.js";
import {
  validateVerifyPan,
  validateSendAadhaarOtp,
  validateVerifyAadhaarOtp,
  validateVerifyBankAccount,
  validateRemoveBankAccount,
} from "../validation/jsonSchema.js";
import {
  getKycStatus,
  verifyPan,
  sendAadhaarOtp,
  verifyAadhaarOtp,
  verifyBankAccount,
  removeBankAccount,
} from "../controllers/kyc.controller.js";

const router = Router();

// Secure all KYC routes
router.use(checkAuthentication);

// Read-only status endpoint — NO rate limiter (used by frontend stepper on page load)
router.route("/status").get(getKycStatus);

// Verification-action endpoints — WITH rate limiter (costly Cashfree API calls)
router.route("/verify/pan").post(kycVerifyLimiter, validateBody(validateVerifyPan), verifyPan);
router.route("/verify/aadhaar/send").post(kycVerifyLimiter, validateBody(validateSendAadhaarOtp), sendAadhaarOtp);
router.route("/verify/aadhaar/verify").post(kycVerifyLimiter, validateBody(validateVerifyAadhaarOtp), verifyAadhaarOtp);
router.route("/verify/bank").post(kycVerifyLimiter, validateBody(validateVerifyBankAccount), verifyBankAccount);

// Bank removal endpoints — requires OTX PIN authorization (rate limited to prevent brute-force attacks)
router.route("/bank").delete(kycVerifyLimiter, validateBody(validateRemoveBankAccount), removeBankAccount);
router.route("/bank/remove").post(kycVerifyLimiter, validateBody(validateRemoveBankAccount), removeBankAccount);

export default router;
