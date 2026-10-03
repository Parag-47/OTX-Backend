import { AdminLog } from "../models/adminLog.model.js";

/**
 * Utility to securely log admin actions.
 * @param {Object} req - The Express request object to extract IP.
 * @param {String} adminId - The MongoDB ObjectId of the admin user.
 * @param {String} action - The action constant (e.g., "LOGIN", "UPDATE_STOCK").
 * @param {String} details - Readable description of the action.
 */
export const logAdminAction = async (req, adminId, action, details) => {
  try {
    // req.ip respects Express's "trust proxy" setting, so it safely resolves
    // the real client IP through trusted infrastructure (e.g. Cloudflare, ALB).
    const ipAddress = req.ip || "Unknown";

    await AdminLog.create({
      adminId,
      action,
      details,
      ipAddress,
    });
  } catch (error) {
    console.error("Failed to write to AdminLog:", error);
    // We intentionally don't throw the error so that logging failure 
    // doesn't crash the main business flow, though this can be changed.
  }
};
