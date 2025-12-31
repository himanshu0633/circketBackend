// models/Ground.js
const mongoose = require("mongoose");

const groundSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Ground", groundSchema);
