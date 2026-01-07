# 🗄️ Database Setup Instructions

## Problem
Login is failing with "Database error" because the `users` and `roles` tables don't exist in the Render PostgreSQL database.

## Solution

### Option 1: Use Init Endpoint (RECOMMENDED - Easiest)

1. **Call the init endpoint ONCE:**
   ```
   POST https://atoz-backend-qq3k.onrender.com/api/init
   ```

   You can use:
   - **Browser:** Open Postman or any API client
   - **cURL:**
     ```bash
     curl -X POST https://atoz-backend-qq3k.onrender.com/api/init
     ```
   - **Browser Console:**
     ```javascript
     fetch('https://atoz-backend-qq3k.onrender.com/api/init', { method: 'POST' })
       .then(r => r.json())
       .then(console.log)
     ```

2. **Expected Response:**
   ```json
   {
     "success": true,
     "message": "Database initialized successfully",
     "admin": {
       "email": "admin@atozinventory.com",
       "password": "admin123",
       "note": "Please change password after first login"
     }
   }
   ```

3. **Login with default credentials:**
   - Email: `admin@atozinventory.com`
   - Password: `admin123`

---

### Option 2: Run Migration Script (Alternative)

If you have access to Render's shell:

1. **SSH into Render service** (if available)
2. **Run migration script:**
   ```bash
   cd server
   npm run migrate
   ```

---

## What Gets Created

### Tables Created:
1. **`roles`** - User roles (Super Admin, Admin, Customer)
2. **`users`** - User accounts with authentication
3. **`customer_profiles`** - Extended customer information

### Default Admin User:
- **Email:** `admin@atozinventory.com`
- **Password:** `admin123`
- **Role:** Super Admin
- **Status:** Active

---

## After Setup

1. ✅ Database tables will exist
2. ✅ Default admin user will be created
3. ✅ Login will work
4. ⚠️ **IMPORTANT:** Change admin password after first login!

---

## Troubleshooting

### If init endpoint returns error:
- Check Render backend logs for detailed error
- Verify `DATABASE_URL` environment variable is set correctly
- Ensure PostgreSQL service is running on Render

### If login still fails:
- Verify tables were created: Check Render PostgreSQL dashboard
- Verify admin user exists: Query `SELECT * FROM users WHERE email = 'admin@atozinventory.com'`
- Check backend logs for specific error messages

---

## Next Steps

After successful initialization:
1. Login with default admin credentials
2. Change admin password immediately
3. Create additional admin/users as needed
4. Start using the application!

