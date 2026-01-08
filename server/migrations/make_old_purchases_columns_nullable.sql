-- Make old purchases table columns nullable to allow new schema inserts
-- This migration makes the old schema columns (sku, series, name) nullable
-- so that new schema inserts (using product_sku, product_series) don't fail

-- Make sku nullable (if it exists and is NOT NULL)
ALTER TABLE purchases 
ALTER COLUMN sku DROP NOT NULL;

-- Make series nullable (if it exists and is NOT NULL)
ALTER TABLE purchases 
ALTER COLUMN series DROP NOT NULL;

-- Make name nullable (if it exists and is NOT NULL)
ALTER TABLE purchases 
ALTER COLUMN name DROP NOT NULL;

-- Note: These columns can be dropped later once all data is migrated to new schema

