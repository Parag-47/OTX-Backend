import { model, Schema } from "mongoose";

const accountClosureSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    state: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    processedBy: { type: Schema.Types.ObjectId, ref: "User" },

    // Auto-calculated at time of request
    pendingSnapshot: {
      pendingOrders: { type: Number, default: 0 },
      pendingWithdrawals: { type: Number, default: 0 },
      walletBalance: { type: Number, default: 0 }, // in Paise
    },

    adminRemarks: { type: String },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

export const AccountClosure = model("AccountClosure", accountClosureSchema);
