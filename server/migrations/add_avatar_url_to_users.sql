-- Add avatar_url column to users table for profile photos
-- This migration adds support for storing user profile photos

-- Add avatar_url column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN avatar_url TEXT;
        
        COMMENT ON COLUMN users.avatar_url IS 'Base64 encoded profile photo or URL to profile image';
    END IF;
END $$;
