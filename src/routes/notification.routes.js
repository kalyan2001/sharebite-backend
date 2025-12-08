import express from "express";
import Notification from "../models/Notification.js";

const router = express.Router();

// Get notifications for recipients
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query; // get userId from query
    const notifications = await Notification.find({
      forRole: "recipient",
    }).sort({ createdAt: -1 });

    const enriched = notifications.map((n) => ({
      _id: n._id,
      message: n.message,
      createdAt: n.createdAt,
      isRead: n.readBy.get(userId) || false,
    }));

    res.status(200).json(enriched);
  } catch (err) {
    console.error("❌ Fetch notifications error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Mark all as read for a specific user
router.put("/mark-read/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find();

    for (const n of notifications) {
      if (!n.readBy.get(userId)) {
        n.readBy.set(userId, true);
        await n.save();
      }
    }

    res.status(200).json({ message: `All marked as read for ${userId}` });
  } catch (err) {
    console.error("❌ Mark read error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
