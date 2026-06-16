import { model, Schema } from "mongoose";

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
  },
  { timestamps: true }
);

export const Kyc = model("Kyc", kycSchema);
