-- Add b2b_selling_price column to products table if it doesn't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS b2b_selling_price NUMERIC(12, 2) DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN products.b2b_selling_price IS 'B2B customer selling price (18% discount from MRP)';

