import { model, Schema } from "mongoose";
const orderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    stockId: {
      type: Schema.Types.ObjectId,
      ref: "Stock",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    pricePerShare: {
      type: Number,
      required: true, // in Paise
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    orderId: {
      type: String,
      unique: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Helper function to get fee percentage based on base amount in Rupees
function getFeePercentage(baseAmountInRupees) {
  if (baseAmountInRupees <= 200000) return 2.0;
  if (baseAmountInRupees <= 300000) return 1.9;
  if (baseAmountInRupees <= 400000) return 1.8;
  if (baseAmountInRupees <= 500000) return 1.7;

  const excess = baseAmountInRupees - 500000;
  const slabIndex = Math.ceil(excess / 100000);
  const rate = 1.70 - slabIndex * 0.01;
  return Math.max(rate, 1.65);
}

// 1. baseAmount (in Paise)
orderSchema.virtual("baseAmount").get(function () {
  return this.quantity * this.pricePerShare;
});

// 2. feePercentage (%)
orderSchema.virtual("feePercentage").get(function () {
  const baseAmountInRupees = (this.quantity * this.pricePerShare) / 100;
  return getFeePercentage(baseAmountInRupees);
});

// 3. transactionFee (in Paise)
orderSchema.virtual("transactionFee").get(function () {
  const baseAmount = this.quantity * this.pricePerShare;
  const feePercent = this.feePercentage;
  return Math.round(baseAmount * (feePercent / 100));
});

// 4. gst (in Paise, 18% of transactionFee)
orderSchema.virtual("gst").get(function () {
  const txFee = this.transactionFee;
  return Math.round(txFee * 0.18);
});

// 5. totalPayable (in Paise)
orderSchema.virtual("totalPayable").get(function () {
  return this.baseAmount + this.transactionFee + this.gst;
});

// 6. refundAmount (in Paise)
orderSchema.virtual("refundAmount").get(function () {
  return this.status === "rejected" ? this.totalPayable : 0;
});


export const Order = model("Order", orderSchema);
