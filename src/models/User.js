import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true }, // Firebase UID
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    role: { type: String, enum: ["donor", "recipient", "admin"], default: "donor" },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
