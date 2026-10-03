// OTX email logo resolution:
// Uses the publicly hosted, HTTPS-served logo (https://www.onetimex.in/newlogootx.png).
// By rendering the logo directly from a hosted URL without MIME attachments,
// mail clients (especially Gmail mobile) will NOT display an unwanted attachment badge/chip (e.g. "[image] newlogocropped") in the inbox view.
const frontendOrigin = (process.env.PROD_FRONTEND_ORIGIN || "https://www.onetimex.in").replace(/\/+$/, "");

export const OTX_LOGO_URL =
  process.env.OTX_LOGO_URL ||
  (frontendOrigin.includes("onetimex.in") ? "https://www.onetimex.in/newlogootx.png" : `${frontendOrigin}/newlogootx.png`);

export const USE_HOSTED_LOGO = true;

export default `<style>
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
              border-radius: 10px 10px 10px 10px;
          }

          .header img {
              max-height: 50px;
              width: auto;
              object-fit: contain;
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
          
      </style>`;

