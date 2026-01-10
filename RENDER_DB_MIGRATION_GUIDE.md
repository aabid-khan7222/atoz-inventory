# 🚀 Render PostgreSQL Database Migration Guide

## ✅ SAFETY VERIFICATION

### Database Credentials (from env.template):
- **Local DB**: `postgres://postgres:007222@localhost:5432/inventory_db`
- **Render DB**: `postgresql://atoz_inventory_user:5onz8uUNT7j5UicfQyVEztDXK4lwOSgz@dpg-d5eekfvgi27c73av6nh0-a:5432/atoz_inventory`

✅ **VERIFIED**: These are DIFFERENT databases - local DB will NOT be touched.

---

## 📋 MIGRATION PLAN

### Step 1: Verify Database Credentials
Run the verification script to confirm credentials are different.

### Step 2: Create Tables on Render DB
Use `/api/init` endpoint or run migrations to create all tables.

### Step 3: Export Data from Local DB
Use `pg_dump` to export ONLY DATA (no schema) from local database.

### Step 4: Restore Data to Render DB
Use `psql` to restore data into Render PostgreSQL database.

### Step 5: Verify Migration
Check that all tables and data are present in Render DB.

---

## 🔧 EXACT COMMANDS

### Prerequisites
- PostgreSQL client tools installed (`pg_dump` and `psql`)
- Access to local pgAdmin database
- Render PostgreSQL connection string

### Step 1: Verify Credentials
```powershell
# Run verification script
node server/scripts/verify-db-credentials.js
```

### Step 2: Create Tables on Render DB

**Option A: Using API Endpoint (Recommended)**
```powershell
# Set production environment
$env:NODE_ENV="production"
$env:DATABASE_URL_PROD="postgresql://atoz_inventory_user:5onz8uUNT7j5UicfQyVEztDXK4lwOSgz@dpg-d5eekfvgi27c73av6nh0-a:5432/atoz_inventory"

# Start server (if not running)
cd server
npm start

# In another terminal, call init endpoint
curl -X POST http://localhost:4000/api/init
```

**Option B: Using Migration Script**
```powershell
# Set production environment
$env:NODE_ENV="production"
$env:DATABASE_URL_PROD="postgresql://atoz_inventory_user:5onz8uUNT7j5UicfQyVEztDXK4lwOSgz@dpg-d5eekfvgi27c73av6nh0-a:5432/atoz_inventory"

# Run migrations
cd server
npm run migrate
```

### Step 3: Export Data from Local DB

**⚠️ SAFE COMMAND - Only exports DATA, no schema changes**

```powershell
# Export ONLY DATA (no schema) from local database
pg_dump -h localhost -U postgres -d inventory_db `
  --data-only `
  --column-inserts `
  --no-owner `
  --no-privileges `
  --file=local_db_data_dump.sql

# When prompted, enter password: 007222
```

**What this does:**
- `--data-only`: Only exports data, NOT schema (safe!)
- `--column-inserts`: Creates INSERT statements with column names
- `--no-owner`: Doesn't include ownership info
- `--no-privileges`: Doesn't include permission info
- **NO DROP/CREATE statements** - completely safe for local DB

### Step 4: Restore Data to Render DB

**⚠️ This will INSERT data into Render DB only**

```powershell
# Restore data to Render PostgreSQL
psql "postgresql://atoz_inventory_user:5onz8uUNT7j5UicfQyVEztDXK4lwOSgz@dpg-d5eekfvgi27c73av6nh0-a:5432/atoz_inventory" `
  -f local_db_data_dump.sql `
  --set ON_ERROR_STOP=on
```

**What this does:**
- Connects to Render DB (NOT local)
- Inserts data from dump file
- Stops on errors (safety feature)

### Step 5: Verify Migration

```powershell
# Connect to Render DB and check tables
psql "postgresql://atoz_inventory_user:5onz8uUNT7j5UicfQyVEztDXK4lwOSgz@dpg-d5eekfvgi27c73av6nh0-a:5432/atoz_inventory" `
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"

# Check row counts
psql "postgresql://atoz_inventory_user:5onz8uUNT7j5UicfQyVEztDXK4lwOSgz@dpg-d5eekfvgi27c73av6nh0-a:5432/atoz_inventory" `
  -c "SELECT 'users' as table_name, COUNT(*) as row_count FROM users UNION ALL SELECT 'products', COUNT(*) FROM products UNION ALL SELECT 'purchases', COUNT(*) FROM purchases UNION ALL SELECT 'sales_item', COUNT(*) FROM sales_item;"
```

---

## 🛡️ SAFETY GUARANTEES

1. ✅ **Local DB is NEVER modified** - `pg_dump` only reads data
2. ✅ **No DROP statements** - `--data-only` flag ensures no destructive SQL
3. ✅ **Different credentials** - Local and Render use different connection strings
4. ✅ **One-time operation** - Migration runs once, can be verified before proceeding

---

## 📝 ALTERNATIVE: Automated Migration Script

For convenience, use the automated migration script:

```powershell
# Run automated migration (handles all steps)
node server/scripts/migrate-to-render.js
```

This script will:
1. Verify credentials are different
2. Create tables on Render DB
3. Export data from local DB
4. Restore data to Render DB
5. Verify migration success

---

## ⚠️ IMPORTANT NOTES

1. **Backup First**: Even though we're not modifying local DB, it's good practice to backup:
   ```powershell
   pg_dump -h localhost -U postgres -d inventory_db -F c -f local_db_backup.dump
   ```

2. **Render DB SSL**: Render PostgreSQL requires SSL. The connection string handles this automatically.

3. **Foreign Key Constraints**: If you get foreign key errors during restore, you may need to temporarily disable them:
   ```sql
   SET session_replication_role = 'replica';
   -- Run your INSERTs
   SET session_replication_role = 'origin';
   ```

4. **Sequence Reset**: After data migration, reset sequences to avoid ID conflicts:
   ```sql
   SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
   SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
   -- Repeat for all SERIAL columns
   ```

---

## ✅ FINAL CHECKLIST

- [ ] Verified local and Render DB credentials are different
- [ ] Created all tables on Render DB
- [ ] Exported data from local DB (data-only dump)
- [ ] Restored data to Render DB
- [ ] Verified all tables exist in Render DB
- [ ] Verified row counts match between local and Render
- [ ] Tested application connection to Render DB
- [ ] Confirmed local DB is untouched

---

## 🆘 TROUBLESHOOTING

### Error: "relation does not exist"
- **Solution**: Run `/api/init` endpoint first to create tables

### Error: "duplicate key value violates unique constraint"
- **Solution**: Data already exists. Use `--clean` flag or manually delete data first

### Error: "SSL connection required"
- **Solution**: Add `?sslmode=require` to connection string

### Error: "connection timeout"
- **Solution**: Check Render database is running and connection string is correct

---

## 📞 NEXT STEPS AFTER MIGRATION

1. Update backend `.env` file to use `DATABASE_URL_PROD` for production
2. Restart backend server on Render
3. Test application with Render database
4. Monitor for any issues

---

**Migration Date**: _______________
**Verified By**: _______________
**Status**: ☐ Pending | ☐ In Progress | ☐ Completed | ☐ Failed

