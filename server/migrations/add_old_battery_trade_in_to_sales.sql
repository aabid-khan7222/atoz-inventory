-- Migration: Add old battery trade-in columns to sales_item table
-- This allows tracking old batteries that customers trade in when purchasing new ones

-- Add columns for old battery trade-in information
ALTER TABLE sales_item
  ADD COLUMN IF NOT EXISTS old_battery_brand VARCHAR(255),
  ADD COLUMN IF NOT EXISTS old_battery_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS old_battery_serial_number VARCHAR(255),
  ADD COLUMN IF NOT EXISTS old_battery_ah_va VARCHAR(20),
  ADD COLUMN IF NOT EXISTS old_battery_trade_in_value NUMERIC(12, 2) DEFAULT 0;

-- Create index on old_battery_serial_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_sales_item_old_battery_serial ON sales_item(old_battery_serial_number) WHERE old_battery_serial_number IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN sales_item.old_battery_brand IS 'Brand of the old battery traded in by customer';
COMMENT ON COLUMN sales_item.old_battery_name IS 'Name/Model of the old battery traded in by customer';
COMMENT ON COLUMN sales_item.old_battery_serial_number IS 'Serial number of the old battery traded in by customer';
COMMENT ON COLUMN sales_item.old_battery_ah_va IS 'Ampere rating (Ah/VA) of the old battery traded in by customer';
COMMENT ON COLUMN sales_item.old_battery_trade_in_value IS 'Value deducted from final amount for the old battery trade-in';

