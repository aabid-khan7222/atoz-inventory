-- Create sales_types lookup table with two IDs:
-- ID 1: Retail customers (normal customers)
-- ID 2: Wholesale/B2B customers

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

-- Update sales_id table to reference sales_types
ALTER TABLE sales_id 
  ADD COLUMN IF NOT EXISTS sales_type_id INTEGER REFERENCES sales_types(id);

-- Update sales_item table to reference sales_types
ALTER TABLE sales_item 
  ADD COLUMN IF NOT EXISTS sales_type_id INTEGER REFERENCES sales_types(id);

-- Migrate existing data: set sales_type_id based on sales_type column
UPDATE sales_id 
SET sales_type_id = CASE 
  WHEN sales_type = 'retail' THEN 1 
  WHEN sales_type = 'wholesale' THEN 2 
  ELSE 1 
END
WHERE sales_type_id IS NULL;

UPDATE sales_item 
SET sales_type_id = CASE 
  WHEN sales_type = 'retail' THEN 1 
  WHEN sales_type = 'wholesale' THEN 2 
  ELSE 1 
END
WHERE sales_type_id IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sales_id_sales_type_id ON sales_id(sales_type_id);
CREATE INDEX IF NOT EXISTS idx_sales_item_sales_type_id ON sales_item(sales_type_id);

COMMENT ON TABLE sales_types IS 'Lookup table for sales types: 1=Retail, 2=Wholesale/B2B';
COMMENT ON COLUMN sales_id.sales_type_id IS 'Reference to sales_types table (1=retail, 2=wholesale)';
COMMENT ON COLUMN sales_item.sales_type_id IS 'Reference to sales_types table (1=retail, 2=wholesale)';

