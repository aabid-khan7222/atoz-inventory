-- Drop services table as it's no longer used
-- All service data is now stored in service_requests table

-- Drop the function that references services table
DROP FUNCTION IF EXISTS generate_service_number();

-- Drop indexes on services table
DROP INDEX IF EXISTS idx_services_customer_id;
DROP INDEX IF EXISTS idx_services_service_type;
DROP INDEX IF EXISTS idx_services_service_status;
DROP INDEX IF EXISTS idx_services_created_at;
DROP INDEX IF EXISTS idx_services_service_number;

-- Drop the services table
DROP TABLE IF EXISTS services;

