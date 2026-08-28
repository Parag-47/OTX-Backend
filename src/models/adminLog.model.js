import mongoose, { Schema } from "mongoose";

const adminLogSchema = new Schema(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true, // e.g., "LOGIN", "LOGOUT", "UPDATE_STOCK"
    },
    details: {
      type: String,
      required: true, // Description of the action
    },
    ipAddress: {
      type: String,
      default: "Unknown",
    },
  },
  { timestamps: true }
);

export const AdminLog = mongoose.model("AdminLog", adminLogSchema);
