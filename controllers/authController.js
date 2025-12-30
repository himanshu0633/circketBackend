const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/* FIXED ADMIN */
const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "admin123";

exports.register = async (req, res) => {
  const { name, email, phoneNo, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    phoneNo,
    password: hashedPassword,
    role: "teamCaptain"
  });

  res.json({ message: "Team Captain Registered", user });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  /* ADMIN LOGIN */
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = jwt.sign(
      { role: "admin" },
      process.env.JWT_SECRET
    );
    return res.json({ role: "admin", token });
  }

  /* TEAM CAPTAIN LOGIN */
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET
  );

  res.json({
    token,
    role: user.role,
    paymentStatus: user.paymentStatus
  });
};
