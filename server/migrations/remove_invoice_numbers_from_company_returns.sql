-- Remove invoice number fields from company_returns table
-- This migration removes returned_invoice_number and received_invoice_number columns

DO $$ 
BEGIN
  -- Drop returned_invoice_number column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'returned_invoice_number'
  ) THEN
    ALTER TABLE company_returns DROP COLUMN returned_invoice_number;
  END IF;

  -- Drop received_invoice_number column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_returns' AND column_name = 'received_invoice_number'
  ) THEN
    ALTER TABLE company_returns DROP COLUMN received_invoice_number;
  END IF;
END $$;

