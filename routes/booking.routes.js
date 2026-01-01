const express = require("express");
const { bookSlot } = require("../controllers/booking.controller.js");
const {protect} = require("../middleware/authMiddleware"); 

const router = express.Router();
router.post("/:slotId", protect, bookSlot);
module.exports = router;
