-- Add B2B MRP and discount columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS b2b_mrp_price NUMERIC(12, 2) DEFAULT NULL;

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS b2b_discount NUMERIC(12, 2) DEFAULT NULL;

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS b2b_discount_percent NUMERIC(5, 2) DEFAULT NULL;

-- Add comments to explain the columns
COMMENT ON COLUMN products.b2b_mrp_price IS 'B2B customer MRP (can be different from regular MRP)';
COMMENT ON COLUMN products.b2b_discount IS 'B2B discount amount';
COMMENT ON COLUMN products.b2b_discount_percent IS 'B2B discount percentage';

