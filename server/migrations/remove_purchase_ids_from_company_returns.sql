-- ============================================================
-- REMOVE PURCHASE ID COLUMNS FROM COMPANY RETURNS
-- ============================================================
-- This script removes returned_purchase_id and received_purchase_id
-- columns from the company_returns table
-- ============================================================

-- Drop the columns
ALTER TABLE company_returns 
DROP COLUMN IF EXISTS returned_purchase_id,
DROP COLUMN IF EXISTS received_purchase_id;

-- Note: Any indexes or constraints on these columns will be automatically dropped

