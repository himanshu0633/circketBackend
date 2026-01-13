const Razorpay = require("razorpay");
const crypto = require("crypto");
const PlayerRegister = require("../models/UserPlayer");

/* ============================
   RAZORPAY INSTANCE (INLINE)
============================ */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* ============================
   CREATE ORDER – ₹500
============================ */
exports.createOrder = async (req, res) => {
  try {
    const { name, email, phone, profileLink, role } = req.body;

    if (!name || !email || !phone || !profileLink || !role) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Create Razorpay Order
    const order = await razorpay.orders.create({
      amount: 500 * 100, // ₹500
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    });

    // Save player with pending status
    const player = await PlayerRegister.create({
      name,
      email,
      phone,
      profileLink,
      role,
      razorpayOrderId: order.id,
      paymentStatus: "pending"
    });

    return res.status(200).json({
      success: true,
      order,
      playerId: player._id
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
   VERIFY PAYMENT & CONFIRM
============================ */
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      playerId
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !playerId) {
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

    // Update registration status
    await PlayerRegister.findByIdAndUpdate(playerId, {
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      paymentStatus: "success"
    });

    return res.status(200).json({
      success: true,
      message: "Registration Confirmed Successfully"
    });

  } catch (error) {
    console.error("Verify Payment Error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed"
    });
  }
};
