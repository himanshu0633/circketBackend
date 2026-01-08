// booking.controller.js - Complete updated code with console logs

const mongoose = require("mongoose");
const Slot = require("../models/Slot");
const SlotBooking = require("../models/SlotBooking");
const User = require("../models/User");
const Team = require("../models/Team");
const { sendBookingEmail } = require("../utils/emailConfig");

console.log("🔧 Booking controller loaded");

/* --------------------------------------------------
   🔔 EMAIL NOTIFICATION (NON BLOCKING)
-------------------------------------------------- */
const sendBookingNotificationEmail = async ({ slotId, teamId, captainId }) => {
  console.log("📧 Starting email notification process");
  console.log(`📧 Parameters: slotId=${slotId}, teamId=${teamId}, captainId=${captainId}`);
  
  try {
    console.log("📧 Fetching team, captain and slot details...");
    const [team, captain, slot] = await Promise.all([
      Team.findById(teamId).lean(),
      User.findById(captainId).lean(),
      Slot.findById(slotId).populate("groundId", "name").lean()
    ]);

    console.log(`📧 Team found: ${team ? team.teamName : 'No'}`);
    console.log(`📧 Captain found: ${captain ? captain.name : 'No'}, Email: ${captain?.email || 'No email'}`);
    console.log(`📧 Slot found: ${slot ? 'Yes' : 'No'}, Ground: ${slot?.groundId?.name || 'Unknown'}`);

    if (!captain?.email) {
      console.log("❌ Email notification skipped: No captain email");
      return;
    }

    console.log("📧 Preparing to send email to:", captain.email);
    
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
    console.error("❌ Error stack:", error.stack);
  }
};

/* --------------------------------------------------
   📌 BOOK SLOT
-------------------------------------------------- */
const bookSlot = async (req, res) => {
  console.log("🚀 BOOK SLOT API CALLED");
  console.log(`👤 User: ${req.user._id}, Role: ${req.user.role}`);
  console.log(`📋 Params: ${JSON.stringify(req.params)}`);
  console.log(`📦 Body: ${JSON.stringify(req.body)}`);

  const session = await mongoose.startSession();
  console.log("🔐 MongoDB session started");

  let bookedSlotId, bookedTeamId, bookedCaptainId;

  try {
    const { slotId } = req.params;
    const { teamId } = req.body;
    const captainId = req.user._id;

    bookedSlotId = slotId;
    bookedTeamId = teamId;
    bookedCaptainId = captainId;

    console.log(`🔄 Starting transaction for slot: ${slotId}, team: ${teamId}, captain: ${captainId}`);

    await session.withTransaction(async () => {
      console.log("✅ Transaction started");

      // 1️⃣ Slot exists & enabled
      console.log(`🔍 Step 1: Checking slot availability (slotId: ${slotId})`);
      const slot = await Slot.findOne({
        _id: slotId,
        isDisabled: false
      }).session(session);

      if (!slot) {
        console.log("❌ Slot not found or disabled");
        throw new Error("Slot not available");
      }
      console.log(`✅ Slot found: ${slot._id}, Date: ${slot.slotDate}, Time: ${slot.startTime}-${slot.endTime}`);
      console.log(`ℹ️ Slot capacity: ${slot.capacity}, isFull: ${slot.isFull}`);

      // 2️⃣ Capacity check
      console.log(`🔍 Step 2: Checking capacity for slot: ${slotId}`);
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
      console.log(`🔍 Step 3: Checking if team ${teamId} already booked this slot`);
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

      // 4️⃣ Get team and captain details
      console.log(`🔍 Step 4: Fetching team and captain details`);
      const [team, captain] = await Promise.all([
        Team.findById(teamId).session(session),
        User.findById(captainId).session(session)
      ]);
      
      console.log(`ℹ️ Team found: ${team ? team.teamName : 'No'}`);
      console.log(`ℹ️ Captain found: ${captain ? captain.name : 'No'}`);
      
      if (!team) {
        console.log("❌ Team not found");
        throw new Error("Team not found");
      }
      
      if (!captain) {
        console.log("❌ Captain not found");
        throw new Error("Captain not found");
      }

      // 5️⃣ Create booking
      console.log("🔍 Step 5: Creating booking record");
      const newBooking = await SlotBooking.create([{
        slotId,
        groundId: slot.groundId,
        teamId,
        captainId,
        bookingStatus: "confirmed",
        paymentStatus: "pending"
      }], { session });

      console.log(`✅ Booking created: ${newBooking[0]._id}`);

      // 6️⃣ Create booking log entry
      console.log("🔍 Step 6: Creating booking log entry");
      const bookingLogEntry = {
        teamId: team._id,
        teamName: team.teamName,
        captainId: captain._id,
        captainName: captain.name,
        captainEmail: captain.email,
        captainMobile: captain.mobile,
        bookedAt: new Date()
      };

      console.log(`📝 Booking log entry: ${JSON.stringify(bookingLogEntry)}`);

      // 7️⃣ Update slot with booking log and simple bookedTeams
      console.log(`🔍 Step 7: Updating slot ${slotId} with booking info`);
      const updatedSlot = await Slot.findByIdAndUpdate(
        slotId,
        {
          $addToSet: { 
            bookedTeams: team.teamName,
            bookingsLog: bookingLogEntry
          },
          $inc: { bookedCount: 1 }
        },
        { new: true, session }
      );

      console.log(`✅ Slot updated. New bookedCount: ${updatedSlot.bookedCount}`);

      // 8️⃣ Calculate remaining and isFull
      console.log("🔍 Step 8: Calculating remaining capacity and isFull");
      const newBookedCount = updatedSlot.bookedCount || confirmedCount + 1;
      const remaining = slot.capacity - newBookedCount;
      const isFull = remaining <= 0;

      console.log(`ℹ️ New booked count: ${newBookedCount}`);
      console.log(`ℹ️ Remaining capacity: ${remaining}`);
      console.log(`ℹ️ Is full: ${isFull}`);

      // Update isFull if needed
      if (isFull !== slot.isFull) {
        console.log(`🔄 Updating isFull from ${slot.isFull} to ${isFull}`);
        await Slot.findByIdAndUpdate(
          slotId,
          { isFull },
          { session }
        );
        console.log("✅ isFull updated");
      }

      console.log("✅ Transaction completed successfully");
    });

    console.log("🎉 Slot booking successful");
    res.json({ 
      success: true, 
      message: "Slot booked successfully",
      updatedSlot: true 
    });

  } catch (error) {
    console.error("❌ Booking failed:", error.message);
    console.error("❌ Error stack:", error.stack);
    res.status(409).json({
      success: false,
      message: error.message
    });
  } finally {
    console.log("🔓 Ending MongoDB session");
    session.endSession();

    if (bookedSlotId && bookedTeamId && bookedCaptainId) {
      console.log("📧 Triggering email notification in background");
      sendBookingNotificationEmail({
        slotId: bookedSlotId,
        teamId: bookedTeamId,
        captainId: bookedCaptainId
      });
    }
  }
};

/* --------------------------------------------------
   📌 GET TEAM BOOKINGS
-------------------------------------------------- */
const getTeamBookings = async (req, res) => {
  console.log("📋 GET TEAM BOOKINGS API CALLED");
  console.log(`📋 Params: ${JSON.stringify(req.params)}`);
  
  try {
    const { teamId } = req.params;
    console.log(`🔍 Fetching bookings for team: ${teamId}`);

    const bookings = await SlotBooking.find({
      teamId,
      bookingStatus: "confirmed"
    })
    .populate("slotId", "slotDate startTime endTime")
    .populate("groundId", "name")
    .sort({ createdAt: -1 })
    .lean();

    console.log(`✅ Found ${bookings.length} bookings for team ${teamId}`);
    
    res.json({
      success: true,
      bookings
    });

  } catch (error) {
    console.error("❌ Get team bookings failed:", error.message);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/* --------------------------------------------------
   📌 CANCEL BOOKING
-------------------------------------------------- */
const cancelBooking = async (req, res) => {
  console.log("🗑️ CANCEL BOOKING API CALLED");
  console.log(`📋 Params: ${JSON.stringify(req.params)}`);
  
  const session = await mongoose.startSession();
  console.log("🔐 MongoDB session started for cancellation");

  try {
    const { bookingId } = req.params;
    console.log(`🔍 Processing cancellation for booking: ${bookingId}`);

    await session.withTransaction(async () => {
      console.log("✅ Transaction started for cancellation");

      // 1️⃣ Find booking
      console.log(`🔍 Step 1: Finding booking ${bookingId}`);
      const booking = await SlotBooking.findOne({
        _id: bookingId,
        bookingStatus: "confirmed"
      })
      .populate("teamId")
      .populate("captainId")
      .session(session);

      if (!booking) {
        console.log("❌ Booking not found or already cancelled");
        throw new Error("Booking not found");
      }
      
      console.log(`✅ Booking found: ${booking._id}`);
      console.log(`ℹ️ Slot ID: ${booking.slotId}, Team: ${booking.teamId?.teamName}`);

      // 2️⃣ Update booking status
      console.log(`🔍 Step 2: Updating booking status to 'cancelled'`);
      await SlotBooking.findByIdAndUpdate(
        bookingId,
        { bookingStatus: "cancelled" },
        { session }
      );
      console.log("✅ Booking status updated");

      // 3️⃣ Update slot - remove from bookedTeams and bookingsLog
      console.log(`🔍 Step 3: Updating slot ${booking.slotId}`);
      await Slot.findByIdAndUpdate(
        booking.slotId,
        {
          $pull: { 
            bookedTeams: booking.teamId.teamName,
            bookingsLog: { 
              teamId: booking.teamId._id,
              captainId: booking.captainId._id
            }
          },
          $inc: { bookedCount: -1 },
          isFull: false
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
    console.error("❌ Error stack:", error.stack);
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
  console.log(`📋 Query: ${JSON.stringify(req.query)}`);
  
  try {
    const { date } = req.query;
    console.log(`🔍 Fetching slots for date: ${date}`);

    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);
    console.log(`📅 Formatted date: ${slotDate}`);

    // 1️⃣ Get active slots
    console.log("🔍 Step 1: Fetching active slots");
    const slots = await Slot.find({
      slotDate,
      isDisabled: false
    })
      .sort({ startTime: 1 })
      .lean();

    console.log(`✅ Found ${slots.length} active slots`);
    
    if (!slots.length) {
      console.log("ℹ️ No slots found for this date");
      return res.json({ success: true, data: [] });
    }

    const slotIds = slots.map(s => s._id);
    console.log(`🔍 Slot IDs: ${slotIds}`);

    // 2️⃣ Get confirmed bookings
    console.log("🔍 Step 2: Fetching confirmed bookings");
    const bookings = await SlotBooking.find({
      slotId: { $in: slotIds },
      bookingStatus: "confirmed"
    }).populate("teamId", "teamName");

    console.log(`✅ Found ${bookings.length} confirmed bookings`);

    // 3️⃣ Build booking map
    console.log("🔍 Step 3: Building booking map");
    const bookingMap = {};
    bookings.forEach(b => {
      const id = b.slotId.toString();
      if (!bookingMap[id]) bookingMap[id] = [];
      bookingMap[id].push(b.teamId.teamName);
    });

    console.log(`📊 Booking map created with ${Object.keys(bookingMap).length} slots`);

    // 4️⃣ Attach booking info to slots
    console.log("🔍 Step 4: Attaching booking info to slots");
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

    console.log("✅ Response prepared successfully");
    res.json({ success: true, data: response });
    
  } catch (error) {
    console.error("❌ Get slots by date failed:", error.message);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* --------------------------------------------------
   📌 GET SLOTS WITH BOOKINGS FOR ADMIN (WITH CAPTAIN DETAILS)
-------------------------------------------------- */
const getSlotsWithBookingsForAdmin = async (req, res) => {
  console.log("👨‍💼 GET SLOTS WITH BOOKINGS FOR ADMIN API CALLED");
  console.log(`📋 Query: ${JSON.stringify(req.query)}`);
  console.log(`👤 Admin user: ${req.user._id}, Role: ${req.user.role}`);
  
  try {
    const { date } = req.query;
    console.log(`🔍 Fetching slots for admin view, date: ${date}`);

    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);
    console.log(`📅 Formatted date: ${slotDate}`);

    // 1️⃣ Get slots with bookingsLog populated
    console.log("🔍 Step 1: Fetching slots with bookingsLog");
    const slots = await Slot.find({
      slotDate,
      isDisabled: false
    })
      .sort({ startTime: 1 })
      .lean();

    console.log(`✅ Found ${slots.length} slots for admin view`);
    
    if (!slots.length) {
      console.log("ℹ️ No slots found for this date");
      return res.json({ success: true, data: [] });
    }

    // 2️⃣ Process each slot - directly use bookingsLog
    console.log("🔍 Step 2: Processing slots for admin view");
    const response = slots.map(slot => {
      // Use bookingsLog array which already has all details
      const bookings = slot.bookingsLog || [];
      console.log(`ℹ️ Slot ${slot._id} has ${bookings.length} bookings in log`);
      
      return {
        _id: slot._id,
        slotDate: slot.slotDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        bookedCount: slot.bookedCount,
        isFull: slot.isFull,
        isDisabled: slot.isDisabled,
        bookedTeams: slot.bookedTeams || [],
        remaining: slot.capacity - slot.bookedCount,
        
        // 🔥 ADMIN: Full booking details with captain info
        bookings: bookings.map(log => ({
          teamId: log.teamId,
          teamName: log.teamName,
          captainId: log.captainId,
          captainName: log.captainName,
          captainEmail: log.captainEmail,
          captainMobile: log.captainMobile,
          bookedAt: log.bookedAt
        }))
      };
    });

    console.log("✅ Admin view response prepared");
    res.json({ success: true, data: response });

  } catch (error) {
    console.error("❌ Get slots for admin failed:", error.message);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/* --------------------------------------------------
   📌 GET SLOT DETAILS WITH BOOKINGS (SPECIFIC SLOT)
-------------------------------------------------- */
const getSlotDetailsWithBookings = async (req, res) => {
  console.log("🔍 GET SLOT DETAILS WITH BOOKINGS API CALLED");
  console.log(`📋 Params: ${JSON.stringify(req.params)}`);
  
  try {
    const { slotId } = req.params;
    console.log(`🔍 Fetching details for slot: ${slotId}`);

    const slot = await Slot.findById(slotId)
      .populate("bookingsLog.teamId", "teamName")
      .populate("bookingsLog.captainId", "name email mobile")
      .lean();

    if (!slot) {
      console.log("❌ Slot not found");
      return res.status(404).json({
        success: false,
        message: "Slot not found"
      });
    }

    console.log(`✅ Slot found: ${slot._id}, Date: ${slot.slotDate}`);
    console.log(`ℹ️ Bookings log count: ${slot.bookingsLog?.length || 0}`);

    // Format bookings log
    console.log("🔍 Formatting bookings log");
    const bookings = slot.bookingsLog.map(log => ({
      teamName: log.teamName,
      captainName: log.captainName,
      captainEmail: log.captainEmail,
      captainMobile: log.captainMobile,
      bookedAt: log.bookedAt
    }));

    console.log(`✅ Prepared ${bookings.length} booking entries`);

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
    console.error("❌ Get slot details failed:", error.message);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/* --------------------------------------------------
   📌 GET CAPTAIN BOOKINGS HISTORY
-------------------------------------------------- */
const getCaptainBookings = async (req, res) => {
  console.log("👤 GET CAPTAIN BOOKINGS API CALLED");
  console.log(`👤 Captain user: ${req.user._id}, Name: ${req.user.name}`);
  
  try {
    const captainId = req.user._id;
    console.log(`🔍 Fetching bookings for captain: ${captainId}`);

    const bookings = await SlotBooking.find({
      captainId,
      bookingStatus: "confirmed"
    })
    .populate("slotId", "slotDate startTime endTime")
    .populate("groundId", "name")
    .populate("teamId", "teamName")
    .sort({ createdAt: -1 })
    .lean();

    console.log(`✅ Found ${bookings.length} bookings for captain`);
    
    res.json({
      success: true,
      bookings
    });

  } catch (error) {
    console.error("❌ Get captain bookings failed:", error.message);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/* --------------------------------------------------
   📌 GET ALL BOOKINGS FOR ADMIN
-------------------------------------------------- */
const getAllBookingsForAdmin = async (req, res) => {
  console.log("👨‍💼 GET ALL BOOKINGS FOR ADMIN API CALLED");
  console.log(`📋 Query: ${JSON.stringify(req.query)}`);
  console.log(`👤 Admin user: ${req.user._id}, Role: ${req.user.role}`);
  
  try {
    const { date, teamId, captainId } = req.query;
    console.log(`🔍 Filters - Date: ${date}, Team ID: ${teamId}, Captain ID: ${captainId}`);
    
    let filter = { bookingStatus: "confirmed" };
    
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      filter.createdAt = { $gte: startDate, $lte: endDate };
      console.log(`📅 Date filter: ${startDate} to ${endDate}`);
    }
    
    if (teamId) {
      filter.teamId = teamId;
      console.log(`🏀 Team filter: ${teamId}`);
    }
    
    if (captainId) {
      filter.captainId = captainId;
      console.log(`👤 Captain filter: ${captainId}`);
    }

    console.log(`🔍 Final filter: ${JSON.stringify(filter)}`);
    
    console.log("🔍 Fetching bookings with filter");
    const bookings = await SlotBooking.find(filter)
      .populate("slotId", "slotDate startTime endTime")
      .populate("groundId", "name")
      .populate("teamId", "teamName")
      .populate("captainId", "name email mobile")
      .sort({ createdAt: -1 })
      .lean();

    console.log(`✅ Found ${bookings.length} bookings`);
    
    res.json({
      success: true,
      bookings
    });

  } catch (error) {
    console.error("❌ Get all bookings for admin failed:", error.message);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

console.log("✅ Booking controller functions defined");

module.exports = { 
  bookSlot, 
  getTeamBookings, 
  cancelBooking,
  getSlotsByDate,
  getSlotsWithBookingsForAdmin,
  getSlotDetailsWithBookings,
  getCaptainBookings,
  getAllBookingsForAdmin 
};