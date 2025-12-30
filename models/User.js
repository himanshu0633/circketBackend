const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["admin", "teamCaptain"],
    required: true
  },

  name: String,

  email: {
    type: String,
    unique: true,
    required: true
  },

  phoneNo: String,

  password: String,

  paymentStatus: {
    type: String,
    enum: ["Pending", "Paid"],
    default: "Pending"
  },

  
paymentDueDate: {
  type: Date
},

  // 🔥 WHICH ADMIN CREATED THIS CAPTAIN
  createdByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    immutable: true   // ❌ cannot be changed
  }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
