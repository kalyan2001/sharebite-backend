import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema(
  {
    recipientId: { type: String, required: true, unique: true }, // Firebase UID
    email: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Subscription", SubscriptionSchema);
