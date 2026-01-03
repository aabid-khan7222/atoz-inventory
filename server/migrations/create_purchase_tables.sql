-- Create purchase_product_type table
CREATE TABLE IF NOT EXISTS purchase_product_type (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

-- Insert the 3 categories with IDs 1, 2, 3
INSERT INTO purchase_product_type (id, name) VALUES
  (1, 'Car/Truck/Tractor Battery'),
  (2, 'Bike Battery'),
  (3, 'Inverter & Battery')
ON CONFLICT (id) DO NOTHING;

-- Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  product_type_id INTEGER NOT NULL REFERENCES purchase_product_type(id),
  purchase_date DATE NOT NULL,
  purchase_number VARCHAR(50) NOT NULL,
  product_series VARCHAR(100),
  product_sku VARCHAR(100) NOT NULL,
  serial_number VARCHAR(255) NOT NULL,
  supplier_name VARCHAR(255),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Ensure unique serial numbers per product
  UNIQUE(product_sku, serial_number)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_purchases_product_type_id ON purchases(product_type_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_number ON purchases(purchase_number);
CREATE INDEX IF NOT EXISTS idx_purchases_product_sku ON purchases(product_sku);
CREATE INDEX IF NOT EXISTS idx_purchases_serial_number ON purchases(serial_number);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_name ON purchases(supplier_name);

