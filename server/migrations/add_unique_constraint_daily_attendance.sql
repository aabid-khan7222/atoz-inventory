-- ============================================================
-- ADD UNIQUE CONSTRAINT TO daily_attendance TABLE
-- ============================================================
-- This migration ensures that the unique constraint on (employee_id, attendance_date)
-- exists for the ON CONFLICT clause to work properly
-- ============================================================

DO $$ 
BEGIN
  -- Check if unique constraint already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'daily_attendance_employee_id_attendance_date_key'
    AND conrelid = 'daily_attendance'::regclass
  ) THEN
    -- Add unique constraint if it doesn't exist
    ALTER TABLE daily_attendance 
    ADD CONSTRAINT daily_attendance_employee_id_attendance_date_key 
    UNIQUE (employee_id, attendance_date);
    
    RAISE NOTICE 'Added unique constraint on (employee_id, attendance_date)';
  ELSE
    RAISE NOTICE 'Unique constraint already exists';
  END IF;
END $$;
