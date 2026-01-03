-- Migration: Drop b2b_mrp_price column from products table
-- Reason: We use single MRP (mrp_price) for both B2C and B2B customers

-- Drop the b2b_mrp_price column if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'b2b_mrp_price'
  ) THEN
    ALTER TABLE products DROP COLUMN b2b_mrp_price;
    RAISE NOTICE 'Column b2b_mrp_price dropped successfully';
  ELSE
    RAISE NOTICE 'Column b2b_mrp_price does not exist, skipping';
  END IF;
END $$;

