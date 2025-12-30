const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { isAdmin } = require("../middleware/adminMiddleware");
const upload = require("../middleware/upload");

const {
  createTeamCaptain,
  getMyTeamCaptains,
  updatePaymentStatus,
  getMyTeam,
  deleteCaptain,
  resendWelcomeEmail,
  getCaptainStats,
  getCaptainTeamByAdmin
} = require("../controllers/adminController");

const router = express.Router();

/* ================== TEAM CAPTAIN MANAGEMENT ================== */

// Create Team Captain (Admin only + Image Upload)
router.post(
  "/createTeamCaptain",
  protect,
  isAdmin,
  upload.single("image"),
  createTeamCaptain
);

// Get captains created by logged-in admin
router.get(
  "/myTeamCaptains",
  protect,
  isAdmin,
  getMyTeamCaptains
);

// Get captain statistics (cards / dashboard stats)
router.get(
  "/captain-stats",
  protect,
  isAdmin,
  getCaptainStats
);

// Update payment status (Pending / Paid)
router.put(
  "/updatePayment/:id",
  protect,
  isAdmin,
  updatePaymentStatus
);

// Delete a captain
router.delete(
  "/deleteCaptain/:id",
  protect,
  isAdmin,
  deleteCaptain
);

// Resend welcome email to captain
router.post(
  "/resendWelcomeEmail/:id",
  protect,
  isAdmin,
  resendWelcomeEmail
);

// Admin → View a specific captain’s team
router.get(
  "/captain/:captainId/team",
  protect,
  isAdmin,
  getCaptainTeamByAdmin
);

/* ================== TEAM MEMBER / CAPTAIN SIDE ================== */

// Logged-in user → get own team (Captain / Member)
router.get(
  "/my-team",
  protect,
  getMyTeam
);

module.exports = router;
