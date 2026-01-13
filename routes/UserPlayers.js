const express = require("express");
const router = express.Router();
const registerController = require("../controllers/UserPlayers");

router.post("/user-create", registerController.createOrder);
router.post("/verify-payment", registerController.verifyPayment);

module.exports = router;