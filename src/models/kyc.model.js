import { model, Schema } from "mongoose";
import { encrypt, decrypt } from "../utils/encryption.js";

const kycSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },
    panNumber: {
      type: String,
      trim: true,
      // We don't put regex validation here because the stored value will be an encrypted string
    },
    aadhaarNumber: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, "Address cannot exceed 500 characters"],
    },
    accountNumber: { type: String, default: null },
    ifscCode: { type: String, default: null },
    accountHolderName: { type: String, default: null },
    bankName: { type: String, default: null },
    bankVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

kycSchema.pre("save", function (next) {
  if (this.isModified("accountNumber") && this.accountNumber) {
    this.accountNumber = encrypt(this.accountNumber);
  }
  if (this.isModified("ifscCode") && this.ifscCode) {
    this.ifscCode = encrypt(this.ifscCode);
  }
  next();
});

export const Kyc = model("Kyc", kycSchema);
