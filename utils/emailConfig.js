const nodemailer = require("nodemailer");

/* --------------------------------------------------
   EMAIL TRANSPORTER
-------------------------------------------------- */
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

/* --------------------------------------------------
   VERIFY EMAIL CONFIG
-------------------------------------------------- */
transporter.verify((error, success) => {
  if (error) {
    console.log("❌ Email configuration error:", error);
  } else {
    console.log("✅ Email server is ready to send messages");
  }
});

/* --------------------------------------------------
   WELCOME EMAIL (CAPTAIN ACCOUNT)
-------------------------------------------------- */
const sendWelcomeEmail = async ({ name, email, password, phoneNo }) => {
  try {
    const mailOptions = {
      from: `"CDS Premier League" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to CDS Premier League - Captain Account Created",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Welcome to CDS Premier League!</h2>
          <p>Hello <b>${name}</b>,</p>

          <p>Your captain account has been successfully created.</p>

          <h3>Login Credentials</h3>
          <p><b>Email:</b> ${email}</p>
          <p><b>Password:</b> ${password}</p>
          <p><b>Phone:</b> ${phoneNo}</p>

          <p><b>Important:</b></p>
          <ul>
            <li>Please login and change your password</li>
            <li>Payment status: Pending</li>
            <li>You can now create your team and add players</li>
          </ul>

          <a href="${process.env.FRONTEND_URL || "http://localhost:3000" || "http://cdspremierleague.com"}/login"
             style="display:inline-block;padding:10px 20px;background:#4CAF50;color:#fff;text-decoration:none;border-radius:4px;">
            Login Now
          </a>

          <p style="margin-top:20px;">
            © ${new Date().getFullYear()} CDS Premier League
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Welcome email sent to ${email}:`, info.messageId);
    return info;

  } catch (error) {
    console.error(`❌ Welcome email failed to ${email}:`, error.message);
    throw error;
  }
};

/* --------------------------------------------------
   SLOT BOOKING EMAIL
-------------------------------------------------- */
const sendBookingEmail = async ({ to, teamName, slotDate, startTime, endTime, groundName }) => {
  try {
    const subject = `Slot Booking Confirmed | ${slotDate} (${startTime}-${endTime})`;

    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h2>Slot Booking Confirmed ✅</h2>
        <p><b>Team:</b> ${teamName}</p>
        <p><b>Date:</b> ${slotDate}</p>
        <p><b>Time:</b> ${startTime} - ${endTime}</p>
        <p><b>Ground:</b> ${groundName}</p>
        <p>Thank you for booking.</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"CDS Premier League" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });

    console.log(`📧 Booking email sent to ${to}:`, info.messageId);
    return info;

  } catch (error) {
    console.error(`❌ Booking email failed to ${to}:`, error.message);
    throw error;
  }
};

/* --------------------------------------------------
   EXPORTS (IMPORTANT)
-------------------------------------------------- */
module.exports = {
  transporter,
  sendWelcomeEmail,
  sendBookingEmail
};
