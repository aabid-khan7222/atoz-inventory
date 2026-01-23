// server/utils/emailService.js
// Gmail SMTP Email Service - Production Ready
const nodemailer = require('nodemailer');

// ============================================
// CONFIGURATION VALIDATION
// ============================================
const GMAIL_USER = (process.env.GMAIL_USER || process.env.EMAIL_USER)?.trim();
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD)?.replace(/\s/g, '').trim();

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error('❌ EMAIL CONFIGURATION ERROR:');
  console.error('   GMAIL_USER:', GMAIL_USER ? 'SET' : 'NOT SET');
  console.error('   GMAIL_APP_PASSWORD:', GMAIL_APP_PASSWORD ? 'SET' : 'NOT SET');
  console.error('   Please set GMAIL_USER and GMAIL_APP_PASSWORD in environment variables');
}

// Validate App Password format (should be 16 characters, no spaces)
if (GMAIL_APP_PASSWORD && GMAIL_APP_PASSWORD.length !== 16) {
  console.warn('⚠️  WARNING: Gmail App Password should be 16 characters');
  console.warn('   Current length:', GMAIL_APP_PASSWORD.length);
  console.warn('   Make sure there are NO SPACES in the password');
}

// ============================================
// CREATE TRANSPORTER (Singleton Pattern)
// ============================================
let transporter = null;

function createTransporter() {
  // Return existing transporter if already created
  if (transporter) {
    return transporter;
  }

  // Validate configuration
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('Gmail configuration missing. Please set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.');
  }

  console.log('📧 Creating Gmail SMTP transporter...');
  console.log('   User:', GMAIL_USER);
  console.log('   Password length:', GMAIL_APP_PASSWORD.length, 'characters');
  console.log('   Environment:', process.env.NODE_ENV || 'development');

  const isProduction = process.env.NODE_ENV === 'production';

  // Production: Use explicit SMTP settings (better for cloud servers)
  // Development: Use service shortcut
  if (isProduction) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
      // Timeout settings for production (cloud servers may have latency)
      connectionTimeout: 30000, // 30 seconds
      socketTimeout: 30000, // 30 seconds
      greetingTimeout: 10000, // 10 seconds
      // Additional options for cloud servers
      tls: {
        rejectUnauthorized: false, // Some cloud providers need this
      },
    });
    console.log('✅ Gmail SMTP transporter created (Production mode)');
  } else {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
      connectionTimeout: 20000, // 20 seconds
      socketTimeout: 20000,
      greetingTimeout: 10000,
    });
    console.log('✅ Gmail SMTP transporter created (Development mode)');
  }

  // Verify transporter connection (optional, but recommended)
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Gmail SMTP transporter verification failed:', error.message);
      console.error('   Check your GMAIL_USER and GMAIL_APP_PASSWORD');
      console.error('   Make sure 2-Step Verification is enabled and App Password is correct');
    } else {
      console.log('✅ Gmail SMTP transporter verified successfully');
    }
  });

  return transporter;
}

// ============================================
// GENERATE OTP
// ============================================
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================
// SEND OTP EMAIL
// ============================================
/**
 * Send OTP email to user
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit OTP code
 * @param {string} purpose - 'signup' | 'forgot-password' | 'verification'
 * @returns {Promise<Object>} - { success: true, messageId: string }
 */
async function sendOTPEmail(toEmail, otp, purpose = 'verification') {
  // Input validation
  if (!toEmail || typeof toEmail !== 'string') {
    throw new Error('Invalid email address: toEmail is required and must be a string');
  }

  const trimmedEmail = toEmail.trim().toLowerCase();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    throw new Error(`Invalid email format: ${trimmedEmail}`);
  }

  if (!otp || otp.length !== 6) {
    throw new Error('Invalid OTP: must be 6 digits');
  }

  // Validate configuration
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('Email configuration missing. Please set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.');
  }

  console.log(`📧 [${purpose.toUpperCase()}] Attempting to send OTP email...`);
  console.log('   To:', trimmedEmail);
  console.log('   OTP:', otp);
  console.log('   Environment:', process.env.NODE_ENV || 'development');

  // Create transporter
  const emailTransporter = createTransporter();

  // Email content based on purpose
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

  // Mail options
  const mailOptions = {
    from: `"AtoZ Inventory" <${GMAIL_USER}>`,
    to: trimmedEmail,
    subject: subject,
    html: htmlContent,
  };

  try {
    console.log('📧 Sending email via Gmail SMTP...');
    const info = await emailTransporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully!');
    console.log('   Message ID:', info.messageId);
    console.log('   Response:', info.response);
    
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error('❌ EMAIL SEND ERROR:');
    console.error('   Error code:', error.code);
    console.error('   Error message:', error.message);
    console.error('   Command:', error.command);
    console.error('   Response:', error.response);
    console.error('   Full error:', error);

    // Provide specific error messages
    if (error.code === 'EAUTH') {
      throw new Error('Gmail authentication failed. Please check GMAIL_USER and GMAIL_APP_PASSWORD. Make sure 2-Step Verification is enabled and App Password is correct.');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      throw new Error('Connection timeout. This may happen on Render free tier (SMTP ports blocked). Consider upgrading to paid plan or using a VPS. Error: ' + error.message);
    } else if (error.code === 'EENVELOPE') {
      throw new Error('Invalid email address: ' + error.message);
    } else {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  generateOTP,
  sendOTPEmail,
};
