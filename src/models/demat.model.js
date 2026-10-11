import { model, Schema } from "mongoose";
import { encrypt } from "../utils/encryption.js";

const dematSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },
    dpName: {
      type: String,
      enum: ["CDSL", "NSDL"],
      required: true,
    },
    dpId: {
      type: String,
      required: true,
      trim: true,
    },
    clientId: {
      type: String,
      required: true,
      trim: true,
    },
    nomineeName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { 
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        if (ret.dpId) ret.dpId = "********" + ret.dpId.slice(-4);
        if (ret.clientId) ret.clientId = "********" + ret.clientId.slice(-4);
        if (ret.nomineeName) ret.nomineeName = "***MASKED***";
        return ret;
      },
    }
  }
);

dematSchema.pre("save", function (next) {
  if (this.isModified("dpId") && this.dpId) {
    this.dpId = encrypt(this.dpId);
  }
  if (this.isModified("clientId") && this.clientId) {
    this.clientId = encrypt(this.clientId);
  }
  if (this.isModified("nomineeName") && this.nomineeName) {
    this.nomineeName = encrypt(this.nomineeName);
  }
  next();
});

export const Demat = model("Demat", dematSchema);
