const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware");
const { updateProfile } = require("../controllers/profileController");

const router = express.Router();

/* =====================================================
   USER PROFILE
===================================================== */

// Update logged-in user's profile
router.put(
  "/update",
  verifyToken,
  updateProfile
);

module.exports = router;
