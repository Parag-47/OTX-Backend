import { Router } from "express";
import {
  verifyWebhook,
  handleWhatsAppWebhook,
} from "../controllers/whatsapp.controller.js";

const whatsappRouter = Router();

// Webhook verification endpoint (GET)
whatsappRouter.get("/webhook", verifyWebhook);

// Webhook event receiver endpoint (POST)
whatsappRouter.post("/webhook", handleWhatsAppWebhook);

export default whatsappRouter;
