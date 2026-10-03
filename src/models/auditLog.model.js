import mongoose, { Schema } from "mongoose";

const auditLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true, // e.g., "KYC_PAN_VERIFIED"
    },
    metadata: {
      type: Schema.Types.Mixed, // flexible object for storing masked data
      default: {},
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes for performance optimization
// 1. Fast querying by userId
auditLogSchema.index({ userId: 1, createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);

