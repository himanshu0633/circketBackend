const Razorpay = require("razorpay");
const crypto = require("crypto");
const PlayerRegister = require("../models/UserPlayer");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* ============================
   STEP 1: CREATE ORDER ONLY
============================ */
exports.createOrder = async (req, res) => {
  try {
    const { amount, currency } = req.body;

    const order = await razorpay.orders.create({
      amount: amount || 50000, // ₹500 default
      currency: currency || "INR",
      receipt: `receipt_${Date.now()}`
    });

    return res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency
      }
    });

  } catch (error) {
    console.error("Create Order Error:", error);
    return res.status(500).json({
      success: false,
      message: "Order creation failed"
    });
  }
};

/* ============================
   STEP 2: VERIFY PAYMENT
============================ */
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment details missing"
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully"
    });

  } catch (error) {
    console.error("Verify Payment Error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed"
    });
  }
};

/* ============================
   STEP 3: SAVE PLAYER AFTER PAYMENT
============================ */
exports.savePlayer = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      profileLink,
      role,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    } = req.body;

    // Check if player already exists with this payment
    const existingPlayer = await PlayerRegister.findOne({ 
      razorpayPaymentId: razorpayPaymentId 
    });

    if (existingPlayer) {
      return res.status(400).json({
        success: false,
        message: "Player already registered with this payment"
      });
    }

    // Create new player
    const player = await PlayerRegister.create({
      name,
      email,
      phone,
      profileLink,
      role,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      paymentStatus: "success",
      registrationDate: new Date()
    });

    return res.status(201).json({
      success: true,
      message: "Player registered successfully",
      playerId: player._id
    });

  } catch (error) {
    console.error("Save Player Error:", error);
    return res.status(500).json({
      success: false,
      message: "Player registration failed"
    });
  }
};