export default function MAIL_TEMPLATE(link) {
  return `<!DOCTYPE html>
  <html lang="en">

  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification</title>
      <style>
          body {
              font-family: Arial, sans-serif;
              background-color: #9eafc040;
              margin: 0;
              padding: 0;
          }

          .email-container {
              background-color: #9eafc040;
              height: fit;
              max-width: 600px;
              margin: 1rem auto;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
              padding: 20px;
              border-radius: 8px;
          }

          .header {
              text-align: center;
              background-color: #0066cc;
              padding: 20px 0;
              border-radius: 10px 10px 0 0;
          }

          .header img {
              width: 160px;
          }

          .content {
              margin: 20px 0;
              color: #333333;
              line-height: 1.6;
          }

          .content h1 {
              color: #0066cc;
              text-align: center;
          }

          p {
              color: #333333;
              font-size: 16px;
              line-height: 1.6;
          }

          .button {
              display: block;
              width: fit-content;
              padding: 12px 20px;
              margin: 20px auto;
              color: #ffffff;
              background-color: #007bff;
              text-decoration: none;
              border-radius: 5px;
              font-size: 18px;
              text-align: center;
          }

          .button:hover {
              background-color: #0056b3;
          }

          .footer {
              margin-top: 30px;
              color: #888888;
              text-align: center;
              border-top: 1px solid #eeeeee;
              padding-top: 15px;
              margin-bottom: 0px;
          }
          
      </style>
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
              Need help? Contact us at <a href="mailto:support@onetimex.in" style="color: #007bff;">support@onetimex.in</a><br> © 2024 OneTimex. All rights reserved.
          </p>
      </div>
  </body>

  </html>`;
}