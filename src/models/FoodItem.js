import mongoose from "mongoose";

const FoodItemSchema = new mongoose.Schema(
  {
    donorId: { type: String, required: true }, // Firebase UID
    name: { type: String, required: true },
    description: String,
    category: String,
    quantity: Number,
    expiryDate: Date,
    pickupAddress: String,
    imageURL: String,
    status: { type: String, default: "available" },
    reservedBy: { type: String, default: null },   
    reservedAt: { type: Date, default: null },   
    pickupConfirmed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("FoodItem", FoodItemSchema);
