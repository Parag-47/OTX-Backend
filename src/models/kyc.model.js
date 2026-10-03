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
      // Stored as AES-256-GCM encrypted string (iv:authTag:cipher)
    },
    panHash: {
      type: String,
      // Deterministic HMAC-SHA256 blind index for global duplicate detection across accounts
    },
    panVerified: { type: Boolean, default: false },
    panName: { type: String, default: null },
    
    aadhaarHash: {
      type: String,
      // One-way HMAC-SHA256 non-reversible blind index for fraud prevention & duplicate detection
    },
    aadhaarLast4: {
      type: String,
      trim: true,
      // UIDAI Compliant: Only last 4 digits stored for user display (e.g. XXXXXXXX1234)
    },
    aadhaarVerified: { type: Boolean, default: false },
    aadhaarName: { type: String, default: null },

    address: {
      type: String,
      trim: true,
      maxlength: [500, "Address cannot exceed 500 characters"],
    },
    
    accountNumber: { type: String, default: null },
    ifscCode: { type: String, default: null },
    accountHolderName: { type: String, default: null },
    bankName: { type: String, default: null },
    bankHash: {
      type: String,
      default: null,
    },
    bankVerified: { type: Boolean, default: false },
    bankRegisteredName: { type: String, default: null },
    bankUtr: { type: String, default: null },
  },
  { timestamps: true }
);

// Partial Unique Indexes: Guarantee zero cross-account duplicates at DB level for verified credentials
kycSchema.index(
  { panHash: 1 },
  {
    unique: true,
    partialFilterExpression: { panVerified: true, panHash: { $type: "string" } },
  }
);

kycSchema.index(
  { aadhaarHash: 1 },
  {
    unique: true,
    partialFilterExpression: { aadhaarVerified: true, aadhaarHash: { $type: "string" } },
  }
);

kycSchema.index(
  { bankHash: 1 },
  {
    unique: true,
    partialFilterExpression: { bankVerified: true, bankHash: { $type: "string" } },
  }
);

kycSchema.pre("save", function (next) {
  if (this.isModified("accountNumber") && this.accountNumber && !this.accountNumber.includes(":")) {
    this.accountNumber = encrypt(this.accountNumber);
  }
  next();
});

export const Kyc = model("Kyc", kycSchema);
