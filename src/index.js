import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import foodRoutes from "./routes/food.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import cron from "node-cron";
import FoodItem from "./models/FoodItem.js";
import paymentRoutes from "./routes/payments.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

connectDB();

// Routes
app.use("/api/auth", authRoutes);

app.use("/api/food", foodRoutes);

app.use("/api/notifications", notificationRoutes);

app.use("/api/payments", paymentRoutes);

app.use("/api/subscriptions", subscriptionRoutes);

cron.schedule("0 */2 * * *", async () => {
  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const expired = await FoodItem.updateMany(
      {
        status: "reserved",
        reservedAt: { $lte: twoMinutesAgo },
        pickupConfirmed: false,
      },
      { $set: { status: "available", reservedBy: null, reservedAt: null } }
    );

    if (expired.modifiedCount > 0) {
      console.log(`♻️ Cron released ${expired.modifiedCount} expired reservations`);
    }
  } catch (err) {
    console.error("❌ Cron release error:", err.message);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
