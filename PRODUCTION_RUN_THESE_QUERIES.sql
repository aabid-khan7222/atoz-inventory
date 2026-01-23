-- ============================================
-- PRODUCTION DATABASE - RUN THESE QUERIES
-- ============================================
-- 
-- Step 1: Production PostgreSQL database mein connect karein
-- Step 2: Ye sab queries ek saath run kar sakte hain
-- Step 3: Agar column already hai to kuch nahi hoga (safe hai)
-- ============================================

-- ============================================
-- QUERY 1: customer_profiles table mein pincode column add karein (agar nahi hai)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'customer_profiles' 
        AND column_name = 'pincode'
    ) THEN
        ALTER TABLE customer_profiles 
        ADD COLUMN pincode VARCHAR(10);
        
        RAISE NOTICE '✅ pincode column added to customer_profiles table';
    ELSE
        RAISE NOTICE 'ℹ️  pincode column already exists in customer_profiles table';
    END IF;
END $$;

-- ============================================
-- QUERY 2: customer_profiles table mein full_name column add karein (agar nahi hai)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'customer_profiles' 
        AND column_name = 'full_name'
    ) THEN
        ALTER TABLE customer_profiles 
        ADD COLUMN full_name VARCHAR(255);
        
        RAISE NOTICE '✅ full_name column added to customer_profiles table';
    ELSE
        RAISE NOTICE 'ℹ️  full_name column already exists in customer_profiles table';
    END IF;
END $$;

-- ============================================
-- QUERY 3: customer_profiles table mein email column add karein (agar nahi hai)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'customer_profiles' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE customer_profiles 
        ADD COLUMN email VARCHAR(255);
        
        RAISE NOTICE '✅ email column added to customer_profiles table';
    ELSE
        RAISE NOTICE 'ℹ️  email column already exists in customer_profiles table';
    END IF;
END $$;

-- ============================================
-- VERIFICATION QUERY: Check karein sab columns hai ya nahi
-- ============================================
-- Ye query run karke verify karein ki sab columns add ho gayi hain:
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'customer_profiles' 
AND column_name IN ('pincode', 'full_name', 'email')
ORDER BY column_name;

-- Expected Result: 3 rows aane chahiye
-- 1. email
-- 2. full_name  
-- 3. pincode

-- ============================================
-- COMPLETE! ✅
-- ============================================
