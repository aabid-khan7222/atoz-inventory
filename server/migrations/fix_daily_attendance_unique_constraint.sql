-- ============================================================
-- FIX daily_attendance UNIQUE CONSTRAINT
-- ============================================================
-- This migration:
-- 1. Checks for duplicate records
-- 2. Removes duplicates (keeps the most recent one)
-- 3. Adds unique constraint on (employee_id, attendance_date)
-- 4. Verifies the constraint exists
-- ============================================================

-- Step 1: Check for duplicates
DO $$ 
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT employee_id, attendance_date, COUNT(*) as cnt
    FROM daily_attendance
    GROUP BY employee_id, attendance_date
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE NOTICE 'Found % duplicate record(s) - will remove duplicates', duplicate_count;
  ELSE
    RAISE NOTICE 'No duplicates found - safe to proceed';
  END IF;
END $$;

-- Step 2: Remove duplicates (keep the most recent record based on updated_at or created_at)
-- This deletes all but the most recent record for each (employee_id, attendance_date) pair
DELETE FROM daily_attendance
WHERE id NOT IN (
  SELECT DISTINCT ON (employee_id, attendance_date) id
  FROM daily_attendance
  ORDER BY employee_id, attendance_date, 
    COALESCE(updated_at, created_at) DESC, id DESC
);

-- Step 3: Drop existing constraint if it exists (with different name)
DO $$ 
BEGIN
  -- Drop constraint if it exists with any name
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conrelid = 'daily_attendance'::regclass
    AND contype = 'u'
    AND (
      conname LIKE '%employee_id%attendance_date%' 
      OR conname LIKE '%daily_attendance%unique%'
      OR conname = 'daily_attendance_employee_id_attendance_date_key'
    )
  ) THEN
    -- Find and drop the constraint
    EXECUTE (
      SELECT 'ALTER TABLE daily_attendance DROP CONSTRAINT ' || conname
      FROM pg_constraint
      WHERE conrelid = 'daily_attendance'::regclass
      AND contype = 'u'
      AND (
        conname LIKE '%employee_id%attendance_date%' 
        OR conname LIKE '%daily_attendance%unique%'
        OR conname = 'daily_attendance_employee_id_attendance_date_key'
      )
      LIMIT 1
    );
    RAISE NOTICE 'Dropped existing unique constraint';
  END IF;
END $$;

-- Step 4: Add unique constraint
DO $$ 
BEGIN
  -- Check if unique constraint already exists
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
    
    RAISE NOTICE 'Added unique constraint daily_attendance_employee_date_unique on (employee_id, attendance_date)';
  ELSE
    RAISE NOTICE 'Unique constraint daily_attendance_employee_date_unique already exists';
  END IF;
END $$;

-- Step 5: Verify constraint exists
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'daily_attendance'::regclass
AND contype = 'u'
AND (
  conname LIKE '%employee_id%attendance_date%' 
  OR conname LIKE '%daily_attendance%unique%'
  OR conname = 'daily_attendance_employee_date_unique'
);

-- Step 6: Final verification - should return 0 rows
SELECT 
  employee_id, 
  attendance_date, 
  COUNT(*) as duplicate_count
FROM daily_attendance
GROUP BY employee_id, attendance_date
HAVING COUNT(*) > 1;
