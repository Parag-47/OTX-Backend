import { Router } from "express";
import { checkAuthentication, requireRole } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validateDto.middleware.js";
import { validateAddStock, validateUpdateStock } from "../validation/jsonSchema.js";
import {
  getDashboardStats,
  getAllInquiries,
  toggleBanUser,
  getRecentUsers,
  addStock,
  getStockByName,
  getAllStocks,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  analyzeOrder,
  getAllUsers,
  updateStock,
  getAdminLogs,
  getAllTransactions,
  getAllWithdrawals,
  rejectWithdrawal,
  approveWithdrawal,
  getDecryptedBankDetails,
  markWithdrawalComplete,
  manualRefundWithdrawal
} from "../controllers/admin.controller.js";

import {
  getUsersReport,
  getUserActivityReport,
  approveAccountClosure,
  rejectAccountClosure,
  reactivateAccount
} from "../controllers/reports.controller.js";

const adminRouter = Router();

adminRouter.use(checkAuthentication);
adminRouter.use(requireRole("admin"));

// ==================== DASHBOARD ====================
adminRouter.get("/stats", getDashboardStats);

// ==================== USERS ====================
adminRouter.get("/users", getAllUsers);
adminRouter.get("/users/recent", getRecentUsers);
adminRouter.patch("/users/:userId/toggle-ban", toggleBanUser);

// ==================== INQUIRIES ====================
adminRouter.get("/inquiries", getAllInquiries);

// ==================== STOCKS ====================
adminRouter.get("/stocks", getAllStocks);
adminRouter.get("/stocks/:name", getStockByName);
adminRouter.post("/stocks", validateBody(validateAddStock), addStock);
adminRouter.patch("/stocks/:stockId", validateBody(validateUpdateStock), updateStock);

// ==================== LOGS ====================
adminRouter.get("/logs", getAdminLogs);

// ==================== ORDERS ====================
adminRouter.get("/orders", getAllOrders);
adminRouter.get("/orders/:orderId", getOrderById);
adminRouter.get("/orders/:orderId/analyze", analyzeOrder);
adminRouter.patch("/orders/:orderId", updateOrderStatus);

// ==================== TRANSACTIONS ====================
adminRouter.get("/transactions", getAllTransactions);

// ==================== WITHDRAWALS ====================
adminRouter.get("/withdrawals", getAllWithdrawals);
adminRouter.get("/withdrawals/:id/bank-details", getDecryptedBankDetails);
adminRouter.patch("/withdrawals/:id/reject", rejectWithdrawal);
adminRouter.patch("/withdrawals/:id/approve", approveWithdrawal);
adminRouter.patch("/withdrawals/:id/mark-complete", markWithdrawalComplete);
adminRouter.patch("/withdrawals/:id/manual-refund", manualRefundWithdrawal);

// ==================== REPORTS & CLOSURE ====================
adminRouter.get("/reports/users", getUsersReport);
adminRouter.get("/reports/users/:id/activity", getUserActivityReport);
adminRouter.patch("/users/:id/approve-closure", approveAccountClosure);
adminRouter.patch("/users/:id/reject-closure", rejectAccountClosure);
adminRouter.patch("/users/:id/reactivate", reactivateAccount);

export default adminRouter;
