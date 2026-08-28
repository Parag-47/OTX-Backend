import axios from 'axios';
import ApiError from '../utils/ApiError.js';
import { User } from '../models/user.model.js';

const getBaseUrl = () => {
  return process.env.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/payout'
    : 'https://sandbox.cashfree.com/payout';
};

const getTransferMode = (amountInPaise) => {
  return amountInPaise <= 50000000 ? "imps" : "neft";
};

export const triggerAutomatedPayout = async (
  amountInPaise,
  decryptedBankDetails,
  transferId,
  userId
) => {
  try {
    // Fetch and validate user contact details
    const user = await User.findById(userId).select("phone email");

    if (!user?.phone) {
      throw new ApiError(
        400,
        "Phone number missing. Please update profile before withdrawal."
      );
    }

    const amountInRupees = (amountInPaise / 100).toFixed(2);
    const beneId = `OTX_BENE_${userId}`;

    // Cashfree V2 Standard Headers (No Bearer Token needed!)
    const headers = {
      'x-client-id': process.env.CASHFREE_PAYOUT_CLIENT_ID,
      'x-client-secret': process.env.CASHFREE_PAYOUT_SECRET,
      'x-api-version': '2024-01-01',
      'Content-Type': 'application/json'
    };

    // 1. Create or Update Beneficiary in Cashfree
    try {
      await axios.post(`${getBaseUrl()}/beneficiary`, {
        beneficiary_id: beneId,
        beneficiary_name: decryptedBankDetails.accountHolder,
        beneficiary_instrument_details: {
          bank_account_number: decryptedBankDetails.accountNumber,
          bank_ifsc: decryptedBankDetails.ifscCode
        },
        beneficiary_contact_details: {
          beneficiary_email: user.email || "support@onetimex.in",
          beneficiary_phone: user.phone
        }
      }, { headers });
    } catch (beneError) {
      // 409 Conflict means Beneficiary already exists, which is fine!
      if (beneError?.response?.status !== 409) {
        throw new Error(
          `Beneficiary creation failed: ${beneError?.response?.data?.message || beneError.message}`
        );
      }
    }

    // 2. Trigger Transfer
    const response = await axios.post(`${getBaseUrl()}/transfers`, {
      transfer_id: transferId,
      transfer_amount: parseFloat(amountInRupees),
      transfer_currency: "INR",
      transfer_mode: getTransferMode(amountInPaise),
      beneficiary_details: {
        beneficiary_id: beneId
      }
    }, { headers });

    // In V2, response contains status like "RECEIVED" if accepted
    return {
      accepted: true,
      cashfreeReferenceId: response.data?.cf_transfer_id || null,
      transferId,
      status: "processing"
    };

  } catch (error) {
    console.error("Cashfree V2 Payout Error:", error?.response?.data || error.message);
    const statusCode = error?.response?.status || 500;
    throw new ApiError(
      statusCode,
      error?.response?.data?.message || error.message || "Failed to trigger automated payout"
    );
  }
};