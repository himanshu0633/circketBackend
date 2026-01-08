const TeamMember = require("../models/TeamMember");
const User = require("../models/User");
const Team = require("../models/Team");

/* ===================== CREATE TEAM ===================== */
exports.createTeam = async (req, res) => {
  try {
    const { teamName, totalPlayers } = req.body;

    const captain = await User.findById(req.user.id);
    if (!captain) {
      return res.status(404).json({ success: false, message: "Captain not found" });
    }

    const isPaid =
      captain.paymentStatus === "Paid" &&
      captain.paymentDueDate &&
      new Date() <= new Date(captain.paymentDueDate);

    const team = await Team.create({
      captainId: captain._id,
      teamName,
      totalPlayers,
      status: isPaid ? "Active" : "Pending"
    });

    res.json({
      success: true,
      message: "Team created successfully",
      team
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ===================== GET MY TEAM ===================== */
exports.getMyTeam = async (req, res) => {
  try {
    const team = await Team.findOne({ captainId: req.user.id });

    if (!team) {
      return res.json({
        success: true,
        team: null,
        members: []
      });
    }

    const members = await TeamMember.find({ teamId: team._id });

    res.json({
      success: true,
      team,
      members,
      totalPlayers: members.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ===================== ADD PLAYERS ===================== */
exports.addPlayers = async (req, res) => {
  try {
    const { teamId, players } = req.body;

    if (!Array.isArray(players) || players.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Players array required"
      });
    }

    const team = await Team.findOne({
      _id: teamId,
      captainId: req.user.id
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found"
      });
    }

    const members = players.map(player => ({
      teamId,
      captainId: req.user.id,
      ...player,
      status: team.status // Active or Pending
    }));

    await TeamMember.insertMany(members);

    res.json({
      success: true,
      message: "Players added successfully"
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ===================== UPDATE MEMBER ===================== */
exports.updateMember = async (req, res) => {
  try {
    const member = await TeamMember.findOneAndUpdate(
      { _id: req.params.id, captainId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found or unauthorized"
      });
    }

    res.json({
      success: true,
      message: "Member updated successfully",
      member
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ===================== DELETE MEMBER ===================== */
exports.deleteMember = async (req, res) => {
  try {
    const member = await TeamMember.findOneAndDelete({
      _id: req.params.id,
      captainId: req.user.id
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found or unauthorized"
      });
    }

    res.json({
      success: true,
      message: "Member deleted successfully"
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ===================== ADD SINGLE MEMBER (Optional) ===================== */
exports.addMember = async (req, res) => {
  try {
    console.log("➡️ Add Member API called");
    console.log("User ID:", req.user?.id);
    console.log("Request Body:", req.body);

    const captain = await User.findById(req.user.id);

    if (!captain) {
      return res.status(404).json({
        success: false,
        message: "Captain not found"
      });
    }

    let memberStatus = "Pending";

    if (
      captain.paymentStatus === "Paid" &&
      captain.paymentDueDate &&
      new Date() <= new Date(captain.paymentDueDate)
    ) {
      memberStatus = "Active";
    }

    const member = await TeamMember.create({
      captainId: req.user.id,
      ...req.body,
      status: memberStatus
    });

    res.json({
      success: true,
      message: "Team member added successfully",
      member
    });

  } catch (err) {
    console.error("❌ ERROR in addMember API");
    console.error("Message:", err.message);
    console.error("Name:", err.name);
    console.error("Stack Trace:\n", err.stack);

    res.status(500).json({
      success: false,
      message: "Failed to add team member",
      error: err.message,
      errorType: err.name
    });
  }
};