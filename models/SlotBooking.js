// models/SlotBooking.js. book. hogy isme 
const mongoose = require("mongoose");

const slotBookingSchema = new mongoose.Schema({
  slotId: { type: mongoose.Schema.Types.ObjectId, ref: "Slot", required: true },
  groundId: { type: mongoose.Schema.Types.ObjectId, ref: "Ground", required: true },

  teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
  captainId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  bookingStatus: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed" },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" }
}, { timestamps: true });

// ✅ same team cannot book same slot twice (unless cancelled)
slotBookingSchema.index(
  { slotId: 1, teamId: 1, bookingStatus: 1 },
  { unique: true, partialFilterExpression: { bookingStatus: "confirmed" } }
);

module.exports = mongoose.model("SlotBooking", slotBookingSchema);
