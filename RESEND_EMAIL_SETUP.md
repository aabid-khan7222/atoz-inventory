# Resend Email Setup - Production Fix

## 🔍 Problem Solved
Render.com **FREE tier** blocks SMTP ports (25, 465, 587), causing Gmail SMTP to timeout on production. This is why:
- ✅ Localhost works (no port blocking)
- ❌ Production fails (SMTP ports blocked)

## ✅ Solution: Resend API
Resend is an email API service that:
- ✅ Works on Render free tier (no SMTP ports needed)
- ✅ Free tier: 3,000 emails/month
- ✅ Fast and reliable (API-based, not SMTP)
- ✅ Simple setup

## 🚀 Setup Steps

### Step 1: Get Resend API Key (FREE)

1. **Sign up for Resend** (FREE):
   - Go to: https://resend.com/signup
   - Create account with your email
   - Verify your email

2. **Get API Key**:
   - After login, go to: https://resend.com/api-keys
   - Click **"Create API Key"**
   - Name it: `AtoZ Inventory Production`
   - Copy the API key (starts with `re_...`)

### Step 2: Add to Render Environment Variables

1. Go to Render Dashboard: https://dashboard.render.com
2. Select your **backend service**
3. Go to **Environment** tab
4. Click **"Add Environment Variable"**
5. Add this:

```
Key: RESEND_API_KEY
Value: re_your_api_key_here
```

**Example:**
```
RESEND_API_KEY=re_abc123xyz456...
```

6. Click **"Save Changes"**
7. Render will automatically redeploy

### Step 3: Verify Setup

After deployment, check server logs. You should see:
```
📧 Attempting to send email to: user@example.com
📧 Environment: production
📧 Using Resend API (works on Render free tier)...
✅ Email sent via Resend: <email-id>
```

## 🎯 How It Works Now

1. **Production (Render)**: Uses Resend API ✅
2. **Localhost**: Uses Gmail SMTP (fallback) ✅
3. **If Resend fails**: Falls back to Gmail SMTP ✅

## 📧 Email Configuration

You can still keep your Gmail credentials for:
- Localhost development
- Fallback if Resend fails
- Custom "from" email address

**Environment Variables:**
```
RESEND_API_KEY=re_... (REQUIRED for production)
GMAIL_USER=pathanaabid5152@gmail.com (optional, for fallback)
GMAIL_APP_PASSWORD=xxxdoyjyxspkbcjb (optional, for fallback)
```

## 🧪 Testing

1. Production site par signup form fill karein
2. "Send OTP" click karein
3. Email should arrive in **2-3 seconds** (not 5 minutes!)
4. Check server logs - should show "Using Resend API"

## 💰 Cost

- **FREE**: 3,000 emails/month
- **Paid**: $20/month for 50,000 emails (if needed later)

## 🔒 Security

- API key is stored in Render environment variables (secure)
- Never commit API key to git
- Can revoke/regenerate API key anytime from Resend dashboard

## ❓ Troubleshooting

**If email still not sending:**
1. Check `RESEND_API_KEY` is set correctly in Render
2. Verify API key is active in Resend dashboard
3. Check server logs for specific error
4. Make sure you've verified your email in Resend account

**If you see "RESEND_API_KEY not configured":**
- Add the environment variable in Render
- Wait for redeploy to complete
- Try again
