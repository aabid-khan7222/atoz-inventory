-- Create stock table for tracking individual stock items
-- Each row represents one physical item with its serial number
-- This table tracks purchases and individual stock items

CREATE TABLE IF NOT EXISTS stock (
  id SERIAL PRIMARY KEY,
  purchase_date DATE NOT NULL,
  sku VARCHAR(100) NOT NULL,
  series VARCHAR(100),
  category VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  ah_va VARCHAR(20),
  quantity INTEGER NOT NULL DEFAULT 1, -- Always 1 per row (one item per serial number)
  purchased_from VARCHAR(255), -- Who we purchased it from
  warranty VARCHAR(50),
  product_type_id INTEGER NOT NULL REFERENCES product_type(id),
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL, -- Link to products table
  serial_number VARCHAR(255), -- Serial number for this specific item
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'sold', 'damaged', 'returned')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_sku ON stock(sku);
CREATE INDEX IF NOT EXISTS idx_stock_product_id ON stock(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_product_type_id ON stock(product_type_id);
CREATE INDEX IF NOT EXISTS idx_stock_purchase_date ON stock(purchase_date);
CREATE INDEX IF NOT EXISTS idx_stock_serial_number ON stock(serial_number);
CREATE INDEX IF NOT EXISTS idx_stock_status ON stock(status);
CREATE INDEX IF NOT EXISTS idx_stock_category ON stock(category);

-- Create unique constraint on serial_number per product to prevent duplicates
-- Only enforce uniqueness for available items (sold items can have same serial if needed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_product_serial_unique 
ON stock(product_id, serial_number) 
WHERE serial_number IS NOT NULL;

COMMENT ON TABLE stock IS 'Tracks individual stock items purchased, one row per serial number';
COMMENT ON COLUMN stock.quantity IS 'Always 1 per row since each row represents one item';
COMMENT ON COLUMN stock.serial_number IS 'Serial number of the individual item';
COMMENT ON COLUMN stock.status IS 'Status: available, sold, damaged, or returned';
COMMENT ON COLUMN stock.purchased_from IS 'Supplier or vendor name from whom the item was purchased';

