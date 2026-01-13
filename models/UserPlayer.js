const mongoose = require("mongoose");

const playerRegisterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  profileLink: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: [
      "Batsman",
      "Bowler",
      "Wicket Keeper",
      "Allrounder",
      "Batsman (WC)"
    ],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "pending"
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String
}, { timestamps: true });

module.exports = mongoose.model("PlayerRegister", playerRegisterSchema);
