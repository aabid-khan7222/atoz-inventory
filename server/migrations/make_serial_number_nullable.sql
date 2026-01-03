-- ============================================================
-- Make SERIAL_NUMBER nullable in sales_item table
-- ============================================================
-- This allows orders to be created without serial numbers initially
-- Serial numbers will be assigned later by admin/super admin
-- ============================================================

-- Alter the SERIAL_NUMBER column to allow NULL values
ALTER TABLE sales_item 
ALTER COLUMN SERIAL_NUMBER DROP NOT NULL;

-- Add a comment explaining the change
COMMENT ON COLUMN sales_item.SERIAL_NUMBER IS 'Serial number of the individual battery sold. NULL means pending assignment by admin.';

