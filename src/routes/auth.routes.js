import express from "express";
import User from "../models/User.js";
import { auth } from "../config/firebase.js";

const router = express.Router();

// Register new user (after Firebase signup)
router.post("/register", async (req, res) => {
  try {
    const { uid, name, email, phone, role } = req.body;

    // Check if already exists
    const existing = await User.findOne({ uid });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const newUser = new User({ uid, name, email, phone, role });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully", user: newUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Verify login token
router.post("/verify", async (req, res) => {
  try {
    const { token } = req.body;
    const decoded = await auth.verifyIdToken(token);
    const user = await User.findOne({ uid: decoded.uid });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ valid: true, user });
  } catch (err) {
    res.status(401).json({ valid: false, message: "Invalid token" });
  }
});

export default router;
