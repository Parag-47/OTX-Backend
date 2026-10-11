import SHARED_STYLES, { OTX_LOGO_URL } from "./sharedStyle.js";

export default function EMAIL_OTP_TEMPLATE(otp) {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OneTimeX - Email Verification OTP</title>
      ${SHARED_STYLES}
      <style>
          .otp-container {
              text-align: center;
              margin: 28px 0;
          }
          .otp-box {
              display: inline-block;
              font-family: 'Courier New', Courier, monospace;
              font-size: 36px;
              font-weight: 800;
              letter-spacing: 10px;
              color: #0066cc;
              background-color: #f0f7ff;
              border: 2px dashed #0066cc;
              border-radius: 12px;
              padding: 16px 32px;
          }
          .warning-text {
              font-size: 13px;
              color: #64748b;
              text-align: center;
              margin-top: 16px;
          }
          .badge {
              display: inline-block;
              background-color: #e0f2fe;
              color: #0369a1;
              font-size: 12px;
              font-weight: bold;
              padding: 4px 12px;
              border-radius: 20px;
              margin-bottom: 12px;
          }
      </style>
  </head>
  <body>
      <div class="email-container">
          <div class="header">
              <img src="${OTX_LOGO_URL}" alt="OneTimeX Logo" style="max-height: 50px; width: auto; object-fit: contain;">
          </div>
          <div class="content" style="text-align: center; padding: 20px 10px;">
              <span class="badge">SECURITY VERIFICATION</span>
              <h1>Verify Your Email Address</h1>
              <p>Please use the following One-Time Password (OTP) to complete your email verification on <strong>OneTimeX</strong>:</p>
              
              <div class="otp-container">
                  <div class="otp-box">${otp}</div>
              </div>
              
              <p class="warning-text">
                  ⏱️ This OTP is valid for <strong>10 minutes</strong>.<br>
                  🔒 For your security, never share this OTP with anyone, including OneTimeX staff.
              </p>
          </div>
          <p class="footer">
              Need help? Contact us at <a href="mailto:connect@onetimex.in" style="color: #0066cc;">connect@onetimex.in</a><br>
              © 2026 OneTimeX. All rights reserved.
          </p>
      </div>
  </body>
  </html>`;
}
