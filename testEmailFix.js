// testEmailFix.js
require('dotenv').config();

console.log('=== Testing Email Configuration ===');
console.log('Current directory:', process.cwd());
console.log('Loading .env from:', require('path').resolve('.env'));

// Check all email-related environment variables
console.log('\n📧 Email Environment Variables:');
console.log('EMAIL_USER:', process.env.EMAIL_USER || 'Not set');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS || 'Not set');
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD || 'Not set');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST || 'Not set');
console.log('EMAIL_PORT:', process.env.EMAIL_PORT || 'Not set');

// Test nodemailer directly
const nodemailer = require('nodemailer');

// Use the password from whichever variable is set
const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;

if (!emailPass) {
  console.error('\n❌ ERROR: No email password found in environment variables!');
  console.error('Please set either EMAIL_PASS or EMAIL_PASSWORD in your .env file');
  process.exit(1);
}

const testTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: emailPass
  }
});

console.log('\n🔧 Testing email connection...');
testTransporter.verify((error, success) => {
  if (error) {
    console.error('❌ Connection failed:', error.message);
    
    // Check Gmail specific issues
    if (error.code === 'EAUTH') {
      console.error('\n🔍 Troubleshooting Gmail Authentication:');
      console.error('1. Make sure 2-Step Verification is enabled:');
      console.error('   https://myaccount.google.com/security');
      console.error('2. Generate an App Password:');
      console.error('   https://myaccount.google.com/apppasswords');
      console.error('3. Select "Mail" as app and "Other" as device');
      console.error('4. Copy the 16-character password');
      console.error('5. Update .env file with that password');
    }
  } else {
    console.log('✅ Connection successful!');
    
    // Send a test email
    console.log('\n📤 Sending test email...');
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'CDS Premier League - Test Email',
      text: 'This is a test email to verify your configuration.',
      html: '<h1>Test Successful!</h1><p>Your email configuration is working correctly.</p>'
    };
    
    testTransporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('❌ Email sending failed:', err.message);
      } else {
        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
      }
      process.exit();
    });
  }
});