-- Add company_address column to customer_profiles table if it doesn't exist
-- This column stores the business address for GST invoices

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'customer_profiles' 
        AND column_name = 'company_address'
    ) THEN
        ALTER TABLE customer_profiles 
        ADD COLUMN company_address TEXT;
        
        RAISE NOTICE 'Added company_address column to customer_profiles table';
    ELSE
        RAISE NOTICE 'company_address column already exists in customer_profiles table';
    END IF;
END $$;

