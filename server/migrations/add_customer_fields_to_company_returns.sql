-- Add customer fields to company_returns table
-- This migration adds customer information fields to track which customer the battery belongs to

DO $$ 
BEGIN
  -- Add customer_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE company_returns ADD COLUMN customer_name VARCHAR(255);
    COMMENT ON COLUMN company_returns.customer_name IS 'Name of the customer who owned the returned battery';
  END IF;

  -- Add customer_vehicle_number column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'customer_vehicle_number'
  ) THEN
    ALTER TABLE company_returns ADD COLUMN customer_vehicle_number VARCHAR(50);
    COMMENT ON COLUMN company_returns.customer_vehicle_number IS 'Vehicle number of the customer';
  END IF;

  -- Add customer_mobile_number column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'customer_mobile_number'
  ) THEN
    ALTER TABLE company_returns ADD COLUMN customer_mobile_number VARCHAR(20);
    COMMENT ON COLUMN company_returns.customer_mobile_number IS 'Mobile number of the customer';
  END IF;
END $$;

