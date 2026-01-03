-- SQL script to create tables for sales, purchases, and services
-- Run this in your PostgreSQL database

-- 1. Sales Table (for both retail and wholesale)
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES users(id),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  sale_type VARCHAR(20) NOT NULL CHECK (sale_type IN ('retail', 'wholesale')),
  total_amount DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  tax DECIMAL(10, 2) DEFAULT 0,
  final_amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'card', 'upi', 'credit')),
  payment_status VARCHAR(20) DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'partial')),
  created_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Sale Items Table (products sold in each sale)
CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  product_category VARCHAR(50) NOT NULL,
  product_id INTEGER NOT NULL,
  product_sku VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  product_serial_number VARCHAR(255),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Services Table (charging, testing)
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  service_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES users(id),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('charging', 'testing')),
  battery_category VARCHAR(50),
  battery_details TEXT,
  service_status VARCHAR(20) DEFAULT 'pending' CHECK (service_status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  service_charge DECIMAL(10, 2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending', 'partial')),
  payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'card', 'upi', 'credit')),
  assigned_to INTEGER REFERENCES users(id),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_sale_type ON sales(sale_type);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON sales(invoice_number);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_category ON sale_items(product_category);

-- Ensure serial number columns exist for existing databases
ALTER TABLE sale_items 
  ADD COLUMN IF NOT EXISTS product_serial_number VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_services_customer_id ON services(customer_id);
CREATE INDEX IF NOT EXISTS idx_services_service_type ON services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_service_status ON services(service_status);
CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at);
CREATE INDEX IF NOT EXISTS idx_services_service_number ON services(service_number);

-- Function to generate invoice number
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
  FROM sales
  WHERE invoice_number LIKE 'INV-' || today_date || '%';
  
  new_number := 'INV-' || today_date || '-' || LPAD(last_number::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate service number
CREATE OR REPLACE FUNCTION generate_service_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  today_date TEXT;
  last_number INTEGER;
BEGIN
  today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(service_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO last_number
  FROM services
  WHERE service_number LIKE 'SRV-' || today_date || '%';
  
  new_number := 'SRV-' || today_date || '-' || LPAD(last_number::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

