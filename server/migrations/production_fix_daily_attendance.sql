-- ============================================================
-- PRODUCTION FIX: daily_attendance UNIQUE CONSTRAINT
-- ============================================================
-- Run this script in PRODUCTION database
-- ============================================================

-- Step 1: Check current database
SELECT current_database() as current_db;

-- Step 2: Check existing constraints
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'daily_attendance'::regclass
AND contype = 'u'
ORDER BY conname;

-- Step 3: Check for duplicates (MUST be 0 rows before adding constraint)
SELECT 
  employee_id, 
  attendance_date, 
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY id) as record_ids
FROM daily_attendance
GROUP BY employee_id, attendance_date
HAVING COUNT(*) > 1;

-- Step 4: Remove duplicates if any (keeps most recent record)
-- UNCOMMENT AND RUN ONLY IF DUPLICATES EXIST:
/*
DELETE FROM daily_attendance
WHERE id NOT IN (
  SELECT DISTINCT ON (employee_id, attendance_date) id
  FROM daily_attendance
  ORDER BY employee_id, attendance_date, 
    COALESCE(updated_at, created_at) DESC, id DESC
);
*/

-- Step 5: Add unique constraint (safe - won't error if exists)
DO $$ 
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'daily_attendance_employee_date_unique'
    AND conrelid = 'daily_attendance'::regclass
  ) THEN
    -- Add unique constraint
    ALTER TABLE daily_attendance
    ADD CONSTRAINT daily_attendance_employee_date_unique
    UNIQUE (employee_id, attendance_date);
    
    RAISE NOTICE '✅ Constraint daily_attendance_employee_date_unique added successfully';
  ELSE
    RAISE NOTICE 'ℹ️ Constraint daily_attendance_employee_date_unique already exists';
  END IF;
END $$;

-- Step 6: Verify constraint exists
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'daily_attendance'::regclass
AND contype = 'u'
AND conname = 'daily_attendance_employee_date_unique';

-- Step 7: Final verification - should return 0 rows (no duplicates)
SELECT 
  employee_id, 
  attendance_date, 
  COUNT(*) as duplicate_count
FROM daily_attendance
GROUP BY employee_id, attendance_date
HAVING COUNT(*) > 1;

-- ============================================================
-- ✅ If Step 7 returns 0 rows and Step 6 shows the constraint,
--    then the database is ready!
-- ============================================================
