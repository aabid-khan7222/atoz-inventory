-- Add DP (Dealer Price), Purchase Value, and Discount columns to purchases table
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS dp NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS purchase_value NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0;

-- Update existing purchases: set DP and purchase_value to amount if they are 0 or NULL
UPDATE purchases 
SET dp = amount,
    purchase_value = amount
WHERE dp IS NULL OR dp = 0 OR purchase_value IS NULL OR purchase_value = 0;

-- Make columns NOT NULL after setting defaults
ALTER TABLE purchases 
ALTER COLUMN dp SET NOT NULL,
ALTER COLUMN purchase_value SET NOT NULL;

