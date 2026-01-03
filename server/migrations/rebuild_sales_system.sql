-- ============================================================
-- REBUILD SALES SYSTEM - Complete Migration Script
-- ============================================================
-- This script:
-- 1. Drops existing sales and sale_items tables
-- 2. Creates new sales_id and sales_item tables
-- 3. Clears all sales-related data
-- ============================================================

-- Step 1: Drop existing sales tables and related constraints
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;

-- Step 2: Create sales_types lookup table FIRST
-- This table contains two IDs: 1 for retail, 2 for wholesale/B2B
CREATE TABLE IF NOT EXISTS sales_types (
  id INTEGER PRIMARY KEY,
  type_name VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert the two required sales types
INSERT INTO sales_types (id, type_name, description) VALUES
  (1, 'retail', 'Retail customers (normal customers)'),
  (2, 'wholesale', 'Wholesale/B2B customers')
ON CONFLICT (id) DO NOTHING;

-- Step 3: Create sales_id table
-- This table stores sales transaction headers
-- References sales_types table (ID 1 for retail, ID 2 for wholesale/B2B)
CREATE TABLE IF NOT EXISTS sales_id (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_mobile_number VARCHAR(20),
  customer_vehicle_number VARCHAR(50),
  sales_type VARCHAR(20) NOT NULL CHECK (sales_type IN ('retail', 'wholesale')),
  sales_type_id INTEGER REFERENCES sales_types(id) DEFAULT 1,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Create sales_item table
-- This table stores every battery that gets sold
-- One row per battery (even if multiple quantities of same product)
CREATE TABLE IF NOT EXISTS sales_item (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_mobile_number VARCHAR(20),
  customer_vehicle_number VARCHAR(50),
  sales_type VARCHAR(20) NOT NULL CHECK (sales_type IN ('retail', 'wholesale')),
  sales_type_id INTEGER REFERENCES sales_types(id) DEFAULT 1,
  sales_id INTEGER REFERENCES sales_id(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL,
  SKU VARCHAR(100) NOT NULL,
  SERIES VARCHAR(100),
  CATEGORY VARCHAR(100),
  NAME VARCHAR(255) NOT NULL,
  AH_VA VARCHAR(20),
  QUANTITY INTEGER NOT NULL DEFAULT 1,
  WARRANTY VARCHAR(50),
  SERIAL_NUMBER VARCHAR(255) NOT NULL,
  MRP DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  tax DECIMAL(10, 2) DEFAULT 0,
  final_amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'card', 'upi', 'credit')),
  payment_status VARCHAR(20) DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'partial')),
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_id_customer_id ON sales_id(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_id_invoice_number ON sales_id(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_id_sales_type ON sales_id(sales_type);
CREATE INDEX IF NOT EXISTS idx_sales_id_sales_type_id ON sales_id(sales_type_id);
CREATE INDEX IF NOT EXISTS idx_sales_id_created_at ON sales_id(created_at);

CREATE INDEX IF NOT EXISTS idx_sales_item_customer_id ON sales_item(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_item_invoice_number ON sales_item(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_item_sales_id ON sales_item(sales_id);
CREATE INDEX IF NOT EXISTS idx_sales_item_serial_number ON sales_item(SERIAL_NUMBER);
CREATE INDEX IF NOT EXISTS idx_sales_item_product_id ON sales_item(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_item_purchase_date ON sales_item(purchase_date);
CREATE INDEX IF NOT EXISTS idx_sales_item_sales_type ON sales_item(sales_type);
CREATE INDEX IF NOT EXISTS idx_sales_item_sales_type_id ON sales_item(sales_type_id);

-- Step 5: Add email column to users table if it doesn't exist
-- (For auto-creating customer accounts)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'email'
  ) THEN
    ALTER TABLE users ADD COLUMN email VARCHAR(255);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  END IF;
END $$;

-- Step 6: Add user_type column to users table if it doesn't exist
-- (For distinguishing user types: admin, super admin, b2b, b2c)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'user_type'
  ) THEN
    ALTER TABLE users ADD COLUMN user_type VARCHAR(20) DEFAULT 'b2c' 
      CHECK (user_type IN ('admin', 'super admin', 'b2b', 'b2c'));
  END IF;
END $$;

-- Step 7: Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  today_date TEXT;
  last_number INTEGER;
BEGIN
  today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO last_number
  FROM sales_id
  WHERE invoice_number LIKE 'INV-' || today_date || '%';
  
  new_number := 'INV-' || today_date || '-' || LPAD(last_number::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE sales_types IS 'Lookup table for sales types: 1=Retail, 2=Wholesale/B2B';
COMMENT ON TABLE sales_id IS 'Sales transaction headers - one per invoice';
COMMENT ON TABLE sales_item IS 'Individual battery sales - one row per battery sold';
COMMENT ON COLUMN sales_id.sales_type_id IS 'Reference to sales_types table (1=retail, 2=wholesale)';
COMMENT ON COLUMN sales_item.QUANTITY IS 'Always 1 per row since each row represents one battery';
COMMENT ON COLUMN sales_item.SERIAL_NUMBER IS 'Serial number of the individual battery sold';
COMMENT ON COLUMN sales_item.sales_type_id IS 'Reference to sales_types table (1=retail, 2=wholesale)';

