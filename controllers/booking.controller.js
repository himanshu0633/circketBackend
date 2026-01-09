const mongoose = require("mongoose");
const Slot = require("../models/Slot");
const SlotBooking = require("../models/SlotBooking");
const User = require("../models/User");
const Team = require("../models/Team");
const { sendBookingEmail } = require("../utils/emailConfig");
const Razorpay = require("razorpay");
const crypto = require("crypto");

console.log("🔧 Booking controller loaded");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* --------------------------------------------------
   🔔 EMAIL NOTIFICATION (NON BLOCKING)
-------------------------------------------------- */
const sendBookingNotificationEmail = async ({ slotId, teamId, captainId }) => {
  console.log("📧 Starting email notification process");
  
  try {
    const [team, captain, slot] = await Promise.all([
      Team.findById(teamId).lean(),
      User.findById(captainId).lean(),
      Slot.findById(slotId).populate("groundId", "name").lean()
    ]);

    if (!captain?.email) {
      console.log("❌ Email notification skipped: No captain email");
      return;
    }

    await sendBookingEmail({
      to: captain.email,
      teamName: team?.teamName || "Team",
      slotDate: slot?.slotDate,
      startTime: slot?.startTime,
      endTime: slot?.endTime,
      groundName: slot?.groundId?.name || "Ground"
    });

    console.log("✅ Email sent successfully");

  } catch (error) {
    console.error("❌ Booking email failed:", error.message);
  }
};

/* --------------------------------------------------
   📌 BOOK SLOT - FIXED VERSION
-------------------------------------------------- */
const bookSlot = async (req, res) => {
  console.log("🚀 BOOK SLOT API CALLED");
  console.log(`👤 User from token:`, req.user);
  console.log(`📋 Slot ID: ${req.params.slotId}`);
  console.log(`📦 Body: ${JSON.stringify(req.body)}`);

  const session = await mongoose.startSession();
  console.log("🔐 MongoDB session started");

  let bookedSlotId, bookedTeamId, bookedCaptainId;

  try {
    const { slotId } = req.params;
    const { teamId } = req.body;
    
    // Use captainId from token instead of body for security
    const captainId = req.user._id;

    console.log(`📝 Using captainId from token: ${captainId}`);
    
    bookedSlotId = slotId;
    bookedTeamId = teamId;
    bookedCaptainId = captainId;

    console.log(`🔄 Starting transaction for slot: ${slotId}, team: ${teamId}, captain: ${captainId}`);

    await session.withTransaction(async () => {
      console.log("✅ Transaction started");

      // 1️⃣ Slot exists & enabled
      console.log(`🔍 Step 1: Checking slot availability`);
      const slot = await Slot.findOne({
        _id: slotId,
        isDisabled: false
      }).session(session);

      if (!slot) {
        console.log("❌ Slot not found or disabled");
        throw new Error("Slot not available");
      }
      console.log(`✅ Slot found: ${slot._id}, Date: ${slot.slotDate}`);

      // 2️⃣ Capacity check
      console.log(`🔍 Step 2: Checking capacity`);
      const confirmedCount = await SlotBooking.countDocuments({
        slotId,
        bookingStatus: "confirmed"
      }).session(session);

      console.log(`ℹ️ Current confirmed bookings: ${confirmedCount}/${slot.capacity}`);
      
      if (confirmedCount >= slot.capacity) {
        console.log("❌ Slot is already full");
        throw new Error("Slot is already full");
      }

      // 3️⃣ Prevent same team double booking
      console.log(`🔍 Step 3: Checking if team already booked this slot`);
      const alreadyBooked = await SlotBooking.findOne({
        slotId,
        teamId,
        bookingStatus: "confirmed"
      }).session(session);

      if (alreadyBooked) {
        console.log(`❌ Team ${teamId} already booked this slot`);
        throw new Error("This team has already booked this slot");
      }
      console.log("✅ Team hasn't booked this slot before");

      // 4️⃣ Get team details
      console.log(`🔍 Step 4: Fetching team details`);
      const team = await Team.findById(teamId).session(session);
      
      console.log(`ℹ️ Team found: ${team ? team.teamName : 'No'}`);
      
      if (!team) {
        console.log("❌ Team not found");
        throw new Error("Team not found");
      }

      // 5️⃣ Check if user is the team captain
      console.log(`🔍 Step 5: Verifying user is team captain`);
      if (team.captainId.toString() !== captainId.toString()) {
        console.log("❌ User is not the team captain");
        console.log(`   Team captain: ${team.captainId}`);
        console.log(`   Current user: ${captainId}`);
        throw new Error("Only team captain can book slots");
      }
      
      // 6️⃣ Get user details for logging
      console.log(`🔍 Step 6: Getting user details for booking log`);
      const user = await User.findById(captainId).session(session);
      if (!user) {
        console.log("⚠️ User details not found, but continuing with token info");
      }

      // 7️⃣ Create booking
      console.log("🔍 Step 7: Creating booking record");
      const newBooking = await SlotBooking.create([{
        slotId,
        groundId: slot.groundId,
        teamId,
        captainId,
        bookingStatus: "confirmed",
        paymentStatus: "pending"
      }], { session });

      console.log(`✅ Booking created: ${newBooking[0]._id}`);

      // 8️⃣ Create booking log entry with fallback values
      console.log("🔍 Step 8: Creating booking log entry");
      const bookingLogEntry = {
        teamId: team._id,
        teamName: team.teamName,
        captainId: captainId,
        captainName: user?.name || req.user.name || "Captain",
        captainEmail: user?.email || req.user.email || "",
        captainMobile: user?.mobile || "",
        bookedAt: new Date()
      };

      // 9️⃣ Update slot with booking info
      console.log(`🔍 Step 9: Updating slot with booking info`);
      await Slot.findByIdAndUpdate(
        slotId,
        {
          $addToSet: { 
            bookedTeams: team.teamName,
            bookingsLog: bookingLogEntry
          },
          $inc: { bookedCount: 1 },
          isFull: (confirmedCount + 1) >= slot.capacity
        },
        { session }
      );

      console.log("✅ Slot updated successfully");
    });

    console.log("🎉 Slot booking successful");
    res.json({ 
      success: true, 
      message: "Slot booked successfully"
    });

  } catch (error) {
    console.error("❌ Booking failed:", error.message);
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    console.log("🔓 Ending MongoDB session");
    session.endSession();

    // Send email notification in background
    if (bookedSlotId && bookedTeamId && bookedCaptainId) {
      console.log("📧 Triggering email notification in background");
      sendBookingNotificationEmail({
        slotId: bookedSlotId,
        teamId: bookedTeamId,
        captainId: bookedCaptainId
      }).catch(emailError => {
        console.error("📧 Email notification failed:", emailError.message);
      });
    }
  }
};

/* --------------------------------------------------
   📌 GET TEAM BOOKINGS
-------------------------------------------------- */
const getTeamBookings = async (req, res) => {
  console.log("📋 GET TEAM BOOKINGS API CALLED");
  console.log(`📋 Team ID: ${req.params.teamId}`);
  
  try {
    const { teamId } = req.params;

    const bookings = await SlotBooking.find({
      teamId,
      bookingStatus: "confirmed"
    })
    .populate("slotId", "slotDate startTime endTime")
    .populate("groundId", "name")
    .sort({ createdAt: -1 })
    .lean();

    console.log(`✅ Found ${bookings.length} bookings for team`);
    
    res.json({
      success: true,
      bookings
    });

  } catch (error) {
    console.error("❌ Get team bookings failed:", error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/* --------------------------------------------------
   📌 CANCEL BOOKING - FIXED VERSION
-------------------------------------------------- */
const cancelBooking = async (req, res) => {
  console.log("🗑️ CANCEL BOOKING API CALLED");
  console.log(`👤 User from token:`, req.user);
  console.log(`📋 Booking ID: ${req.params.bookingId}`);
  
  const session = await mongoose.startSession();
  console.log("🔐 MongoDB session started for cancellation");

  try {
    const { bookingId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    console.log(`🔍 Processing cancellation for booking: ${bookingId}`);
    console.log(`👤 User ID: ${userId}, Role: ${userRole}`);

    await session.withTransaction(async () => {
      console.log("✅ Transaction started for cancellation");

      // 1️⃣ Find booking
      console.log(`🔍 Step 1: Finding booking`);
      const booking = await SlotBooking.findOne({
        _id: bookingId,
        bookingStatus: "confirmed"
      })
      .populate("teamId", "teamName captainId")
      .populate("slotId", "slotDate startTime endTime")
      .session(session);

      if (!booking) {
        console.log("❌ Booking not found or already cancelled");
        throw new Error("Booking not found");
      }
      
      console.log(`✅ Booking found: ${booking._id}`);
      console.log(`ℹ️ Team: ${booking.teamId?.teamName}`);
      console.log(`ℹ️ Slot: ${booking.slotId?.slotDate} ${booking.slotId?.startTime}`);
      console.log(`ℹ️ Captain from booking: ${booking.captainId}`);
      console.log(`ℹ️ Current user: ${userId}`);

      // 2️⃣ Authorization check
      console.log(`🔍 Step 2: Checking authorization`);
      const isTeamCaptain = booking.captainId.toString() === userId.toString();
      const isTeamOwner = booking.teamId?.captainId?.toString() === userId.toString();
      const isAdmin = userRole === 'admin';
      
      console.log(`🔍 Authorization check:
        - Is team captain: ${isTeamCaptain}
        - Is team owner: ${isTeamOwner}
        - Is admin: ${isAdmin}`);
      
      if (!isTeamCaptain && !isAdmin && !isTeamOwner) {
        console.log("❌ User not authorized to cancel this booking");
        throw new Error("You are not authorized to cancel this booking");
      }
      console.log("✅ User authorized to cancel");

      // 3️⃣ Update booking status
      console.log(`🔍 Step 3: Updating booking status to 'cancelled'`);
      await SlotBooking.findByIdAndUpdate(
        bookingId,
        { bookingStatus: "cancelled" },
        { session }
      );
      console.log("✅ Booking status updated");

      // 4️⃣ Get team name for slot update
      const team = await Team.findById(booking.teamId._id).session(session);
      const teamName = team?.teamName || "Team";

      // 5️⃣ Update slot - remove team from bookedTeams
      console.log(`🔍 Step 4: Updating slot`);
      await Slot.findByIdAndUpdate(
        booking.slotId,
        {
          $pull: { 
            bookedTeams: teamName,
            bookingsLog: { 
              teamId: booking.teamId._id
            }
          },
          $inc: { bookedCount: -1 },
          $set: { isFull: false }
        },
        { session }
      );
      console.log("✅ Slot updated, team removed from bookedTeams");

      console.log("✅ Cancellation transaction completed");
    });

    console.log("🎉 Booking cancelled successfully");
    res.json({
      success: true,
      message: "Booking cancelled successfully"
    });

  } catch (error) {
    console.error("❌ Cancellation failed:", error.message);
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    console.log("🔓 Ending MongoDB session for cancellation");
    session.endSession();
  }
};

/* --------------------------------------------------
   📌 GET SLOTS BY DATE
-------------------------------------------------- */
const getSlotsByDate = async (req, res) => {
  console.log("📅 GET SLOTS BY DATE API CALLED");
  console.log(`📋 Date: ${req.query.date}`);
  
  try {
    const { date } = req.query;
    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);

    // Get active slots
    const slots = await Slot.find({
      slotDate,
      isDisabled: false
    })
      .sort({ startTime: 1 })
      .lean();

    if (!slots.length) {
      return res.json({ success: true, data: [] });
    }

    const slotIds = slots.map(s => s._id);

    // Get confirmed bookings
    const bookings = await SlotBooking.find({
      slotId: { $in: slotIds },
      bookingStatus: "confirmed"
    })
    .populate("teamId", "teamName");

    // Build booking map
    const bookingMap = {};
    bookings.forEach(b => {
      const id = b.slotId.toString();
      if (!bookingMap[id]) bookingMap[id] = [];
      bookingMap[id].push(b.teamId.teamName);
    });

    // Attach booking info to slots
    const response = slots.map(s => {
      const bookedTeams = bookingMap[s._id.toString()] || [];
      const bookedCount = bookedTeams.length;

      return {
        ...s,
        bookedTeams,
        bookedCount,
        remaining: s.capacity - bookedCount,
        isFull: bookedCount >= s.capacity
      };
    });

    res.json({ success: true, data: response });
    
  } catch (error) {
    console.error("❌ Get slots by date failed:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* --------------------------------------------------
   📌 OTHER FUNCTIONS (Simplified)
-------------------------------------------------- */
const getSlotsWithBookingsForAdmin = async (req, res) => {
  try {
    const { date } = req.query;
    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);

    const slots = await Slot.find({
      slotDate,
      isDisabled: false
    })
      .sort({ startTime: 1 })
      .lean();

    const response = slots.map(slot => {
      const bookings = slot.bookingsLog || [];
      
      return {
        _id: slot._id,
        slotDate: slot.slotDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        bookedCount: slot.bookedCount,
        isFull: slot.isFull,
        bookedTeams: slot.bookedTeams || [],
        remaining: slot.capacity - slot.bookedCount,
        
        // Admin booking details
        bookings: bookings.map(log => ({
          teamName: log.teamName,
          captainName: log.captainName,
          captainEmail: log.captainEmail,
          captainMobile: log.captainMobile,
          bookedAt: log.bookedAt
        }))
      };
    });

    res.json({ success: true, data: response });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getSlotDetailsWithBookings = async (req, res) => {
  try {
    const { slotId } = req.params;
    const slot = await Slot.findById(slotId).lean();

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Slot not found"
      });
    }

    const bookings = slot.bookingsLog?.map(log => ({
      teamName: log.teamName,
      captainName: log.captainName,
      captainEmail: log.captainEmail,
      bookedAt: log.bookedAt
    })) || [];

    res.json({
      success: true,
      data: {
        slotDetails: {
          slotDate: slot.slotDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: slot.capacity,
          bookedCount: slot.bookedCount,
          isFull: slot.isFull,
          remaining: slot.capacity - slot.bookedCount
        },
        bookings: bookings
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getCaptainBookings = async (req, res) => {
  try {
    const captainId = req.user._id;
    const bookings = await SlotBooking.find({
      captainId,
      bookingStatus: "confirmed"
    })
    .populate("slotId", "slotDate startTime endTime")
    .populate("groundId", "name")
    .populate("teamId", "teamName")
    .sort({ createdAt: -1 })
    .lean();
    
    res.json({
      success: true,
      bookings
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getAllBookingsForAdmin = async (req, res) => {
  try {
    const { date, teamId, captainId } = req.query;
    let filter = { bookingStatus: "confirmed" };
    
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startDate, $lte: endDate };
    }
    
    if (teamId) filter.teamId = teamId;
    if (captainId) filter.captainId = captainId;

    const bookings = await SlotBooking.find(filter)
      .populate("slotId", "slotDate startTime endTime")
      .populate("groundId", "name")
      .populate("teamId", "teamName")
      .populate("captainId", "name email mobile")
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      bookings
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

console.log("✅ Booking controller functions defined");
/* --------------------------------------------------
   💳 CREATE RAZORPAY ORDER
-------------------------------------------------- */
const createBookingPaymentOrder = async (req, res) => {
  try {
    const { slotId, teamId } = req.body;
    const captainId = req.user._id;

    console.log("💳 Creating payment order");
    console.log("Slot:", slotId);
    console.log("Team:", teamId);
    console.log("Captain:", captainId);

    console.log("🔑 Razorpay Key ID:", process.env.RAZORPAY_KEY_ID ? "FOUND" : "MISSING");
    console.log("🔑 Razorpay Key Secret:", process.env.RAZORPAY_KEY_SECRET ? "FOUND" : "MISSING");

    const amount = 500 * 100; // ₹500

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `SLOT_${slotId.toString().slice(-6)}_${Date.now().toString().slice(-6)}`

    });

    console.log("✅ Razorpay order created:", order.id);

    res.json({
      success: true,
      order,
      razorpayKey: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error("❌ Razorpay ORDER ERROR FULL:", error);
    console.error("❌ Razorpay ORDER ERROR MESSAGE:", error.message);

    res.status(500).json({
      success: false,
      message: error.message || "Unable to create payment order"
    });
  }
};

/* --------------------------------------------------
   ✅ VERIFY PAYMENT & BOOK SLOT
-------------------------------------------------- */
const verifyPaymentAndBookSlot = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      slotId,
      teamId
    } = req.body;

    const captainId = req.user._id;

    // 🔐 Verify Signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed"
      });
    }

    // 💥 PAYMENT VERIFIED → BOOK SLOT
    await session.withTransaction(async () => {
      const slot = await Slot.findOne({
        _id: slotId,
        isDisabled: false
      }).session(session);

      if (!slot) throw new Error("Slot not available");

      const confirmedCount = await SlotBooking.countDocuments({
        slotId,
        bookingStatus: "confirmed"
      }).session(session);

      if (confirmedCount >= slot.capacity) {
        throw new Error("Slot already full");
      }

      const team = await Team.findById(teamId).session(session);
      if (!team) throw new Error("Team not found");

      if (team.captainId.toString() !== captainId.toString()) {
        throw new Error("Only captain can book slot");
      }

      await SlotBooking.create([{
        slotId,
        groundId: slot.groundId,
        teamId,
        captainId,
        bookingStatus: "confirmed",
        paymentStatus: "paid",
        paymentId: razorpay_payment_id
      }], { session });

      await Slot.findByIdAndUpdate(
        slotId,
        {
          $inc: { bookedCount: 1 },
          $addToSet: { bookedTeams: team.teamName },
          isFull: (confirmedCount + 1) >= slot.capacity
        },
        { session }
      );
    });

    res.json({
      success: true,
      message: "Payment successful & slot booked"
    });

  } catch (error) {
    console.error("❌ Payment booking failed:", error.message);
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
};

module.exports = { 
  bookSlot, 
  getTeamBookings, 
  cancelBooking,
  getSlotsByDate,
  getSlotsWithBookingsForAdmin,
  getSlotDetailsWithBookings,
  getCaptainBookings,
  getAllBookingsForAdmin,
  verifyPaymentAndBookSlot,
  createBookingPaymentOrder 
};