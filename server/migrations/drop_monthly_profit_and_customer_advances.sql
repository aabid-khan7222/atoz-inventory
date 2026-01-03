-- Drop customer_advances table
DROP TABLE IF EXISTS customer_advances CASCADE;

-- Drop monthly_profit table
DROP TABLE IF EXISTS monthly_profit CASCADE;

-- Note: employee_payments table will remain as it's still needed for employee payment tracking
-- But it won't automatically deduct from monthly_profit anymore

