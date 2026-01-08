const express = require("express");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

const {
  createTeamCaptain,
  getMyTeamCaptains,
  updatePaymentStatus,
  getMyTeam,
  deleteCaptain,
  resendWelcomeEmail,
  getCaptainStats,
  getCaptainTeamByAdmin,
  testEmail
} = require("../controllers/adminController");

const router = express.Router();

/* =====================================================
   TEAM CAPTAIN MANAGEMENT (ADMIN ONLY)
===================================================== */

// Create Team Captain (Admin + Image Upload)
router.post(
  "/createTeamCaptain",
  verifyToken,
  isAdmin,
  upload.single("image"),
  createTeamCaptain
);

// Get captains created by logged-in admin
router.get(
  "/myTeamCaptains",
  verifyToken,
  isAdmin,
  getMyTeamCaptains
);

// Get captain dashboard stats
router.get(
  "/captain-stats",
  verifyToken,
  isAdmin,
  getCaptainStats
);

// Update payment status (Pending / Paid)
router.put(
  "/updatePayment/:id",
  verifyToken,
  isAdmin,
  updatePaymentStatus
);

// Delete a team captain
router.delete(
  "/deleteCaptain/:id",
  verifyToken,
  isAdmin,
  deleteCaptain
);

// Resend welcome email to captain
router.post(
  "/resendWelcomeEmail/:id",
  verifyToken,
  isAdmin,
  resendWelcomeEmail
);

// Admin → View a specific captain’s team
router.get(
  "/captain/:captainId/team",
  verifyToken,
  isAdmin,
  getCaptainTeamByAdmin
);

/* =====================================================
   TEAM CAPTAIN / MEMBER SIDE
===================================================== */

// Logged-in user → get own team (Captain / Member)
router.get(
  "/my-team",
  verifyToken,
  getMyTeam
);

// Test email (Admin only)
router.post(
  "/test-email",
  verifyToken,
  isAdmin,
  testEmail
);

module.exports = router;
