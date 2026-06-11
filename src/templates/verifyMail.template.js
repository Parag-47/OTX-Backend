import SHARED_STYLES from "./sharedStyle.js";

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
              <img src="https://www.onetimex.in/[removal.ai]_66399c92-94f0-4f4a-a183-30fb7476d933-b2afb360-b79e-42a3-9222-c46acc12bda0.png" alt="OneTimex Logo">
          </div>
          <div class="content">
              <h1>Welcome to OneTimex</h1>
              <p>We are excited to have you on board. To complete your registration, please verify your email address by clicking the button below:</p>
              <a href="${link}" class="button">Verify Your Email</a>
              <p>If you didn't create an account on <strong>OneTimex.in</strong>, you can safely ignore this email.</p>
          </div>
          <p class="footer">
              Need help? Contact us at <a href="mailto:support@onetimex.in" style="color: #007bff;">support@onetimex.in</a><br>
              © 2026 OneTimex. All rights reserved.
          </p>
      </div>
  </body>
  </html>`;
}
