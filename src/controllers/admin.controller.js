import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Inquiry } from "../models/inquiry.model.js";
import { Stock } from "../models/stock.model.js";
import { Order } from "../models/order.model.js";
import { Wallet } from "../models/wallet.model.js";
import { WalletTransaction } from "../models/walletTransaction.model.js";
import { WithdrawalRequest } from "../models/withdrawal.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { AdminLog } from "../models/adminLog.model.js";
import { logAdminAction } from "../utils/adminLogger.js";
import { decrypt } from "../utils/encryption.js";
import { triggerAutomatedPayout } from "../services/payout.service.js";

const getDashboardStats = asyncHandler(async (_req, res) => {
  const [
    totalUsers,
    activeUsers,
    adminCount,
    verifiedUsers,
    totalEnquiries,
    recentUsers,
    totalOrders,
    pendingOrders,
    approvedOrders,
    rejectedOrders,
    totalStocks,
    pendingWithdrawals,
    depositStats,
    revenueStats
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ role: "admin" }),
    User.countDocuments({
      $or: [{ verified_email: true }, { verified_phone: true }],
    }),
    Inquiry.countDocuments(),
    User.countDocuments({
      createdAt: {
        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    }),
    Order.countDocuments(),
    Order.countDocuments({ status: "pending" }),
    Order.countDocuments({ status: "approved" }),
    Order.countDocuments({ status: "rejected" }),
    Stock.countDocuments(),
    WithdrawalRequest.countDocuments({ status: "Pending" }),
    // Aggregate total successful deposits
    WalletTransaction.aggregate([
      { $match: { type: "deposit", status: "success" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]),
    // Aggregate total revenue from approved orders
    Order.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: null, totalQuantity: { $sum: "$quantity" }, totalRevenue: { $sum: { $multiply: ["$quantity", "$pricePerShare"] } } } }
    ])
  ]);

  const totalDepositsPaise = depositStats[0]?.total || 0;
  const totalRevenuePaise = revenueStats[0]?.totalRevenue || 0;

  return res.status(200).json(
    new ApiResponse(
      200,
      true,
      "Dashboard statistics fetched successfully",
      {
        users: {
          total: totalUsers,
          active: activeUsers,
          admins: adminCount,
          verified: verifiedUsers,
          last7Days: recentUsers,
        },
        enquiries: {
          total: totalEnquiries,
        },
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          approved: approvedOrders,
          rejected: rejectedOrders,
        },
        financials: {
          totalRevenuePaise,
          totalDepositsPaise,
        },
        withdrawals: {
          pending: pendingWithdrawals,
        },
        stocks: {
          total: totalStocks,
        }
      }
    )
  );
});

const getEnquiries = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;

  const skip = (page - 1) * limit;

  const [enquiries, total] = await Promise.all([
    Inquiry.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),

    Inquiry.countDocuments(),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        enquiries,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
      "Enquiries fetched successfully"
    )
  );
});


const getRecentUsers = asyncHandler(async (_req, res) => {
  const users = await User.find()
    .select("name email phone role isActive createdAt")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return res
    .status(200)
    .json(new ApiResponse(200, true, "Recent users fetched", users));
});

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find()
    .select("-password -pin -refreshToken -__v") // Exclude sensitive fields
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json(
    new ApiResponse(200, true, "All users fetched successfully", users)
  );
});

const getAllInquiries = asyncHandler(async (req, res) => {
  const { status, inquiryType, page = 1, limit = 10 } = req.query;

  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (inquiryType) {
    filter.inquiryType = inquiryType;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [totalInquiries, inquiries] = await Promise.all([
    Inquiry.countDocuments(filter),
    Inquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        total: totalInquiries,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalInquiries / limit),
        inquiries,
      },
      "Inquiries fetched successfully"
    )
  );
});

const toggleBanUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) throw new ApiError(400, "User ID is required");

  const user = await User.findById(userId);

  if (!user) throw new ApiError(404, "User not found");

  // prevent admin banning themselves (VERY IMPORTANT)
  if (user._id.toString() === req.session.userId.toString())
    throw new ApiError(400, "You cannot ban yourself");

  user.isBanned = !user.isBanned;
  user.bannedAt = user.isBanned ? new Date() : null;

  await user.save();

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isBanned: user.isBanned },
        `User ${user.isBanned ? "banned" : "unbanned"} successfully`
      )
    );
});

/**
 * POST /api/v1/admin/stocks
 * Secure API to add a new unlisted stock to the platform.
 * Protected by checkAuthentication + requireRole("admin") via adminRouter.use().
 * Input is pre-validated by validateBody(validateAddStock) middleware in the route.
 */
const addStock = asyncHandler(async (req, res) => {
  const {
    name, logo, sector, currentPrice, availableQuantity, aboutCompany,
    foundedYear, headquarters, founder, employees, websiteUrl,
    estimatedValuation, minimumInvestmentShares, ipoStatusText, ipoTimeline,
    businessSegments, tag
  } = req.body;

  const trimmedName = name.trim();

  // 1. Check for duplicate stock (case-insensitive exact match)
  const escapedName = trimmedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const existingStock = await Stock.findOne({
    name: { $regex: `^${escapedName}$`, $options: "i" },
  });
  if (existingStock) {
    throw new ApiError(409, "A stock with this name already exists!");
  }

  // 2. Create Stock in DB with duplicate-key race protection
  try {
    const newStock = await Stock.create({
      name: trimmedName,
      logo,
      sector,
      currentPrice,
      previousPrice: currentPrice, // Initialize previousPrice with currentPrice
      availableQuantity,
      aboutCompany,
      foundedYear,
      headquarters,
      founder,
      employees,
      websiteUrl,
      estimatedValuation,
      minimumInvestmentShares,
      ipoStatusText,
      ipoTimeline,
      businessSegments,
      tag
    });

    // 3. Return Response
    return res.status(201).json(
      new ApiResponse(201, true, "New stock added successfully!", newStock)
    );
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "A stock with this name already exists!");
    }
    throw error;
  }
});

/**
 * GET /api/v1/admin/stocks/:name
 * Fetch details of a specific unlisted stock by its name (case-insensitive).
 */
const getStockByName = asyncHandler(async (req, res) => {
  const { name } = req.params;

  if (!name) {
    throw new ApiError(400, "Stock name is required");
  }

  // Case-insensitive exact match
  const escapedName = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const stock = await Stock.findOne({
    name: { $regex: `^${escapedName}$`, $options: "i" },
  });

  if (!stock) {
    throw new ApiError(404, `Stock with name "${name}" not found`);
  }

  return res.status(200).json(
    new ApiResponse(200, true, "Stock details fetched successfully!", stock)
  );
});

/**
 * GET /api/v1/admin/stocks
 * Fetch a list of all unlisted stocks.
 */
const getAllStocks = asyncHandler(async (req, res) => {
  const stocks = await Stock.find().sort({ name: 1 });

  return res.status(200).json(
    new ApiResponse(200, true, "All stocks fetched successfully!", stocks)
  );
});

/**
 * GET /api/v1/admin/orders
 * Fetch a list of all user orders.
 */
const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find()
    .populate("userId", "name email phone")
    .populate("stockId", "name logo sector")
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, true, "All orders fetched successfully!", orders)
  );
});

/**
 * GET /api/v1/admin/orders/:orderId
 * Fetch a specific order by its MongoDB _id or custom orderId (e.g. OTX1003)
 */
const getOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(orderId);

  const order = await Order.findOne(
    isObjectId ? { _id: orderId } : { orderId: orderId }
  )
    .populate("userId", "name email phone")
    .populate("stockId", "name logo sector");

  if (!order) {
    throw new ApiError(404, `Order with ID ${orderId} not found`);
  }

  return res.status(200).json(
    new ApiResponse(200, true, "Order fetched successfully!", order)
  );
});

/**
 * PATCH /api/v1/admin/orders/:orderId
 * Approve or reject an order. If rejected, restores stock quantity.
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    throw new ApiError(400, "Invalid status update. Must be 'approved' or 'rejected'.");
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(orderId);
  const orderQuery = isObjectId ? { _id: orderId } : { orderId: orderId };

  // 1. Start MongoDB ACID Transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  let order;
  try {
    // 2. Atomically claim the order ONLY if it is currently "pending"
    order = await Order.findOneAndUpdate(
      { ...orderQuery, status: "pending" },
      { $set: { status } },
      { new: true, session }
    );

    if (!order) {
      await session.abortTransaction();
      session.endSession();
      throw new ApiError(400, "Order not found, or it has already been processed by another admin.");
    }

    // 3. If rejected, restore stock available quantity and refund totalPayable (base + fee + GST) to user's wallet
    if (status === "rejected") {
      if (order.stockId) {
        await Stock.findByIdAndUpdate(
          order.stockId,
          { $inc: { availableQuantity: order.quantity } },
          { session }
        );
      }

      // Refund the total amount deducted (base amount + fee + gst) to user's wallet
      const refundAmount = order.totalPayable;
      await Wallet.findOneAndUpdate(
        { userId: order.userId },
        { $inc: { balance: refundAmount } },
        { upsert: true, session }
      );

      // Log the refund transaction
      await WalletTransaction.create(
        [
          {
            userId: order.userId,
            transactionId: `REF_${order._id}`,
            depositAmount: refundAmount,
            gatewayFee: 0,
            gst: 0,
            totalAmount: refundAmount,
            type: "refund",
            status: "success",
            paymentDetails: { orderId: order._id },
          },
        ],
        { session }
      );
    }

    // 4. Commit transaction
    await session.commitTransaction();
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    session.endSession();
  }

  // 5. Post-commit: compute recommendation and log action
  let algoRecommendation = "UNKNOWN";
  if (order.stockId) {
    const stock = await Stock.findById(order.stockId);
    if (stock) {
      const totalPlatformImpact = (stock.currentPrice - order.pricePerShare) * order.quantity;
      algoRecommendation = totalPlatformImpact > 0 ? "REJECT" : "APPROVE";
    }
  }

  await logAdminAction(
    req, 
    req.session.userId, 
    "UPDATE_ORDER", 
    `Admin updated order ${order.orderId || order._id} to ${status.toUpperCase()}. (Algorithm Recommendation at time of action: ${algoRecommendation})`
  );

  const populatedOrder = await Order.findById(order._id)
    .populate("userId", "name email phone")
    .populate("stockId", "name logo sector");

  return res.status(200).json(
    new ApiResponse(200, true, `Order status updated to ${status} successfully!`, populatedOrder)
  );
});

/**
 * GET /api/v1/admin/orders/:orderId/analyze
 * Intelligent analysis to recommend whether to approve or reject a pending order
 * based on the platform's profit/loss margins (Live Price vs Locked Purchase Price).
 */
const analyzeOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(orderId);

  // 1. Fetch order with stock and user details
  const order = await Order.findOne(
    isObjectId ? { _id: orderId } : { orderId: orderId }
  )
    .populate("stockId", "name currentPrice")
    .populate("userId", "name phone");

  if (!order) throw new ApiError(404, `Order with ID ${orderId} not found`);

  if (!order.stockId) {
    throw new ApiError(422, `The stock referenced by this order no longer exists in the database.`);
  }
  if (!order.userId) {
    throw new ApiError(422, `The user who placed this order no longer exists in the database.`);
  }
  
  if (order.status !== "pending") {
    throw new ApiError(400, "Order is not pending approval. Only pending orders can be analyzed.");
  }

  // 2. Calculate platform impact (all amounts in Paise for precision)
  const userLockedPrice = order.pricePerShare;
  const liveStockPrice = order.stockId.currentPrice;
  const quantity = order.quantity;
  const priceDiffPerShare = liveStockPrice - userLockedPrice;
  const totalPlatformImpact = priceDiffPerShare * quantity;

  // 3. Recommendation logic (Buy orders)
  // Live price > locked price = platform loss = REJECT
  // Live price <= locked price = platform profit = APPROVE
  let recommendation, reason;

  if (liveStockPrice > userLockedPrice) {
    recommendation = "REJECT";
    reason = `The live stock price (₹${(liveStockPrice / 100).toFixed(2)}) ` +
             `is higher than the user's locked price ` +
             `(₹${(userLockedPrice / 100).toFixed(2)}). ` +
             `Approving will result in a platform loss of ` +
             `₹${(Math.abs(totalPlatformImpact) / 100).toFixed(2)} ` +
             `for ${quantity} shares.`;
  } else {
    recommendation = "APPROVE";
    reason = `Favorable pricing: The live stock price ` +
             `(₹${(liveStockPrice / 100).toFixed(2)}) is lower than ` +
             `or equal to the user's locked price ` +
             `(₹${(userLockedPrice / 100).toFixed(2)}). ` +
             `Approving will result in a platform gain of ` +
             `₹${(Math.abs(totalPlatformImpact) / 100).toFixed(2)} ` +
             `for ${quantity} shares.`;
  }


  // 5. Return response
  return res.status(200).json(
    new ApiResponse(200, true, "Order analysis generated successfully.", {
      orderId: order.orderId,
      stockName: order.stockId.name,
      userName: order.userId.name,
      userPhone: order.userId.phone,
      quantity,
      userLockedPrice,
      liveStockPrice,
      priceDifferencePerShare: priceDiffPerShare,
      totalPlatformImpact,
      recommendation,
      reason,
      analysisNote: "Admin override allowed — final decision is yours."
    })
  );
});

const updateStock = asyncHandler(async (req, res) => {
  const { stockId } = req.params;
  const {
    currentPrice, availableQuantity, name, logo, sector, aboutCompany,
    foundedYear, headquarters, founder, employees, websiteUrl,
    estimatedValuation, minimumInvestmentShares, ipoStatusText, ipoTimeline,
    businessSegments, tag, isActive
  } = req.body;

  const stock = await Stock.findById(stockId);
  if (!stock) throw new ApiError(404, "Stock not found");

  // Smart Price Change Logic:
  // If the price is being updated to a NEW price, save the old price as previousPrice
  if (currentPrice !== undefined && currentPrice !== stock.currentPrice) {
    stock.previousPrice = stock.currentPrice;
    stock.currentPrice = currentPrice;
  }

  if (availableQuantity !== undefined) stock.availableQuantity = availableQuantity;
  if (name !== undefined) stock.name = name;
  if (logo !== undefined) stock.logo = logo;
  if (sector !== undefined) stock.sector = sector;
  if (aboutCompany !== undefined) stock.aboutCompany = aboutCompany;

  if (foundedYear !== undefined) stock.foundedYear = foundedYear;
  if (headquarters !== undefined) stock.headquarters = headquarters;
  if (founder !== undefined) stock.founder = founder;
  if (employees !== undefined) stock.employees = employees;
  if (websiteUrl !== undefined) stock.websiteUrl = websiteUrl;

  if (estimatedValuation !== undefined) stock.estimatedValuation = estimatedValuation;
  if (minimumInvestmentShares !== undefined) stock.minimumInvestmentShares = minimumInvestmentShares;
  if (ipoStatusText !== undefined) stock.ipoStatusText = ipoStatusText;
  if (ipoTimeline !== undefined) stock.ipoTimeline = ipoTimeline;

  if (businessSegments !== undefined) stock.businessSegments = businessSegments;
  if (tag !== undefined) stock.tag = tag;
  if (isActive !== undefined) stock.isActive = isActive;

  await stock.save();

  await logAdminAction(req, req.session.userId, "UPDATE_STOCK", `Updated stock ${stock.name}`);

  return res.status(200).json(new ApiResponse(200, true, "Stock updated successfully", stock));
});

const getAdminLogs = asyncHandler(async (req, res) => {
  const logs = await AdminLog.find()
    .populate("adminId", "name email")
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json(new ApiResponse(200, true, "Logs fetched successfully", logs));
});

/**
 * @desc Get all platform transactions
 * @route GET /api/v1/admin/transactions
 */
const getAllTransactions = asyncHandler(async (req, res) => {
  const transactions = await WalletTransaction.find()
    .select("transactionId depositAmount gatewayFee gst totalAmount type status createdAt updatedAt -_id")
    .populate("userId", "name email phone -_id")
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json(
    new ApiResponse(200, true, "Transactions fetched successfully", transactions)
  );
});

/*
SECURITY: Uses MongoDB _id for routing (unguessable BOLA protection).
OTXW1001 withdrawId is display-only — never used in API URLs.
Ownership verified via userId: req.user._id on all user routes.
ACID Transaction & DB Cooldown Constraints active.
*/
const getAllWithdrawals = asyncHandler(async (req, res) => {
  const withdrawals = await WithdrawalRequest.find()
    .populate("userId", "name email phone -_id")
    .populate("processedBy", "name email -_id")
    .select("-__v") // MUST return _id
    .sort({ createdAt: -1 })
    .lean();

  // Decrypt and sanitize fields explicitly before sending to admin UI
  const securedWithdrawals = withdrawals.map((w) => {
    let maskedAccount = "N/A";
    let decryptedIfsc = "N/A";
    let bankDetailsDecryptionFailed = false;

    if (w.bankDetails && w.bankDetails.accountNumber) {
      try {
        const rawNumber = decrypt(w.bankDetails.accountNumber);
        maskedAccount = "********" + rawNumber.slice(-4);
      } catch (err) {
        bankDetailsDecryptionFailed = true;
      }
    }

    if (w.bankDetails && w.bankDetails.ifscCode) {
      try {
        decryptedIfsc = decrypt(w.bankDetails.ifscCode);
      } catch (err) {
        bankDetailsDecryptionFailed = true;
      }
    }

    return {
      _id: w._id,
      withdrawId: w.withdrawId,
      amount: w.amount,
      feeAmount: w.feeAmount,
      gstAmount: w.gstAmount,
      netAmountToBank: w.netAmountToBank,
      status: w.status,
      utrNumber: w.utrNumber || null,
      cashfreeReferenceId: w.cashfreeReferenceId || null,
      rejectionReason: w.rejectionReason || null,
      adminNote: w.adminNote || null,
      createdAt: w.createdAt,
      processedAt: w.processedAt || null,
      userId: w.userId,
      processedBy: w.processedBy,
      bankDetails: w.bankDetails
        ? {
            bankName: w.bankDetails.bankName || "N/A",
            accountHolder: w.bankDetails.accountHolder || "N/A",
            accountNumber: maskedAccount,
            ifscCode: decryptedIfsc,
          }
        : null,
      bankDetailsDecryptionFailed,
    };
  });

  return res.status(200).json(
    new ApiResponse(200, true, "Withdrawal requests fetched successfully", securedWithdrawals)
  );
});

/*
SECURITY: Uses MongoDB _id for routing (unguessable BOLA protection).
OTXW1001 withdrawId is display-only — never used in API URLs.
Ownership verified via userId: req.user._id on all user routes.
ACID Transaction & DB Cooldown Constraints active.
*/
const rejectWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  if (!rejectionReason) {
    throw new ApiError(400, "Rejection reason is required.");
  }

  // Start MongoDB ACID Transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Step 1: Atomically lock the status
    const withdrawal = await WithdrawalRequest.findOneAndUpdate(
      { _id: id, status: "Pending" },
      {
        status: "Rejected",
        rejectionReason,
        processedBy: req.user._id,
        processedAt: new Date()
      },
      { new: true, session }
    ).select("-__v -bankDetails.accountNumber");

    if (!withdrawal) {
      throw new ApiError(400, "Withdrawal request is already processed or does not exist.");
    }

    // Step 2: Refund exact deducted amount back to user's wallet
    await Wallet.findOneAndUpdate(
      { userId: withdrawal.userId },
      { $inc: { balance: withdrawal.amount } }, // Refunds base amount (total deduction)
      { new: true, session }
    );

    // Log Wallet Transaction for Refund
    await WalletTransaction.create(
      [
        {
          userId: withdrawal.userId,
          transactionId: `${withdrawal.withdrawId}-REFUND`,
          type: "refund",
          totalAmount: withdrawal.amount,
          depositAmount: withdrawal.amount,
          gatewayFee: 0,
          gst: 0,
          status: "success",
          description: `Refund for rejected withdrawal ${withdrawal.withdrawId}`,
        },
      ],
      { session }
    );

    // Step 3: Mark the original Withdrawal WalletTransaction as "failed"
    // This ensures the user's ledger shows "failed" instead of "pending" for the withdrawal entry
    await WalletTransaction.findOneAndUpdate(
      { transactionId: withdrawal.withdrawId },
      { status: "failed" },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Log the admin action asynchronously
    await logAdminAction(req, req.user._id, "UPDATE", `Rejected withdrawal ${withdrawal.withdrawId}`);

    return res.status(200).json(
      new ApiResponse(200, true, "Withdrawal rejected and amount refunded successfully", {})
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

/*
SECURITY: Uses MongoDB _id for routing (unguessable BOLA protection).
OTXW1001 withdrawId is display-only — never used in API URLs.
Ownership verified via userId: req.user._id on all user routes.
ACID Transaction & DB Cooldown Constraints active.
*/
const approveWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { utrNumber, method } = req.body;

  // ── Step 1: Fetch withdrawal WITHOUT approving yet ───────────────
  const pendingWithdrawal = await WithdrawalRequest.findOne({
    _id: id,
    status: "Pending"
  }).select("-__v");

  if (!pendingWithdrawal) {
    throw new ApiError(400, "Withdrawal request is already processed or does not exist.");
  }

  // ── Step 2: Legacy safety guard ──────────────────────────────────
  // Protects against old requests created before fee structure migration
  if (!pendingWithdrawal.netAmountToBank) {
    throw new ApiError(
      500,
      "Legacy withdrawal request is missing 'netAmountToBank'. Please reject this manually."
    );
    // No revert needed — we never approved it
  }

  // ── Steps 3 & 4: Atomic daily-limit check + status lock ─────────
  //
  // WHY A TRANSACTION HERE?
  // Without a transaction, two admins can simultaneously read the same daily
  // total (e.g. ₹20,000), both see the limit as unbreached, and both approve
  // different withdrawals — together exceeding the cap. Wrapping the aggregate
  // and the findOneAndUpdate in a single session serialises concurrent approvals:
  // the second admin's aggregate will see the first's committed Approved record
  // and correctly block the over-limit request.
  //
  // IMPORTANT: This requires MongoDB to run as a replica set (even a single-node
  // one started with --replSet). Atlas M0+ clusters satisfy this automatically.
  // On a standalone mongod you must promote it to a single-node replica set first.

  const approvalSession = await mongoose.startSession();
  approvalSession.startTransaction();

  let withdrawal; // declared here so Step 5 onward can access it after commit

  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0); // UTC to prevent timezone bugs

    // Step 3: Daily Circuit Breaker — runs inside the transaction so no
    // other concurrent approval can sneak through between this read and the
    // write in Step 4 below.
    const dailyPayouts = await WithdrawalRequest.aggregate([
      {
        $match: {
          status: { $in: ["Approved", "Processing", "Completed"] },
          processedAt: { $gte: todayStart }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" }
        }
      }
    ]).session(approvalSession); // bind aggregate to the transaction session

    const todayTotal = dailyPayouts[0]?.totalAmount || 0;
    const parsedLimit = parseInt(process.env.DAILY_PAYOUT_LIMIT || "100000");
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      await approvalSession.abortTransaction();
      approvalSession.endSession();
      throw new ApiError(500, "Server misconfiguration: DAILY_PAYOUT_LIMIT is not a valid positive number.");
    }
    const DAILY_LIMIT_PAISE = parsedLimit * 100;

    if (todayTotal + pendingWithdrawal.amount > DAILY_LIMIT_PAISE) {
      await approvalSession.abortTransaction();
      approvalSession.endSession();
      throw new ApiError(
        429,
        `Daily payout limit of ₹${DAILY_LIMIT_PAISE / 100} exceeded. Cannot process this request today.`
      );
    }

    // Step 4: Atomically lock status — within the same transaction.
    // The { _id, status: "Pending" } filter is still the per-withdrawal race
    // guard: it prevents two admins from double-approving the same request.
    withdrawal = await WithdrawalRequest.findOneAndUpdate(
      { _id: id, status: "Pending" },
      {
        status: "Approved",
        processedBy: req.user._id,
        processedAt: new Date()
      },
      { new: true, session: approvalSession }
    ).select("-__v");

    if (!withdrawal) {
      // Another admin approved this specific request between our Step 1 fetch
      // and this update — abort and surface the existing race-guard message.
      await approvalSession.abortTransaction();
      approvalSession.endSession();
      throw new ApiError(400, "Race condition detected: request was just processed by another admin.");
    }

    await approvalSession.commitTransaction();

  } catch (err) {
    // Only abort if the transaction is still active (limit & race errors already
    // called abortTransaction + endSession before re-throwing).
    if (approvalSession.inTransaction()) {
      await approvalSession.abortTransaction();
    }
    // endSession is idempotent — safe to call even if already ended.
    approvalSession.endSession();
    throw err; // re-throw so asyncHandler returns the correct HTTP error
  }

  approvalSession.endSession(); // clean up on the happy path

  // ── Step 5: Decrypt bank details ─────────────────────────────────
  // Use .toObject() to convert the Mongoose subdocument to a plain JS object before
  // spreading. Without this, schema fields like accountHolder and bankName may not
  // enumerate correctly during spread, causing them to be undefined when passed to
  // triggerAutomatedPayout — which would make Cashfree reject the beneficiary creation.
  const decryptedBankDetails = {
    ...withdrawal.bankDetails.toObject(),
    accountNumber: decrypt(withdrawal.bankDetails.accountNumber),
    ifscCode: decrypt(withdrawal.bankDetails.ifscCode)
  };

  // ── Step 6: Trigger payout ───────────────────────────────────────

  if (method === "manual") {
    // ── MANUAL PAYOUT (Skip Cashfree) ──────────────────────────────
    // Admin says they already transferred the money manually.
    // We MUST have a valid UTR before marking as Completed.

    if (!utrNumber || typeof utrNumber !== "string" || !utrNumber.trim()) {
      throw new ApiError(400, "UTR number is required for manual payouts.");
    }

    // Universal UTR Validation: 12 to 22 alphanumeric characters
    const utrRegex = /^[a-zA-Z0-9]{12,22}$/;
    if (!utrRegex.test(utrNumber.trim())) {
      throw new ApiError(400, "Invalid UTR format. Must be 12-22 alphanumeric characters.");
    }

    // Atomic update: both WithdrawalRequest and WalletTransaction
    // must succeed together or both roll back.
    const manualSession = await mongoose.startSession();
    manualSession.startTransaction();

    try {
      await WithdrawalRequest.findByIdAndUpdate(id, {
        status: "Completed",
        utrNumber: utrNumber.trim()
      }, { session: manualSession });

      await WalletTransaction.findOneAndUpdate(
        { transactionId: withdrawal.withdrawId },
        { status: "success" },
        { session: manualSession }
      );

      await manualSession.commitTransaction();
    } catch (manualError) {
      await manualSession.abortTransaction();
      throw manualError;
    } finally {
      manualSession.endSession();
    }

    await logAdminAction(req, req.user._id, "UPDATE", `Approved manual withdrawal ${withdrawal.withdrawId} with UTR ${utrNumber.trim()}`);

    return res.status(200).json(
      new ApiResponse(200, true, "Manual withdrawal approved successfully", { utrNumber: utrNumber.trim() })
    );
  }

  // ── AUTOMATED PAYOUT ─────────────────────────────────────────────
  try {
    // Send netAmountToBank to Cashfree — NOT gross amount
    // netAmountToBank = requestedAmount - fee - GST (Option A inclusive)
    const payoutResult = await triggerAutomatedPayout(
      withdrawal.netAmountToBank,
      decryptedBankDetails,
      withdrawal.withdrawId,
      withdrawal.userId
    );

    // WalletTransaction remains "pending" until Cashfree Webhook confirms it.

    // Store Cashfree reference ID in dedicated field — NOT utrNumber
    // utrNumber will be filled by webhook when bank confirms actual UTR
    await WithdrawalRequest.findByIdAndUpdate(id, {
      cashfreeReferenceId: payoutResult.cashfreeReferenceId || null
    });

    await logAdminAction(
      req,
      req.user._id,
      "UPDATE",
      `Approved automated withdrawal ${withdrawal.withdrawId}`
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        true,
        "Withdrawal approved. Automated payout triggered successfully.",
        { cashfreeReferenceId: payoutResult.cashfreeReferenceId }
      )
    );

  } catch (cashfreeError) {
    const isDefinitiveFailure = cashfreeError.statuscode >= 400 && cashfreeError.statuscode < 500;

    if (isDefinitiveFailure) {
      // ── Synchronous Definitive Failure (4xx): Refund user wallet immediately ─────────
      const session = await mongoose.startSession();
      session.startTransaction();

      let refundSuccessful = false;
      try {
        // 1. Refund full requested amount to wallet
        await Wallet.findOneAndUpdate(
          { userId: withdrawal.userId },
          { $inc: { balance: withdrawal.amount } }, // full amount back
          { session }
        );

        // 2. Create FAIL-REFUND audit record
        await WalletTransaction.create([{
          userId: withdrawal.userId,
          transactionId: `${withdrawal.withdrawId}-FAIL-REFUND`,
          type: "refund",
          totalAmount: withdrawal.amount,
          depositAmount: withdrawal.amount,
          gatewayFee: 0,
          gst: 0,
          status: "success",
          description: `Auto-refund: payout rejected by gateway for ${withdrawal.withdrawId}`
        }], { session });

        // 3. Mark original withdrawal WalletTransaction as failed
        await WalletTransaction.findOneAndUpdate(
          { transactionId: withdrawal.withdrawId },
          { status: "failed" },
          { session }
        );

        // 4. Mark WithdrawalRequest as Rejected with Cashfree error
        await WithdrawalRequest.findByIdAndUpdate(
          id,
          {
            status: "Rejected",
            rejectionReason: cashfreeError.message || "Automated payout synchronously rejected by gateway"
          },
          { session }
        );

        await session.commitTransaction();
        refundSuccessful = true;

      } catch (refundError) {
        await session.abortTransaction();
        // CRITICAL: Both payout AND refund failed
        // User money is stuck — ops team must manually intervene
        console.error(
          `CRITICAL: Auto-refund failed for withdrawal ${withdrawal.withdrawId}!`,
          refundError
        );
      } finally {
        session.endSession(); // always runs regardless of outcome
      }

      if (refundSuccessful) {
        throw new ApiError(
          500,
          `Payout definitively rejected: ${cashfreeError.message}. Amount has been automatically refunded to wallet.`
        );
      } else {
        // Force update OUTSIDE the aborted session so the Admin UI sees the critical failure
        await WithdrawalRequest.findByIdAndUpdate(id, {
          status: "Rejected",
          adminNote: `CRITICAL: Payout rejected (${cashfreeError.message}) BUT auto-refund FAILED. User money is stuck. Please manually refund wallet!`,
        });

        throw new ApiError(
          500,
          `Payout definitively rejected: ${cashfreeError.message}, AND auto-refund failed! Manual intervention required.`
        );
      }

    } else {
      // ── Indeterminate Failure (5xx / Timeout): Mark as Processing ─────────
      // DO NOT refund the wallet. Cashfree might have processed it in the background.
      await WithdrawalRequest.findByIdAndUpdate(id, {
        status: "Processing",
        adminNote: `Automated payout hit indeterminate failure (${cashfreeError.statuscode || 'Timeout/Network'}). Check Cashfree dashboard manually. Error: ${cashfreeError.message}`
      });

      throw new ApiError(
        500,
        `Gateway returned indeterminate error. Withdrawal marked as Processing for manual reconciliation. Error: ${cashfreeError.message}`
      );
    }
  }
});



/**
 * SECURITY: Decrypt-on-Demand Architecture.
 * Prevents bulk exposure of sensitive bank data.
 * Only returns the decrypted account number for a specific, authorized request.
 */
const getDecryptedBankDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const withdrawal = await WithdrawalRequest.findById(id).select("bankDetails.accountNumber bankDetails.ifscCode");

  if (!withdrawal || !withdrawal.bankDetails || !withdrawal.bankDetails.accountNumber || !withdrawal.bankDetails.ifscCode) {
    throw new ApiError(404, "Bank details not found for this withdrawal");
  }

  const realAccountNumber = decrypt(withdrawal.bankDetails.accountNumber);
  const realIfscCode = decrypt(withdrawal.bankDetails.ifscCode);

  return res.status(200).json(
    new ApiResponse(200, true, "Bank details decrypted securely", {
      accountNumber: realAccountNumber,
      ifscCode: realIfscCode
    })
  );
});

/**
 * PATCH /api/v1/admin/withdrawals/:id/mark-complete
 * Marks a "Processing" withdrawal as "Completed".
 * Used for indeterminate Cashfree payouts where ops team confirmed the money reached the user.
 */
const markWithdrawalComplete = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const withdrawal = await WithdrawalRequest.findOneAndUpdate(
    { _id: id, status: "Processing" },
    {
      status: "Completed",
      adminNote: "Manually marked as completed after ops verification",
      processedBy: req.user._id,
      processedAt: new Date()
    },
    { new: true }
  );

  if (!withdrawal) {
    throw new ApiError(400, "Withdrawal is not in Processing state or does not exist.");
  }

  await WalletTransaction.findOneAndUpdate(
    { transactionId: withdrawal.withdrawId },
    { status: "success" }
  );

  await logAdminAction(req, req.user._id, "UPDATE", `WITHDRAWAL_MARKED_COMPLETE: ${withdrawal.withdrawId}`);

  return res.status(200).json(
    new ApiResponse(200, true, "Withdrawal marked as completed successfully")
  );
});

/**
 * PATCH /api/v1/admin/withdrawals/:id/manual-refund
 * Refunds a "Processing" withdrawal back to the user's wallet.
 * Used for indeterminate Cashfree payouts where ops team confirmed the money DID NOT reach the user.
 */
const manualRefundWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const withdrawal = await WithdrawalRequest.findOneAndUpdate(
      { _id: id, status: "Processing" },
      {
        status: "Rejected",
        rejectionReason: "Manually refunded after ops verification of gateway failure",
        processedBy: req.user._id,
        processedAt: new Date()
      },
      { session, new: true }
    );

    if (!withdrawal) {
      throw new ApiError(400, "Withdrawal is not in Processing state or does not exist.");
    }

    // 1. Refund full requested amount to wallet
    await Wallet.findOneAndUpdate(
      { userId: withdrawal.userId },
      { $inc: { balance: withdrawal.amount } }, // full amount back
      { session }
    );

    // 2. Create ORDER_REFUND audit record
    await WalletTransaction.create([{
      userId: withdrawal.userId,
      transactionId: `${withdrawal.withdrawId}-MANUAL-REFUND`,
      type: "ORDER_REFUND", // Requested by user
      totalAmount: withdrawal.amount,
      depositAmount: withdrawal.amount,
      gatewayFee: 0,
      gst: 0,
      status: "success",
      description: `Manual refund: payout failed for ${withdrawal.withdrawId}`
    }], { session });

    // 3. Mark original withdrawal WalletTransaction as failed
    await WalletTransaction.findOneAndUpdate(
      { transactionId: withdrawal.withdrawId },
      { status: "failed" },
      { session }
    );

    await logAdminAction(req, req.user._id, "UPDATE", `WITHDRAWAL_MANUAL_REFUND: ${withdrawal.withdrawId}`);

    await session.commitTransaction();

    return res.status(200).json(
      new ApiResponse(200, true, "Withdrawal manually refunded successfully")
    );

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export {
  getDashboardStats,
  getEnquiries,
  getRecentUsers,
  getAllInquiries,
  toggleBanUser,
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
};
