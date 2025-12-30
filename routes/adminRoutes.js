const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { isAdmin } = require("../middleware/adminMiddleware");
const upload = require("../middleware/upload");
const {
  createTeamCaptain,
  getMyTeamCaptains,
  updatePaymentStatus
} = require("../controllers/adminController");
const router = express.Router();

router.post("/createTeamCaptain", protect, isAdmin,upload.single("image"), createTeamCaptain);
router.get("/myTeamCaptains", protect, isAdmin, getMyTeamCaptains);
router.put("/updatePayment/:id", protect, isAdmin, updatePaymentStatus);

module.exports = router;
