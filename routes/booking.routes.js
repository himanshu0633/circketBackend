const express = require("express");
const { bookSlot, getTeamBookings, cancelBooking } = require("../controllers/booking.controller");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// BOOK slot
router.post("/book/:slotId", protect, bookSlot);
// GET team bookings
router.get("/team/:teamId", protect, getTeamBookings);
// CANCEL booking
router.delete("/cancel/:bookingId", protect, cancelBooking);

module.exports = router;