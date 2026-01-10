# 🚀 Quick Start: Data Migration

## Step 1: Update `.env` File

`server/.env` file mein ye add karo (apne local database ke details ke saath):

```env
# Local PostgreSQL 17 Database Details
LOCAL_DB_HOST=localhost
LOCAL_DB_PORT=5432
LOCAL_DB_NAME=atoz_inventory  # Ya jo bhi naam hai apke local database ka
LOCAL_DB_USER=postgres       # Ya jo bhi user hai
LOCAL_DB_PASSWORD=your_password_here  # Apna password
```

**Note:** `DATABASE_URL_PROD` already set hai, usko change mat karo.

## Step 2: Run Migration

Terminal mein ye command run karo:

```bash
cd server
npm run migrate-data
```

Ya directly:

```bash
cd server
node scripts/migrate-data-local-to-render.js
```

## Step 3: Wait for Completion

Script automatically:
- ✅ Local database se connect karega
- ✅ Render database se connect karega
- ✅ Har table ka data copy karega
- ✅ Progress dikhayega
- ✅ Summary dega

## Expected Output

```
🚀 Starting data migration from Local PostgreSQL 17 to Render 'atoz' database

📡 Testing database connections...
  ✅ Local PostgreSQL 17 connected
  ✅ Render 'atoz' database connected

📋 Getting list of tables...
  ✅ Found 25 tables in local database

📦 Migrating table: product_type
  📊 Found 4 rows in local database
  ✅ Successfully migrated 4/4 rows

📦 Migrating table: users
  📊 Found 10 rows in local database
  ✅ Successfully migrated 10/10 rows

...

📊 MIGRATION SUMMARY
✅ Successfully migrated: 25 tables
❌ Failed: 0 tables
⚠️  Skipped: 0 tables
📦 Total rows migrated: 1234
```

## Troubleshooting

### "Local database connection failed"
- Check karo `.env` mein `LOCAL_DB_*` variables sahi hain
- Local PostgreSQL 17 running hai?
- Password sahi hai?

### "DATABASE_URL_PROD not found"
- `.env` file mein `DATABASE_URL_PROD` set hai?
- Render dashboard se connection string copy karo

### "Table does not exist"
- Dono databases mein tables same hain?
- Migration files run kiye hain Render database par?

## Important

⚠️ **Warning:** Yeh script Render database ka **existing data clear** karega aur local se data copy karega.

✅ **Safe:** Local database ka data **delete nahi** hoga, sirf copy hoga.

## After Migration

1. Render database check karo (pgAdmin se)
2. Production URL par jao
3. Login karo
4. Data verify karo (products, customers, sales, etc.)

