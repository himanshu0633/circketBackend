const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const {
  createTeam,
  addPlayers,
  getMyTeam,
  updateMember,
  deleteMember
} = require("../controllers/teamController");

const router = express.Router();

router.post("/create-team", protect, createTeam);
router.get("/my-team", protect, getMyTeam);
router.post("/add-players", protect, addPlayers);
router.put("/member/:id", protect, updateMember);
router.delete("/member/:id", protect, deleteMember);

module.exports = router;
