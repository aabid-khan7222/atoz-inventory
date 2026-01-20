-- ============================================================
-- GUARANTEE SYSTEM - Database Tables
-- ============================================================
-- This script creates tables for tracking guarantee replacements only
-- Warranty functionality has been removed
-- ============================================================

-- Step 1: Add guarantee_period_months column to products table
-- This stores the number of months a product is under guarantee
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'guarantee_period_months'
  ) THEN
    ALTER TABLE products ADD COLUMN guarantee_period_months INTEGER DEFAULT 0;
    COMMENT ON COLUMN products.guarantee_period_months IS 'Number of months the product is under guarantee (0 = no guarantee)';
  END IF;
END $$;

-- Step 2: Warranty slabs removed - only guarantee functionality is supported

-- Step 3: Create battery_replacements table
-- This table tracks all battery replacements (guarantee only)
-- First, check if table exists with old schema and drop it if needed
DO $$ 
BEGIN
  -- Check if battery_replacements table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'battery_replacements'
  ) THEN
    -- Check if it has the old schema (has replacement_serial_number instead of new_serial_number)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'battery_replacements' AND column_name = 'replacement_serial_number'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'battery_replacements' AND column_name = 'new_serial_number'
    ) THEN
      -- Old schema detected, drop the table
      DROP TABLE IF EXISTS battery_replacements CASCADE;
      RAISE NOTICE 'Dropped old battery_replacements table with incompatible schema';
    END IF;
  END IF;
END $$;

-- Create battery_replacements table with correct schema
CREATE TABLE IF NOT EXISTS battery_replacements (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  original_sale_item_id INTEGER REFERENCES sales_item(id) ON DELETE SET NULL,
  original_serial_number VARCHAR(255) NOT NULL,
  original_purchase_date DATE NOT NULL,
  original_invoice_number VARCHAR(50),
  replacement_type VARCHAR(20) NOT NULL CHECK (replacement_type = 'guarantee'),
  replacement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  new_serial_number VARCHAR(255) NOT NULL,
  new_sale_item_id INTEGER REFERENCES sales_item(id) ON DELETE SET NULL,
  new_invoice_number VARCHAR(50),
  discount_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_battery_replacements_customer_id ON battery_replacements(customer_id);
CREATE INDEX IF NOT EXISTS idx_battery_replacements_original_serial ON battery_replacements(original_serial_number);
CREATE INDEX IF NOT EXISTS idx_battery_replacements_new_serial ON battery_replacements(new_serial_number);
CREATE INDEX IF NOT EXISTS idx_battery_replacements_original_sale_item ON battery_replacements(original_sale_item_id);
CREATE INDEX IF NOT EXISTS idx_battery_replacements_new_sale_item ON battery_replacements(new_sale_item_id);
CREATE INDEX IF NOT EXISTS idx_battery_replacements_replacement_type ON battery_replacements(replacement_type);
CREATE INDEX IF NOT EXISTS idx_battery_replacements_replacement_date ON battery_replacements(replacement_date);
CREATE INDEX IF NOT EXISTS idx_battery_replacements_original_purchase_date ON battery_replacements(original_purchase_date);

-- Step 5: Add comments for documentation
COMMENT ON TABLE battery_replacements IS 'Tracks all battery replacements (guarantee only) with serial number history';
COMMENT ON COLUMN battery_replacements.replacement_type IS 'Type of replacement: guarantee (free)';
COMMENT ON COLUMN battery_replacements.original_purchase_date IS 'Original purchase date - used for guarantee period calculation (does not reset for guarantee)';
COMMENT ON COLUMN battery_replacements.replacement_date IS 'Date of replacement';
COMMENT ON COLUMN battery_replacements.discount_percentage IS 'Discount percentage applied (always 0 for guarantee replacements)';

-- Step 6: Create function to check if battery is under guarantee
CREATE OR REPLACE FUNCTION is_under_guarantee(
  p_purchase_date DATE,
  p_guarantee_months INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_guarantee_months IS NULL OR p_guarantee_months = 0 THEN
    RETURN FALSE;
  END IF;
  
  RETURN (CURRENT_DATE - p_purchase_date) <= (p_guarantee_months * INTERVAL '1 month');
END;
$$ LANGUAGE plpgsql;

-- Step 7: Warranty slab function removed - only guarantee functionality is supported

