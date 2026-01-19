-- ============================================================
-- Fix b2b_mrp NULL values in products table (Production DB)
-- ============================================================
-- Run this SQL directly in your production database SQL client
-- This will update all products where b2b_mrp is NULL

-- Check how many products have NULL b2b_mrp (before update)
SELECT 
  COUNT(*) as total_products,
  COUNT(CASE WHEN b2b_mrp IS NULL THEN 1 END) as products_with_null_b2b_mrp,
  COUNT(CASE WHEN b2b_mrp IS NOT NULL THEN 1 END) as products_with_b2b_mrp
FROM products;

-- Update b2b_mrp to mrp_price where b2b_mrp is NULL
UPDATE products
SET b2b_mrp = mrp_price
WHERE b2b_mrp IS NULL AND mrp_price IS NOT NULL;

-- Check results after update
SELECT 
  COUNT(*) as total_products,
  COUNT(CASE WHEN b2b_mrp IS NULL THEN 1 END) as products_with_null_b2b_mrp,
  COUNT(CASE WHEN b2b_mrp IS NOT NULL THEN 1 END) as products_with_b2b_mrp,
  COUNT(CASE WHEN b2b_mrp = mrp_price THEN 1 END) as products_with_matching_b2b_mrp
FROM products;

-- Verify: Check a few sample products
SELECT id, sku, name, mrp_price, b2b_mrp, 
  CASE WHEN b2b_mrp = mrp_price THEN '✅ Match' ELSE '❌ Mismatch' END as status
FROM products 
ORDER BY id 
LIMIT 10;

