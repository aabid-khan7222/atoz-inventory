// server/utils/emailService.js
const nodemailer = require('nodemailer');
const https = require('https');

// Send email using Resend API (works on Render free tier - no SMTP port blocking)
const sendEmailViaResend = async (to, subject, htmlContent, fromEmail) => {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured. Please set it in environment variables.');
  }

  const data = JSON.stringify({
    from: fromEmail || 'AtoZ Inventory <noreply@resend.dev>',
    to: [to],
    subject: subject,
    html: htmlContent,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Length': data.length,
      },
      timeout: 10000, // 10 seconds timeout
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const result = JSON.parse(responseData);
          console.log('✅ Email sent via Resend:', result.id);
          resolve({ success: true, messageId: result.id });
        } else {
          const error = JSON.parse(responseData);
          console.error('❌ Resend API error:', error);
          reject(new Error(error.message || 'Failed to send email via Resend'));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Resend request error:', error);
      reject(new Error(`Network error: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Resend API request timeout'));
    });

    req.write(data);
    req.end();
  });
};

// Create reusable transporter object using Gmail SMTP (fallback for localhost/paid plans)
const createTransporter = () => {
  const emailUser = (process.env.GMAIL_USER || process.env.EMAIL_USER)?.trim();
  const emailPassword = (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD)?.replace(/\s/g, '').trim();

  if (!emailUser || !emailPassword) {
    throw new Error('Gmail configuration not found');
  }

  console.log('Email service configured with user:', emailUser);

  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
      connectionTimeout: 10000, // 10 seconds
      socketTimeout: 10000,
      greetingTimeout: 5000,
    });
  } else {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
      connectionTimeout: 10000,
      socketTimeout: 10000,
      greetingTimeout: 5000,
    });
  }
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email - Uses Resend API (works on Render free tier) with Gmail SMTP fallback
const sendOTPEmail = async (email, otp, purpose = 'verification') => {
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
  const fromEmail = emailUser ? `${emailUser.split('@')[0]} <${emailUser}>` : 'AtoZ Inventory <noreply@resend.dev>';

  console.log('📧 Attempting to send email to:', email);
  console.log('📧 Environment:', process.env.NODE_ENV || 'development');

  // Strategy: Try Resend API first (works on Render free tier), fallback to Gmail SMTP
  const useResend = process.env.RESEND_API_KEY || process.env.NODE_ENV === 'production';
  
  if (useResend && process.env.RESEND_API_KEY) {
    try {
      console.log('📧 Using Resend API (works on Render free tier)...');
      return await sendEmailViaResend(email, subject, htmlContent, fromEmail);
    } catch (resendError) {
      console.error('❌ Resend API failed, trying Gmail SMTP fallback...', resendError.message);
      // Fall through to Gmail SMTP
    }
  }

  // Fallback to Gmail SMTP (works on localhost and paid Render plans)
  try {
    console.log('📧 Using Gmail SMTP (fallback)...');
    const transporter = createTransporter();
    const mailOptions = {
      from: emailUser,
      to: email,
      subject: subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully via Gmail SMTP:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (gmailError) {
    console.error('❌ Gmail SMTP also failed:', gmailError.message);
    
    // Provide helpful error message
    if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) {
      throw new Error('Email sending failed. Please configure RESEND_API_KEY for production. Render free tier blocks SMTP ports. Get free API key from: https://resend.com/api-keys');
    } else if (gmailError.code === 'ETIMEDOUT' || gmailError.code === 'ECONNECTION') {
      throw new Error('Connection timeout. Render free tier blocks SMTP ports. Please configure RESEND_API_KEY. Get free API key from: https://resend.com/api-keys');
    } else {
      throw new Error(`Failed to send email: ${gmailError.message}`);
    }
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
};
