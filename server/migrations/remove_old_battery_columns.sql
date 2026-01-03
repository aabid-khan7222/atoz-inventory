-- Migration to remove old battery replacement columns from sales_item table
-- This removes all old battery trade-in related columns

-- Drop the old battery columns from sales_item table
ALTER TABLE sales_item 
DROP COLUMN IF EXISTS old_battery_brand,
DROP COLUMN IF EXISTS old_battery_name,
DROP COLUMN IF EXISTS old_battery_serial_number,
DROP COLUMN IF EXISTS old_battery_ah_va,
DROP COLUMN IF EXISTS old_battery_trade_in_value;

-- Note: This migration removes the columns completely.
-- Any existing data in these columns will be lost.
-- Make sure to backup your database before running this migration.

