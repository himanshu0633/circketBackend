// controllers/adminSlot.controller.js
const Slot = require("../models/Slot");

/* ================= CREATE SLOT ================= */
exports.createSlot = async (req, res) => {
  try {
    const { slotDate, startTime, endTime, capacity } = req.body;

    const date = new Date(slotDate);
    date.setHours(0, 0, 0, 0);

    const exists = await Slot.findOne({
      slotDate: date,
      startTime,
      endTime,
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Slot already exists for this date & time",
      });
    }

    const slot = await Slot.create({
      slotDate: date,
      startTime,
      endTime,
      capacity: capacity || 2,
    });

    res.status(201).json({
      success: true,
      message: "Slot created successfully",
      data: slot,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= BULK FUTURE SLOT GENERATION ================= */
exports.generateFutureSlots = async (req, res) => {
  try {
    const { startDate, endDate, timeSlots, capacity = 2 } = req.body;

    let currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    const lastDate = new Date(endDate);
    lastDate.setHours(0, 0, 0, 0);

    const slotsToInsert = [];

    while (currentDate <= lastDate) {
      for (const t of timeSlots) {
        const exists = await Slot.findOne({
          slotDate: currentDate,
          startTime: t.startTime,
          endTime: t.endTime,
        });

        if (!exists) {
          slotsToInsert.push({
            slotDate: new Date(currentDate),
            startTime: t.startTime,
            endTime: t.endTime,
            capacity,
          });
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (slotsToInsert.length) {
      await Slot.insertMany(slotsToInsert);
    }

    res.json({
      success: true,
      message: "Future slots generated successfully",
      totalSlots: slotsToInsert.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= DISABLE ALL SLOTS BY DATE ================= */
exports.disableSlotsByDate = async (req, res) => {
  try {
    const { slotDate } = req.body;

    const date = new Date(slotDate);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const result = await Slot.updateMany(
      {
        slotDate: { $gte: date, $lt: nextDate },
      },
      { $set: { isDisabled: true } }
    );

    res.json({
      success: true,
      message: "All slots disabled for this date",
      modified: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= GET ALL SLOTS ================= */
exports.getAllSlots = async (req, res) => {
  try {
    const slots = await Slot.find().sort({ slotDate: 1, startTime: 1 });

    res.json({ success: true, data: slots });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= GET SINGLE SLOT ================= */
exports.getSlotById = async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.id);

    if (!slot) {
      return res.status(404).json({ success: false, message: "Slot not found" });
    }

    res.json({ success: true, data: slot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= UPDATE SLOT ================= */
exports.updateSlot = async (req, res) => {
  try {
    const slot = await Slot.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!slot) {
      return res.status(404).json({ success: false, message: "Slot not found" });
    }

    res.json({
      success: true,
      message: "Slot updated successfully",
      data: slot,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= DELETE SLOT ================= */
exports.deleteSlot = async (req, res) => {
  try {
    const slot = await Slot.findByIdAndDelete(req.params.id);

    if (!slot) {
      return res.status(404).json({ success: false, message: "Slot not found" });
    }

    res.json({ success: true, message: "Slot deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= ENABLE / DISABLE SINGLE SLOT ================= */
exports.toggleSlotStatus = async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.id);

    if (!slot) {
      return res.status(404).json({ success: false, message: "Slot not found" });
    }

    slot.isDisabled = !slot.isDisabled;
    await slot.save();

    res.json({
      success: true,
      message: `Slot ${slot.isDisabled ? "Disabled" : "Enabled"} successfully`,
      data: slot,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
