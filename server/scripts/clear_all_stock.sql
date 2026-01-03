-- SQL script to clear all stock
-- Run this directly in your PostgreSQL database

-- Step 1: Set all product quantities to 0
UPDATE products SET qty = 0, updated_at = CURRENT_TIMESTAMP;

-- Step 2: Delete all stock from stock table
DELETE FROM stock;

-- Step 3: Verify - Check product quantities
SELECT 
  COUNT(*) as total_products,
  SUM(qty) as total_quantity
FROM products;

-- Step 4: Verify - Check stock table
SELECT COUNT(*) as stock_items FROM stock;

