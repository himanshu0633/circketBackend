const express = require("express");
const router = express.Router();
const playerController = require("../controllers/UserPlayers");

// Add middleware for admin routes (you can implement authentication later)
const requireAdmin = (req, res, next) => {
  // For now, allow all requests
  // Later, implement proper authentication
  next();
};

// Public routes
router.get("/payment-details", playerController.getPaymentDetails);
router.post("/register", playerController.savePlayer);
router.get("/check-status", playerController.checkStatus);

// Admin routes
router.post("/verify-payment", requireAdmin, playerController.verifyPayment);
router.get("/pending-registrations", requireAdmin, playerController.getPendingRegistrations);
router.get("/all-players", requireAdmin, playerController.getAllPlayers);
router.get("/dashboard-stats", requireAdmin, playerController.getDashboardStats);
router.get("/search", requireAdmin, playerController.searchPlayers);
router.get("/export", requireAdmin, playerController.exportPlayers);
router.get("/:id", requireAdmin, playerController.getPlayerById);
router.put("/:id", requireAdmin, playerController.updatePlayer);
router.delete("/:id", requireAdmin, playerController.deletePlayer);

module.exports = router;