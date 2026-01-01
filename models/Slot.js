const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema({
  slotDate: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  capacity: { type: Number, default: 2 },
  isDisabled: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Slot", slotSchema);
