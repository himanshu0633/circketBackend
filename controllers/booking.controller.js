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

      // 4️⃣ Create booking
      await SlotBooking.create([{
        slotId,
        groundId: slot.groundId,
        teamId,
        captainId,
        bookingStatus: "confirmed",
        paymentStatus: "pending"
      }], { session });

    });

    res.json({ success: true, message: "Slot booked successfully" });

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
module.exports = {bookSlot};