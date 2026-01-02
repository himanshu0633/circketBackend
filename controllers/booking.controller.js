// booking.controller.js - Complete updated code

const mongoose = require("mongoose");
const Slot = require("../models/Slot");
const SlotBooking = require("../models/SlotBooking");
const User = require("../models/User");
const Team = require("../models/Team");
const { sendBookingEmail } = require("../utils/emailConfig");

/* --------------------------------------------------
   🔔 EMAIL NOTIFICATION (NON BLOCKING)
-------------------------------------------------- */
const sendBookingNotificationEmail = async ({ slotId, teamId, captainId }) => {
  try {
    const [team, captain, slot] = await Promise.all([
      Team.findById(teamId).lean(),
      User.findById(captainId).lean(),
      Slot.findById(slotId).populate("groundId", "name").lean()
    ]);

    if (!captain?.email) return;

    await sendBookingEmail({
      to: captain.email,
      teamName: team?.teamName || "Team",
      slotDate: slot?.slotDate,
      startTime: slot?.startTime,
      endTime: slot?.endTime,
      groundName: slot?.groundId?.name || "Ground"
    });

  } catch (error) {
    console.error("Booking email failed:", error.message);
  }
};

/* --------------------------------------------------
   📌 BOOK SLOT
-------------------------------------------------- */
const bookSlot = async (req, res) => {
  const session = await mongoose.startSession();

  let bookedSlotId, bookedTeamId, bookedCaptainId;

  try {
    const { slotId } = req.params;
    const { teamId } = req.body;
    const captainId = req.user._id;

    bookedSlotId = slotId;
    bookedTeamId = teamId;
    bookedCaptainId = captainId;

    await session.withTransaction(async () => {

      // 1️⃣ Slot exists & enabled
      const slot = await Slot.findOne({
        _id: slotId,
        isDisabled: false
      }).session(session);

      if (!slot) {
        throw new Error("Slot not available");
      }

      // 2️⃣ Capacity check
      const confirmedCount = await SlotBooking.countDocuments({
        slotId,
        bookingStatus: "confirmed"
      }).session(session);

      if (confirmedCount >= slot.capacity) {
        throw new Error("Slot is already full");
      }

      // 3️⃣ Prevent same team double booking
      const alreadyBooked = await SlotBooking.findOne({
        slotId,
        teamId,
        bookingStatus: "confirmed"
      }).session(session);

      if (alreadyBooked) {
        throw new Error("This team has already booked this slot");
      }

      // 4️⃣ Get team name for adding to bookedTeams
      const team = await Team.findById(teamId).session(session);
      if (!team) {
        throw new Error("Team not found");
      }

      // 5️⃣ Create booking
      await SlotBooking.create([{
        slotId,
        groundId: slot.groundId,
        teamId,
        captainId,
        bookingStatus: "confirmed",
        paymentStatus: "pending"
      }], { session });

      // 6️⃣ Update slot's bookedTeams array and bookedCount
      const updatedSlot = await Slot.findByIdAndUpdate(
        slotId,
        {
          $addToSet: { bookedTeams: team.teamName },
          $inc: { bookedCount: 1 }
        },
        { new: true, session }
      );

      // 7️⃣ Calculate remaining and isFull
      const newBookedCount = updatedSlot.bookedCount || confirmedCount + 1;
      const remaining = slot.capacity - newBookedCount;
      const isFull = remaining <= 0;

      // Update isFull if needed
      if (isFull !== slot.isFull) {
        await Slot.findByIdAndUpdate(
          slotId,
          { isFull },
          { session }
        );
      }

    });

    res.json({ 
      success: true, 
      message: "Slot booked successfully",
      updatedSlot: true 
    });

  } catch (error) {
    res.status(409).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();

    if (bookedSlotId && bookedTeamId && bookedCaptainId) {
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

/* --------------------------------------------------
   📌 CANCEL BOOKING
-------------------------------------------------- */
const cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { bookingId } = req.params;

    await session.withTransaction(async () => {
      // 1️⃣ Find booking
      const booking = await SlotBooking.findOne({
        _id: bookingId,
        bookingStatus: "confirmed"
      }).session(session);

      if (!booking) {
        throw new Error("Booking not found");
      }

      // 2️⃣ Get team name
      const team = await Team.findById(booking.teamId).session(session);
      
      // 3️⃣ Update booking status
      await SlotBooking.findByIdAndUpdate(
        bookingId,
        { bookingStatus: "cancelled" },
        { session }
      );

      // 4️⃣ Update slot's bookedTeams and bookedCount
      if (team && team.teamName) {
        await Slot.findByIdAndUpdate(
          booking.slotId,
          {
            $pull: { bookedTeams: team.teamName },
            $inc: { bookedCount: -1 },
            isFull: false
          },
          { session }
        );
      }
    });

    res.json({
      success: true,
      message: "Booking cancelled successfully"
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
};

module.exports = { bookSlot, getTeamBookings, cancelBooking };