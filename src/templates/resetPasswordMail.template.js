import SHARED_STYLES, { OTX_LOGO_URL } from "./sharedStyle.js";

export default function PASSWORD_RESET_TEMPLATE(link) {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
      ${SHARED_STYLES}
  </head>
  <body>
      <div class="email-container">
          <div class="header">
              <img src="${OTX_LOGO_URL}" alt="OneTimex Logo" style="max-height: 50px; width: auto; object-fit: contain;">
          </div>
          <div class="content">
              <h1>Reset Your Password</h1>
              <p>We received a request to reset the password for your OneTimex account. Click the button below to choose a new password:</p>
              <a href="${link}" class="button">Reset Password</a>
              <p>This link will expire in <strong>15 minutes</strong>. If you didn't request a password reset, you can safely ignore this email — your password will not be changed.</p>
          </div>
          <p class="footer">
              Need help? Contact us at <a href="mailto:connect@onetimex.in" style="color: #007bff;">connect@onetimex.in</a><br>
              © 2026 OneTimex. All rights reserved.
          </p>
      </div>
  </body>
  </html>`;
}
