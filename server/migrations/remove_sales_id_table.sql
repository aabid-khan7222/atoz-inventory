-- ============================================================
-- REMOVE sales_id TABLE MIGRATION
-- ============================================================
-- This script:
-- 1. Adds created_by column to sales_item if missing
-- 2. Backfills created_by from sales_id to sales_item
-- 3. Updates invoice number generation function to use sales_item
-- 4. Drops foreign key constraint and sales_id column from sales_item
-- 5. Drops sales_id table
-- ============================================================

BEGIN;

-- Step 1: Add created_by column to sales_item if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_item' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE sales_item ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_sales_item_created_by ON sales_item(created_by);
  END IF;
END $$;

-- Step 2: Backfill created_by from sales_id to sales_item (only if sales_id exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'sales_id'
  ) THEN
    UPDATE sales_item si
    SET created_by = sid.created_by
    FROM sales_id sid
    WHERE si.sales_id = sid.id
      AND si.created_by IS NULL
      AND sid.created_by IS NOT NULL;
  END IF;
END $$;

-- Step 3: Update invoice number generation function to use sales_item instead of sales_id
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  today_date TEXT;
  last_number INTEGER;
BEGIN
  today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO last_number
  FROM sales_item
  WHERE invoice_number LIKE 'INV-' || today_date || '%';
  
  new_number := 'INV-' || today_date || '-' || LPAD(last_number::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Drop foreign key constraint on sales_id column
ALTER TABLE sales_item DROP CONSTRAINT IF EXISTS sales_item_sales_id_fkey;

-- Step 5: Drop sales_id column from sales_item
ALTER TABLE sales_item DROP COLUMN IF EXISTS sales_id;

-- Step 6: Drop index on sales_id if it exists
DROP INDEX IF EXISTS idx_sales_item_sales_id;

-- Step 7: Drop sales_id table
DROP TABLE IF EXISTS sales_id CASCADE;

COMMIT;

