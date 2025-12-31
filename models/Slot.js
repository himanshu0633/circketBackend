// models/Slot.js  create hogy 
const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema({
  groundId: { type: mongoose.Schema.Types.ObjectId, ref: "Ground", required: true },

  slotDate: { type: String, required: true },     // "2026-01-05"
  startTime: { type: String, required: true },    // "06:00"
  endTime: { type: String, required: true },      // "07:00"

  capacity: { type: Number, default: 2 },         // ✅ 2 teams
  isDisabled: { type: Boolean, default: false },

  // optimization fields:
  bookingsCount: { type: Number, default: 0 }     // ✅ fast availability
}, { timestamps: true });

// prevent exact duplicate slot
slotSchema.index({ groundId: 1, slotDate: 1, startTime: 1, endTime: 1 }, { unique: true });

module.exports = mongoose.model("Slot", slotSchema);
