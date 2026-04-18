import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    externalAuthId: {
      type: String,
      trim: true,
      index: true,
    },
    authProvider: {
      type: String,
      trim: true,
      default: "LOCAL",
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["USER", "TECHNICIAN", "ADMIN"],
      default: "USER",
      index: true,
    },
    department: {
      type: String,
      trim: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model("User", userSchema);
