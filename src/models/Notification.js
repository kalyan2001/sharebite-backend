import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    forRole: { type: String, enum: ["recipient", "admin"], default: "recipient" },
    readBy: {
      type: Map,
      of: Boolean,
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
