import axios from "axios";

/**
 * Sends a transactional WhatsApp notification using the Meta Graph API sandbox.
 * @param {string} phone - User's mobile phone number (without country code)
 * @param {string} otp - The generated 6-digit verification code
 */
export async function sendWhatsAppOTP(phone, otp) {
  // Format to standard Indian international prefix required by Meta
  const internationalPhone = `91${phone}`;

  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const apiVersion = (process.env.WHATSAPP_API_VERSION || "v20.0").trim();
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const templateName = (process.env.WHATSAPP_TEMPLATE_NAME || "order_confirmed").trim();
  const templateLang = (process.env.WHATSAPP_TEMPLATE_LANG || "en_US").trim();

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  // UPDATED PAYLOAD: Added the components array to pass the dynamic OTP value
  const payload = {
    messaging_product: "whatsapp",
    to: internationalPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: String(otp) // This explicitly injects the OTP into your {{1}} placeholder
            }
          ]
        }
      ]
    },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10-second timeout to prevent stalling if Meta is unresponsive
    });

    console.log(`✅ WhatsApp notification dispatched to 91${phone}:`, JSON.stringify(response.data));
    return { success: true };

  } catch (error) {
    // Handle Axios timeout explicitly
    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      console.error(`❌ Meta WhatsApp Gateway Timeout for +91${phone}`);
      throw new Error("WhatsApp gateway is not responding. Please try again later.");
    }

    const metaError = error.response?.data?.error;
    console.error(`❌ Meta WhatsApp Gateway Failure:`, metaError || error.message);

    // Explicit error interceptors for smoother debugging
    if (metaError?.code === 131030) {
      throw new Error(`+91${phone} is not whitelisted in your Meta Sandbox dashboard.`);
    }
    if (metaError?.code === 190) {
      throw new Error(`Meta Access Token has expired or is invalid. Check system user permissions.`);
    }

    throw new Error(metaError?.message || "WhatsApp gateway dispatch failed.");
  }
}