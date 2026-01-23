# Production Setup: Signup & Forgot Password Features

## Overview
This document contains the setup instructions and database queries (if needed) for the new Signup and Forgot Password features with OTP email verification.

## ✅ Database Schema Check

The existing `users` and `customer_profiles` tables should have all required columns. However, to ensure everything works correctly, please run the queries in `PRODUCTION_DB_QUERIES.sql` to verify and add any missing columns.

**The code automatically handles missing columns**, but it's recommended to ensure all columns exist for optimal performance.

## 📧 Email Configuration (REQUIRED)

### Step 1: Set Up Gmail App Password

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification** (enable if not already enabled)
3. Go to **App passwords**: https://myaccount.google.com/apppasswords
4. Generate a new App Password for "Mail"
5. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

### Step 2: Add Environment Variables

Add the following environment variables to your production server (Render/Heroku/etc.):

```bash
# Gmail SMTP Configuration
GMAIL_USER=pathanaabid5152@gmail.com
GMAIL_APP_PASSWORD=xxxdoyjyxspkbcjb  # The 16-character app password

# Alternative variable names (also supported):
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
```

**Important Notes:**
- Use **App Password**, not your regular Gmail password
- The App Password is 16 characters (remove spaces if copied with spaces)
- Keep these credentials secure and never commit them to git

### Step 3: Verify Email Configuration

After setting environment variables, restart your backend server. The email service will use these credentials automatically.

## 🧪 Testing

### Test Signup Flow:
1. Navigate to `/signup`
2. Fill in all required fields
3. Click "Send OTP & Continue"
4. Check email for OTP
5. Enter OTP and verify account creation

### Test Forgot Password Flow:
1. Navigate to `/forgot-password`
2. Enter registered email
3. Click "Send OTP"
4. Check email for OTP
5. Enter OTP and new password
6. Login with new password

## 🔍 Troubleshooting

### Email Not Sending

1. **Check Environment Variables:**
   ```bash
   # On Render dashboard, verify these are set:
   GMAIL_USER
   GMAIL_APP_PASSWORD
   ```

2. **Check Server Logs:**
   - Look for "Error sending email" messages
   - Verify email configuration is loaded

3. **Common Issues:**
   - **"Invalid login"**: App Password is incorrect or not set
   - **"Connection timeout"**: Check server network/firewall settings
   - **"Authentication failed"**: Verify 2-Step Verification is enabled on Gmail account

### OTP Not Working

- OTPs expire after 10 minutes
- Maximum 5 failed attempts per OTP
- Check server logs for OTP generation errors

## 📝 API Endpoints

### Signup:
- `POST /api/auth/signup/send-otp` - Send OTP to email
- `POST /api/auth/signup/verify-otp` - Verify OTP and create account

### Forgot Password:
- `POST /api/auth/forgot-password/send-otp` - Send OTP to email
- `POST /api/auth/forgot-password/verify-otp` - Verify OTP and reset password

## 🔐 Security Features

1. **OTP Expiration**: OTPs expire after 10 minutes
2. **Rate Limiting**: Maximum 5 failed attempts per OTP
3. **Password Hashing**: All passwords are hashed using bcrypt
4. **Email Validation**: Email format validation on both frontend and backend
5. **Password Strength**: Minimum 6 characters required

## 📊 Database Tables Used

### `users` table:
- `id`, `full_name`, `email`, `phone`, `password`
- `state`, `city`, `address`
- `gst_number`, `company_name`, `company_address`
- `role_id`, `is_active`

### `customer_profiles` table:
- `user_id`, `full_name`, `email`, `phone`
- `state`, `city`, `address`, `pincode`
- `is_business_customer`
- `company_name`, `gst_number`, `company_address`

## 🚀 Deployment Checklist

- [ ] Gmail App Password generated
- [ ] Environment variables set in production
- [ ] Backend server restarted
- [ ] Test signup flow
- [ ] Test forgot password flow
- [ ] Verify emails are being sent
- [ ] Check server logs for any errors

## 📞 Support

If you encounter any issues:
1. Check server logs for detailed error messages
2. Verify environment variables are correctly set
3. Test email configuration with a simple test script
4. Ensure Gmail account has 2-Step Verification enabled

---

**Note**: The OTP storage is currently in-memory. For production with multiple server instances, consider using Redis or database-based OTP storage for better scalability.
