# 📤 Data Migration Guide - Localhost to Production

## Problem
Your localhost has all the actual data (products, sales, purchases, etc.) but production database is empty.

## Solution
Migrate your localhost data to production using the migration tool.

---

## 🚀 Step-by-Step Instructions

### Step 1: Export Data from Localhost

**On your local machine**, open terminal in project root and run:

```bash
node export-localhost-data.js
```

**Expected Output:**
```
📤 Exporting data from localhost database...
📦 Exporting products...
✅ Exported 50 products
📦 Exporting stock...
✅ Exported 200 stock items
💰 Exporting sales...
✅ Exported 150 sales items
...
✅ Data exported successfully to localhost-data-export.json
```

**File Created:** `localhost-data-export.json` (in project root)

---

### Step 2: Wait for Backend Redeploy

- Render.com will auto-deploy the migration endpoint
- Wait 2-3 minutes for deployment
- Check Render dashboard - backend should be "Live"

---

### Step 3: Import Data to Production

**Option A: Using HTML File (Easiest)**

1. Open `migrate-data.html` file in your browser
2. Click "Choose File" and select `localhost-data-export.json`
3. Click "Import Data to Production"
4. Wait for success message

**Option B: Using Browser Console**

1. Open production frontend: https://atoz-frontend.onrender.com
2. Press F12 (Developer Tools)
3. Go to Console tab
4. Run this code:

```javascript
// First, read the JSON file (you need to upload it first)
// Or paste the JSON data directly:

const data = {
  // Paste your JSON data here
};

fetch('https://atoz-backend-qq3k.onrender.com/api/migrate-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data })
})
  .then(res => res.json())
  .then(result => {
    console.log('✅ Migration Result:', result);
    if (result.success) {
      alert('✅ Data migrated successfully!\n\n' + 
            JSON.stringify(result.results, null, 2));
    }
  })
  .catch(err => console.error('❌ Error:', err));
```

---

## 📋 What Gets Migrated

- ✅ **Products** - All your products
- ✅ **Stock** - All stock items
- ✅ **Sales** - All sales records
- ✅ **Purchases** - All purchase records
- ✅ **Users/Customers** - All users (except admin)
- ✅ **Customer Profiles** - All customer profiles
- ✅ **Notifications** - All notifications
- ✅ **Charging Services** - All charging services
- ✅ **Service Requests** - All service requests
- ✅ **Company Returns** - All returns

---

## ⚠️ Important Notes

1. **Safe Migration:**
   - Uses `ON CONFLICT DO UPDATE` for products/users
   - Uses `ON CONFLICT DO NOTHING` for stock/sales
   - Won't delete existing data
   - Won't duplicate data

2. **Admin User:**
   - Admin user (`admin@atozinventory.com`) is skipped
   - Production admin remains unchanged

3. **Data Integrity:**
   - Foreign keys are preserved
   - Timestamps are maintained
   - All relationships are kept

---

## ✅ After Migration

1. **Refresh your application**
2. **Check all sections:**
   - Products page - should show all your products
   - Sales - should show all sales history
   - Purchases - should show all purchases
   - Stock - should show all stock items
   - Users - should show all customers
   - Dashboard - should show correct data

---

## 🐛 Troubleshooting

**If export fails:**
- Check `.env` file has correct `DATABASE_URL`
- Make sure localhost database is running
- Check database connection

**If import fails:**
- Check backend logs on Render
- Verify JSON file is valid
- Check network tab for errors

---

**Ab Step 1 (export) karo, phir Step 3 (import) karo - sab data production mein migrate ho jayega! 🎉**

