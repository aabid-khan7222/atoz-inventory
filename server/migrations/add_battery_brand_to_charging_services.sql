-- Add battery_brand column to charging_services table
-- This stores the brand name of the battery being charged (e.g., Exide, Amaron, etc.)

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'charging_services' AND column_name = 'battery_brand'
  ) THEN
    ALTER TABLE charging_services ADD COLUMN battery_brand VARCHAR(100);
    COMMENT ON COLUMN charging_services.battery_brand IS 'Brand name of the battery being charged (e.g., Exide, Amaron, etc.)';
    
    -- Create index for faster lookups
    CREATE INDEX IF NOT EXISTS idx_charging_services_battery_brand ON charging_services(battery_brand);
  END IF;
END $$;

