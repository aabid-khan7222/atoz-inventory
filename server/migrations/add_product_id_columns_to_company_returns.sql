-- ============================================================
-- ADD PRODUCT ID COLUMNS TO COMPANY RETURNS
-- ============================================================
-- This migration adds returned_product_id and received_product_id
-- columns if they don't exist, ensuring the table matches the expected schema
-- ============================================================

DO $$ 
BEGIN
  -- Add returned_product_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'returned_product_id'
  ) THEN
    ALTER TABLE company_returns 
    ADD COLUMN returned_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
    COMMENT ON COLUMN company_returns.returned_product_id IS 'Product ID of the battery returned to Exide';
  END IF;

  -- Add received_product_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'received_product_id'
  ) THEN
    ALTER TABLE company_returns 
    ADD COLUMN received_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
    COMMENT ON COLUMN company_returns.received_product_id IS 'Product ID of the replacement battery received from Exide';
  END IF;

  -- Add returned_serial_number if it doesn't exist (in case the restore migration wasn't run)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'returned_serial_number'
  ) THEN
    ALTER TABLE company_returns 
    ADD COLUMN returned_serial_number VARCHAR(255);
    COMMENT ON COLUMN company_returns.returned_serial_number IS 'Serial number of the battery returned to Exide';
    
    -- Create index
    CREATE INDEX IF NOT EXISTS idx_company_returns_returned_serial ON company_returns(returned_serial_number);
  END IF;

  -- Add received_serial_number if it doesn't exist (in case the restore migration wasn't run)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'received_serial_number'
  ) THEN
    ALTER TABLE company_returns 
    ADD COLUMN received_serial_number VARCHAR(255);
    COMMENT ON COLUMN company_returns.received_serial_number IS 'Serial number of the replacement battery received from Exide';
    
    -- Create index
    CREATE INDEX IF NOT EXISTS idx_company_returns_received_serial ON company_returns(received_serial_number);
  END IF;

  -- Add returned_date if it doesn't exist (rename from return_date if needed)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'returned_date'
  ) THEN
    -- Check if return_date exists and rename it, otherwise add new column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'company_returns' AND column_name = 'return_date'
    ) THEN
      ALTER TABLE company_returns 
      RENAME COLUMN return_date TO returned_date;
    ELSE
      ALTER TABLE company_returns 
      ADD COLUMN returned_date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
    COMMENT ON COLUMN company_returns.returned_date IS 'Date when the battery was returned to Exide';
  END IF;

  -- Add received_date if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'received_date'
  ) THEN
    ALTER TABLE company_returns 
    ADD COLUMN received_date DATE;
    COMMENT ON COLUMN company_returns.received_date IS 'Date when the replacement battery was received from Exide';
  END IF;

  -- Add status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'status'
  ) THEN
    ALTER TABLE company_returns 
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending';
    
    -- Add check constraint
    ALTER TABLE company_returns 
    ADD CONSTRAINT company_returns_status_check 
    CHECK (status IN ('pending', 'returned', 'received', 'completed'));
    
    COMMENT ON COLUMN company_returns.status IS 'Status: pending (not yet returned), returned (sent to company), received (replacement received), completed (fully processed)';
    
    -- Create index
    CREATE INDEX IF NOT EXISTS idx_company_returns_status ON company_returns(status);
  END IF;

  -- Add notes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'notes'
  ) THEN
    ALTER TABLE company_returns 
    ADD COLUMN notes TEXT;
    COMMENT ON COLUMN company_returns.notes IS 'Additional notes about the return';
  END IF;

  -- Add customer_vehicle_number if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'customer_vehicle_number'
  ) THEN
    ALTER TABLE company_returns 
    ADD COLUMN customer_vehicle_number VARCHAR(50);
    COMMENT ON COLUMN company_returns.customer_vehicle_number IS 'Vehicle number of the customer';
  END IF;

  -- Add customer_mobile_number if it doesn't exist (may be named customer_phone in old schema)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'customer_mobile_number'
  ) THEN
    -- Check if customer_phone exists and rename it, otherwise add new column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'company_returns' AND column_name = 'customer_phone'
    ) THEN
      ALTER TABLE company_returns 
      RENAME COLUMN customer_phone TO customer_mobile_number;
    ELSE
      ALTER TABLE company_returns 
      ADD COLUMN customer_mobile_number VARCHAR(20);
    END IF;
    COMMENT ON COLUMN company_returns.customer_mobile_number IS 'Mobile number of the customer';
  END IF;

  -- Create indexes if they don't exist
  CREATE INDEX IF NOT EXISTS idx_company_returns_returned_date ON company_returns(returned_date);
  CREATE INDEX IF NOT EXISTS idx_company_returns_received_date ON company_returns(received_date);
  CREATE INDEX IF NOT EXISTS idx_company_returns_created_by ON company_returns(created_by);

END $$;

