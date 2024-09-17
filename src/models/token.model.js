import mongoose, { Schema } from "mongoose";

const tokenSchema = new Schema({
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    token: {
      type: String,
      required: true,
    }
});

export const Token = mongoose.model("Token", tokenSchema);