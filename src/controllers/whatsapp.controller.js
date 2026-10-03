import crypto from "crypto";
import asyncHandler from "../utils/asyncHandler.js";
import { valkey } from "../db/valkey.js";

/**
 * Mask phone numbers for privacy in logs (e.g. 9191******35)
 */
const maskPhone = (p) => {
  if (!p || typeof p !== "string") return "******";
  if (p.length < 6) return "******";
  return `${p.slice(0, 4)}******${p.slice(-2)}`;
};

/**
 * GET /api/v1/webhooks/whatsapp/webhook
 * Meta Webhook verification handshake.
 */
export const verifyWebhook = asyncHandler(async (req, res) => {
  console.log("🔍 Meta Webhook Handshake Query:", req.query);

  const mode = (
    req.query["hub.mode"] ||
    req.query["hub_mode"] ||
    req.query.hub_mode ||
    ""
  ).trim();

  const token = (
    req.query["hub.verify_token"] ||
    req.query["hub_verify_token"] ||
    req.query.hub_verify_token ||
    ""
  ).trim();

  const challenge =
    req.query["hub.challenge"] ||
    req.query["hub_challenge"] ||
    req.query.hub_challenge;

  const verifyToken = (
    process.env.WHATSAPP_VERIFY_TOKEN ||
    process.env.WEBHOOK_VERIFY_TOKEN ||
    ""
  ).trim();

  if (mode === "subscribe" && token === verifyToken) {
    console.log("✅ Meta WhatsApp Webhook verified successfully! Returning challenge:", challenge);
    return res.status(200).send(challenge);
  }

  console.warn(`❌ Meta WhatsApp Webhook verification failed. Received mode='${mode}', token='${token}', Expected token='${verifyToken}'`);
  return res.status(403).json({ error: "Forbidden" });
});

/**
 * POST /api/v1/webhooks/whatsapp/webhook
 * Real-time event notifications from Meta (Delivery receipts, Statuses, Inbound Messages).
 */
export const handleWhatsAppWebhook = asyncHandler(async (req, res) => {
  console.log("📥 Incoming Meta Webhook POST event received!");

  // ── STEP 1: Verify Meta Signature FIRST ──────────────────────────────
  const signature = req.headers["x-hub-signature-256"];
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!signature || !appSecret) {
    console.warn("⚠️ Meta WhatsApp Webhook: Missing x-hub-signature-256 header or WHATSAPP_APP_SECRET in .env");
    return res.sendStatus(200); // Always 200 — never reject Meta with 4xx
  }

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));

  const expectedSignature =
    "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  const sigBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  const isValidSignature =
    sigBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(sigBuffer, expectedBuffer);

  if (!isValidSignature) {
    console.warn("⚠️ Meta WhatsApp Webhook: Signature verification failed. Potential spoofed request.");
    return res.sendStatus(200); // Always 200
  }

  // ── STEP 2 & 3: Parse Payload Safely ────────────────────────────────
  let body;
  try {
    body = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8")) : req.body;
  } catch (parseError) {
    console.warn("⚠️ Meta WhatsApp Webhook: Malformed JSON body:", parseError.message);
    return res.sendStatus(200);
  }

  const value = body?.entry?.[0]?.changes?.[0]?.value;
  if (!value) {
    return res.sendStatus(200);
  }

  const { statuses, messages } = value;

  // ── STEP 4: Handle Status Updates (Sent, Delivered, Read, Failed) ───
  if (Array.isArray(statuses)) {
    for (const item of statuses) {
      const messageId = item.id;
      const status = item.status;
      const recipient = item.recipient_id ? maskPhone(String(item.recipient_id)) : "unknown";

      // Idempotency check via Valkey (24-hour TTL)
      if (messageId && status) {
        const idempotencyKey = `wa_processed:${messageId}:${status}`;
        try {
          const isNew = await valkey.set(idempotencyKey, "1", "EX", 86400, "NX");
          if (!isNew) {
            // Already processed this exact message status
            continue;
          }
        } catch (valkeyErr) {
          console.warn("⚠️ Valkey idempotency error (skipping deduplication):", valkeyErr.message);
        }
      }

      if (status === "sent") {
        console.log(`📤 WhatsApp Message Sent: ID=${messageId}, Recipient=${recipient}`);
      } else if (status === "delivered") {
        console.log(`📬 WhatsApp Message Delivered: ID=${messageId}, Recipient=${recipient}`);
      } else if (status === "read") {
        console.log(`👁️ WhatsApp Message Read: ID=${messageId}, Recipient=${recipient}`);
      } else if (status === "failed") {
        const errorDetails = item.errors?.[0];
        console.error(
          `❌ WhatsApp Message Failed: ID=${messageId}, Recipient=${recipient}, Code=${errorDetails?.code || "N/A"}, Title=${errorDetails?.title || "Unknown error"}, Details=${errorDetails?.error_data?.details || "None"}`
        );
      } else {
        console.log(`ℹ️ WhatsApp Status Update: ID=${messageId}, Status=${status}, Recipient=${recipient}`);
      }
    }
  }

  // ── STEP 5: Handle Inbound Messages (For future auto-reply / support) ─
  if (Array.isArray(messages)) {
    for (const msg of messages) {
      const messageId = msg.id;
      const sender = msg.from ? maskPhone(String(msg.from)) : "unknown";
      const msgType = msg.type || "unknown";

      // Idempotency check for inbound messages
      if (messageId) {
        const idempotencyKey = `wa_processed:${messageId}:received`;
        try {
          const isNew = await valkey.set(idempotencyKey, "1", "EX", 86400, "NX");
          if (!isNew) {
            continue;
          }
        } catch (valkeyErr) {
          console.warn("⚠️ Valkey idempotency error (skipping deduplication):", valkeyErr.message);
        }
      }

      console.log(`📩 Incoming WhatsApp Message: ID=${messageId}, From=${sender}, Type=${msgType}`);
    }
  }

  // ── STEP 6: Always Return 200 OK ─────────────────────────────────────
  return res.sendStatus(200);
});
