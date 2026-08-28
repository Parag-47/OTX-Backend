export const validateEnv = () => {
  const requiredEnvVars = [
    "PORT",
    "NODE_ENV",
    "MONGODB_URI",
    "SERVICE_URI",
    "SESSION_SECRET",
    "AES_SECRET_KEY",
    "CASHFREE_APP_ID",
    "CASHFREE_SECRET_KEY",
    "CASHFREE_ENV",
    "CASHFREE_PAYOUT_CLIENT_ID",
    "CASHFREE_PAYOUT_SECRET",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_API_VERSION",
    "DAILY_PAYOUT_LIMIT_RUPEES",
  ];

  const missingVars = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
    }
  }

  if (missingVars.length > 0) {
    console.error(`🚨 ERROR: Missing required environment variables: \n${missingVars.join("\n")}`);
    console.error("Server cannot start. Exiting...");
    process.exit(1);
  }
};
