# Gmail SMTP Setup - Production Guide

## ✅ Root Cause Analysis

### A) Current Email Service
- **Using:** Gmail SMTP via Nodemailer (Resend code removed)
- **Location:** `server/utils/emailService.js`
- **Method:** `nodemailer.createTransport()` with Gmail SMTP

### B) Environment Variables Loading
- ✅ `dotenv` is loaded in `server/index.js` (line 2: `require("dotenv").config()`)
- ✅ Production platforms (Render/Railway/VPS) load `.env` automatically
- ⚠️ **IMPORTANT:** On Render, add environment variables in Dashboard, not just `.env` file

### C) NODE_ENV Configuration
- **Current:** `NODE_ENV=development` in `.env` template
- **Production:** Must be `NODE_ENV=production` in production environment
- **Impact:** Affects database connection, CORS, error messages

### D) Gmail App Password Format
- ✅ Code automatically removes spaces: `.replace(/\s/g, '')`
- ✅ Validates 16-character length
- ✅ Logs warnings if format is incorrect

## 📧 Final .env Configuration

### Required Variables (server/.env)

```bash
# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=4000

# IMPORTANT: Set to 'production' in production environment
# For localhost: NODE_ENV=development
# For production: NODE_ENV=production
NODE_ENV=development

# ============================================
# DATABASE CONFIGURATION
# ============================================
# Development Database (Local)
DATABASE_URL=postgres://postgres:007222@localhost:5432/inventory_db

# Production Database
DATABASE_URL_PROD=postgresql://atoz_inventory_user:5onz8uUNT7j5UicfQyVEztDXK4lwOSgz@dpg-d5eekfvgi27c73av6nh0-a:5432/atoz_inventory

# ============================================
# CORS CONFIGURATION
# ============================================
# Comma-separated list of allowed origins
# For production, add your frontend URL
ALLOWED_ORIGINS=http://localhost:5173,https://atoz-frontend.onrender.com

# ============================================
# JWT SECRET
# ============================================
# Change this to a random string in production
JWT_SECRET=your-secret-key-change-this-in-production

# ============================================
# GMAIL SMTP CONFIGURATION (REQUIRED)
# ============================================
# Your Gmail address
GMAIL_USER=pathanaabid5152@gmail.com

# Gmail App Password (16 characters, NO SPACES)
# Get from: https://myaccount.google.com/apppasswords
# Example: If Google shows "abcd efgh ijkl mnop", save as "abcdefghijklmnop"
GMAIL_APP_PASSWORD=xxxdoyjyxspkbcjb

# Alternative variable names (also supported):
# EMAIL_USER=pathanaabid5152@gmail.com
# EMAIL_PASSWORD=xxxdoyjyxspkbcjb
```

### Production Environment Variables (Render/Railway/VPS)

**On Render Dashboard:**
1. Go to your backend service
2. Click "Environment" tab
3. Add/Update these variables:

```
NODE_ENV=production
GMAIL_USER=pathanaabid5152@gmail.com
GMAIL_APP_PASSWORD=xxxdoyjyxspkbcjb
ALLOWED_ORIGINS=https://atoz-frontend.onrender.com
JWT_SECRET=your-production-secret-key
DATABASE_URL_PROD=your-production-database-url
```

## 🧪 Testing

### Test Endpoint

**GET** `/api/auth/test-email?to=your@email.com`

**Example:**
```bash
# Localhost
curl "http://localhost:4000/api/auth/test-email?to=test@gmail.com"

# Production
curl "https://atoz-backend-qg3k.onrender.com/api/auth/test-email?to=test@gmail.com"
```

**Response (Success):**
```json
{
  "ok": true,
  "success": true,
  "message": "Test email sent successfully!",
  "testEmail": "test@gmail.com",
  "testOTP": "123456",
  "messageId": "<message-id>",
  "note": "Check your email inbox for the OTP"
}
```

**Response (Error):**
```json
{
  "ok": false,
  "error": "Failed to send test email",
  "message": "Connection timeout..."
}
```

## 📋 Production Deployment Checklist

### Step 1: Update Environment Variables
- [ ] Set `NODE_ENV=production` in production environment
- [ ] Add `GMAIL_USER` with your Gmail address
- [ ] Add `GMAIL_APP_PASSWORD` (16 characters, no spaces)
- [ ] Update `ALLOWED_ORIGINS` with production frontend URL
- [ ] Set strong `JWT_SECRET` for production

### Step 2: Verify Gmail App Password
- [ ] Go to https://myaccount.google.com/apppasswords
- [ ] Generate new App Password if needed
- [ ] Copy 16-character password (remove spaces)
- [ ] Paste in environment variables (NO SPACES)

### Step 3: Restart Backend Server
- [ ] **Render:** Automatic redeploy after env var changes
- [ ] **VPS/PM2:** `pm2 restart all` or `systemctl restart your-app`
- [ ] **Railway:** Automatic restart

### Step 4: Check Server Logs
Look for these logs on startup:
```
✅ Gmail SMTP configuration found:
   User: pathanaabid5152@gmail.com
   Password length: 16 characters
✅ Gmail SMTP transporter created
✅ Gmail SMTP transporter verified successfully
```

### Step 5: Test Email Sending
1. Use test endpoint: `/api/auth/test-email?to=your@email.com`
2. Check server logs for success/error
3. Check email inbox for OTP

### Step 6: Test OTP Flow
1. Go to production site
2. Try signup or forgot password
3. Verify OTP email arrives
4. Complete OTP verification

## ⚠️ Important Notes

### Render Free Tier Limitation
- **Issue:** Render free tier blocks SMTP ports (25, 465, 587)
- **Symptom:** Connection timeout errors
- **Solutions:**
  1. **Upgrade to Render paid plan** (recommended)
  2. **Use VPS** (DigitalOcean, AWS EC2, Linode)
  3. **Use Railway** (allows SMTP on free tier)

### Gmail App Password Requirements
- ✅ 2-Step Verification must be enabled
- ✅ App Password must be 16 characters
- ✅ No spaces in environment variable
- ✅ App Password expires if 2-Step Verification is disabled

### Error Troubleshooting

**Error: "EAUTH - Authentication failed"**
- Check Gmail App Password is correct
- Verify 2-Step Verification is enabled
- Regenerate App Password if needed

**Error: "ETIMEDOUT - Connection timeout"**
- Render free tier blocks SMTP ports
- Upgrade to paid plan or use VPS
- Check firewall settings

**Error: "Invalid email format"**
- Verify email address format
- Check for extra spaces or special characters

## 🔍 Debugging

### Check Email Configuration
```bash
# Server logs on startup show:
📧 Email Configuration Check:
✅ Gmail SMTP configuration found:
   User: pathanaabid5152@gmail.com
   Password length: 16 characters
```

### Test Email Sending
```bash
# Use test endpoint
curl "https://your-backend.com/api/auth/test-email?to=test@gmail.com"
```

### Check Server Logs
Look for:
- `✅ Email sent successfully!`
- `❌ EMAIL SEND ERROR:` (with error details)

## ✅ Success Indicators

1. ✅ Server logs show "Gmail SMTP transporter verified successfully"
2. ✅ Test endpoint returns `ok: true`
3. ✅ OTP emails arrive in inbox within 5-10 seconds
4. ✅ Signup and forgot password flows work correctly
