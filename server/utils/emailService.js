// server/utils/emailService.js
const nodemailer = require('nodemailer');

// Create reusable transporter object using Gmail SMTP
const createTransporter = () => {
  // Gmail SMTP configuration
  // Note: For production, use App Password instead of regular password
  // Generate App Password from: https://myaccount.google.com/apppasswords
  
  const emailUser = (process.env.GMAIL_USER || process.env.EMAIL_USER)?.trim();
  // Remove spaces from App Password (Gmail App Passwords sometimes have spaces when copied)
  const emailPassword = (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD)?.replace(/\s/g, '').trim();

  // Check if email configuration is set
  if (!emailUser || !emailPassword) {
    console.error('Email configuration missing:');
    console.error('GMAIL_USER:', emailUser ? 'Set' : 'NOT SET');
    console.error('GMAIL_APP_PASSWORD:', emailPassword ? 'Set (length: ' + emailPassword.length + ')' : 'NOT SET');
    throw new Error('Email configuration not found. Please set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.');
  }

  // Validate App Password length (should be 16 characters)
  if (emailPassword.length !== 16) {
    console.warn('Warning: Gmail App Password should be 16 characters. Current length:', emailPassword.length);
  }

  console.log('Email service configured with user:', emailUser);

  // Production servers (Render/Heroku) often have network restrictions
  // Use explicit SMTP configuration instead of 'service: gmail'
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Explicit SMTP configuration for production (better for cloud servers)
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
      // Increased timeouts for production network latency
      connectionTimeout: 90000, // 90 seconds
      socketTimeout: 90000, // 90 seconds
      greetingTimeout: 30000, // 30 seconds
      // Retry configuration
      pool: true,
      maxConnections: 1,
      maxMessages: 3,
      // Additional options for production
      tls: {
        rejectUnauthorized: false, // Some cloud providers need this
      },
    });
  } else {
    // Development: use service shortcut
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
      // Increase timeout settings to prevent connection timeout
      connectionTimeout: 60000, // 60 seconds
      socketTimeout: 60000, // 60 seconds
      greetingTimeout: 30000, // 30 seconds
      // Retry configuration
      pool: true,
      maxConnections: 1,
      maxMessages: 3,
    });
  }
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

    const emailUser = (process.env.GMAIL_USER || process.env.EMAIL_USER)?.trim();
    
    const mailOptions = {
      from: emailUser,
      to: email,
      subject: subject,
      html: htmlContent,
    };

    console.log('Attempting to send email to:', email);
    console.log('Email service: Starting SMTP connection...');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('SMTP Host: smtp.gmail.com:465');

    // Production needs longer timeout due to network latency
    const timeoutDuration = process.env.NODE_ENV === 'production' ? 60000 : 30000;
    
    // Add timeout wrapper for email sending
    const sendEmailWithTimeout = (transporter, mailOptions, timeout = timeoutDuration) => {
      return Promise.race([
        transporter.sendMail(mailOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Email send timeout after ${timeout/1000} seconds`)), timeout)
        )
      ]);
    };

    const info = await sendEmailWithTimeout(transporter, mailOptions, timeoutDuration);
    console.log('✅ Email sent successfully:', info.messageId);
    console.log('✅ Email sent to:', email);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });

    // Provide more specific error messages
    if (error.message && error.message.includes('timeout')) {
      throw new Error('Connection timeout. Please check your internet connection and try again. If the problem persists, the email server may be temporarily unavailable.');
    } else if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Please check GMAIL_USER and GMAIL_APP_PASSWORD.');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      throw new Error('Failed to connect to email server. Please check your internet connection and firewall settings.');
    } else if (!process.env.GMAIL_USER && !process.env.EMAIL_USER) {
      throw new Error('Email configuration not found. Please set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.');
    } else {
      throw new Error(`Failed to send email: ${error.message || 'Unknown error'}`);
    }
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
};
