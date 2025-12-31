const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const TeamMember = require("../models/TeamMember");
const Team = require("../models/Team");
const { sendWelcomeEmail, transporter } = require("../utils/emailConfig");

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

    // Password strength validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
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
      emailSent: false, // Initialize emailSent flag
      image: req.file ? `/uploads/captains/${req.file.filename}` : null
    });

    // Send welcome email with detailed logging
    let emailSent = false;
    let emailErrorMsg = null;
    let emailMessageId = null;
    
    try {
      console.log(`📤 [Create Captain] Attempting to send email to: ${email}`);
      console.log(`📨 [Create Captain] From: ${process.env.EMAIL_USER}`);
      console.log(`🔑 [Create Captain] Password length: ${password.length}`);
      
      const emailResult = await sendWelcomeEmail({
        name,
        email,
        password, // Send plain password for initial login
        phoneNo
      });
      
      emailSent = true;
      emailMessageId = emailResult.messageId;
      
      console.log(`✅ [Create Captain] Welcome email sent successfully to ${email}`);
      console.log(`📨 [Create Captain] Message ID: ${emailMessageId}`);
      
      // Update emailSent flag in database
      captain.emailSent = true;
      await captain.save();
      
    } catch (emailError) {
      emailErrorMsg = emailError.message;
      console.error(`❌ [Create Captain] Failed to send welcome email to ${email}:`, {
        message: emailError.message,
        code: emailError.code,
        stack: emailError.stack
      });
      
      // Don't fail the entire request if email fails
    }

    // Remove password from response
    const captainResponse = captain.toObject();
    delete captainResponse.password;

    // Log final status
    console.log(`📊 [Create Captain] Summary:`, {
      name,
      email,
      phoneNo,
      emailSent,
      emailMessageId,
      emailError: emailErrorMsg
    });

    res.status(201).json({
      success: true,
      message: emailSent 
        ? "Captain created successfully. Welcome email sent." 
        : "Captain created successfully. Email notification failed.",
      captain: captainResponse,
      emailSent,
      emailMessageId,
      emailError: emailErrorMsg
    });

  } catch (err) {
    console.error("❌ [Create Captain] Error:", {
      message: err.message,
      stack: err.stack,
      body: req.body
    });
    
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

// Test Email Endpoint
exports.testEmail = async (req, res) => {
  try {
    const testEmail = process.env.TEST_EMAIL || req.body.email;
    
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        message: "Test email required"
      });
    }

    // Test email configuration
    console.log("🔧 Testing email configuration...");
    console.log("Email Host:", process.env.EMAIL_HOST);
    console.log("Email Port:", process.env.EMAIL_PORT);
    console.log("Email User:", process.env.EMAIL_USER ? "Set" : "Not Set");

    await transporter.verify();
    console.log("✅ Email server verified");

    // Send test email
    const mailOptions = {
      from: `"Test Email" <${process.env.EMAIL_USER}>`,
      to: testEmail,
      subject: 'Test Email from CDS Premier League',
      text: 'This is a test email from CDS Premier League Management System',
      html: '<h1>Test Email</h1><p>This is a test email from CDS Premier League Management System</p>'
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Test email sent to ${testEmail}:`, info.messageId);
    
    res.json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`,
      messageId: info.messageId
    });

  } catch (error) {
    console.error("❌ Email test failed:", error);
    
    res.status(500).json({
      success: false,
      message: "Email test failed",
      error: error.message,
      details: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER ? "Set" : "Not Set"
      }
    });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    // Validate status
    const validStatuses = ["Pending", "Paid"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Must be one of: ${validStatuses.join(", ")}`
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

    // Check permissions
    if (req.user.role === "admin") {
      // Admin can only update captains they created
      if (captain.createdByAdmin && captain.createdByAdmin.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "You can only update captains created by you"
        });
      }
    } else if (captain._id.toString() !== req.user.id) {
      // Captains can only update their own status
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update this captain"
      });
    }

    // Prepare update data
    const updateData = { paymentStatus: status };
    
    if (status === "Paid") {
      updateData.paymentDueDate = null;
      updateData.paymentDate = new Date();
    } else if (status === "Pending") {
      // Set due date 7 days from now if not already set
      if (!captain.paymentDueDate) {
        const paymentDueDate = new Date();
        paymentDueDate.setDate(paymentDueDate.getDate() + 7);
        updateData.paymentDueDate = paymentDueDate;
      }
    }

    // Update payment status
    const updatedCaptain = await User.findByIdAndUpdate(
      id,
      updateData,
      { 
        new: true,
        runValidators: true 
      }
    ).select("-password");

    // Log the update
    console.log(`💰 [Payment Update] Captain ${updatedCaptain.email}: ${status}`);

    res.json({
      success: true,
      message: `Payment status updated to ${status}`,
      captain: updatedCaptain
    });

  } catch (err) {
    console.error("❌ [Payment Update] Error:", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid captain ID"
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
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
    .sort({ createdAt: -1 });

    // Calculate stats
    const total = captains.length;
    const paid = captains.filter(c => c.paymentStatus === "Paid").length;
    const pending = total - paid;

    // Get captains with upcoming payments
    const today = new Date();
    const upcomingCaptains = captains.filter(c => 
      c.paymentStatus === "Pending" && 
      c.paymentDueDate && 
      c.paymentDueDate <= new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
    ).length;

    res.json({
      success: true,
      total,
      stats: { 
        total, 
        paid, 
        pending, 
        upcomingPayments: upcomingCaptains 
      },
      captains
    });
  } catch (err) {
    console.error("❌ Get captains error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch team captains",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getMyTeam = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    
    // Find current user in TeamMember
    const currentTeamMember = await TeamMember.findOne({
      $or: [
        { _id: currentUserId },
        { email: req.user.email }
      ]
    });

    if (!currentTeamMember) {
      return res.status(404).json({
        success: false,
        message: "Team member not found"
      });
    }

    // Get team details
    const team = await Team.findById(currentTeamMember.teamId)
      .populate('captainId', 'name email phoneNo')
      .select('-__v');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found"
      });
    }

    // Get all team members
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

    // Check if captain exists and belongs to this admin
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

    // Check if captain has a team
    const team = await Team.findOne({ captainId: id });
    if (team) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete captain who has an active team. Delete the team first."
      });
    }

    await captain.deleteOne();
    
    console.log(`🗑️ Captain deleted: ${captain.email}`);

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
      message: "Failed to delete captain",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
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

    try {
      // For resend, we won't send the password again
      await sendWelcomeEmail({
        name: captain.name,
        email: captain.email,
        password: "[Use your existing password]",
        phoneNo: captain.phoneNo
      });

      // Update emailSent flag
      captain.emailSent = true;
      await captain.save();

      console.log(`📧 Welcome email resent to ${captain.email}`);

      res.json({
        success: true,
        message: `Welcome email resent to ${captain.email}`,
        note: "Captain should use their existing password to login"
      });

    } catch (emailError) {
      console.error(`❌ Failed to resend email to ${captain.email}:`, emailError);
      
      res.status(500).json({
        success: false,
        message: "Failed to send email. Please check email configuration.",
        error: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }

  } catch (err) {
    console.error("❌ Resend email error:", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid captain ID"
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to resend welcome email",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getCaptainStats = async (req, res) => {
  try {
    const captains = await User.find({
      role: "teamCaptain",
      createdByAdmin: req.user.id
    }).select("paymentStatus paymentDueDate");

    const total = captains.length;
    const paid = captains.filter(c => c.paymentStatus === "Paid").length;
    const pending = total - paid;

    // Calculate upcoming payments (due in next 3 days)
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);

    const upcomingPayments = captains.filter(c => 
      c.paymentStatus === "Pending" && 
      c.paymentDueDate && 
      c.paymentDueDate <= threeDaysLater &&
      c.paymentDueDate >= today
    ).length;

    // Calculate overdue payments
    const overduePayments = captains.filter(c => 
      c.paymentStatus === "Pending" && 
      c.paymentDueDate && 
      c.paymentDueDate < today
    ).length;

    res.json({
      success: true,
      stats: {
        total,
        paid,
        pending,
        upcomingPayments,
        overduePayments
      }
    });

  } catch (err) {
    console.error("❌ Get stats error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getCaptainTeamByAdmin = async (req, res) => {
  try {
    const { captainId } = req.params;

    // Check admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Only admin can access this endpoint"
      });
    }

    // Get captain details
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

    // Get captain's team
    const team = await Team.findOne({ captainId: captainId })
      .populate('captainId', 'name email phoneNo paymentStatus')
      .select('-__v');

    // Get team members if team exists
    let teamMembers = [];
    if (team) {
      teamMembers = await TeamMember.find({ teamId: team._id })
        .select('-__v')
        .sort({ createdAt: 1 });
    }

    // Format response
    const response = {
      success: true,
      captain: {
        id: captain._id,
        name: captain.name,
        email: captain.email,
        phoneNo: captain.phoneNo,
        paymentStatus: captain.paymentStatus,
        paymentDueDate: captain.paymentDueDate,
        emailSent: captain.emailSent,
        createdAt: captain.createdAt
      },
      team: team ? {
        _id: team._id,
        teamName: team.teamName,
        sportType: team.sportType || "General",
        totalPlayers: team.totalPlayers,
        currentPlayers: teamMembers.length,
        status: team.status,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt
      } : null,
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

// Add this route to routes file
exports.updateCaptain = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phoneNo } = req.body;

    // Validation
    if (!name && !phoneNo) {
      return res.status(400).json({
        success: false,
        message: "At least one field (name or phoneNo) is required to update"
      });
    }

    // Phone validation if provided
    if (phoneNo) {
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(phoneNo)) {
        return res.status(400).json({
          success: false,
          message: "Phone number must be 10 digits"
        });
      }
    }

    // Find and update captain
    const captain = await User.findOneAndUpdate(
      {
        _id: id,
        role: "teamCaptain",
        createdByAdmin: req.user.id
      },
      {
        ...(name && { name }),
        ...(phoneNo && { phoneNo }),
        ...(req.file && { image: `/uploads/captains/${req.file.filename}` })
      },
      {
        new: true,
        runValidators: true
      }
    ).select("-password");

    if (!captain) {
      return res.status(404).json({
        success: false,
        message: "Captain not found or you don't have permission"
      });
    }

    res.json({
      success: true,
      message: "Captain updated successfully",
      captain
    });

  } catch (err) {
    console.error("❌ Update captain error:", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid captain ID"
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update captain",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};