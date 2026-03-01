import { Router } from "express";

import { checkAuthentication, requireRole } from "../middlewares/auth.js";

import {
  getDashboardStats,
  getAllInquiries,
  toggleBanUser,
  getRecentUsers,
} from "../controllers/admin.controller.js";

const adminRouter = Router();

adminRouter.use(checkAuthentication);
adminRouter.use(requireRole("admin"));

// ==================== DASHBOARD ====================
adminRouter.get("/stats", getDashboardStats);

// ==================== USERS ====================
adminRouter.get("/users/recent", getRecentUsers);
adminRouter.patch("/users/:userId/toggle-ban", toggleBanUser);

// ==================== INQUIRIES ====================
adminRouter.get("/inquiries", getAllInquiries);

export default adminRouter;
