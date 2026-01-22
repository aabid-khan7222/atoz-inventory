-- ============================================================
-- UPDATE COMPANY RETURNS SKU AND PRODUCT_NAME
-- ============================================================
-- This migration updates existing company_returns records to populate
-- sku and product_name fields from the products table based on returned_product_id
-- ============================================================

DO $$ 
BEGIN
  -- Update sku and product_name from products table where they are NULL
  UPDATE company_returns cr
  SET 
    sku = p.sku,
    product_name = p.name
  FROM products p
  WHERE cr.returned_product_id = p.id
    AND (cr.sku IS NULL OR cr.product_name IS NULL);
  
  -- Log the number of rows updated
  RAISE NOTICE 'Updated % company_returns records with sku and product_name', SQL%ROWCOUNT;
END $$;
