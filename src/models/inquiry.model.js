import mongoose, { Schema } from "mongoose";

const inquirySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required!"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required!"],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required!"],
      trim: true,
    },
    inquiryType: {
      type: String,
      enum: ["General Inquiry", "Partnership", "Support"],
      required: [true, "Inquiry type is required!"],
    },
    message: {
      type: String,
      required: [true, "Message is required!"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "in-progress", "resolved", "closed"],
      default: "pending",
    },
    respondedAt: {
      type: Date,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const Inquiry = mongoose.model("Inquiry", inquirySchema);
