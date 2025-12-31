// utils/emailConfig.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
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

// Test email configuration
transporter.verify(function(error, success) {
  if (error) {
    console.log("❌ Email configuration error:", error);
  } else {
    console.log("✅ Email server is ready to send messages");
  }
});

const sendWelcomeEmail = async ({ name, email, password, phoneNo }) => {
  try {
    const mailOptions = {
      from: `"CDS Premier League" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to CDS Premier League - Captain Account Created',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .credentials { background: #fff; border: 2px solid #4CAF50; padding: 20px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; }
            .btn { 
              display: inline-block; 
              background: #4CAF50; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 5px;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to CDS Premier League!</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>Your captain account has been successfully created.</p>
              
              <div class="credentials">
                <h3>Your Login Credentials:</h3>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Password:</strong> ${password}</p>
                <p><strong>Phone:</strong> ${phoneNo}</p>
              </div>
              
              <p><strong>Important:</strong></p>
              <ul>
                <li>Please login and change your password immediately</li>
                <li>Payment due date: Within 7 days</li>
                <li>Payment status: Pending</li>
                <li>You can now create your team and add players</li>
              </ul>
              
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="btn">Login to Your Account</a>
              
              <p>If you have any questions, please contact the admin.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} CDS Premier League Management System</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent successfully to ${email}:`, info.messageId);
    return info;
    
  } catch (error) {
    console.error(`❌ Email sending failed to ${email}:`, error.message);
    throw error;
  }
};

module.exports = { sendWelcomeEmail, transporter };