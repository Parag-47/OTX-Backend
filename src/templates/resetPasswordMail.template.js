import SHARED_STYLES from "./sharedStyle.js";

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
              <img src="https://www.onetimex.in/[removal.ai]_66399c92-94f0-4f4a-a183-30fb7476d933-b2afb360-b79e-42a3-9222-c46acc12bda0.png" alt="OneTimex Logo">
          </div>
          <div class="content">
              <h1>Reset Your Password</h1>
              <p>We received a request to reset the password for your OneTimex account. Click the button below to choose a new password:</p>
              <a href="${link}" class="button">Reset Password</a>
              <p>This link will expire in <strong>15 minutes</strong>. If you didn't request a password reset, you can safely ignore this email — your password will not be changed.</p>
          </div>
          <p class="footer">
              Need help? Contact us at <a href="mailto:support@onetimex.in" style="color: #007bff;">support@onetimex.in</a><br>
              © 2026 OneTimex. All rights reserved.
          </p>
      </div>
  </body>
  </html>`;
}
