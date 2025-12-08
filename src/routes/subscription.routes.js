import express from "express";
import Subscription from "../models/Subscription.js";

const router = express.Router();

// simple email regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET status: /api/subscriptions/status?recipientId=xxxx
router.get("/status", async (req, res) => {
  try {
    const { recipientId } = req.query;
    if (!recipientId) {
      return res.status(400).json({ message: "recipientId is required" });
    }

    const sub = await Subscription.findOne({ recipientId });
    if (!sub) {
      return res.status(200).json({ subscribed: false, email: null });
    }

    res.status(200).json({
      subscribed: true,
      email: sub.email,
    });
  } catch (err) {
    console.error("❌ Subscription status error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST subscribe
// body: { recipientId, email }
router.post("/subscribe", async (req, res) => {
  try {
    const { recipientId, email } = req.body;

    if (!recipientId || !email) {
      return res
        .status(400)
        .json({ message: "recipientId and email are required" });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email." });
    }

    const sub = await Subscription.findOneAndUpdate(
      { recipientId },
      { email },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`📧 ${email} subscribed for alerts (recipientId: ${recipientId})`);
    res
      .status(200)
      .json({ message: "Subscribed successfully", subscribed: true, email: sub.email });
  } catch (err) {
    console.error("❌ Subscribe error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE unsubscribe
// body: { recipientId }
router.delete("/unsubscribe", async (req, res) => {
  try {
    const { recipientId } = req.body;
    if (!recipientId) {
      return res.status(400).json({ message: "recipientId is required" });
    }

    const result = await Subscription.findOneAndDelete({ recipientId });

    if (!result) {
      return res
        .status(404)
        .json({ message: "No active subscription found for this user." });
    }

    console.log(`📭 recipientId ${recipientId} unsubscribed from alerts`);
    res
      .status(200)
      .json({ message: "Unsubscribed successfully", subscribed: false });
  } catch (err) {
    console.error("❌ Unsubscribe error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
