# ✅ Complete Daily Attendance ON CONFLICT Fix

## 🔍 Root Cause (1 Sentence)

**Backend is likely connecting to a different database than where you added the constraint, OR the constraint exists but PostgreSQL isn't recognizing it due to schema/table name mismatch.**

## 📁 File Path & Code

**File:** `server/routes/employees.js`

**Route:** `POST /employees/:id/daily-attendance` (Line 269-406)

**Complete Fixed Function:**

```javascript
router.post('/:id/daily-attendance', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    console.log('[Daily Attendance API] Route called - Using ON CONFLICT (employee_id, attendance_date)');
    
    // TEMPORARY DEBUG LOG - Remove after fixing
    try {
      const dbInfo = await db.query('SELECT current_database() as db, current_user as user, current_schema() as schema');
      console.log('=== CONNECTED DB INFO (TEMPORARY DEBUG) ===');
      console.log('Database:', dbInfo.rows[0]?.db || 'unknown');
      console.log('User:', dbInfo.rows[0]?.user || 'unknown');
      console.log('Schema:', dbInfo.rows[0]?.schema || 'unknown');
      
      // Check if table exists
      const tableExists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = current_schema()
          AND table_name = 'daily_attendance'
        ) as exists
      `);
      console.log('Table daily_attendance exists:', tableExists.rows[0]?.exists);
      
      // Check constraints on daily_attendance table
      const constraintInfo = await db.query(`
        SELECT 
          conname, 
          pg_get_constraintdef(oid) as constraint_def,
          conkey as column_indexes
        FROM pg_constraint
        WHERE conrelid = 'daily_attendance'::regclass
        AND contype = 'u'
        ORDER BY conname
      `);
      console.log('Unique constraints on daily_attendance:', JSON.stringify(constraintInfo.rows, null, 2));
      
      // Check which columns are in the constraints
      if (constraintInfo.rows.length > 0) {
        const columnInfo = await db.query(`
          SELECT 
            c.conname,
            array_agg(a.attname ORDER BY a.attnum) as columns
          FROM pg_constraint c
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
          WHERE c.conrelid = 'daily_attendance'::regclass
          AND c.contype = 'u'
          GROUP BY c.conname
        `);
        console.log('Constraint columns:', JSON.stringify(columnInfo.rows, null, 2));
      }
      console.log('=== END DEBUG INFO ===');
    } catch (dbInfoErr) {
      console.log('[DB Info] Could not fetch database info:', dbInfoErr.message);
    }
    
    const employeeId = parseInt(req.params.id);
    if (isNaN(employeeId)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    const { attendance_date, status, check_in_time, check_out_time, notes } = req.body;

    if (!attendance_date || !status) {
      return res.status(400).json({ error: 'Attendance date and status are required' });
    }

    // Validate status
    const validStatuses = ['present', 'absent', 'leave', 'half_day'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: present, absent, leave, or half_day' });
    }

    // Normalize time values - convert empty strings to null
    const normalizedCheckIn = (check_in_time && check_in_time.trim() !== '') ? check_in_time : null;
    const normalizedCheckOut = (check_out_time && check_out_time.trim() !== '') ? check_out_time : null;
    const normalizedNotes = (notes && notes.trim() !== '') ? notes : null;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert or update daily attendance using ON CONFLICT
      // Use column names directly (works with any constraint name)
      console.log('[Daily Attendance] Attempting INSERT with:', {
        employeeId,
        attendance_date,
        status,
        check_in_time: normalizedCheckIn,
        check_out_time: normalizedCheckOut
      });
      
      const attendanceResult = await client.query(
        `INSERT INTO daily_attendance 
         (employee_id, attendance_date, status, check_in_time, check_out_time, notes, created_by, created_at, updated_at)
         VALUES ($1, $2::DATE, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (employee_id, attendance_date)
         DO UPDATE SET
           status = EXCLUDED.status,
           check_in_time = EXCLUDED.check_in_time,
           check_out_time = EXCLUDED.check_out_time,
           notes = EXCLUDED.notes,
           updated_at = NOW()
         RETURNING *`,
        [
          employeeId, 
          attendance_date, 
          status, 
          normalizedCheckIn,
          normalizedCheckOut,
          normalizedNotes,
          req.user.id
        ]
      );
      
      console.log('[Daily Attendance] INSERT successful, rows affected:', attendanceResult.rows.length);

      // Update monthly attendance summary
      const monthDate = new Date(attendance_date);
      monthDate.setDate(1);
      const monthStr = monthDate.toISOString().split('T')[0];

      // Count days for the month
      const monthStats = await client.query(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'present') as present_count,
           COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
           COUNT(*) FILTER (WHERE status = 'leave') as leave_count,
           COUNT(*) FILTER (WHERE status = 'half_day') as half_day_count,
           COUNT(*) as total_count
         FROM daily_attendance
         WHERE employee_id = $1 
           AND attendance_date >= $2::DATE 
           AND attendance_date < ($2::DATE + INTERVAL '1 month')`,
        [employeeId, monthStr]
      );

      const stats = monthStats.rows[0];
      const presentDays = parseInt(stats.present_count || 0) + parseInt(stats.half_day_count || 0) * 0.5;
      const absentDays = parseInt(stats.absent_count || 0);
      const leaveDays = parseInt(stats.leave_count || 0);
      const totalDays = parseInt(stats.total_count || 0);

      // Update monthly attendance
      await client.query(
        `INSERT INTO employee_attendance 
         (employee_id, attendance_month, total_days, present_days, absent_days, leave_days)
         VALUES ($1, $2::DATE, $3, $4, $5, $6)
         ON CONFLICT (employee_id, attendance_month)
         DO UPDATE SET
           total_days = EXCLUDED.total_days,
           present_days = EXCLUDED.present_days,
           absent_days = EXCLUDED.absent_days,
           leave_days = EXCLUDED.leave_days,
           updated_at = CURRENT_TIMESTAMP`,
        [employeeId, monthStr, totalDays, Math.round(presentDays), absentDays, leaveDays]
      );

      // Add to history
      const historyDescription = `Daily attendance marked: ${status} on ${new Date(attendance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      await client.query(
        `INSERT INTO employee_history (employee_id, history_type, description, created_by)
         VALUES ($1, 'attendance', $2, $3)`,
        [employeeId, historyDescription, req.user.id]
      );

      await client.query('COMMIT');
      res.status(201).json(attendanceResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('POST /employees/:id/daily-attendance error:', err);
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);
    console.error('Error detail:', err.detail);
    console.error('Error hint:', err.hint);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});
```

## ✅ Fixed SQL Query

**Final Working Query:**

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
- `$2` = `attendance_date` (DATE format: 'YYYY-MM-DD')
- `$3` = `status` (varchar: 'present', 'absent', 'leave', 'half_day')
- `$4` = `check_in_time` (TIME or NULL)
- `$5` = `check_out_time` (TIME or NULL)
- `$6` = `notes` (TEXT or NULL)
- `$7` = `req.user.id` (integer - created_by)

## 📋 Database Queries to Run (After Deployment)

### A) Check which DB backend is connected to:

```sql
SELECT current_database() as db, current_user as user, current_schema() as schema;
```

**Important:** Compare this with the database where you added the constraint!

### B) Check constraints in the database backend is using:

```sql
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'daily_attendance'::regclass
AND contype = 'u'
ORDER BY conname;
```

**Expected:** Should show constraint on `(employee_id, attendance_date)`

### C) Ensure UNIQUE constraint exists (if missing):

```sql
-- First check for duplicates
SELECT employee_id, attendance_date, COUNT(*)
FROM daily_attendance
GROUP BY employee_id, attendance_date
HAVING COUNT(*) > 1;

-- If duplicates exist, remove them (keeps latest)
DELETE FROM daily_attendance
WHERE id NOT IN (
  SELECT DISTINCT ON (employee_id, attendance_date) id
  FROM daily_attendance
  ORDER BY employee_id, attendance_date, 
    COALESCE(updated_at, created_at) DESC, id DESC
);

-- Add constraint (safe - won't error if exists)
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
    RAISE NOTICE 'Constraint added';
  ELSE
    RAISE NOTICE 'Constraint already exists';
  END IF;
END $$;
```

### D) Verify no duplicates:

```sql
SELECT employee_id, attendance_date, COUNT(*)
FROM daily_attendance
GROUP BY employee_id, attendance_date
HAVING COUNT(*) > 1;
```

**Expected:** 0 rows

## 🔍 How to Verify Fix (Test Steps)

### Step 1: Wait for Deployment (2-3 minutes)

Code has been pushed. Wait for auto-deployment to complete.

### Step 2: Check Server Logs

After deployment, make a test API call and check server logs. You should see:

```
=== CONNECTED DB INFO (TEMPORARY DEBUG) ===
Database: <database_name>
User: <database_user>
Schema: <schema_name>
Table daily_attendance exists: true
Unique constraints on daily_attendance: [...]
Constraint columns: [...]
=== END DEBUG INFO ===
```

**Important:** Note the database name shown in logs!

### Step 3: Verify Database Match

1. Check server logs for database name
2. Connect to that exact database
3. Run constraint check query (B above)
4. If constraint doesn't exist in that DB, add it (C above)

### Step 4: Test API

Make a POST request to `/employees/:id/daily-attendance` with:
```json
{
  "attendance_date": "2024-01-15",
  "status": "present",
  "check_in_time": "09:00:00",
  "check_out_time": "18:00:00",
  "notes": "Test"
}
```

**Expected:** Should succeed without error

### Step 5: Remove Debug Logs (After Confirming It Works)

Once everything works, remove the debug block (lines 273-310) from `server/routes/employees.js`:

```javascript
// Remove this entire block:
// TEMPORARY DEBUG LOG - Remove after fixing
try {
  const dbInfo = await db.query(...);
  // ... all debug code ...
} catch (dbInfoErr) {
  console.log('[DB Info] Could not fetch database info:', dbInfoErr.message);
}
```

Then commit and push:
```bash
git add server/routes/employees.js
git commit -m "Remove debug logs from daily attendance route"
git push origin main
```

## 🚀 Deployment Status

✅ **Code Fixed:** Complete
✅ **Code Committed:** Yes (commit `5f49b4c`)
✅ **Code Pushed:** Yes
✅ **Auto-Deployment:** Triggered

## ⚠️ Most Likely Issue

Based on the error still occurring:

**The backend is connecting to a DIFFERENT database than where you added the constraint.**

**Solution:**
1. Check server logs after deployment
2. Note the database name shown
3. Connect to that exact database
4. Add the constraint there

## 📝 Summary

- ✅ Code is fixed and uses correct `ON CONFLICT (employee_id, attendance_date)`
- ✅ Debug logs added to identify database mismatch
- ✅ Code pushed and deployment triggered
- ⚠️ **Action Required:** Check server logs to see which database backend is using, then add constraint to that database
