# Production Email Setup - Connection Timeout Fix

## 🔍 Problem
Production site par email send karne par "Connection timeout" error aa raha hai, lekin localhost mein sab kaam kar raha hai.

## 🎯 Root Cause
Production servers (Render/Heroku) par network restrictions aur firewall settings Gmail SMTP connection ko block kar sakte hain.

## ✅ Solution Applied

### 1. **Explicit SMTP Configuration for Production**
- Production mein `service: 'gmail'` ki jagah explicit SMTP settings use ho rahi hain
- `smtp.gmail.com:465` with `secure: true`
- Better compatibility with cloud servers

### 2. **Increased Timeouts**
- Production: 90 seconds timeout (network latency ke liye)
- Development: 30 seconds timeout

### 3. **TLS Configuration**
- `rejectUnauthorized: false` - Cloud providers ke liye required

## 🔧 Production Server Setup (REQUIRED)

### Step 1: Environment Variables Set Karein

**Render Dashboard:**
1. Go to: https://dashboard.render.com
2. Select your backend service
3. Go to **Environment** tab
4. Add these variables:

```bash
GMAIL_USER=pathanaabid5152@gmail.com
GMAIL_APP_PASSWORD=xxxdoyjyxspkbcjb
```

**Important:**
- App Password mein **spaces nahi hone chahiye**
- 16 characters exactly
- 2-Step Verification enabled hona chahiye

### Step 2: Verify Environment Variables

Server logs mein yeh dikhna chahiye:
```
📧 Email Configuration Check:
✅ Email configuration found:
   User: pathanaabid5152@gmail.com
   Password length: 16 characters
```

### Step 3: Server Restart

Environment variables add karne ke baad:
- Render automatically redeploy karega
- Ya manually "Manual Deploy" karein

## 🧪 Testing

### Test 1: Check Email Configuration
Production server logs check karein:
```
Email service configured with user: pathanaabid5152@gmail.com
Environment: production
SMTP Host: smtp.gmail.com:465
```

### Test 2: Test Email Send
1. Production site par signup form fill karein
2. "Send OTP" click karein
3. Server logs check karein - actual error dikhega

## 🐛 Common Production Issues

### Issue 1: Environment Variables Not Set
**Symptom:** "Email configuration not found"
**Solution:** Render dashboard mein `GMAIL_USER` aur `GMAIL_APP_PASSWORD` set karein

### Issue 2: Network/Firewall Blocking
**Symptom:** Connection timeout
**Solution:** 
- Render servers se Gmail SMTP ports (465) accessible hain ya nahi check karein
- Alternative: Use different email service (SendGrid, Mailgun) for production

### Issue 3: App Password Incorrect
**Symptom:** Authentication error
**Solution:**
- New App Password generate karein
- Spaces remove karein
- 16 characters exactly

## 📝 Production Checklist

- [ ] `GMAIL_USER` set in Render dashboard
- [ ] `GMAIL_APP_PASSWORD` set in Render dashboard (16 chars, no spaces)
- [ ] Server restarted after adding variables
- [ ] Server logs show "Email configuration found"
- [ ] Test signup flow on production
- [ ] Check server logs for actual errors

## 🚀 Alternative Solution (If Still Not Working)

Agar Gmail SMTP production mein consistently fail ho raha hai, to alternative email services use karein:

1. **SendGrid** (Free tier: 100 emails/day)
2. **Mailgun** (Free tier: 5,000 emails/month)
3. **AWS SES** (Very cheap, pay per email)

Main code update kar sakta hoon agar aap alternative service use karna chahte hain.

---

**Current Status:** Code updated with production-specific SMTP configuration. Bas environment variables set karni hain Render dashboard mein.
