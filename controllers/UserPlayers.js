const PlayerRegister = require("../models/UserPlayer");
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

/* ============================
   GET PAYMENT DETAILS
============================ */
exports.getPaymentDetails = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      registrationFee: 500,
      bankDetails: {
        accountName: "CDS PREMIER LEAGUE",
        accountNumber: "123456789012",
        bankName: "State Bank of India",
        branch: "Main Branch, Delhi",
        ifscCode: "SBIN0001234",
        upiId: "cdsleague@okhdfcbank"
      },
      instructions: [
        "Pay ₹500 registration fee using any method",
        "Save the UTR/Reference number from your payment",
        "Fill the form with your details and UTR number",
        "Submit registration - status will be 'pending'",
        "We'll verify your payment manually within 24 hours",
        "You'll receive email confirmation once verified"
      ]
    });

  } catch (error) {
    console.error("Get Payment Details Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get payment details"
    });
  }
};

/* ============================
   SAVE PLAYER REGISTRATION
============================ */
exports.savePlayer = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      profileLink,
      role,
      paymentMethod,
      utrNumber,
      category,
      teamPreference,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation
    } = req.body;

    // Basic validation
    if (!name || !email || !phone || !profileLink || !role || !utrNumber) {
      return res.status(400).json({
        success: false,
        message: "All required fields are missing"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address"
      });
    }

    // Validate phone number (Indian)
    const phoneRegex = /^[6-9]\d{9}$/;
    const cleanedPhone = phone.replace(/\D/g, '');
    if (!phoneRegex.test(cleanedPhone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit Indian phone number"
      });
    }

    // Validate UTR number (minimum 8 characters)
    if (utrNumber.trim().length < 8) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid UTR number (minimum 8 characters)"
      });
    }

    // Check if UTR number already exists
    const existingPlayerWithUTR = await PlayerRegister.findOne({ 
      utrNumber: utrNumber.trim()
    });

    if (existingPlayerWithUTR) {
      return res.status(400).json({
        success: false,
        message: "This UTR number has already been used for registration"
      });
    }

    // Check if email already exists
    const existingPlayerWithEmail = await PlayerRegister.findOne({ 
      email: email.toLowerCase()
    });

    if (existingPlayerWithEmail) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    // Check if phone already exists
    const existingPlayerWithPhone = await PlayerRegister.findOne({ 
      phone: cleanedPhone
    });

    if (existingPlayerWithPhone) {
      return res.status(400).json({
        success: false,
        message: "Phone number already registered"
      });
    }

    const paymentProofFile = req.file ? req.file.filename : null;

    // Prepare player data
    const playerData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: cleanedPhone,
      profileLink: profileLink.trim(),
      role,
      paymentMethod: paymentMethod || 'qr',
      utrNumber: utrNumber.trim(),
      paymentStatus: "pending"
    };

    if (paymentProofFile) {
      playerData.paymentProof = paymentProofFile;
      playerData.proofUploadedAt = new Date();
    }

    // Add optional fields if provided
    if (category) playerData.category = category;
    if (teamPreference) playerData.teamPreference = teamPreference;
    
    if (emergencyContactName && emergencyContactPhone) {
      playerData.emergencyContact = {
        name: emergencyContactName.trim(),
        phone: emergencyContactPhone.replace(/\D/g, ''),
        relation: emergencyContactRelation || "Other"
      };
    }

    // Create new player
    const player = await PlayerRegister.create(playerData);

    return res.status(201).json({
      success: true,
      message: "Registration submitted successfully! Your registration is pending verification.",
      playerId: player._id,
      utrNumber: player.utrNumber,
      data: {
        name: player.name,
        email: player.email,
        role: player.role,
        paymentStatus: player.paymentStatus
      },
      note: "We will verify your payment using the UTR number within 24 hours. You will receive email confirmation once verified."
    });

  } catch (error) {
    console.error("Save Player Error:", error);
    
    if (error.code === 11000) {
      const field = error.message.includes('email') ? 'Email' : 
                   error.message.includes('phone') ? 'Phone number' : 
                   error.message.includes('utrNumber') ? 'UTR number' : 'Field';
      
      return res.status(400).json({
        success: false,
        message: `${field} already registered. Please use different ${field.toLowerCase()}.`
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again."
    });
  }
};

/* ============================
   VERIFY PAYMENT (ADMIN FUNCTION)
============================ */
exports.verifyPayment = async (req, res) => {
  try {
    const { playerId, status, verifiedBy, notes } = req.body;

    if (!playerId || !status || !verifiedBy) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: playerId, status, verifiedBy"
      });
    }

    const player = await PlayerRegister.findById(playerId);
    
    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found"
      });
    }

    player.paymentStatus = status;
    player.verifiedBy = verifiedBy;
    player.verificationDate = new Date();
    if (notes) player.notes = notes;

    await player.save();

    return res.status(200).json({
      success: true,
      message: `Payment ${status} successfully`,
      data: player
    });

  } catch (error) {
    console.error("Verify Payment Error:", error);
    return res.status(500).json({
      success: false,
      message: "Verification failed"
    });
  }
};

/* ============================
   GET ALL PENDING REGISTRATIONS (ADMIN)
============================ */
exports.getPendingRegistrations = async (req, res) => {
  try {
    const pendingPlayers = await PlayerRegister.find({ 
      paymentStatus: "pending" 
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: pendingPlayers.length,
      data: pendingPlayers
    });

  } catch (error) {
    console.error("Get Pending Registrations Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending registrations"
    });
  }
};

/* ============================
   GET ALL PLAYERS (ADMIN)
============================ */
exports.getAllPlayers = async (req, res) => {
  try {
    const { 
      status, 
      role, 
      category,
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    // Filter by status if provided
    if (status && status !== 'all') {
      query.paymentStatus = status;
    }
    
    // Filter by role if provided
    if (role && role !== 'all') {
      query.role = role;
    }
    
    // Filter by category if provided
    if (category && category !== 'all') {
      query.category = category;
    }

    // Pagination
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Fetch players with filters
    const players = await PlayerRegister.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNumber);

    // Get total count for pagination
    const total = await PlayerRegister.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: players,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(total / limitNumber),
        hasNext: pageNumber < Math.ceil(total / limitNumber),
        hasPrev: pageNumber > 1
      },
      filters: {
        status: status || 'all',
        role: role || 'all',
        category: category || 'all'
      }
    });

  } catch (error) {
    console.error("Get All Players Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch players"
    });
  }
};

/* ============================
   CHECK REGISTRATION STATUS
============================ */
exports.checkStatus = async (req, res) => {
  try {
    const { email, utrNumber } = req.query;

    if (!email && !utrNumber) {
      return res.status(400).json({
        success: false,
        message: "Please provide email or UTR number"
      });
    }

    const query = {};
    if (email) query.email = email.toLowerCase();
    if (utrNumber) query.utrNumber = utrNumber.trim();

    const player = await PlayerRegister.findOne(query);
    
    if (!player) {
      return res.status(404).json({
        success: false,
        message: "No registration found with provided details"
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        name: player.name,
        email: player.email,
        phone: player.phone,
        role: player.role,
        category: player.category,
        utrNumber: player.utrNumber,
        paymentStatus: player.paymentStatus,
        registeredAt: player.createdAt,
        verifiedAt: player.verificationDate,
        verifiedBy: player.verifiedBy,
        notes: player.notes
      }
    });

  } catch (error) {
    console.error("Check Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check status"
    });
  }
};

/* ============================
   DASHBOARD STATISTICS (ADMIN)
============================ */
exports.getDashboardStats = async (req, res) => {
  try {
    // Get total counts
    const totalPlayers = await PlayerRegister.countDocuments();
    const verifiedPlayers = await PlayerRegister.countDocuments({ 
      paymentStatus: 'verified' 
    });
    const pendingPlayers = await PlayerRegister.countDocuments({ 
      paymentStatus: 'pending' 
    });
    const rejectedPlayers = await PlayerRegister.countDocuments({ 
      paymentStatus: 'rejected' 
    });

    // Get role-wise counts
    const roleStats = await PlayerRegister.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
          verified: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "verified"] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "rejected"] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get category-wise counts
    const categoryStats = await PlayerRegister.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get monthly registrations
    const monthlyStats = await PlayerRegister.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Format monthly stats
    const formattedMonthlyStats = monthlyStats.map(stat => ({
      month: `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}`,
      count: stat.count
    }));

    // Calculate total collection
    const totalCollection = verifiedPlayers * 500;

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalPlayers,
          verifiedPlayers,
          pendingPlayers,
          rejectedPlayers,
          totalCollection
        },
        roleStats,
        categoryStats,
        monthlyStats: formattedMonthlyStats,
        recentRegistrations: await PlayerRegister.find()
          .sort({ createdAt: -1 })
          .limit(5)
      }
    });

  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics"
    });
  }
};

/* ============================
   SEARCH AND FILTER PLAYERS (ADMIN)
============================ */
exports.searchPlayers = async (req, res) => {
  try {
    const { 
      search, 
      status, 
      role, 
      category,
      startDate, 
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    // Search by name, email, phone, or UTR
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { utrNumber: searchRegex }
      ];
    }

    // Apply filters
    if (status && status !== 'all') query.paymentStatus = status;
    if (role && role !== 'all') query.role = role;
    if (category && category !== 'all') query.category = category;
    
    // Date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Pagination
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const players = await PlayerRegister.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNumber);

    const total = await PlayerRegister.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: players,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(total / limitNumber),
        hasNext: pageNumber < Math.ceil(total / limitNumber),
        hasPrev: pageNumber > 1
      },
      filters: {
        search: search || '',
        status: status || 'all',
        role: role || 'all',
        category: category || 'all',
        startDate: startDate || '',
        endDate: endDate || ''
      }
    });

  } catch (error) {
    console.error("Search Players Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search players"
    });
  }
};

/* ============================
   EXPORT PLAYERS TO EXCEL (ADMIN)
============================ */
exports.exportPlayers = async (req, res) => {
  try {
    const { 
      status, 
      role, 
      category,
      startDate, 
      endDate 
    } = req.query;

    const query = {};
    
    // Apply filters
    if (status && status !== 'all') query.paymentStatus = status;
    if (role && role !== 'all') query.role = role;
    if (category && category !== 'all') query.category = category;
    
    // Date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Fetch all players matching the query
    const players = await PlayerRegister.find(query).sort({ createdAt: -1 });

    if (players.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No players found for export"
      });
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CDS Premier League';
    workbook.created = new Date();

    // Create worksheet
    const worksheet = workbook.addWorksheet('Players Registrations');

    // Define columns
    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Role', key: 'role', width: 15 },
      { header: 'Category', key: 'category', width: 12 },
      { header: 'UTR Number', key: 'utrNumber', width: 20 },
      { header: 'Payment Status', key: 'paymentStatus', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Registration Date', key: 'createdAt', width: 20 },
      { header: 'Verified By', key: 'verifiedBy', width: 20 },
      { header: 'Verification Date', key: 'verificationDate', width: 20 },
      { header: 'Profile Link', key: 'profileLink', width: 40 },
      { header: 'Team Preference', key: 'teamPreference', width: 20 },
      { header: 'Notes', key: 'notes', width: 30 }
    ];

    // Add header row style
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' }
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data rows
    players.forEach((player, index) => {
      const row = worksheet.addRow({
        sno: index + 1,
        name: player.name,
        email: player.email,
        phone: player.phone,
        role: player.role,
        category: player.category || 'Senior',
        utrNumber: player.utrNumber,
        paymentStatus: player.paymentStatus,
        paymentMethod: player.paymentMethod === 'qr' ? 'QR Code' : 'Bank Transfer',
        createdAt: player.createdAt.toLocaleDateString('en-IN'),
        verifiedBy: player.verifiedBy || 'Not Verified',
        verificationDate: player.verificationDate 
          ? player.verificationDate.toLocaleDateString('en-IN') 
          : 'Not Verified',
        profileLink: player.profileLink,
        teamPreference: player.teamPreference || 'Not Specified',
        notes: player.notes || ''
      });

      // Add conditional formatting for status
      const statusCell = row.getCell('paymentStatus');
      if (player.paymentStatus === 'verified') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'C6EFCE' }
        };
      } else if (player.paymentStatus === 'pending') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEB9C' }
        };
      } else if (player.paymentStatus === 'rejected') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC7CE' }
        };
      }
    });

    // Auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `O${players.length + 1}`
    };

    // Freeze header row
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];

    // Set response headers
    const fileName = `cds-premier-league-registrations-${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Export Players Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export data"
    });
  }
};

/* ============================
   GET PLAYER BY ID (ADMIN)
============================ */
exports.getPlayerById = async (req, res) => {
  try {
    const { id } = req.params;

    const player = await PlayerRegister.findById(id);
    
    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: player
    });

  } catch (error) {
    console.error("Get Player By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch player details"
    });
  }
};

/* ============================
   UPDATE PLAYER (ADMIN)
============================ */
exports.updatePlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.__v;

    const player = await PlayerRegister.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Player updated successfully",
      data: player
    });

  } catch (error) {
    console.error("Update Player Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update player"
    });
  }
};

/* ============================
   DELETE PLAYER (ADMIN)
============================ */
exports.deletePlayer = async (req, res) => {
  try {
    const { id } = req.params;

    const player = await PlayerRegister.findByIdAndDelete(id);
    
    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Player deleted successfully"
    });

  } catch (error) {
    console.error("Delete Player Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete player"
    });
  }
};