-- Script to remove all repair services from the database
-- This script:
-- 1. Deletes all repair service records
-- 2. Updates the service_type constraint to remove 'repair'

-- Step 1: Delete all repair service records
DELETE FROM services WHERE service_type = 'repair';

-- Step 2: Drop the existing constraint
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_service_type_check;

-- Step 3: Add new constraint without 'repair'
ALTER TABLE services ADD CONSTRAINT services_service_type_check 
  CHECK (service_type IN ('charging', 'testing'));

-- Step 4: Drop the generate_service_number function if it exists (optional cleanup)
-- Note: We keep it since it's used for all service types, not just repairs
-- DROP FUNCTION IF EXISTS generate_service_number();

-- Verification query (run separately to check)
-- SELECT service_type, COUNT(*) FROM services GROUP BY service_type;

