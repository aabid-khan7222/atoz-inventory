-- Complete database schema initialization
-- Run this FIRST to create all base tables

-- ============================================================
-- 1. PRODUCT TYPE TABLE (Must be created first)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_type (
  id INTEGER PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default product types
INSERT INTO product_type (id, name) VALUES
  (1, 'car-truck-tractor'),
  (2, 'bike'),
  (3, 'ups-inverter'),
  (4, 'water_products')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. PRODUCTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(100) UNIQUE NOT NULL,
  series VARCHAR(100),
  category VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  qty INTEGER DEFAULT 0,
  ah_va VARCHAR(20),
  warranty VARCHAR(50),
  guarantee_period_months INTEGER DEFAULT 0,
  mrp_price DECIMAL(10, 2) NOT NULL,
  selling_price DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  discount_percent DECIMAL(5, 2) DEFAULT 0,
  b2b_selling_price DECIMAL(10, 2),
  b2b_discount DECIMAL(10, 2) DEFAULT 0,
  b2b_discount_percent DECIMAL(5, 2) DEFAULT 0,
  b2b_mrp DECIMAL(10, 2),
  dp DECIMAL(10, 2), -- Dealer Price
  product_type_id INTEGER NOT NULL REFERENCES product_type(id),
  order_index INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_product_type_id ON products(product_type_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_order_index ON products(order_index);

-- ============================================================
-- 3. STOCK TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS stock (
  id SERIAL PRIMARY KEY,
  purchase_date DATE NOT NULL,
  sku VARCHAR(100) NOT NULL,
  series VARCHAR(100),
  category VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  ah_va VARCHAR(20),
  quantity INTEGER NOT NULL DEFAULT 1,
  purchased_from VARCHAR(255),
  warranty VARCHAR(50),
  product_type_id INTEGER NOT NULL REFERENCES product_type(id),
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  serial_number VARCHAR(255),
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'sold', 'damaged', 'returned')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_sku ON stock(sku);
CREATE INDEX IF NOT EXISTS idx_stock_product_id ON stock(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_product_type_id ON stock(product_type_id);
CREATE INDEX IF NOT EXISTS idx_stock_purchase_date ON stock(purchase_date);
CREATE INDEX IF NOT EXISTS idx_stock_serial_number ON stock(serial_number);
CREATE INDEX IF NOT EXISTS idx_stock_status ON stock(status);
CREATE INDEX IF NOT EXISTS idx_stock_category ON stock(category);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_product_serial_unique 
ON stock(product_id, serial_number) 
WHERE serial_number IS NOT NULL;

-- ============================================================
-- 4. SALES TYPES LOOKUP
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_types (
  id INTEGER PRIMARY KEY,
  type_name VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sales_types (id, type_name, description) VALUES
  (1, 'retail', 'Retail customers (normal customers)'),
  (2, 'wholesale', 'Wholesale/B2B customers')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. SALES_ID TABLE (Sales Headers)
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_id (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_mobile_number VARCHAR(20),
  customer_vehicle_number VARCHAR(50),
  customer_gst VARCHAR(50),
  sales_type VARCHAR(20) NOT NULL CHECK (sales_type IN ('retail', 'wholesale')),
  sales_type_id INTEGER REFERENCES sales_types(id) DEFAULT 1,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_id_customer_id ON sales_id(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_id_invoice_number ON sales_id(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_id_sales_type ON sales_id(sales_type);
CREATE INDEX IF NOT EXISTS idx_sales_id_sales_type_id ON sales_id(sales_type_id);
CREATE INDEX IF NOT EXISTS idx_sales_id_created_at ON sales_id(created_at);

-- ============================================================
-- 6. SALES_ITEM TABLE (Individual Sales)
-- ============================================================
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
  old_battery_trade_in BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_item_customer_id ON sales_item(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_item_invoice_number ON sales_item(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_item_sales_id ON sales_item(sales_id);
CREATE INDEX IF NOT EXISTS idx_sales_item_serial_number ON sales_item(SERIAL_NUMBER);
CREATE INDEX IF NOT EXISTS idx_sales_item_product_id ON sales_item(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_item_purchase_date ON sales_item(purchase_date);
CREATE INDEX IF NOT EXISTS idx_sales_item_sales_type ON sales_item(sales_type);
CREATE INDEX IF NOT EXISTS idx_sales_item_sales_type_id ON sales_item(sales_type_id);

-- ============================================================
-- 7. PURCHASE PRODUCT TYPE
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_product_type (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO purchase_product_type (id, name) VALUES
  (1, 'Car/Truck/Tractor'),
  (2, 'Bike'),
  (3, 'UPS/Inverter'),
  (4, 'Water Products')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. PURCHASES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  purchase_date DATE NOT NULL,
  product_type_id INTEGER REFERENCES purchase_product_type(id),
  sku VARCHAR(100) NOT NULL,
  series VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  purchase_price DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  supplier_name VARCHAR(255),
  invoice_number VARCHAR(100),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_product_type_id ON purchases(product_type_id);
CREATE INDEX IF NOT EXISTS idx_purchases_sku ON purchases(sku);

-- ============================================================
-- 9. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN DEFAULT false,
  related_sale_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ============================================================
-- 10. OTHER TABLES (Referenced but may be optional)
-- ============================================================

-- Charging Services
CREATE TABLE IF NOT EXISTS charging_services (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20),
  customer_email VARCHAR(255),
  battery_brand VARCHAR(100),
  battery_ah_va VARCHAR(20),
  service_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service Requests
CREATE TABLE IF NOT EXISTS service_requests (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20),
  service_type VARCHAR(100),
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  amount DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Company Returns
CREATE TABLE IF NOT EXISTS company_returns (
  id SERIAL PRIMARY KEY,
  return_date DATE NOT NULL,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  customer_gst VARCHAR(50),
  company_name VARCHAR(255),
  company_address TEXT,
  sku VARCHAR(100),
  product_name VARCHAR(255),
  quantity INTEGER NOT NULL,
  reason TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guarantee/Warranty Tables
CREATE TABLE IF NOT EXISTS warranty_slabs (
  id SERIAL PRIMARY KEY,
  product_type_id INTEGER REFERENCES product_type(id),
  warranty_string VARCHAR(50) NOT NULL,
  guarantee_months INTEGER NOT NULL,
  warranty_months INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS battery_replacements (
  id SERIAL PRIMARY KEY,
  original_serial_number VARCHAR(255) NOT NULL,
  replacement_serial_number VARCHAR(255) NOT NULL,
  replacement_date DATE NOT NULL,
  reason TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_battery_replacements_original_serial ON battery_replacements(original_serial_number);

-- Stock History
CREATE TABLE IF NOT EXISTS stock_history (
  id SERIAL PRIMARY KEY,
  stock_id INTEGER REFERENCES stock(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  quantity_change INTEGER NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_history_stock_id ON stock_history(stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created_at ON stock_history(created_at);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  role VARCHAR(100),
  salary DECIMAL(10, 2),
  joining_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commission Agents
CREATE TABLE IF NOT EXISTS commission_agents (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  commission_rate DECIMAL(5, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily Attendance
CREATE TABLE IF NOT EXISTS daily_attendance (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status VARCHAR(20) CHECK (status IN ('present', 'absent', 'half_day', 'leave')),
  check_in_time TIME,
  check_out_time TIME,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_attendance_employee_id ON daily_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_date ON daily_attendance(attendance_date);

