-- ============================================================
-- COMPANY RETURNS SYSTEM - Database Table
-- ============================================================
-- This script creates a table for tracking batteries returned to Exide company
-- and the replacement batteries received in exchange
-- ============================================================

-- Create company_returns table
CREATE TABLE IF NOT EXISTS company_returns (
  id SERIAL PRIMARY KEY,
  returned_serial_number VARCHAR(255) NOT NULL,
  returned_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  returned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  returned_purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
  returned_invoice_number VARCHAR(50),
  received_serial_number VARCHAR(255),
  received_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  received_date DATE,
  received_purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
  received_invoice_number VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'returned', 'received', 'completed')),
  customer_name VARCHAR(255),
  customer_vehicle_number VARCHAR(50),
  customer_mobile_number VARCHAR(20),
  reason TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_company_returns_returned_serial ON company_returns(returned_serial_number);
CREATE INDEX IF NOT EXISTS idx_company_returns_received_serial ON company_returns(received_serial_number);
CREATE INDEX IF NOT EXISTS idx_company_returns_status ON company_returns(status);
CREATE INDEX IF NOT EXISTS idx_company_returns_returned_date ON company_returns(returned_date);
CREATE INDEX IF NOT EXISTS idx_company_returns_received_date ON company_returns(received_date);
CREATE INDEX IF NOT EXISTS idx_company_returns_created_by ON company_returns(created_by);

-- Add comments for documentation
COMMENT ON TABLE company_returns IS 'Tracks batteries returned to Exide company and replacement batteries received';
COMMENT ON COLUMN company_returns.returned_serial_number IS 'Serial number of the battery returned to Exide';
COMMENT ON COLUMN company_returns.received_serial_number IS 'Serial number of the replacement battery received from Exide';
COMMENT ON COLUMN company_returns.status IS 'Status: pending (not yet returned), returned (sent to company), received (replacement received), completed (fully processed)';

