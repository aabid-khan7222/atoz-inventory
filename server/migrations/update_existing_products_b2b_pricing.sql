-- Migration: Update existing products with B2B pricing and guarantee_period_months
-- This script updates products that have NULL B2B pricing fields

-- Step 1: Update B2B pricing for products where B2B fields are NULL
-- Set B2B discount and discount_percent same as B2C (default behavior)
-- Set B2B selling price same as B2C selling price initially
UPDATE products
SET 
  b2b_selling_price = COALESCE(b2b_selling_price, selling_price),
  b2b_discount = COALESCE(b2b_discount, discount),
  b2b_discount_percent = COALESCE(b2b_discount_percent, discount_percent)
WHERE 
  b2b_selling_price IS NULL 
  OR b2b_discount IS NULL 
  OR b2b_discount_percent IS NULL;

-- Step 2: Ensure b2b_mrp_price is NULL (since we use single MRP)
-- This is already correct, but let's make sure
UPDATE products
SET b2b_mrp_price = NULL
WHERE b2b_mrp_price IS NOT NULL;

-- Step 3: Update guarantee_period_months for products where it's NULL
-- Extract months from warranty field if it contains numeric values
-- Format examples: "24F+24P" (24 months), "12" (12 months), etc.
UPDATE products
SET guarantee_period_months = CASE
  -- If warranty field contains numbers, try to extract the first number
  WHEN warranty IS NOT NULL AND warranty ~ '^[0-9]+' THEN
    CAST(SUBSTRING(warranty FROM '^([0-9]+)') AS INTEGER)
  -- If warranty contains pattern like "24F+24P", extract first number
  WHEN warranty IS NOT NULL AND warranty ~ '[0-9]+' THEN
    CAST(SUBSTRING(warranty FROM '([0-9]+)') AS INTEGER)
  -- Default to 0 if no warranty information
  ELSE 0
END
WHERE guarantee_period_months IS NULL;

-- Step 4: Set default guarantee_period_months to 0 for any remaining NULL values
UPDATE products
SET guarantee_period_months = 0
WHERE guarantee_period_months IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN products.b2b_mrp_price IS 'B2B MRP (NULL = uses same MRP as B2C)';
COMMENT ON COLUMN products.b2b_selling_price IS 'B2B selling price (calculated from MRP - B2B discount)';
COMMENT ON COLUMN products.b2b_discount IS 'B2B discount amount';
COMMENT ON COLUMN products.b2b_discount_percent IS 'B2B discount percentage';
COMMENT ON COLUMN products.guarantee_period_months IS 'Number of months the product is under guarantee (0 = no guarantee)';

