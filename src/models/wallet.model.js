import { model, Schema } from "mongoose";

const walletSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0, // Stored in Paise (e.g. ₹100 is 10000 Paise)
      min: [0, "Wallet balance cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Wallet balance must be an integer (paise)"
      }
    },
  },
  { timestamps: true }
);

export const Wallet = model("Wallet", walletSchema);
