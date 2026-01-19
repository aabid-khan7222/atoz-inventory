-- ============================================================
-- CLEAR ALL SALES DATA FROM PRODUCTION - RUN THIS NOW
-- ============================================================
-- Copy and paste this entire script into Render Database Console
-- This will make Inventory/Sold Batteries and Sales sections empty
-- ============================================================

-- Step 1: Delete all sales_item records (this is the main table)
DELETE FROM sales_item;

-- Step 2: Delete all sales_id records (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales_id') THEN
        DELETE FROM sales_id;
        RAISE NOTICE 'Deleted all records from sales_id';
    END IF;
END $$;

-- Step 3: Verify - should show 0 records
SELECT 
    'sales_item count: ' || (SELECT COUNT(*) FROM sales_item) as status1,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales_id')
        THEN 'sales_id count: ' || (SELECT COUNT(*) FROM sales_id)
        ELSE 'sales_id table does not exist'
    END as status2,
    CASE 
        WHEN (SELECT COUNT(*) FROM sales_item) = 0 
        THEN '✅ SUCCESS! All sales data cleared!'
        ELSE '⚠️ ERROR: Data still exists'
    END as result;

