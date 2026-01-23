# Email Configuration Troubleshooting

## ✅ Current Status
- 2-Step Verification: **ON** ✓
- Gmail App Password: Set (with spaces removed)
- Test Endpoint: Added but needs server restart

## 🔧 Steps to Fix

### Step 1: Server Restart (CRITICAL)

**Local Development:**
```bash
# Terminal mein server folder mein jao
cd server

# Server stop karo (Ctrl+C press karo)

# Phir start karo
npm run dev
```

**Important:** `.env` file change ke baad **HAMESHA** server restart karna zaroori hai!

### Step 2: Verify Email Configuration

Server restart ke baad, browser mein yeh URL open karein:
```
http://localhost:4000/api/auth/test-email
```

**Expected Response:**
```json
{
  "emailConfigured": true,
  "emailUser": "pathanaabid5152@gmail.com",
  "emailPasswordLength": 16,
  "emailPasswordSet": true,
  "message": "Email configuration found. Try sending an OTP to test."
}
```

### Step 3: Check Server Logs

Server console mein yeh dikhna chahiye:
```
Email service configured with user: pathanaabid5152@gmail.com
```

### Step 4: Test Signup Flow

1. Signup form fill karein
2. "Send OTP" click karein
3. Server console check karein - actual error dikhega

## 🐛 Common Issues

### Issue 1: Server Not Restarted
**Symptom:** Test endpoint "Not Found" error
**Solution:** Server restart karein

### Issue 2: Environment Variables Not Loading
**Symptom:** `emailConfigured: false`
**Solution:** 
- Check `.env` file `server` folder mein hai
- Check variable names: `GMAIL_USER` and `GMAIL_APP_PASSWORD`
- No spaces in App Password

### Issue 3: Gmail Authentication Error
**Symptom:** `EAUTH` error in logs
**Solution:**
- Verify App Password is correct (16 characters)
- Check 2-Step Verification is ON
- Generate new App Password if needed

## 📝 Quick Checklist

- [ ] Server restarted after .env changes
- [ ] `.env` file in `server` folder
- [ ] `GMAIL_USER` set correctly
- [ ] `GMAIL_APP_PASSWORD` set (16 chars, no spaces)
- [ ] 2-Step Verification ON
- [ ] Test endpoint accessible: `/api/auth/test-email`
- [ ] Server logs show "Email service configured"

## 🚀 After Server Restart

1. Test endpoint check karein
2. Signup form try karein
3. Server console mein actual error check karein
4. Agar error aaye, exact error message share karein

---

**Note:** Server restart ke baad sab theek ho jayega. Code already push ho gaya hai, bas server restart karna hai!
