import express from "express";
import paypal from "@paypal/checkout-server-sdk";

const router = express.Router();

const environment = new paypal.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_CLIENT_SECRET
);

const paypalClient = new paypal.core.PayPalHttpClient(environment);

// Create order
router.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: process.env.PAYMENT_CURRENCY || "CAD",
            value: amount,
          },
        },
      ],
    });

    const order = await paypalClient.execute(request);
    res.status(200).json({ id: order.result.id });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Capture order
router.post("/capture-order", async (req, res) => {
  try {
    const { orderId } = req.body;

    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    const capture = await paypalClient.execute(request);

    res.status(200).json({ capture: capture.result });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
