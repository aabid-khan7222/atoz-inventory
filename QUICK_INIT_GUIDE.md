# 🚀 Quick Database Initialization Guide

## Problem
Login is failing because database tables don't exist.

## Solution - 3 Easy Steps

### Step 1: Open Browser Console
1. Open your frontend: https://atoz-frontend.onrender.com
2. Press **F12** (or Right-click → Inspect)
3. Go to **Console** tab

### Step 2: Run This Code
Copy and paste this code in the console, then press Enter:

```javascript
fetch('https://atoz-backend-qq3k.onrender.com/api/init', { method: 'POST' })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      console.log('✅ Database initialized!');
      console.log('Admin Email:', data.admin.email);
      console.log('Admin Password:', data.admin.password);
      alert('Database initialized! Email: ' + data.admin.email + ', Password: ' + data.admin.password);
    } else {
      console.error('❌ Error:', data);
    }
  })
  .catch(err => console.error('❌ Network Error:', err));
```

### Step 3: Login
After successful initialization:
- **Email:** `admin@atozinventory.com`
- **Password:** `admin123`

---

## Alternative: Use HTML File

1. Open `init-database.html` file in your browser
2. Click "Initialize Database" button
3. Wait for success message
4. Login with credentials shown

---

## What Gets Created?

✅ **Tables:**
- `roles` (Super Admin, Admin, Customer)
- `users` (User accounts)
- `customer_profiles` (Customer data)

✅ **Default Admin:**
- Email: `admin@atozinventory.com`
- Password: `admin123`
- Role: Super Admin

---

## Troubleshooting

**If you get CORS error:**
- Make sure backend is deployed and running
- Check Render backend logs

**If you get 404 error:**
- Make sure backend is redeployed with latest code
- Wait 1-2 minutes after deployment

**If tables already exist:**
- That's fine! The endpoint is safe to call multiple times
- It won't create duplicates

---

**After initialization, login will work! 🎉**

