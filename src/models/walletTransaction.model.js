import { model, Schema } from "mongoose";

const walletTransactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true, // Unique index to prevent duplicate credit processing
    },
    depositAmount: {
      type: Number,
      required: true, // net amount to wallet in Paise
      min: [0, "Deposit amount cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Deposit amount must be an integer (paise)",
      },
    },
    gatewayFee: {
      type: Number,
      required: true, // 2% gateway fee in Paise
      min: [0, "Gateway fee cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Gateway fee must be an integer (paise)",
      },
    },
    gst: {
      type: Number,
      required: true, // 18% GST on gatewayFee in Paise
      min: [0, "GST cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "GST must be an integer (paise)",
      },
    },
    totalAmount: {
      type: Number,
      required: true, // total paid in Paise
      min: [0, "Total amount cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Total amount must be an integer (paise)",
      },
    },
    netAmountToBank: {
      type: Number, // Tracking actual bank transfer in Paise
      min: [0, "Net amount cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Net amount must be an integer (paise)",
      },
    },
    description: {
      type: String, // Audit descriptions
    },
    type: {
      type: String,
      enum: ["deposit", "payment", "refund", "withdrawal", "ORDER_REFUND"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    paymentDetails: {
      type: Object, // Raw webhook payload mapping for audit logs
    },
  },
  { timestamps: true }
);

export const WalletTransaction = model("WalletTransaction", walletTransactionSchema);
