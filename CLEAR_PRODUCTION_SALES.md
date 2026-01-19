# Clear Production Sales Data - Instructions

## Problem
Production UI is still showing sales data even though local database was cleared. This is because production uses a separate database.

## Solution
Run the clear script on production database.

## Method 1: Using Node.js Script (Recommended)

### On Render/Production Server:

1. **SSH into your production server** (if you have SSH access)
   OR
   **Use Render Shell** (if available in Render dashboard)

2. **Run the script:**
   ```bash
   cd /path/to/your/app
   NODE_ENV=production node server/scripts/clear_all_sales_production.js
   ```

### On Local Machine (Connecting to Production DB):

1. **Set production environment variables:**
   ```bash
   export NODE_ENV=production
   export DATABASE_URL=your_production_database_url
   ```

2. **Run the script:**
   ```bash
   cd server
   node scripts/clear_all_sales_production.js
   ```

## Method 2: Using SQL Script (Direct Database Access)

If you have direct access to your production PostgreSQL database:

1. **Connect to production database:**
   ```bash
   psql your_production_database_url
   ```

2. **Run the SQL script:**
   ```sql
   \i server/scripts/clear_all_sales_production.sql
   ```

   OR copy-paste the SQL commands directly into psql.

## Method 3: Using Render Dashboard

1. Go to Render Dashboard → Your Database
2. Open **"Connect"** or **"Shell"** tab
3. Run the SQL commands from `clear_all_sales_production.sql`

## Verification

After running the script, verify:

1. **Check database:**
   ```sql
   SELECT COUNT(*) FROM sales_item;  -- Should return 0
   ```

2. **Clear browser cache:**
   - Press `Ctrl + Shift + Delete`
   - Select "Cached images and files"
   - Click "Clear data"

3. **Hard refresh the page:**
   - Press `Ctrl + Shift + R` (Windows/Linux)
   - Press `Cmd + Shift + R` (Mac)

4. **Check UI:**
   - Inventory/Sold Batteries section → Should show "No Sold Batteries Found"
   - Sales section → Should show empty list
   - Dashboard → All sales metrics should be 0
   - Reports → All sales values should be 0

## Expected Results

✅ **Inventory/Sold Batteries Section:**
- "No Sold Batteries Found" message
- Empty table
- Summary: "Total Sold: 0 batteries"

✅ **Sales Section:**
- Empty list
- No sales records

✅ **Dashboard:**
- Sales revenue: ₹0
- Sales count: 0
- All sales metrics: 0

✅ **Reports:**
- All sales reports: 0 values

## Important Notes

⚠️ **This action is PERMANENT and CANNOT be undone!**

- Make sure you have a backup if you need to restore data later
- The script will delete ALL sales records from production database
- After clearing, you'll need to clear browser cache to see the changes

## Troubleshooting

If data still appears after clearing:

1. **Verify database connection:**
   - Check if script connected to correct database
   - Verify `NODE_ENV=production` is set

2. **Check for multiple databases:**
   - Ensure you're clearing the correct production database
   - Verify database URL in environment variables

3. **Clear all caches:**
   - Browser cache
   - Server-side cache (if any)
   - CDN cache (if using)

4. **Restart server:**
   - After clearing data, restart the production server
   - This ensures fresh data is loaded

