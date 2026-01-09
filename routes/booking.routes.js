const express = require("express");
const router = express.Router();
const {
  bookSlot,
  getTeamBookings,
  cancelBooking,
  getSlotsByDate,
  getSlotsWithBookingsForAdmin,
  getSlotDetailsWithBookings,
  getCaptainBookings,
  getAllBookingsForAdmin,
  createBookingPaymentOrder,
  verifyPaymentAndBookSlot
} = require("../controllers/booking.controller");
const { verifyToken, isTeamCaptain, isAdmin } = require("../middleware/authMiddleware");

console.log("🛣️ Booking routes loaded");

// 📌 Public routes (no auth required)
router.get("/slots/by-date", getSlotsByDate);

// 📌 Team Captain routes
router.post("/book/:slotId", verifyToken, isTeamCaptain, bookSlot);
router.get("/team/:teamId", verifyToken, getTeamBookings);
router.get("/captain/bookings", verifyToken, getCaptainBookings);
router.delete("/cancel/:bookingId", verifyToken, cancelBooking);

// 📌 Admin routes
router.get("/admin/slots", verifyToken, isAdmin, getSlotsWithBookingsForAdmin);
router.get("/admin/all-bookings", verifyToken, isAdmin, getAllBookingsForAdmin);
router.get("/slot/:slotId/details", verifyToken, isAdmin, getSlotDetailsWithBookings);
router.post(
  "/create-payment-order",
  verifyToken,
  isTeamCaptain,
  createBookingPaymentOrder
);

router.post(
  "/verify-payment",
  verifyToken,
  isTeamCaptain,
  verifyPaymentAndBookSlot
);

// 📌 Debug route (remove in production)
router.get("/test-captain/:captainId", verifyToken, async (req, res) => {
  try {
    const User = require("../models/User");
    const { captainId } = req.params;
    const user = await User.findById(captainId);
    
    res.json({
      success: true,
      exists: !!user,
      user: user ? {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      } : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

console.log("✅ Booking routes defined");

module.exports = router;