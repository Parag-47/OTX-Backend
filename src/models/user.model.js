import mongoose, { Schema } from "mongoose";

const userSchema = new Schema({
  email: {
    type: String,
    unique: true,
    index: true,
    //require: true,
  },
  password: {
    type: String,
    //require: [true, "Password is Required!"],
  },
  phone: {
    type: Number,
    unique: true,
    index: true,
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
  isActive: {
    type: Boolean,
    default: false,
  },
});

export const User = mongoose.model("User", userSchema);