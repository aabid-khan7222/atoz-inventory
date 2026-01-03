-- Add customer_email column to charging_services table
-- This allows storing customer email for automatic user creation

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'charging_services' AND column_name = 'customer_email'
  ) THEN
    ALTER TABLE charging_services ADD COLUMN customer_email VARCHAR(255);
    COMMENT ON COLUMN charging_services.customer_email IS 'Customer email address for automatic user account creation';
    
    -- Create index for faster lookups
    CREATE INDEX IF NOT EXISTS idx_charging_services_customer_email ON charging_services(customer_email);
  END IF;
END $$;

