// server/utils/emailService.js
const nodemailer = require('nodemailer');

// Create reusable transporter object using Gmail SMTP
const createTransporter = () => {
  // Gmail SMTP configuration
  // Note: For production, use App Password instead of regular password
  // Generate App Password from: https://myaccount.google.com/apppasswords
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER || process.env.EMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD,
    },
  });
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp, purpose = 'verification') => {
  try {
    const transporter = createTransporter();

    let subject, htmlContent;
    
    if (purpose === 'signup') {
      subject = 'Verify Your Email - AtoZ Inventory';
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #e60000;">Welcome to AtoZ Inventory!</h2>
          <p>Thank you for creating an account with us.</p>
          <p>Please use the following OTP to verify your email address:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #e60000; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">This OTP will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't create an account, please ignore this email.</p>
        </div>
      `;
    } else if (purpose === 'forgot-password') {
      subject = 'Reset Your Password - AtoZ Inventory';
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #e60000;">Password Reset Request</h2>
          <p>You have requested to reset your password.</p>
          <p>Please use the following OTP to reset your password:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #e60000; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">This OTP will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request a password reset, please ignore this email.</p>
        </div>
      `;
    } else {
      subject = 'Your Verification Code - AtoZ Inventory';
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #e60000;">Verification Code</h2>
          <p>Please use the following OTP to verify:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #e60000; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">This OTP will expire in 10 minutes.</p>
        </div>
      `;
    }

    const mailOptions = {
      from: process.env.GMAIL_USER || process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email. Please check email configuration.');
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
};
