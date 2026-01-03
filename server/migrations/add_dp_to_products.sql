-- Add DP (Dealer Price) column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS dp NUMERIC(12, 2) DEFAULT 0;

-- Update existing products: set DP to MRP if DP is 0 or NULL
UPDATE products 
SET dp = mrp_price 
WHERE dp IS NULL OR dp = 0;

-- Make DP NOT NULL after setting defaults
ALTER TABLE products 
ALTER COLUMN dp SET NOT NULL;

