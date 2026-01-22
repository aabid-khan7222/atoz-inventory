-- ============================================================
-- CHECK daily_attendance CONSTRAINTS AND DUPLICATES
-- ============================================================
-- Run this query to verify the database state
-- ============================================================

-- 1. Check for duplicates (should return 0 rows)
SELECT 
  employee_id, 
  attendance_date, 
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY id) as record_ids
FROM daily_attendance
GROUP BY employee_id, attendance_date
HAVING COUNT(*) > 1;

-- 2. List all unique constraints on daily_attendance table
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'daily_attendance'::regclass
AND contype = 'u'
ORDER BY conname;

-- 3. Check table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'daily_attendance'
ORDER BY ordinal_position;

-- 4. Count total records
SELECT COUNT(*) as total_records FROM daily_attendance;

-- 5. Sample records
SELECT 
  id,
  employee_id,
  attendance_date,
  status,
  created_at,
  updated_at
FROM daily_attendance
ORDER BY employee_id, attendance_date DESC
LIMIT 10;
