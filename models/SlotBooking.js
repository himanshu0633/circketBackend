const mongoose = require("mongoose");

const slotBookingSchema = new mongoose.Schema({
  slotId: { type: mongoose.Schema.Types.ObjectId, ref: "Slot" },
  groundId: { type: mongoose.Schema.Types.ObjectId, ref: "Ground" },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
  captainId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  bookingStatus: { type: String, default: "confirmed" },
  paymentStatus: { type: String, default: "pending" }

}, { timestamps: true });

slotBookingSchema.index(
  { slotId: 1, teamId: 1, bookingStatus: 1 },
  { unique: true }
);

module.exports = mongoose.model("SlotBooking", slotBookingSchema);
