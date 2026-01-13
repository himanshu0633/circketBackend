const express = require("express");
const router = express.Router();
const registerController = require("../controllers/UserPlayers");

router.post('/create-order', registerController.createOrder);
router.post('/verify-payment', registerController.verifyPayment);
router.post('/save-player', registerController.savePlayer);
module.exports = router;