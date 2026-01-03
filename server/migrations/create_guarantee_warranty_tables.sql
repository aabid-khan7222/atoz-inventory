-- ============================================================
-- GUARANTEE & WARRANTY SYSTEM - Database Tables
-- ============================================================
-- This script creates tables for tracking guarantee and warranty replacements
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

-- Step 2: Create warranty_slabs table
-- This table stores warranty discount slabs (e.g., 10%, 20%, 45%, 50%)
CREATE TABLE IF NOT EXISTS warranty_slabs (
  id SERIAL PRIMARY KEY,
  slab_name VARCHAR(100) NOT NULL,
  discount_percentage DECIMAL(5, 2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  min_months INTEGER NOT NULL CHECK (min_months >= 0),
  max_months INTEGER CHECK (max_months IS NULL OR max_months >= min_months),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(slab_name)
);

-- Insert default warranty slabs
INSERT INTO warranty_slabs (slab_name, discount_percentage, min_months, max_months, description) VALUES
  ('Slab 1', 10.00, 0, 6, '10% discount for 0-6 months after guarantee'),
  ('Slab 2', 20.00, 7, 12, '20% discount for 7-12 months after guarantee'),
  ('Slab 3', 45.00, 13, 18, '45% discount for 13-18 months after guarantee'),
  ('Slab 4', 50.00, 19, NULL, '50% discount for 19+ months after guarantee')
ON CONFLICT (slab_name) DO NOTHING;

-- Step 3: Create battery_replacements table
-- This table tracks all battery replacements (both guarantee and warranty)
CREATE TABLE IF NOT EXISTS battery_replacements (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  original_sale_item_id INTEGER REFERENCES sales_item(id) ON DELETE SET NULL,
  original_serial_number VARCHAR(255) NOT NULL,
  original_purchase_date DATE NOT NULL,
  original_invoice_number VARCHAR(50),
  replacement_type VARCHAR(20) NOT NULL CHECK (replacement_type IN ('guarantee', 'warranty')),
  replacement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  new_serial_number VARCHAR(255) NOT NULL,
  new_sale_item_id INTEGER REFERENCES sales_item(id) ON DELETE SET NULL,
  new_invoice_number VARCHAR(50),
  warranty_slab_id INTEGER REFERENCES warranty_slabs(id) ON DELETE SET NULL,
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
COMMENT ON TABLE warranty_slabs IS 'Warranty discount slabs - defines discount percentages based on months after guarantee period';
COMMENT ON TABLE battery_replacements IS 'Tracks all battery replacements (guarantee and warranty) with serial number history';
COMMENT ON COLUMN battery_replacements.replacement_type IS 'Type of replacement: guarantee (free) or warranty (discounted)';
COMMENT ON COLUMN battery_replacements.original_purchase_date IS 'Original purchase date - used for guarantee period calculation (does not reset for guarantee)';
COMMENT ON COLUMN battery_replacements.replacement_date IS 'Date of replacement - used as new purchase date for warranty replacements';
COMMENT ON COLUMN battery_replacements.discount_percentage IS 'Discount percentage applied (0 for guarantee, >0 for warranty)';

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

-- Step 7: Create function to get warranty slab for a battery
CREATE OR REPLACE FUNCTION get_warranty_slab(
  p_purchase_date DATE,
  p_guarantee_months INTEGER
)
RETURNS TABLE (
  slab_id INTEGER,
  slab_name VARCHAR(100),
  discount_percentage DECIMAL(5, 2),
  months_after_guarantee INTEGER
) AS $$
DECLARE
  v_guarantee_end_date DATE;
  v_months_after_guarantee INTEGER;
BEGIN
  -- Calculate guarantee end date
  IF p_guarantee_months IS NULL OR p_guarantee_months = 0 THEN
    v_guarantee_end_date := p_purchase_date;
  ELSE
    v_guarantee_end_date := p_purchase_date + (p_guarantee_months || ' months')::INTERVAL;
  END IF;
  
  -- Calculate months after guarantee period ended
  v_months_after_guarantee := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_guarantee_end_date)) * 12 + 
                              EXTRACT(MONTH FROM AGE(CURRENT_DATE, v_guarantee_end_date));
  
  -- Find matching warranty slab
  RETURN QUERY
  SELECT 
    ws.id,
    ws.slab_name,
    ws.discount_percentage,
    GREATEST(0, FLOOR(v_months_after_guarantee))::INTEGER
  FROM warranty_slabs ws
  WHERE ws.is_active = true
    AND v_months_after_guarantee >= ws.min_months
    AND (ws.max_months IS NULL OR v_months_after_guarantee <= ws.max_months)
  ORDER BY ws.discount_percentage DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

