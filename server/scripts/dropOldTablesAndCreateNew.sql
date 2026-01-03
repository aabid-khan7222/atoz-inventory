-- SQL script to drop old tables and create new unified product structure
-- Run this AFTER migrating data using migrateToUnifiedProductTable.js
-- OR if you want to start fresh, run this first

-- Step 1: Drop old product tables (if they exist)
DROP TABLE IF EXISTS bike_batteries CASCADE;
DROP TABLE IF EXISTS car_truck_tractor_batteries CASCADE;
DROP TABLE IF EXISTS hups_inverter_batteries CASCADE;
DROP TABLE IF EXISTS ups_inverter_batteries CASCADE;
DROP TABLE IF EXISTS product CASCADE; -- Old product table if exists

-- Step 2: Create product_type table
CREATE TABLE IF NOT EXISTS product_type (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Insert product types
INSERT INTO product_type (id, name) VALUES
(1, 'car_truck_tractor_batteries'),
(2, 'bike_batteries'),
(3, 'hups_inverter_batteries')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO product_type (id, name) VALUES
(1, 'car_truck_tractor_batteries'),
(2, 'bike_batteries'),
(3, 'hups_inverter_batteries')
ON CONFLICT (name) DO NOTHING;

-- Step 4: Create unified product table
CREATE TABLE IF NOT EXISTS product (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(100) UNIQUE NOT NULL,
  series VARCHAR(100),
  category VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  qty INTEGER DEFAULT 0,
  selling_price DECIMAL(10, 2) NOT NULL,
  mrp_price DECIMAL(10, 2),
  discount DECIMAL(10, 2) DEFAULT 0,
  ah_va VARCHAR(20),
  warranty VARCHAR(50),
  order_index INTEGER,
  product_type_id INTEGER NOT NULL REFERENCES product_type(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_product_sku ON product(sku);
CREATE INDEX IF NOT EXISTS idx_product_type_id ON product(product_type_id);
CREATE INDEX IF NOT EXISTS idx_product_series ON product(series);
CREATE INDEX IF NOT EXISTS idx_product_order_index ON product(order_index);

