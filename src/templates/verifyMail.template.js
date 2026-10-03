import SHARED_STYLES, { OTX_LOGO_URL } from "./sharedStyle.js";

export default function EMAIL_VERIFICATION_TEMPLATE(link) {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification</title>
      ${SHARED_STYLES}
  </head>
  <body>
      <div class="email-container">
          <div class="header">
              <img src="${OTX_LOGO_URL}" alt="OneTimex Logo" style="max-height: 50px; width: auto; object-fit: contain;">
          </div>
          <div class="content">
              <h1>Welcome to OneTimex</h1>
              <p>We are excited to have you on board. To complete your registration, please verify your email address by clicking the button below:</p>
              <a href="${link}" class="button">Verify Your Email</a>
              <p>If you didn't create an account on <strong>OneTimex.in</strong>, you can safely ignore this email.</p>
          </div>
          <p class="footer">
              Need help? Contact us at <a href="mailto:connect@onetimex.in" style="color: #007bff;">connect@onetimex.in</a><br>
              © 2026 OneTimex. All rights reserved.
          </p>
      </div>
  </body>
  </html>`;
}
