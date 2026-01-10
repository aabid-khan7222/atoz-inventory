# ⚡ Quick Migration Reference

## 🎯 Goal
Migrate ALL TABLES + ALL DATA from local pgAdmin → Render PostgreSQL

## ✅ Safety Guarantees
- ✅ Local DB credentials: `localhost:5432/inventory_db`
- ✅ Render DB credentials: `dpg-d5eekfvgi27c73av6nh0-a/atoz_inventory`
- ✅ **DIFFERENT databases** - local DB will NOT be touched
- ✅ `pg_dump --data-only` = **READ ONLY** (no modifications)

---

## 🚀 Quick Start (3 Methods)

### Method 1: Automated PowerShell Script (Easiest)
```powershell
.\migrate-to-render.ps1
```
Follow the prompts. Script handles everything automatically.

---

### Method 2: Manual Commands (Step-by-Step)

#### Step 1: Verify Credentials
```powershell
node server/scripts/verify-db-credentials.js
```

#### Step 2: Create Tables on Render DB
```powershell
# Option A: Use API endpoint
# Set in .env: NODE_ENV=production, DATABASE_URL_PROD=...
# Then: POST http://localhost:4000/api/init

# Option B: Run migrations
cd server
$env:NODE_ENV="production"
npm run migrate
```

#### Step 3: Export Data (Local DB → File)
```powershell
pg_dump -h localhost -U postgres -d inventory_db `
  --data-only `
  --column-inserts `
  --no-owner `
  --no-privileges `
  -f local_db_data_dump.sql
# Password: 007222
```

#### Step 4: Restore Data (File → Render DB)
```powershell
psql "postgresql://atoz_inventory_user:5onz8uUNT7j5UicfQyVEztDXK4lwOSgz@dpg-d5eekfvgi27c73av6nh0-a:5432/atoz_inventory" `
  -f local_db_data_dump.sql `
  --set ON_ERROR_STOP=on
```

#### Step 5: Verify
```powershell
psql "postgresql://atoz_inventory_user:5onz8uUNT7j5UicfQyVEztDXK4lwOSgz@dpg-d5eekfvgi27c73av6nh0-a:5432/atoz_inventory" `
  -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM products;"
```

---

### Method 3: Node.js Script
```powershell
node server/scripts/migrate-to-render.js
```

---

## 🔑 Key Commands Cheat Sheet

| Action | Command |
|--------|---------|
| **Verify DBs are different** | `node server/scripts/verify-db-credentials.js` |
| **Create tables (Render)** | `POST /api/init` or `npm run migrate` |
| **Export data (Local)** | `pg_dump -h localhost -U postgres -d inventory_db --data-only -f dump.sql` |
| **Restore data (Render)** | `psql "RENDER_URL" -f dump.sql` |
| **Check tables** | `psql "RENDER_URL" -c "\dt"` |
| **Check row counts** | `psql "RENDER_URL" -c "SELECT COUNT(*) FROM users;"` |

---

## ⚠️ Important Notes

1. **`--data-only` flag** = Only exports data, NOT schema (safe!)
2. **No DROP/CREATE** = Local DB is never modified
3. **Different credentials** = Local and Render are separate
4. **One-time operation** = Run once, verify, done

---

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| "relation does not exist" | Run `/api/init` first to create tables |
| "duplicate key" | Data already exists - delete first or skip |
| "SSL required" | Add `?sslmode=require` to connection string |
| "password prompt" | Set `$env:PGPASSWORD="password"` |

---

## ✅ Final Checklist

- [ ] Verified local ≠ Render DB credentials
- [ ] Created all tables on Render DB
- [ ] Exported data from local DB
- [ ] Restored data to Render DB
- [ ] Verified tables exist
- [ ] Verified row counts match
- [ ] Confirmed local DB untouched

---

**Full Guide**: See `RENDER_DB_MIGRATION_GUIDE.md` for detailed instructions.

