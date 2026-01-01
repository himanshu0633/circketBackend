const Slot = require("../models/Slot");
const SlotBooking = require("../models/SlotBooking");

exports.getSlotsByDate = async (req, res) => {
  try {
    const { date } = req.query;

    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);

    // 1️⃣ Get active slots
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

    // 2️⃣ Get confirmed bookings
    const bookings = await SlotBooking.find({
      slotId: { $in: slotIds },
      bookingStatus: "confirmed"
    }).populate("teamId", "teamName");

    // 3️⃣ Build booking map
    const bookingMap = {};
    bookings.forEach(b => {
      const id = b.slotId.toString();
      if (!bookingMap[id]) bookingMap[id] = [];
      bookingMap[id].push(b.teamId.teamName);
    });

    // 4️⃣ Attach booking info to slots
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
    res.status(500).json({ success: false, message: error.message });
  }
};

