const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const path = require("path");
dotenv.config();
connectDB();


const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/team", require("./routes/teamRoutes"));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


app.use("/api/admin/slots", require("./routes/adminSlot.routes"));
app.use("/api/slots", require("./routes/slot.routes"));
app.use("/api/bookings", require("./routes/booking.routes"));
app.listen(4000, () =>
  console.log("Server running on port 4000")
);
  