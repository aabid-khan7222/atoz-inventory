# Complete Daily Attendance ON CONFLICT Fix

## ✅ 1. Exact Backend Code Location

**File Path:** `server/routes/employees.js`

**Function/Routes:**
- `POST /employees/:id/daily-attendance` (Line 269-427)
- `POST /employees/daily-attendance/bulk` (Line 432-565)

**Current SQL Query (Final Version):**

```sql
INSERT INTO daily_attendance 
(employee_id, attendance_date, status, check_in_time, check_out_time, notes, created_by, created_at, updated_at)
VALUES ($1, $2::DATE, $3, $4, $5, $6, $7, NOW(), NOW())
ON CONFLICT (employee_id, attendance_date)
DO UPDATE SET
  status = EXCLUDED.status,
  check_in_time = EXCLUDED.check_in_time,
  check_out_time = EXCLUDED.check_out_time,
  notes = EXCLUDED.notes,
  updated_at = NOW()
RETURNING *;
```

**Parameters:**
- `$1` = `employeeId` (integer)
- `$2` = `attendance_date` (DATE format: YYYY-MM-DD)
- `$3` = `status` (varchar: 'present', 'absent', 'leave', 'half_day')
- `$4` = `check_in_time` (TIME or NULL)
- `$5` = `check_out_time` (TIME or NULL)
- `$6` = `notes` (TEXT or NULL)
- `$7` = `req.user.id` (integer - created_by)

## ✅ 2. Fixed UPSERT Query

The query uses:
- ✅ `ON CONFLICT (employee_id, attendance_date)` - Correct columns
- ✅ Proper NULL handling for times
- ✅ Date casting with `::DATE`
- ✅ Fallback mechanism if constraint name doesn't match

## ✅ 3. Production DB Debug Logging

**Location:** `server/routes/employees.js` (Line 273-290)

**Debug Code Added:**
```javascript
// TEMPORARY DEBUG LOG - Remove after fixing
const dbInfo = await db.query('SELECT current_database() as db, current_user as user');
console.log('=== CONNECTED DB INFO (TEMPORARY DEBUG) ===');
console.log('Database:', dbInfo.rows[0]?.db);
console.log('User:', dbInfo.rows[0]?.user);

// Check constraints
const constraintInfo = await db.query(`
  SELECT conname, pg_get_constraintdef(oid) as constraint_def
  FROM pg_constraint
  WHERE conrelid = 'daily_attendance'::regclass
  AND contype = 'u'
`);
console.log('Unique constraints:', JSON.stringify(constraintInfo.rows, null, 2));
console.log('=== END DEBUG INFO ===');
```

**How to Remove Later:**
1. Open `server/routes/employees.js`
2. Find lines 273-290 (the debug block)
3. Delete or comment out the entire try-catch block
4. Commit and push

## ✅ 4. Production DB Queries to Run

### A) Confirm which DB you are in:
```sql
SELECT current_database();
```

### B) Check daily_attendance constraints:
```sql
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'daily_attendance'::regclass
AND contype = 'u'
ORDER BY conname;
```

**Expected Result:** Should show constraint on `(employee_id, attendance_date)`

### C) Check for duplicates (MUST be 0 rows before adding constraint):
```sql
SELECT 
  employee_id, 
  attendance_date, 
  COUNT(*) as duplicate_count
FROM daily_attendance
GROUP BY employee_id, attendance_date
HAVING COUNT(*) > 1;
```

**If duplicates exist, remove them first (keeps latest row):**
```sql
-- SAFE DELETE: Removes duplicates, keeps the most recent record
DELETE FROM daily_attendance
WHERE id NOT IN (
  SELECT DISTINCT ON (employee_id, attendance_date) id
  FROM daily_attendance
  ORDER BY employee_id, attendance_date, 
    COALESCE(updated_at, created_at) DESC, id DESC
);
```

### D) Add UNIQUE constraint (if not exists):
```sql
-- Check if constraint already exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'daily_attendance_employee_date_unique'
    AND conrelid = 'daily_attendance'::regclass
  ) THEN
    ALTER TABLE daily_attendance
    ADD CONSTRAINT daily_attendance_employee_date_unique
    UNIQUE (employee_id, attendance_date);
    
    RAISE NOTICE 'Constraint added successfully';
  ELSE
    RAISE NOTICE 'Constraint already exists';
  END IF;
END $$;
```

**Or simple version:**
```sql
ALTER TABLE daily_attendance
ADD CONSTRAINT daily_attendance_employee_date_unique
UNIQUE (employee_id, attendance_date);
```

### E) Verify constraint exists:
```sql
SELECT 
  conname,
  pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'daily_attendance'::regclass
AND contype = 'u'
AND conname = 'daily_attendance_employee_date_unique';
```

**Expected:** Should return 1 row with the constraint definition

### F) Final verification - no duplicates:
```sql
SELECT employee_id, attendance_date, COUNT(*)
FROM daily_attendance
GROUP BY employee_id, attendance_date
HAVING COUNT(*) > 1;
```

**Expected:** 0 rows

## ✅ 5. Complete Step-by-Step Process

### Step 1: Connect to Production Database
```bash
# Use your production DB connection
psql $DATABASE_URL
# Or
psql -h <host> -U <user> -d <database>
```

### Step 2: Run Verification Queries
```sql
-- Check current database
SELECT current_database();

-- Check existing constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'daily_attendance'::regclass
AND contype = 'u';

-- Check for duplicates
SELECT employee_id, attendance_date, COUNT(*)
FROM daily_attendance
GROUP BY employee_id, attendance_date
HAVING COUNT(*) > 1;
```

### Step 3: Remove Duplicates (if any)
```sql
DELETE FROM daily_attendance
WHERE id NOT IN (
  SELECT DISTINCT ON (employee_id, attendance_date) id
  FROM daily_attendance
  ORDER BY employee_id, attendance_date, 
    COALESCE(updated_at, created_at) DESC, id DESC
);
```

### Step 4: Add Unique Constraint
```sql
ALTER TABLE daily_attendance
ADD CONSTRAINT daily_attendance_employee_date_unique
UNIQUE (employee_id, attendance_date);
```

### Step 5: Verify
```sql
-- Should show the constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'daily_attendance'::regclass
AND contype = 'u'
AND conname = 'daily_attendance_employee_date_unique';

-- Should return 0 rows
SELECT employee_id, attendance_date, COUNT(*)
FROM daily_attendance
GROUP BY employee_id, attendance_date
HAVING COUNT(*) > 1;
```

### Step 6: Deploy Backend Code
- Code is already fixed and committed
- Push to trigger auto-deployment
- Wait for deployment to complete

### Step 7: Test API
- Make a POST request to `/employees/:id/daily-attendance`
- Check server logs for debug info
- Verify no errors

### Step 8: Remove Debug Logs (After Confirming It Works)
- Remove the debug block from `server/routes/employees.js`
- Commit and push

## ✅ Why Error Happened

1. **Missing Constraint:** Production database didn't have a unique constraint on `(employee_id, attendance_date)`
2. **ON CONFLICT Requirement:** PostgreSQL's `ON CONFLICT` clause requires a unique constraint/index to exist
3. **Database Mismatch:** Backend might be connected to a different database than the one where you added the constraint

## ✅ Why This Fix Works

1. **Unique Constraint Added:** Ensures PostgreSQL recognizes `(employee_id, attendance_date)` as unique
2. **Correct ON CONFLICT Syntax:** Uses `ON CONFLICT (employee_id, attendance_date)` which matches the constraint
3. **Fallback Mechanism:** If constraint name doesn't match, falls back to column names
4. **Proper Error Handling:** Catches constraint errors and tries alternative approaches
5. **Debug Logging:** Shows which database is being used and what constraints exist

## 📝 Files Modified

1. **server/routes/employees.js**
   - Added debug logging (temporary)
   - Fixed ON CONFLICT queries
   - Added fallback mechanism
   - Proper NULL handling

## 🚀 Deployment Checklist

- [ ] Run verification queries in production DB
- [ ] Remove duplicates if any
- [ ] Add unique constraint
- [ ] Verify constraint exists
- [ ] Deploy backend code (already committed)
- [ ] Test API endpoint
- [ ] Check server logs for debug info
- [ ] Remove debug logs after confirming it works
- [ ] Commit and push removal of debug logs

## ⚠️ Important Notes

1. **Always backup database** before running migrations
2. **Remove duplicates first** before adding constraint
3. **Verify constraint exists** after adding
4. **Check server logs** to see which database backend is using
5. **Remove debug logs** after confirming everything works
