-- Add amount column to service_requests table
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2) DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN service_requests.amount IS 'Service charge amount charged to customer when service is completed';

