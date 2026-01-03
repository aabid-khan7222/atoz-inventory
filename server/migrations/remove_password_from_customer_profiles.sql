-- Remove password column from customer_profiles table
-- Passwords should only be stored in users table for security
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'customer_profiles' 
        AND column_name = 'password'
    ) THEN
        ALTER TABLE customer_profiles 
        DROP COLUMN password;
        
        RAISE NOTICE 'Removed password column from customer_profiles table';
    ELSE
        RAISE NOTICE 'password column does not exist in customer_profiles table';
    END IF;
END $$;

