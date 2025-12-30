// models/TeamMember.js
const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema({
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    required: true
  },

  name: {
    type: String,
    required: true
  },

  mobile: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true
  },

  role: {
    type: String,
    required: true
  }

}, { timestamps: true });

module.exports = mongoose.model("TeamMember", teamMemberSchema);
