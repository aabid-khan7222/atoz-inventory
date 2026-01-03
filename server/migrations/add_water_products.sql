-- Add new product_type for water products
INSERT INTO product_type (id, name) VALUES (4, 'water_products')
ON CONFLICT (id) DO NOTHING;

-- Add water products to purchase_product_type table (for tracking purchases)
INSERT INTO purchase_product_type (id, name) VALUES (4, 'Water Products')
ON CONFLICT (id) DO NOTHING;

-- Add Exide Distilled Water (5L)
-- Purchase: ₹95, MRP: ₹153, B2B: ₹100, B2C: ₹130
INSERT INTO products (
  sku, series, category, name, qty,
  mrp_price, selling_price, discount, discount_percent,
  b2b_selling_price, b2b_discount, b2b_discount_percent,
  ah_va, warranty, guarantee_period_months, order_index, product_type_id
) VALUES (
  'EXIDE-DW-5L',
  'EXIDE',
  'water',
  'Exide Distilled Water 5L',
  0,
  153,  -- MRP
  130,  -- B2C selling price
  23,   -- Discount amount (153 - 130)
  15.03, -- Discount percent (23/153 * 100)
  100,  -- B2B selling price
  53,   -- B2B discount amount (153 - 100)
  34.64, -- B2B discount percent (53/153 * 100)
  '5L',
  NULL,
  0,
  1,
  4
) ON CONFLICT (sku) DO NOTHING;

-- Add Generic Distilled Water (5L)
-- Purchase: ₹40, MRP: ₹110, B2B: ₹50, B2C: ₹70
INSERT INTO products (
  sku, series, category, name, qty,
  mrp_price, selling_price, discount, discount_percent,
  b2b_selling_price, b2b_discount, b2b_discount_percent,
  ah_va, warranty, guarantee_period_months, order_index, product_type_id
) VALUES (
  'GEN-DW-5L',
  'GENERIC',
  'water',
  'Generic Distilled Water 5L',
  0,
  110,  -- MRP
  70,   -- B2C selling price
  40,   -- Discount amount (110 - 70)
  36.36, -- Discount percent (40/110 * 100)
  50,   -- B2B selling price
  60,   -- B2B discount amount (110 - 50)
  54.55, -- B2B discount percent (60/110 * 100)
  '5L',
  NULL,
  0,
  2,
  4
) ON CONFLICT (sku) DO NOTHING;

-- Add Generic Distilled Water (1L)
-- Purchase: ₹8, MRP: ₹25, B2B: ₹15, B2C: ₹20
INSERT INTO products (
  sku, series, category, name, qty,
  mrp_price, selling_price, discount, discount_percent,
  b2b_selling_price, b2b_discount, b2b_discount_percent,
  ah_va, warranty, guarantee_period_months, order_index, product_type_id
) VALUES (
  'GEN-DW-1L',
  'GENERIC',
  'water',
  'Generic Distilled Water 1L',
  0,
  25,   -- MRP
  20,   -- B2C selling price
  5,    -- Discount amount (25 - 20)
  20.00, -- Discount percent (5/25 * 100)
  15,   -- B2B selling price
  10,   -- B2B discount amount (25 - 15)
  40.00, -- B2B discount percent (10/25 * 100)
  '1L',
  NULL,
  0,
  3,
  4
) ON CONFLICT (sku) DO NOTHING;

-- Add Generic Battery Acid (1L)
-- Purchase: ₹20, MRP: ₹40, B2B: ₹30, B2C: ₹40
INSERT INTO products (
  sku, series, category, name, qty,
  mrp_price, selling_price, discount, discount_percent,
  b2b_selling_price, b2b_discount, b2b_discount_percent,
  ah_va, warranty, guarantee_period_months, order_index, product_type_id
) VALUES (
  'GEN-BA-1L',
  'GENERIC',
  'water',
  'Generic Battery Acid 1L',
  0,
  40,   -- MRP
  40,   -- B2C selling price (no discount)
  0,    -- Discount amount
  0.00, -- Discount percent
  30,   -- B2B selling price
  10,   -- B2B discount amount (40 - 30)
  25.00, -- B2B discount percent (10/40 * 100)
  '1L',
  NULL,
  0,
  4,
  4
) ON CONFLICT (sku) DO NOTHING;

