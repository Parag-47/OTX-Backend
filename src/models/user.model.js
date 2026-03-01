import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      default: null,
      // unique: true,
      // index: true,
      //require: true,
    },
    password: {
      type: String,
      //require: [true, "Password is Required!"],
    },
    phone: {
      type: Number,
      default: null,
      // unique: true,
      // index: true,
      //require: true,
    },
    name: {
      type: String,
      //required: true,
      validate: (value) => value.length > 3,
    },
    broker: {
      type: String,
      enum: ["Motilal Oswal", "Upstox", "AliceBlue"],
      //require: true,
    },
    traderType: {
      type: String,
      enum: [
        "Day Trader",
        "Momentum Trader",
        "Option Trader",
        "Swing Trader",
        "Trend Trader",
        "Buy Hold Trader",
      ],
      default: "Day Trader",
    },
    source: {
      type: String,
      enum: ["Facebook", "Instagram", "YouTube", "Direct"],
      default: "Direct",
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    verified_email: {
      type: Boolean,
      default: false,
    },
    verified_phone: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    isBanned: {
      type: Boolean,
      default: false,
      index: true,
    },
    banReason: String,
    bannedAt: Date,
  },
  { timestamps: true }
);

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $exists: true } },
  }
);

userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $exists: true } },
  }
);

export const User = mongoose.model("User", userSchema);
