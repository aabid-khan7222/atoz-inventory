-- Insert sample/initial data for the application to function
-- This includes products, product types, and other essential data

-- ============================================================
-- 1. PRODUCT TYPES (Already inserted in base tables, but ensure they exist)
-- ============================================================
INSERT INTO product_type (id, name) VALUES
  (1, 'car-truck-tractor'),
  (2, 'bike'),
  (3, 'ups-inverter'),
  (4, 'water_products')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. SAMPLE PRODUCTS (Essential products for testing)
-- ============================================================

-- Sample Car/Truck/Tractor Battery
INSERT INTO products (
  sku, series, category, name, qty,
  mrp_price, selling_price, discount, discount_percent,
  b2b_selling_price, b2b_discount, b2b_discount_percent,
  ah_va, warranty, guarantee_period_months, order_index, product_type_id, dp
) VALUES (
  'EXIDE-CAR-100AH',
  'EXIDE',
  'car-truck-tractor',
  'Exide Car Battery 100AH',
  0,
  5000,  -- MRP
  4500,  -- Selling price
  500,   -- Discount
  10.00, -- Discount percent
  4000,  -- B2B price
  1000,  -- B2B discount
  20.00, -- B2B discount percent
  '100AH',
  '24F',
  24,
  1,
  1,
  5000   -- DP
) ON CONFLICT (sku) DO NOTHING;

-- Sample Bike Battery
INSERT INTO products (
  sku, series, category, name, qty,
  mrp_price, selling_price, discount, discount_percent,
  b2b_selling_price, b2b_discount, b2b_discount_percent,
  ah_va, warranty, guarantee_period_months, order_index, product_type_id, dp
) VALUES (
  'EXIDE-BIKE-7AH',
  'EXIDE',
  'bike',
  'Exide Bike Battery 7AH',
  0,
  2000,  -- MRP
  1800,  -- Selling price
  200,   -- Discount
  10.00, -- Discount percent
  1600,  -- B2B price
  400,   -- B2B discount
  20.00, -- B2B discount percent
  '7AH',
  '12F',
  12,
  1,
  2,
  2000   -- DP
) ON CONFLICT (sku) DO NOTHING;

-- Sample UPS/Inverter Battery
INSERT INTO products (
  sku, series, category, name, qty,
  mrp_price, selling_price, discount, discount_percent,
  b2b_selling_price, b2b_discount, b2b_discount_percent,
  ah_va, warranty, guarantee_period_months, order_index, product_type_id, dp
) VALUES (
  'EXIDE-UPS-150AH',
  'EXIDE',
  'ups-inverter',
  'Exide UPS Battery 150AH',
  0,
  8000,  -- MRP
  7200,  -- Selling price
  800,   -- Discount
  10.00, -- Discount percent
  6400,  -- B2B price
  1600,  -- B2B discount
  20.00, -- B2B discount percent
  '150AH',
  '36F',
  36,
  1,
  3,
  8000   -- DP
) ON CONFLICT (sku) DO NOTHING;

-- Sample Water Products (from existing migration)
INSERT INTO products (
  sku, series, category, name, qty,
  mrp_price, selling_price, discount, discount_percent,
  b2b_selling_price, b2b_discount, b2b_discount_percent,
  ah_va, warranty, guarantee_period_months, order_index, product_type_id, dp
) VALUES (
  'EXIDE-DW-5L',
  'EXIDE',
  'water',
  'Exide Distilled Water 5L',
  0,
  153,   -- MRP
  130,   -- B2C selling price
  23,    -- Discount amount
  15.03, -- Discount percent
  100,   -- B2B selling price
  53,    -- B2B discount amount
  34.64, -- B2B discount percent
  '5L',
  NULL,
  0,
  1,
  4,
  153    -- DP
) ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (
  sku, series, category, name, qty,
  mrp_price, selling_price, discount, discount_percent,
  b2b_selling_price, b2b_discount, b2b_discount_percent,
  ah_va, warranty, guarantee_period_months, order_index, product_type_id, dp
) VALUES (
  'GEN-DW-5L',
  'GENERIC',
  'water',
  'Generic Distilled Water 5L',
  0,
  110,   -- MRP
  70,    -- B2C selling price
  40,    -- Discount amount
  36.36, -- Discount percent
  50,    -- B2B selling price
  60,    -- B2B discount amount
  54.55, -- B2B discount percent
  '5L',
  NULL,
  0,
  2,
  4,
  110    -- DP
) ON CONFLICT (sku) DO NOTHING;

-- ============================================================
-- 3. PURCHASE PRODUCT TYPES
-- ============================================================
INSERT INTO purchase_product_type (id, name) VALUES
  (1, 'Car/Truck/Tractor'),
  (2, 'Bike'),
  (3, 'UPS/Inverter'),
  (4, 'Water Products')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. SALES TYPES (Already inserted in base tables)
-- ============================================================
INSERT INTO sales_types (id, type_name, description) VALUES
  (1, 'retail', 'Retail customers (normal customers)'),
  (2, 'wholesale', 'Wholesale/B2B customers')
ON CONFLICT (id) DO NOTHING;

