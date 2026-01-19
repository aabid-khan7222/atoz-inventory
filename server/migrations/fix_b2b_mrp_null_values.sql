-- Migration: Fix b2b_mrp NULL values in products table
-- This script updates all products where b2b_mrp is NULL to set it to mrp_price
-- Since we use single MRP for both B2C and B2B customers

UPDATE products
SET b2b_mrp = mrp_price
WHERE b2b_mrp IS NULL AND mrp_price IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN products.b2b_mrp IS 'B2B MRP (same as mrp_price for single MRP system)';

