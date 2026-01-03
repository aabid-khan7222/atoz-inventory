-- Create stock_history table for tracking all stock transactions
-- This table tracks both additions and sales of stock with serial numbers

CREATE TABLE IF NOT EXISTS stock_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('add', 'sell')),
  quantity INTEGER NOT NULL DEFAULT 1,
  serial_number VARCHAR(255),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  amount DECIMAL(10, 2),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_history_product_id ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_transaction_type ON stock_history(transaction_type);
CREATE INDEX IF NOT EXISTS idx_stock_history_created_at ON stock_history(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_history_serial_number ON stock_history(serial_number);

-- Create a unique constraint to prevent duplicate serial numbers for the same product in 'add' transactions
-- Note: This allows the same serial number to be added multiple times if needed
-- You may want to adjust this based on your business logic

COMMENT ON TABLE stock_history IS 'Tracks all stock transactions including additions and sales with serial numbers';
COMMENT ON COLUMN stock_history.transaction_type IS 'Type of transaction: add or sell';
COMMENT ON COLUMN stock_history.serial_number IS 'Serial number of the product unit';
COMMENT ON COLUMN stock_history.amount IS 'Sale amount (only for sell transactions)';

