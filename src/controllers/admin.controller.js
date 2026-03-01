import { User } from "../models/user.model.js";
import { Inquiry } from "../models/inquiry.model.js";

import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

const getDashboardStats = asyncHandler(async (_req, res) => {
  const [
    totalUsers,
    activeUsers,
    adminCount,
    verifiedUsers,
    totalEnquiries,
    recentUsers,
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
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
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
      },
      "Dashboard statistics fetched successfully"
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
    .json(new ApiResponse(200, users, "Recent users fetched"));
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

export {
  getDashboardStats,
  getEnquiries,
  getRecentUsers,
  getAllInquiries,
  toggleBanUser,
};
