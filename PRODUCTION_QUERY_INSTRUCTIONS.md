# Production Database Queries - Step by Step Guide

## 📍 Kahan Run Karein?

**Production PostgreSQL Database mein** - jo aapke Render/Heroku ya kisi bhi hosting platform par hai.

## 🔧 Kaise Run Karein?

### Option 1: Render Dashboard se (Recommended)
1. Render dashboard mein jao
2. Apni **PostgreSQL database** select karo
3. **"Connect"** ya **"Query"** button click karo
4. `PRODUCTION_RUN_THESE_QUERIES.sql` file ki queries copy-paste karo
5. **Run** button click karo

### Option 2: pgAdmin ya DBeaver se
1. Production database se connect karo
2. SQL query editor open karo
3. `PRODUCTION_RUN_THESE_QUERIES.sql` file ki queries copy-paste karo
4. Execute karo

### Option 3: Command Line se (psql)
```bash
psql "your-production-database-connection-string" -f PRODUCTION_RUN_THESE_QUERIES.sql
```

## 📋 Kya Queries Run Karein?

**File: `PRODUCTION_RUN_THESE_QUERIES.sql`**

Ye file mein **3 queries** hain jo automatically check karke missing columns add karengi:

1. **pincode** column (customer_profiles table mein)
2. **full_name** column (customer_profiles table mein)  
3. **email** column (customer_profiles table mein)

## ✅ Verification

Queries run karne ke baad, verification query run karein:

```sql
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'customer_profiles' 
AND column_name IN ('pincode', 'full_name', 'email')
ORDER BY column_name;
```

**Expected Result:** 3 rows aane chahiye

## 🛡️ Safety

- ✅ **Safe hai** - sirf missing columns add hongi
- ✅ **Existing data safe hai** - kuch delete ya modify nahi hoga
- ✅ **Agar column already hai** - kuch nahi hoga, error nahi aayega
- ✅ **Multiple times run kar sakte hain** - koi problem nahi

## 📝 Summary

**Table:** `customer_profiles`  
**Queries:** 3 queries (pincode, full_name, email columns ke liye)  
**File:** `PRODUCTION_RUN_THESE_QUERIES.sql`

Bas yeh file ki queries production database mein run kar do, sab set ho jayega! 🚀
