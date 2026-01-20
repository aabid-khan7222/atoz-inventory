-- Create pending_service_requests table for temporary service requests (before admin confirmation)
-- These requests are stored temporarily and can be deleted if cancelled
-- Only after admin confirmation, they are moved to service_requests table
CREATE TABLE IF NOT EXISTS pending_service_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    service_type VARCHAR(50) NOT NULL,
    vehicle_name VARCHAR(255),
    fuel_type VARCHAR(50),
    vehicle_number VARCHAR(50),
    inverter_va VARCHAR(50),
    inverter_voltage VARCHAR(50),
    battery_ampere_rating VARCHAR(50),
    notes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'requested',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pending_service_requests_user_id ON pending_service_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_service_requests_status ON pending_service_requests(status);
CREATE INDEX IF NOT EXISTS idx_pending_service_requests_service_type ON pending_service_requests(service_type);

