const jwt = require("jsonwebtoken");
const User = require("../models/User");

console.log("🔐 Auth middleware loaded");

const verifyToken = async (req, res, next) => {
  try {
    console.log("🔍 Verifying token...");
    
    // Get token from header
    const authHeader = req.headers.authorization;
    console.log(`📋 Authorization header: ${authHeader}`);
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ No token provided or invalid format");
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided."
      });
    }

    const token = authHeader.split(" ")[1];
    console.log(`🔑 Token received (first 20 chars): ${token.substring(0, 20)}...`);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`✅ Token verified. Decoded:`, decoded);

    // Find user in database
    const user = await User.findById(decoded.id).select("-password");
    console.log(`🔍 User lookup for ID: ${decoded.id}`);
    
    if (!user) {
      console.log("❌ User not found in database");
      return res.status(401).json({
        success: false,
        message: "User not found. Please login again."
      });
    }

    console.log(`👤 User found: ${user.name} (${user.role})`);
    
    // Attach user to request
    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      mobile: user.mobile
    };
    
    next();
    
  } catch (error) {
    console.error("❌ Token verification failed:", error.message);
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please login again."
      });
    }
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again."
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication."
    });
  }
};

const isTeamCaptain = (req, res, next) => {
  console.log(`🔍 Checking if user is team captain...`);
  console.log(`👤 User role: ${req.user.role}`);
  
  if (req.user.role !== "teamCaptain") {
    console.log("❌ Access denied: User is not a team captain");
    return res.status(403).json({
      success: false,
      message: "Access denied. Team captain role required."
    });
  }
  
  console.log("✅ User is a team captain");
  next();
};

const isAdmin = (req, res, next) => {
  console.log(`🔍 Checking if user is admin...`);
  console.log(`👤 User role: ${req.user.role}`);
  
  if (req.user.role !== "admin") {
    console.log("❌ Access denied: User is not an admin");
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin role required."
    });
  }
  
  console.log("✅ User is an admin");
  next();
};

module.exports = {
  verifyToken,
  isTeamCaptain,
  isAdmin
};