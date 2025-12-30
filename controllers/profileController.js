const User = require("../models/User");

exports.updateProfile = async (req, res) => {
  try {
    const allowedUpdates = {
      name: req.body.name,
      phoneNo: req.body.phoneNo
    };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      allowedUpdates,
      { new: true }
    );

    res.json({
      success: true,
      message: "Profile updated",
      user
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Profile update failed"
    });
  }
};
