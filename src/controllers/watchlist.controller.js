import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Watchlist } from "../models/watchlist.model.js";
import { Stock } from "../models/stock.model.js";
import mongoose from "mongoose";

/**
 * Helper: check if a string is a valid 24-character hexadecimal MongoDB ObjectId
 */
const isObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(id);

/**
 * Helper: Resolve a stockId that may be an ObjectId or exact stock name
 * into the actual Stock document. Returns null if not found/inactive.
 */
const resolveStock = async (stockId) => {
  if (!stockId || typeof stockId !== "string") return null;

  // 1. Try direct ObjectId lookup
  if (isObjectId(stockId)) {
    const stock = await Stock.findById(stockId).select("name isActive");
    if (stock && stock.isActive) return stock;
  }

  // 2. Try case-insensitive exact name match (handles "Tata Capital", "boAt", etc.)
  const escapedName = stockId.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const byName = await Stock.findOne({
    name: { $regex: new RegExp(`^${escapedName}$`, "i") },
    isActive: true,
  }).select("name isActive");
  if (byName) return byName;

  return null;
};

/**
 * Add a stock to user's personal watchlist
 * POST /api/v1/user/watchlist
 * Body: { stockId }
 */
export const addToWatchlist = asyncHandler(async (req, res) => {
  const { stockId } = req.body;
  const userId = req.user._id;

  // 1. Smart-resolve stockId (ObjectId, name, or slug)
  const stock = await resolveStock(stockId);
  if (!stock) {
    throw new ApiError(404, "Stock not found or inactive.");
  }

  const resolvedId = stock._id;

  // 2. Insert into Watchlist collection, intercept duplicate key error (code 11000)
  try {
    await Watchlist.create({ userId, stockId: resolvedId });
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(400, "Stock already in your watchlist.");
    }
    throw error;
  }

  return res.status(201).json(
    new ApiResponse(201, true, `${stock.name} added to watchlist.`, { stockId: resolvedId })
  );
});

/**
 * Remove a specific stock from user's watchlist
 * DELETE /api/v1/user/watchlist/:stockId
 */
export const removeFromWatchlist = asyncHandler(async (req, res) => {
  const { stockId } = req.params;
  const userId = req.user._id;

  // Smart-resolve: try ObjectId first, then name/slug
  let resolvedId = null;
  if (isObjectId(stockId)) {
    resolvedId = new mongoose.Types.ObjectId(stockId);
  } else {
    const stock = await resolveStock(stockId);
    if (stock) resolvedId = stock._id;
  }

  if (!resolvedId) {
    throw new ApiError(400, "Invalid or unrecognized stock ID.");
  }

  const deleted = await Watchlist.findOneAndDelete({ userId, stockId: resolvedId });
  if (!deleted) {
    throw new ApiError(404, "Stock not found in your watchlist.");
  }

  return res.status(200).json(
    new ApiResponse(200, true, "Stock removed from watchlist.", null)
  );
});

/**
 * Fetch all wishlisted stocks for the authenticated user
 * GET /api/v1/user/watchlist
 */
export const getWatchlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const items = await Watchlist.find({ userId })
    .sort({ createdAt: -1 })
    .populate({
      path: "stockId",
      select: "name logo currentPrice sector isActive tag",
      match: { isActive: true },
    })
    .lean();

  // Filter out any entries where the stock was deleted or inactive
  const cleanList = items
    .filter((item) => item.stockId)
    .map((item) => ({
      watchlistId: item._id,
      addedAt: item.createdAt,
      stock: {
        id: item.stockId._id,
        name: item.stockId.name,
        logo: item.stockId.logo || "",
        currentPrice: item.stockId.currentPrice,
        sector: item.stockId.sector,
        tag: item.stockId.tag || "LIVE",
      },
    }));

  return res.status(200).json(
    new ApiResponse(200, true, "Watchlist fetched successfully.", cleanList)
  );
});

/**
 * Check if a specific stock is in the user's watchlist (for heart icon state)
 * GET /api/v1/user/watchlist/:stockId
 */
export const checkWatchlistStatus = asyncHandler(async (req, res) => {
  const { stockId } = req.params;
  const userId = req.user._id;

  let resolvedId = null;
  if (isObjectId(stockId)) {
    resolvedId = stockId;
  } else {
    const stock = await resolveStock(stockId);
    if (stock) resolvedId = stock._id;
  }

  if (!resolvedId) {
    return res.status(200).json(
      new ApiResponse(200, true, "Status fetched.", { isWatchlisted: false })
    );
  }

  const exists = await Watchlist.exists({ userId, stockId: resolvedId });

  return res.status(200).json(
    new ApiResponse(200, true, "Status fetched.", { isWatchlisted: !!exists })
  );
});

/**
 * Clear all stocks from the user's watchlist
 * DELETE /api/v1/user/watchlist
 */
export const clearWatchlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  await Watchlist.deleteMany({ userId });

  return res.status(200).json(
    new ApiResponse(200, true, "Watchlist cleared successfully.", null)
  );
});
