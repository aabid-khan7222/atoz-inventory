-- Remove business_type column from customer_profiles table if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'customer_profiles' 
        AND column_name = 'business_type'
    ) THEN
        ALTER TABLE customer_profiles 
        DROP COLUMN business_type;
        
        RAISE NOTICE 'Removed business_type column from customer_profiles table';
    ELSE
        RAISE NOTICE 'business_type column does not exist in customer_profiles table';
    END IF;
END $$;

