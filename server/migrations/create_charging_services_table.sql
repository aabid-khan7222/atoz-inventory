-- Create charging_services table
-- This table stores battery charging service records

CREATE TABLE IF NOT EXISTS charging_services (
  id SERIAL PRIMARY KEY,
  battery_serial_number VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_mobile_number VARCHAR(20) NOT NULL,
  vehicle_number VARCHAR(50),
  battery_sku VARCHAR(100),
  battery_ampere_rating VARCHAR(50),
  battery_condition VARCHAR(100) NOT NULL, -- e.g., 'good', 'fair', 'poor'
  service_price DECIMAL(10, 2) NOT NULL,
  expected_completion_time VARCHAR(50) NOT NULL, -- e.g., 'this evening', 'tomorrow morning', 'tomorrow evening'
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'collected'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  completed_at TIMESTAMP,
  collected_at TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_charging_services_serial ON charging_services(battery_serial_number);
CREATE INDEX IF NOT EXISTS idx_charging_services_customer_mobile ON charging_services(customer_mobile_number);
CREATE INDEX IF NOT EXISTS idx_charging_services_status ON charging_services(status);
CREATE INDEX IF NOT EXISTS idx_charging_services_created_at ON charging_services(created_at);

-- Add comment to table
COMMENT ON TABLE charging_services IS 'Stores battery charging service records for all battery brands';

