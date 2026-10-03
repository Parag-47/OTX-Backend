import mongoose, { Schema } from "mongoose";

const watchlistSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    stockId: {
      type: Schema.Types.ObjectId,
      ref: "Stock",
      required: [true, "Stock ID is required"],
    },
  },
  { timestamps: true }
);

// Compound Unique Index: Enforces at the database layer that a user cannot add the same stock twice
watchlistSchema.index({ userId: 1, stockId: 1 }, { unique: true });

// Index for fast reverse-chronological listing per user
watchlistSchema.index({ userId: 1, createdAt: -1 });

export const Watchlist = mongoose.model("Watchlist", watchlistSchema);
