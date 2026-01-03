-- Migration: Create commission_agents table and add commission columns to sales_item

-- 1. Create commission_agents table
CREATE TABLE IF NOT EXISTS commission_agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  mobile_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  total_commission_paid NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mobile_number)
);

-- Create index on mobile_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_commission_agents_mobile ON commission_agents(mobile_number);

-- Create index on name for search
CREATE INDEX IF NOT EXISTS idx_commission_agents_name ON commission_agents(name);

-- 2. Add commission columns to sales_item table
ALTER TABLE sales_item
  ADD COLUMN IF NOT EXISTS has_commission BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS commission_agent_id INTEGER REFERENCES commission_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12, 2) DEFAULT 0;

-- Create index on commission_agent_id for faster joins
CREATE INDEX IF NOT EXISTS idx_sales_item_commission_agent ON sales_item(commission_agent_id);

-- Create index on has_commission for filtering
CREATE INDEX IF NOT EXISTS idx_sales_item_has_commission ON sales_item(has_commission);

-- Add comments for documentation
COMMENT ON TABLE commission_agents IS 'Stores commission agent details and tracks total commission paid';
COMMENT ON COLUMN commission_agents.total_commission_paid IS 'Total commission amount paid to this agent across all sales';
COMMENT ON COLUMN sales_item.has_commission IS 'Whether commission was paid for this sale';
COMMENT ON COLUMN sales_item.commission_agent_id IS 'Reference to the commission agent who received commission';
COMMENT ON COLUMN sales_item.commission_amount IS 'Commission amount paid for this specific sale item';

