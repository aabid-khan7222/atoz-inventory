-- Clear all stock from database
-- This sets all product quantities to 0 and removes all available stock items

BEGIN;

-- Step 1: Set all product quantities to 0
UPDATE products 
SET qty = 0, updated_at = CURRENT_TIMESTAMP
WHERE qty > 0;

-- Step 2: Delete all available stock from stock table
DELETE FROM stock 
WHERE status = 'available';

-- Step 3: Verify (these should return 0)
-- SELECT COUNT(*) FROM products WHERE qty > 0;
-- SELECT COUNT(*) FROM stock WHERE status = 'available';

COMMIT;

-- Display results
SELECT 
  'Products with stock > 0' as check_type,
  COUNT(*) as count
FROM products 
WHERE qty > 0

UNION ALL

SELECT 
  'Available stock items' as check_type,
  COUNT(*) as count
FROM stock 
WHERE status = 'available';

