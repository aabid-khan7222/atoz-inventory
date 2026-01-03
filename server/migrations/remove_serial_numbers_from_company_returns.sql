-- Remove serial number fields from company_returns table
-- This migration removes returned_serial_number and received_serial_number columns

DO $$ 
BEGIN
  -- Drop returned_serial_number column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'returned_serial_number'
  ) THEN
    ALTER TABLE company_returns DROP COLUMN returned_serial_number;
  END IF;

  -- Drop received_serial_number column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'received_serial_number'
  ) THEN
    ALTER TABLE company_returns DROP COLUMN received_serial_number;
  END IF;

  -- Drop indexes if they exist
  DROP INDEX IF EXISTS idx_company_returns_returned_serial;
  DROP INDEX IF EXISTS idx_company_returns_received_serial;
END $$;

