import { model, Schema } from "mongoose";

const tokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    token: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["email_verification", "password_reset"],
      default: "email_verification",
    },
    expiresAt: {
      type: Date,
      default: () => Date.now() + 3600000, // 1 hour
    },
  },
  { timestamps: true }
);

tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Token = model("Token", tokenSchema);
