import mongoose, { Schema } from "mongoose";

const userSchema = new Schema({
  email: {
    type: String,
    unique: true,
    index: true,
    require: true,
  },
  phone: {
    type: Number,
    unique: true,
    index: true,
    require: true,
  },
  firstName: {
    type: String,
    required: true,
    validate: (value) => value.length > 3,
  },
  lastName: {
    type: String,
    required: true,
    validate: (value) => value.length > 3,
  },
  gender: {
    type: String,
    enum: ["male" , "female", "others"],
    require: true,
  },
  broker: {
    type: String,
    enum: ["Motilal Oswal", "Upstox", "AliceBlue"],
    require: true,
  },
  traderType: {
    type: String,
    enum: ["Day Trader", "Momentum Trader", "Option Trader", "Swing Trader", "Trend Trader", "Buy Hold Trader"],
    default: "Day Trader",
  },
  source: {
    type: String,
    enum: ["Facebook", "Instagram", "YouTube", "Direct"],
    default: "Direct"
  }
});

export const User = mongoose.model("User", userSchema);