const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { updateProfile } = require("../controllers/profileController");

const router = express.Router();

router.put("/update", protect, updateProfile);

module.exports = router;
