import SHARED_STYLES, { OTX_LOGO_URL } from "./sharedStyle.js";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function EMAIL_VERIFIED_TEMPLATE(userName = "User") {
  const safeUserName = escapeHtml(userName || "User");
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OneTimeX - Email Verified Successfully</title>
    ${SHARED_STYLES}
    <style>
        .success-icon-box {
            text-align: center;
            margin: 24px 0 16px 0;
        }
        .success-circle {
            display: inline-block;
            width: 70px;
            height: 70px;
            line-height: 70px;
            border-radius: 50%;
            background: linear-gradient(135deg, #10b981, #059669);
            color: #ffffff;
            font-size: 38px;
            box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
        }
        .badge-verified {
            display: inline-block;
            background-color: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 1px;
            padding: 5px 14px;
            border-radius: 20px;
            margin-bottom: 12px;
            text-transform: uppercase;
        }
        .info-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px 20px;
            margin: 20px 0;
            text-align: left;
        }
        .info-card-item {
            font-size: 13px;
            color: #475569;
            margin: 6px 0;
            line-height: 1.5;
        }
        .btn-dashboard {
            display: inline-block;
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: #ffffff !important;
            font-size: 15px;
            font-weight: bold;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 10px;
            margin-top: 10px;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header with OTX Logo -->
        <div class="header">
            <img src="${OTX_LOGO_URL}" alt="OneTimeX Logo" style="max-height: 50px; width: auto; object-fit: contain;">
        </div>

        <!-- Body Content -->
        <div class="content" style="text-align: center; padding: 20px 15px;">
            <div class="success-icon-box">
                <div class="success-circle">✓</div>
            </div>

            <span class="badge-verified">Account Verified</span>
            <h1 style="color: #0f172a; margin-top: 8px; margin-bottom: 8px; font-size: 24px; font-weight: 800;">
                Email Verified Successfully!
            </h1>

            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-top: 4px;">
                Hello <strong>${safeUserName}</strong>,<br>
                Your email address has been successfully verified on <strong>OneTimeX</strong>. Your account is now fully secured.
            </p>

            <div class="info-card">
                <div class="info-card-item">
                    <strong>🔒 Security:</strong> Two-factor authentication & verified account status enabled.
                </div>
                <div class="info-card-item">
                    <strong>📈 Trading & KYC:</strong> You will now receive instant trade allocations, buy/sell confirmations, and KYC updates directly to this email.
                </div>
                <div class="info-card-item">
                    <strong>🛡️ Protection:</strong> OneTimeX representatives will never ask for your PIN or password.
                </div>
            </div>

            <div style="margin-top: 24px; margin-bottom: 12px;">
                <a href="https://www.onetimex.in/dashboard" class="btn-dashboard">
                    Go To Your Dashboard →
                </a>
            </div>
        </div>

        <!-- Footer -->
        <p class="footer">
            Need help? Contact our dedicated support team at <a href="mailto:connect@onetimex.in" style="color: #2563eb; text-decoration: none; font-weight: bold;">connect@onetimex.in</a><br>
            © 2026 OneTimeX. All rights reserved.
        </p>
    </div>
</body>
</html>`;
}
