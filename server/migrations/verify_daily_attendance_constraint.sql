-- ============================================================
-- VERIFY daily_attendance UNIQUE CONSTRAINT
-- ============================================================
-- Run this to check if constraint exists and is working
-- ============================================================

-- 1. Check ALL unique constraints on daily_attendance table
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'daily_attendance'::regclass
AND contype = 'u'
ORDER BY conname;

-- 2. Check for duplicates (should return 0 rows if constraint is working)
SELECT 
  employee_id, 
  attendance_date, 
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY id) as record_ids
FROM daily_attendance
GROUP BY employee_id, attendance_date
HAVING COUNT(*) > 1;

-- 3. Test if ON CONFLICT will work (check if constraint covers employee_id and attendance_date)
SELECT 
  conname,
  a.attname as column_name,
  pg_get_constraintdef(c.oid) as constraint_def
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.conrelid = 'daily_attendance'::regclass
AND c.contype = 'u'
AND a.attname IN ('employee_id', 'attendance_date')
ORDER BY conname, a.attnum;
