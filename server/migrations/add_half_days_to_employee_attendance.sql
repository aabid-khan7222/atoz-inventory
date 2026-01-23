-- ============================================================
-- ADD half_days COLUMN TO employee_attendance TABLE
-- ============================================================
-- This migration adds half_days column to track half day attendance
-- ============================================================

-- Add half_days column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'employee_attendance' 
    AND column_name = 'half_days'
  ) THEN
    ALTER TABLE employee_attendance
    ADD COLUMN half_days INTEGER DEFAULT 0;
    
    RAISE NOTICE 'Added half_days column to employee_attendance table';
  ELSE
    RAISE NOTICE 'half_days column already exists';
  END IF;
END $$;
