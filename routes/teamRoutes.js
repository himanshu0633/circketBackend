const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

const {
  createTeam,
  addPlayers,
  getMyTeam,
  updateMember,
  deleteMember
} = require("../controllers/teamController");

const router = express.Router();

/* =====================================================
   TEAM MANAGEMENT (CAPTAIN / MEMBER)
===================================================== */

// Create team (Only logged-in users)
router.post(
  "/create-team",
  verifyToken,
  createTeam
);

// Get logged-in user's team
router.get(
  "/my-team",
  verifyToken,
  getMyTeam
);

// Add players to team
router.post(
  "/add-players",
  verifyToken,
  addPlayers
);

// Update a team member
router.put(
  "/member/:id",
  verifyToken,
  updateMember
);

// Delete a team member
router.delete(
  "/member/:id",
  verifyToken,
  deleteMember
);

module.exports = router;
