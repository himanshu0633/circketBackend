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
    lowercase: true,
    unique: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
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
  paymentMethod: {
    type: String,
    enum: ["qr", "bank_transfer"],
    required: true
  },
  utrNumber: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "verified", "rejected"],
    default: "pending"
  },
  verifiedBy: {
    type: String,
    default: null
  },
  verificationDate: {
    type: Date,
    default: null
  },
  registrationFee: {
    type: Number,
    default: 500
  },
  // New fields for additional features
  paymentProof: {
    type: String,
    default: null
  },
  proofUploadedAt: {
    type: Date,
    default: null
  },

  paymentProof: {
  type: String,
  default: null
},
proofUploadedAt: {
  type: Date,
  default: null
},
  category: {
    type: String,
    enum: ["Junior", "Senior", "Veteran"],
    default: "Senior"
  },
  teamPreference: {
    type: String,
    default: null
  },
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
  },
  notes: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted date
playerRegisterSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
});

// Virtual for formatted verification date
playerRegisterSchema.virtual('formattedVerificationDate').get(function() {
  if (!this.verificationDate) return null;
  return this.verificationDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
});

// Indexes for better query performance
playerRegisterSchema.index({ paymentStatus: 1 });
playerRegisterSchema.index({ email: 1 });
playerRegisterSchema.index({ utrNumber: 1 });
playerRegisterSchema.index({ createdAt: -1 });
playerRegisterSchema.index({ role: 1, paymentStatus: 1 });

module.exports = mongoose.model("PlayerRegister", playerRegisterSchema);