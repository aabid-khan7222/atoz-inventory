-- ============================================================
-- SAFE: Add daily_attendance UNIQUE CONSTRAINT (Idempotent)
-- ============================================================
-- This script safely adds the constraint only if it doesn't exist
-- Safe to run multiple times - won't error if constraint already exists
-- ============================================================

DO $$ 
BEGIN
  -- Check if constraint with exact name already exists
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'daily_attendance_employee_date_unique'
    AND conrelid = 'daily_attendance'::regclass
  ) THEN
    RAISE NOTICE '✅ Constraint daily_attendance_employee_date_unique already exists - No action needed';
  
  -- Check if any unique constraint on (employee_id, attendance_date) exists
  ELSIF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a1 ON a1.attrelid = c.conrelid AND a1.attnum = c.conkey[1]
    JOIN pg_attribute a2 ON a2.attrelid = c.conrelid AND a2.attnum = c.conkey[2]
    WHERE c.conrelid = 'daily_attendance'::regclass
    AND c.contype = 'u'
    AND array_length(c.conkey, 1) = 2
    AND (
      (a1.attname = 'employee_id' AND a2.attname = 'attendance_date')
      OR (a1.attname = 'attendance_date' AND a2.attname = 'employee_id')
    )
  ) THEN
    RAISE NOTICE '✅ A unique constraint on (employee_id, attendance_date) already exists - No action needed';
  
  ELSE
    -- Check for duplicates first
    IF EXISTS (
      SELECT 1
      FROM (
        SELECT employee_id, attendance_date, COUNT(*) as cnt
        FROM daily_attendance
        GROUP BY employee_id, attendance_date
        HAVING COUNT(*) > 1
      ) duplicates
    ) THEN
      RAISE WARNING '⚠️ Duplicates found! Removing duplicates first...';
      
      -- Remove duplicates (keep most recent)
      DELETE FROM daily_attendance
      WHERE id NOT IN (
        SELECT DISTINCT ON (employee_id, attendance_date) id
        FROM daily_attendance
        ORDER BY employee_id, attendance_date, 
          COALESCE(updated_at, created_at) DESC, id DESC
      );
      
      RAISE NOTICE '✅ Duplicates removed';
    END IF;
    
    -- Add unique constraint
    ALTER TABLE daily_attendance 
    ADD CONSTRAINT daily_attendance_employee_date_unique
    UNIQUE (employee_id, attendance_date);
    
    RAISE NOTICE '✅ Added unique constraint daily_attendance_employee_date_unique on (employee_id, attendance_date)';
  END IF;
END $$;

-- Verify constraint exists
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'daily_attendance'::regclass
AND contype = 'u'
AND (
  conname = 'daily_attendance_employee_date_unique'
  OR conname LIKE '%employee_id%attendance_date%'
);
