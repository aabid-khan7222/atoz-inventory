-- ============================================================
-- RENAME customer_type TO user_type AND UPDATE VALUES
-- ============================================================
-- This script:
-- 1. Renames customer_type column to user_type
-- 2. Updates values based on role_id and existing customer_type:
--    - role_id = 1 (Super Admin) → "super admin"
--    - role_id = 2 (Admin) → "admin"
--    - role_id >= 3 with customer_type IN ('b2b', 'wholesale') → "b2b"
--    - role_id >= 3 with customer_type = 'normal' → "b2c"
-- ============================================================

-- Step 1: Drop the old CHECK constraint first (before updating values)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_customer_type_check;

-- Step 2: Update the values based on role_id and existing customer_type
-- Update Super Admin users (role_id = 1)
UPDATE users 
SET customer_type = 'super admin' 
WHERE role_id = 1;

-- Update Admin users (role_id = 2)
UPDATE users 
SET customer_type = 'admin' 
WHERE role_id = 2;

-- Update B2B customers (role_id >= 3 with b2b or wholesale)
UPDATE users 
SET customer_type = 'b2b' 
WHERE role_id >= 3 
  AND customer_type IN ('b2b', 'wholesale');

-- Update B2C customers (role_id >= 3 with normal)
UPDATE users 
SET customer_type = 'b2c' 
WHERE role_id >= 3 
  AND customer_type = 'normal';

-- Step 3: Rename the column from customer_type to user_type
ALTER TABLE users RENAME COLUMN customer_type TO user_type;

-- Step 4: Add new CHECK constraint for user_type
ALTER TABLE users 
ADD CONSTRAINT users_user_type_check 
CHECK (user_type IN ('admin', 'super admin', 'b2b', 'b2c'));

-- Step 5: Update the default value
ALTER TABLE users ALTER COLUMN user_type SET DEFAULT 'b2c';

COMMENT ON COLUMN users.user_type IS 'User type: admin, super admin, b2b (B2B customer), or b2c (B2C customer)';

