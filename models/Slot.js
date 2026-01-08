const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema({
  slotDate: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },

  capacity: { type: Number, default: 2 },
  isDisabled: { type: Boolean, default: false },

  bookedCount: { type: Number, default: 0 },
  isFull: { type: Boolean, default: false },

  bookedTeams: [{ type: String }],

  // 🔥 ADMIN BOOKING LOG (FULL DETAILS)
  bookingsLog: [
    {
      teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
      teamName: String,

      captainId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      captainName: String,
      captainEmail: String,
      captainMobile: String,

      bookedAt: { type: Date, default: Date.now }
    }
  ]

}, { timestamps: true });

module.exports = mongoose.model("Slot", slotSchema);
