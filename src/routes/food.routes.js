import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import cloudinary from "../config/cloudinary.js";
import FoodItem from "../models/FoodItem.js";
import Notification from "../models/Notification.js";
//import fetch from "node-fetch";
import { sendEmail } from "../config/email.js";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";

dotenv.config();

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Geocode address using OpenStreetMap API
async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    address
  )}`;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ShareBite-FoodBank/1.0 (contact@sharebite.ca)",
      },
    });

    const text = await response.text();

    // Handle non-JSON responses gracefully
    if (text.startsWith("<")) {
      console.error(
        " Nominatim returned HTML instead of JSON. Possible rate-limit."
      );
      throw new Error("Nominatim rate limit or invalid response");
    }

    const data = JSON.parse(text);
    if (!data.length) throw new Error("Unable to geocode address");

    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch (err) {
    console.error("❌ Geocoding failed:", err.message);
    // Fallback coordinates (center of Kitchener)
    return { lat: 43.4516, lon: -80.4925 };
  }
}

// Calculate distance (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // radius of Earth in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

// Add food route
router.post("/add", upload.single("image"), async (req, res) => {
  try {
    //console.log("📥 Incoming form data:", req.body);
    //console.log("📷 File received:", req.file ? req.file.originalname : "none");

    if (!req.body.donorId) {
      return res.status(400).json({ message: "Donor ID is required" });
    }

    if (!req.body.name || !req.body.category) {
      return res
        .status(400)
        .json({ message: "Name and category are required" });
    }

    if (req.body.quantity <= 0) {
      return res
        .status(400)
        .json({ message: "Quantity must be greater than 0." });
    }

    if (req.file && !req.file.mimetype.startsWith("image/")) {
      return res
        .status(400)
        .json({ message: "Only image uploads are allowed." });
    }

    // Upload image
    let imageURL = "";
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      //console.log(" Uploading to Cloudinary...");

      const uploadResponse = await cloudinary.uploader.upload(dataURI, {
        folder: "food_donations",
        resource_type: "image",
      });

      imageURL = uploadResponse.secure_url;
      //console.log("✅ Cloudinary upload success:", imageURL);
    }

    // Use donor-provided expiryDate
    const expiryDate = new Date(req.body.expiryDate);
    if (isNaN(expiryDate)) {
      return res.status(400).json({ message: "Invalid expiry date format." });
    }

    const food = new FoodItem({
      donorId: req.body.donorId,
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      quantity: req.body.quantity,
      expiryDate,
      pickupAddress: req.body.pickupAddress,
      imageURL,
      status: "available",
    });

    await food.save();
    //console.log("Food item saved to database");

    await Notification.create({
      message: `🍎 New donation posted: ${req.body.name} (${req.body.category}).`,
      forRole: "recipient",
    });

    // Email alerts to all subscribers
    try {
      const subscribers = await Subscription.find({});
      console.log(`📧 Found ${subscribers.length} email subscribers`);

      for (const sub of subscribers) {
        await sendEmail(
          sub.email,
          "New Food Donation Available ",
          `<p>Hi there,</p>
       <p>A new food donation has just been posted on <b>ShareBite</b>.</p>
       <p><b>${food.name}</b> — ${food.category}</p>
       <p><b>Pickup location:</b> ${food.pickupAddress}</p>
       <p><b>Expires:</b> ${new Date(food.expiryDate).toLocaleString()}</p>
       <p>Log in to your ShareBite account to reserve it before it's gone.</p>
       <p style="font-size:12px;color:#666;">
         You received this email because you're subscribed to ShareBite donation alerts.
       </p>`
        );
      }

      console.log("📧 Alert emails sent to subscribers");
    } catch (emailErr) {
      console.error("❌ Failed to send subscription emails:", emailErr);
    }

    res.status(201).json({ message: "Food added successfully", food });
  } catch (err) {
    console.error("❌ Upload/AddFood error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get all food items by donor ID
router.get("/donor/:donorId", async (req, res) => {
  try {
    const { donorId } = req.params;

    //console.log(`📋 Fetching foods for donor: ${donorId}`);

    const foods = await FoodItem.find({ donorId })
      .sort({ createdAt: -1 })
      .lean();

    //console.log(` Found ${foods.length} food items for donor ${donorId}`);

    res.status(200).json(foods);
  } catch (err) {
    console.error("❌ Error fetching donor foods:", err);
    res.status(500).json({
      message: "Failed to fetch food items",
      error: err.message,
    });
  }
});

// Get feed for recipients: available + (my) reserved items
router.get("/available", async (req, res) => {
  try {
    const { recipientId } = req.query;
    const now = new Date();

    // base: not expired
    const baseExpiryFilter = { expiryDate: { $gte: now } };

    // if recipientId provided → include their reserved items too
    const query = recipientId
      ? {
          ...baseExpiryFilter,
          $or: [
            { status: "available" },
            { status: "reserved", reservedBy: recipientId },
          ],
        }
      : {
          ...baseExpiryFilter,
          status: "available",
        };

    const foods = await FoodItem.find(query).sort({ createdAt: -1 }).lean();

    res.status(200).json(foods);
  } catch (err) {
    console.error("❌ Error fetching available feed:", err);
    res.status(500).json({
      message: "Failed to fetch available food items",
      error: err.message,
    });
  }
});

// Get single food item by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    //console.log(`Fetching food item: ${id}`);

    const food = await FoodItem.findById(id);

    if (!food) {
      return res.status(404).json({ message: "Food item not found" });
    }

    //console.log(`Found food item: ${food.name}`);

    res.status(200).json(food);
  } catch (err) {
    console.error("❌ Error fetching food item:", err);
    res.status(500).json({
      message: "Failed to fetch food item",
      error: err.message,
    });
  }
});

// Reserve a food item (Recipient) and email confirmation
router.patch("/:id/reserve", async (req, res) => {
  try {
    const { id } = req.params;
    const { recipientId } = req.body;

    const food = await FoodItem.findById(id);
    if (!food) return res.status(404).json({ message: "Food not found" });

    if (food.status !== "available")
      return res
        .status(400)
        .json({ message: "Food already reserved or picked up" });

    food.status = "reserved";
    food.reservedBy = recipientId;
    food.reservedAt = new Date();
    await food.save();

    // Fetch donor & recipient info (adjust according to your schema)
    const donor = await User.findOne({ uid: food.donorId });
    const recipient = await User.findOne({ uid: recipientId });

    // Send reservation emails
    if (recipient?.email)
      await sendEmail(
        recipient.email,
        "Food Reservation Confirmed 🍽️",
        `<p>Hi ${recipient.name || "Recipient"},</p>
         <p>You have successfully reserved <b>${food.name}</b> from ${
          donor?.name || "a donor"
        }.</p>
         <p>Please pick it up before <b>${new Date(
           food.expiryDate
         ).toLocaleString()}</b>.</p>
         <p>Pickup location: ${food.pickupAddress}</p>`
      );

    if (donor?.email)
      await sendEmail(
        donor.email,
        "Your Donation Has Been Reserved 🤝",
        `<p>Hi ${donor.name || "Donor"},</p>
         <p>Your donation <b>${food.name}</b> has been reserved by ${
          recipient?.name || "a recipient"
        }.</p>
         <p>They will arrive for pickup soon.</p>`
      );

    console.log(`🍽️ ${food.name} reserved by ${recipientId}`);
    res.status(200).json({ message: "Food reserved and emails sent", food });
  } catch (err) {
    console.error("❌ Reserve food error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Release expired reservations
router.patch("/release-expired", async (req, res) => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const expired = await FoodItem.updateMany(
      {
        status: "reserved",
        reservedAt: { $lte: twoHoursAgo },
        pickupConfirmed: false,
      },
      { $set: { status: "available", reservedBy: null, reservedAt: null } }
    );

    console.log(`♻️ Released ${expired.modifiedCount} expired reservations`);
    res.status(200).json({ message: "Expired reservations released" });
  } catch (err) {
    console.error("❌ Release expired error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// pickup with geo-verification and email confirmation
router.patch("/:id/pickup", async (req, res) => {
  try {
    const { id } = req.params;
    const { recipientId, latitude, longitude } = req.body;

    // Find the food item
    const food = await FoodItem.findById(id);
    if (!food) return res.status(404).json({ message: "Food not found" });

    // Check that the recipient is the correct reserver
    if (food.reservedBy !== recipientId)
      return res
        .status(403)
        .json({ message: "You cannot confirm pickup for this item." });

    // Geocode the pickup address
    const { lat, lon } = await geocodeAddress(food.pickupAddress);

    // Compute the distance between pickup point and recipient’s live location
    const distance = calculateDistance(lat, lon, latitude, longitude);
    console.log(`📍 Distance to pickup: ${distance.toFixed(1)} meters`);

    // Reject if recipient is too far (e.g. > 500m)
    if (distance > 500) {
      return res.status(400).json({
        message: `You must be within 500 meters of the pickup location to confirm pickup.`,
        actualDistance: distance.toFixed(1),
      });
    }

    // Mark as picked up
    food.status = "picked_up";
    food.pickupConfirmed = true;
    await food.save();

    // Get donor & recipient user info
    const donor = await User.findOne({ uid: food.donorId });
    const recipient = await User.findOne({ uid: recipientId });

    // Send confirmation emails
    if (donor?.email)
      await sendEmail(
        donor.email,
        "Pickup Completed ✅",
        `<p>Hi ${donor.name || "Donor"},</p>
         <p>Your food item <b>${
           food.name
         }</b> has been successfully picked up.</p>
         <p>Thank you for your contribution to ShareBite!</p>`
      );

    if (recipient?.email)
      await sendEmail(
        recipient.email,
        "Pickup Verified 🍴",
        `<p>Hi ${recipient.name || "Recipient"},</p>
         <p>Your pickup of <b>${
           food.name
         }</b> has been verified successfully (${distance.toFixed(
          1
        )}m from location).</p>
         <p>Enjoy your meal and thank you for helping reduce food waste!</p>`
      );

    console.log(`✅ ${food.name} verified and picked up by ${recipientId}`);

    res.status(200).json({
      message: "Pickup verified and email notifications sent!",
      distance: distance.toFixed(1),
      food,
    });
  } catch (err) {
    console.error("❌ Geo-verification + Email error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
