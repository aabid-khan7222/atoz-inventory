-- Remove 'amount' column from purchases table
-- This column is redundant as 'purchase_value' serves the same purpose

-- First, update any NULL purchase_value values to use amount (if amount exists)
UPDATE purchases
SET purchase_value = amount
WHERE purchase_value IS NULL AND amount IS NOT NULL;

-- Now drop the amount column
ALTER TABLE purchases
DROP COLUMN IF EXISTS amount;

