// models/Team.js
const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema({
  captainId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  teamName: {
    type: String,
    required: true
  },

  totalPlayers: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    enum: ["Pending", "Active"],
    default: "Pending"
  }

}, { timestamps: true });

module.exports = mongoose.model("Team", teamSchema);
