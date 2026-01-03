-- Restore serial number fields to company_returns table
-- This migration adds back returned_serial_number and received_serial_number columns

DO $$ 
BEGIN
  -- Add returned_serial_number column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'returned_serial_number'
  ) THEN
    ALTER TABLE company_returns ADD COLUMN returned_serial_number VARCHAR(255);
    COMMENT ON COLUMN company_returns.returned_serial_number IS 'Serial number of the battery returned to Exide';
  END IF;

  -- Add received_serial_number column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'received_serial_number'
  ) THEN
    ALTER TABLE company_returns ADD COLUMN received_serial_number VARCHAR(255);
    COMMENT ON COLUMN company_returns.received_serial_number IS 'Serial number of the replacement battery received from Exide';
  END IF;

  -- Create indexes if they don't exist
  CREATE INDEX IF NOT EXISTS idx_company_returns_returned_serial ON company_returns(returned_serial_number);
  CREATE INDEX IF NOT EXISTS idx_company_returns_received_serial ON company_returns(received_serial_number);
END $$;

