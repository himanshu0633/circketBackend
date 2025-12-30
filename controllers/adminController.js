const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const TeamMember = require("../models/TeamMember");
const Team = require("../models/Team");
const { sendWelcomeEmail } = require("../utils/emailConfig");

exports.createTeamCaptain = async (req, res) => {
  try {
    const { name, email, phoneNo, password } = req.body;

    // Validation
    if (!name || !email || !phoneNo || !password) {
      return res.status(400).json({ 
        success: false,
        message: "All fields are required" 
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // Phone validation
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phoneNo)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be 10 digits"
      });
    }

    // Check if user exists
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ 
        success: false,
        message: "Email already exists" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Calculate payment due date (7 days from now)
    const paymentDueDate = new Date();
    paymentDueDate.setDate(paymentDueDate.getDate() + 7);

    // Create captain
    const captain = await User.create({
      name,
      email,
      phoneNo,
      password: hashedPassword,
      role: "teamCaptain",
      createdByAdmin: req.user.id,
      paymentStatus: "Pending",
      paymentDueDate,
      image: req.file ? `/uploads/captains/${req.file.filename}` : null
    });

    // Send welcome email (async - don't wait for response)
    let emailSent = false;
    try {
      await sendWelcomeEmail({
        name,
        email,
        password, // Send plain password for initial login
        phoneNo
      });
      emailSent = true;
      console.log(`✅ Welcome email sent to ${email} for captain ${name}`);
    } catch (emailError) {
      console.error(`❌ Failed to send welcome email to ${email}:`, emailError.message);
      // Don't fail the entire request if email fails
    }

    // Remove password from response
    const captainResponse = captain.toObject();
    delete captainResponse.password;

    res.status(201).json({
      success: true,
      message: emailSent 
        ? "Captain created successfully. Welcome email sent." 
        : "Captain created successfully. Email notification failed.",
      captain: captainResponse,
      emailSent
    });

  } catch (err) {
    console.error("❌ Create captain error:", err);
    
    // Handle specific errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(err.errors).map(e => e.message)
      });
    }
    
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email already exists"
      });
    }

    res.status(500).json({ 
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    // Validate status
    if (!["Pending", "Paid"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status. Must be 'Pending' or 'Paid'"
      });
    }

    // Find the captain first
    const captain = await User.findById(id).select("-password");
    
    if (!captain) {
      return res.status(404).json({
        success: false,
        message: "Captain not found"
      });
    }

    // Check if captain belongs to the admin
    // FIXED: Check if createdByAdmin exists before calling toString()
    if (captain.createdByAdmin && captain.createdByAdmin.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only update captains created by you"
      });
    }

    // If createdByAdmin doesn't exist, check if user is updating their own record
    if (!captain.createdByAdmin && captain._id.toString() !== req.user.id && captain.role !== "teamCaptain") {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update this captain"
      });
    }

    // Update payment status
    const updatedCaptain = await User.findByIdAndUpdate(
      id,
      { 
        paymentStatus: status,
        // If marking as paid, remove due date
        ...(status === "Paid" && { paymentDueDate: null })
      },
      { 
        new: true,
        runValidators: true 
      }
    ).select("-password");

    res.json({
      success: true,
      message: `Payment status updated to ${status}`,
      captain: updatedCaptain
    });

  } catch (err) {
    console.error("❌ Update payment error:", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid captain ID"
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
exports.getMyTeamCaptains = async (req, res) => {
  try {
    const captains = await User.find({
      role: "teamCaptain",
      createdByAdmin: req.user.id
    })
    .select("-password")
    .sort({ createdAt: -1 }); // Sort by newest first

    // Calculate stats
    const total = captains.length;
    const paid = captains.filter(c => c.paymentStatus === "Paid").length;
    const pending = total - paid;

    res.json({
      success: true,
      total,
      stats: { total, paid, pending },
      captains
    });
  } catch (err) {
    console.error("❌ Get captains error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch team captains"
    });
  }
};
exports.getMyTeam = async (req, res) => {
  try {
    // Current logged-in user की ID (req.user.id middleware से आएगी)
    const currentUserId = req.user.id;
    
    // पहले current user को TeamMember में ढूंढ़ें
    const currentTeamMember = await TeamMember.findOne({
      $or: [
        { _id: currentUserId },
        { email: req.user.email } // अगर user email से login है तो
      ]
    });

    if (!currentTeamMember) {
      return res.status(404).json({
        success: false,
        message: "Team member not found"
      });
    }

    // Current user की teamId से टीम ढूंढ़ें
    const team = await mongoose.model("Team").findById(currentTeamMember.teamId)
      .populate('captainId', 'name email phoneNo')
      .select('-__v');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found"
      });
    }

    // उस टीम के सभी members ढूंढ़ें
    const teamMembers = await TeamMember.find({ teamId: currentTeamMember.teamId })
      .select('-__v')
      .sort({ createdAt: 1 });

    // Format response
    const response = {
      success: true,
      team: {
        _id: team._id,
        teamName: team.teamName,
        sportType: team.sportType || "General",
        totalPlayers: teamMembers.length,
        captain: team.captainId ? {
          id: team.captainId._id,
          name: team.captainId.name,
          email: team.captainId.email,
          phoneNo: team.captainId.phoneNo
        } : null,
        status: team.status,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt
      },
      members: teamMembers.map(member => ({
        _id: member._id,
        name: member.name,
        mobile: member.mobile,
        email: member.email,
        role: member.role,
        isCurrentUser: member._id.toString() === currentUserId.toString(),
        createdAt: member.createdAt
      })),
      currentUserRole: currentTeamMember.role,
      totalMembers: teamMembers.length
    };

    res.json(response);

  } catch (err) {
    console.error("❌ Get my team error:", err);
    
    res.status(500).json({
      success: false,
      message: "Failed to fetch team details",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
exports.deleteCaptain = async (req, res) => {
  try {
    const { id } = req.params;

    const captain = await User.findOne({
      _id: id,
      role: "teamCaptain",
      createdByAdmin: req.user.id
    });

    if (!captain) {
      return res.status(404).json({
        success: false,
        message: "Captain not found or you don't have permission"
      });
    }

    await captain.deleteOne();

    res.json({
      success: true,
      message: "Captain deleted successfully"
    });

  } catch (err) {
    console.error("❌ Delete captain error:", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid captain ID"
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete captain"
    });
  }
};
exports.resendWelcomeEmail = async (req, res) => {
  try {
    const { id } = req.params;

    const captain = await User.findOne({
      _id: id,
      role: "teamCaptain",
      createdByAdmin: req.user.id
    });

    if (!captain) {
      return res.status(404).json({
        success: false,
        message: "Captain not found"
      });
    }

    // Note: In production, you might want to generate a temporary password
    // instead of using the stored hashed password
    await sendWelcomeEmail({
      name: captain.name,
      email: captain.email,
      password: "Use the password you set during registration",
      phoneNo: captain.phoneNo
    });

    res.json({
      success: true,
      message: `Welcome email resent to ${captain.email}`
    });

  } catch (err) {
    console.error("❌ Resend email error:", err);
    
    if (err.message.includes('Failed to send welcome email')) {
      return res.status(500).json({
        success: false,
        message: "Failed to send email. Please check email configuration."
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to resend welcome email"
    });
  }
};
exports.getCaptainStats = async (req, res) => {
  try {
    const captains = await User.find({
      role: "teamCaptain",
      createdByAdmin: req.user.id
    }).select("paymentStatus");

    const total = captains.length;
    const paid = captains.filter(c => c.paymentStatus === "Paid").length;
    const pending = total - paid;

    // Calculate upcoming payments (due in next 3 days)
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);

    const upcomingPayments = await User.countDocuments({
      role: "teamCaptain",
      createdByAdmin: req.user.id,
      paymentStatus: "Pending",
      paymentDueDate: {
        $gte: today,
        $lte: threeDaysLater
      }
    });

    res.json({
      success: true,
      stats: {
        total,
        paid,
        pending,
        upcomingPayments
      }
    });

  } catch (err) {
    console.error("❌ Get stats error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics"
    });
  }
};
exports.getCaptainTeamByAdmin = async (req, res) => {
  try {
    const { captainId } = req.params;

    // 1. Validate admin role (middleware se aaya hoga, phir bhi check)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Only admin can access this endpoint"
      });
    }

    // 2. Captain exists and was created by this admin
    const captain = await User.findOne({
      _id: captainId,
      role: "teamCaptain",
      createdByAdmin: req.user.id
    });

    if (!captain) {
      return res.status(404).json({
        success: false,
        message: "Captain not found or you don't have permission"
      });
    }

    // 3. Get captain's team
    const team = await Team.findOne({ captainId: captainId })
      .populate('captainId', 'name email phoneNo paymentStatus')
      .select('-__v');

    if (!team) {
      return res.json({
        success: true,
        message: "Captain hasn't created a team yet",
        captain: {
          id: captain._id,
          name: captain.name,
          email: captain.email,
          phoneNo: captain.phoneNo,
          paymentStatus: captain.paymentStatus
        },
        team: null,
        members: []
      });
    }

    // 4. Get team members
    const teamMembers = await TeamMember.find({ teamId: team._id })
      .select('-__v')
      .sort({ createdAt: 1 });

    // 5. Format response
    const response = {
      success: true,
      captain: {
        id: captain._id,
        name: captain.name,
        email: captain.email,
        phoneNo: captain.phoneNo,
        paymentStatus: captain.paymentStatus,
        paymentDueDate: captain.paymentDueDate,
        createdAt: captain.createdAt
      },
      team: {
        _id: team._id,
        teamName: team.teamName,
        sportType: team.sportType || "General",
        totalPlayers: team.totalPlayers,
        currentPlayers: teamMembers.length,
        status: team.status,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt
      },
      members: teamMembers.map(member => ({
        _id: member._id,
        name: member.name,
        mobile: member.mobile,
        email: member.email,
        role: member.role,
        status: member.status,
        createdAt: member.createdAt
      })),
      totalMembers: teamMembers.length
    };

    res.json(response);

  } catch (err) {
    console.error("❌ Admin get captain team error:", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid captain ID format"
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to fetch captain's team",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
