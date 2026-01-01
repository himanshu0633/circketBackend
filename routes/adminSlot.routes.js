// routes/adminSlot.routes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/adminMiddleware");

const {
  createSlot,
  generateFutureSlots,
  disableSlotsByDate,
  getAllSlots,
  getSlotById,
  updateSlot,
  deleteSlot,
  toggleSlotStatus,
} = require("../controllers/adminSlot.controller");

/* CRUD */
router.post("/create", createSlot);
router.get("/", getAllSlots);
router.get("/:id", getSlotById);
router.put("/:id", updateSlot);
router.delete("/:id", deleteSlot);
router.patch("/toggle/:id", toggleSlotStatus);

/* ADVANCED SLOT CONTROL */
router.post("/generate-future", generateFutureSlots); // fixed time for future dates
router.post("/disable-date", disableSlotsByDate);     // disable full date

module.exports = router;
