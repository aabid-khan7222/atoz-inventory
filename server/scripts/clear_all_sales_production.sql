-- ============================================================
-- CLEAR ALL SALES DATA FROM PRODUCTION DATABASE
-- ============================================================
-- This script deletes all sales records from the PRODUCTION database
-- Use with caution - this action cannot be undone!
-- 
-- Run this on your production database (Render/PostgreSQL)
-- ============================================================

BEGIN;

-- Delete all sales_item records (individual batteries sold)
DELETE FROM sales_item;
SELECT 'Deleted all records from sales_item' as status;

-- Delete all sales_id records (invoice headers) if table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales_id') THEN
        DELETE FROM sales_id;
        RAISE NOTICE 'Deleted all records from sales_id';
    ELSE
        RAISE NOTICE 'sales_id table does not exist, skipping...';
    END IF;
END $$;

-- Also clear any legacy sales tables if they exist
DO $$
BEGIN
    -- Check and delete from old 'sales' table if it exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales') THEN
        DELETE FROM sales;
        RAISE NOTICE 'Deleted all records from sales table';
    END IF;
    
    -- Check and delete from old 'sale_items' table if it exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sale_items') THEN
        DELETE FROM sale_items;
        RAISE NOTICE 'Deleted all records from sale_items table';
    END IF;
END $$;

COMMIT;

-- Verify deletion
SELECT 
    (SELECT COUNT(*) FROM sales_item) as sales_item_count,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales_id')
        THEN (SELECT COUNT(*) FROM sales_id)
        ELSE 0
    END as sales_id_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM sales_item) = 0 
        THEN '✅ All sales data cleared successfully!'
        ELSE '⚠️ Some data may still exist'
    END as status;

