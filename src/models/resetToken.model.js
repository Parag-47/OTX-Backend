import mongoose from "mongoose";

const resetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },

  tokenHash: {
    type: String,
    required: true,
  },

  expiresAt: {
    type: Date,
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    expires: 1800, // 30 minutes TTL
  },
});

// TTL index auto-deletes expired docs
export const ResetToken = mongoose.model("ResetToken", resetTokenSchema);
