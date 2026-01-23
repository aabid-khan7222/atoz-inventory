-- ============================================
-- PRODUCTION DATABASE QUERIES
-- Signup & Forgot Password Feature
-- ============================================
-- 
-- IMPORTANT: Run these queries ONLY if the columns don't exist
-- The code automatically handles missing columns, but it's better to ensure they exist
-- ============================================

-- ============================================
-- 1. Check if pincode column exists in customer_profiles
-- ============================================
-- Run this first to check:
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'customer_profiles' 
AND column_name = 'pincode';

-- If the above query returns NO rows, then run this:
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
        
        RAISE NOTICE 'Added pincode column to customer_profiles table';
    ELSE
        RAISE NOTICE 'pincode column already exists in customer_profiles table';
    END IF;
END $$;

-- ============================================
-- 2. Check if full_name and email columns exist in customer_profiles
-- ============================================
-- Run this to check:
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'customer_profiles' 
AND column_name IN ('full_name', 'email');

-- If full_name doesn't exist, run this:
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
        
        RAISE NOTICE 'Added full_name column to customer_profiles table';
    ELSE
        RAISE NOTICE 'full_name column already exists in customer_profiles table';
    END IF;
END $$;

-- If email doesn't exist, run this:
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
        
        RAISE NOTICE 'Added email column to customer_profiles table';
    ELSE
        RAISE NOTICE 'email column already exists in customer_profiles table';
    END IF;
END $$;

-- ============================================
-- 3. Verify all required columns exist
-- ============================================
-- Run this to verify all columns exist:
SELECT 
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'customer_profiles' 
AND column_name IN (
    'user_id',
    'full_name',
    'email',
    'phone',
    'state',
    'city',
    'address',
    'pincode',
    'is_business_customer',
    'company_name',
    'gst_number',
    'company_address'
)
ORDER BY column_name;

-- ============================================
-- 4. Verify users table has all required columns
-- ============================================
SELECT 
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN (
    'id',
    'full_name',
    'email',
    'phone',
    'password',
    'role_id',
    'is_active',
    'state',
    'city',
    'address',
    'gst_number',
    'company_name',
    'company_address'
)
ORDER BY column_name;

-- ============================================
-- NOTES:
-- ============================================
-- 1. The code automatically checks for column existence and handles gracefully
-- 2. However, it's recommended to run these queries to ensure all columns exist
-- 3. These queries are SAFE - they only add columns if they don't exist
-- 4. No data will be lost or modified
-- 5. Run these queries in your production database
-- ============================================
