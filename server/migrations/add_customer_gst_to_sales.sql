-- Add optional customer GST fields to sales tables
ALTER TABLE sales_id
  ADD COLUMN IF NOT EXISTS customer_business_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_gst_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS customer_business_address TEXT;

ALTER TABLE sales_item
  ADD COLUMN IF NOT EXISTS customer_business_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_gst_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS customer_business_address TEXT;

