import { model, Schema } from "mongoose";

const withdrawalSchema = new Schema(
  {
    withdrawId: {
      type: String,
      unique: true,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number, // in paise
      required: true,
      min: [0, "Amount cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Amount must be an integer (paise)",
      },
    },
    feeAmount: {
      type: Number, // in paise
      required: true,
      min: [0, "Fee amount cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Fee amount must be an integer (paise)",
      },
    },
    gstAmount: {
      type: Number, // in paise
      required: true,
      min: [0, "GST amount cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "GST amount must be an integer (paise)",
      },
    },
    netAmountToBank: {
      type: Number, // in paise
      required: true,
      min: [0, "Net amount cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Net amount must be an integer (paise)",
      },
    },
    bankDetails: {
      accountNumber: { type: String, required: true },
      ifscCode: { type: String, required: true },
      accountHolder: { type: String, required: true },
      bankName: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Processing", "Completed", "Rejected"],
      default: "Pending",
    },
    utrNumber: {
      type: String,
    },
    cashfreeReferenceId: {
      type: String,
    },
    adminNote: {
      type: String,
    },
    rejectionReason: {
      type: String,
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save guard: Reject withdrawal if arithmetic is inconsistent
withdrawalSchema.pre("save", function (next) {
  const expected = this.amount - this.feeAmount - this.gstAmount;
  if (this.netAmountToBank !== expected) {
    return next(
      new Error(
        `Withdrawal arithmetic mismatch: netAmountToBank (${this.netAmountToBank}) !== amount (${this.amount}) - feeAmount (${this.feeAmount}) - gstAmount (${this.gstAmount}) = ${expected}`
      )
    );
  }
  next();
});

// CRUCIAL DB CONSTRAINT: Partial unique index to definitively prevent double-pending requests
withdrawalSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "Pending" } }
);

export const WithdrawalRequest = model("WithdrawalRequest", withdrawalSchema);
