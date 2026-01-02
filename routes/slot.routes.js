const express = require("express");
const { getSlotsByDate } = require("../controllers/slot.controller");
const router = express.Router();

router.get("/by-date", getSlotsByDate);

module.exports = router;

