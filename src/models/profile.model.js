import { model, Schema } from "mongoose";

const profileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      unique: true,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
    },
    dateOfBirth: {
      type: Date,
      required: [true, "Date of birth is required!"],
    },
    fathersName: {
      type: String,
      trim: true,
      minlength: [3, "Name must be at least 3 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
      validate: {
        validator: function (value) {
          return /^[a-zA-Z\s]+$/.test(value);
        },
        message: "Name can only contain letters and spaces",
      },
    },
    incomeRange: {
      type: String,
      enum: ["below_1l", "1_5l", "5_10l", "10l+"],
    },
    phone: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Profile = model("Profile", profileSchema);
