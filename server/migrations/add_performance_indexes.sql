-- ============================================================
-- PERFORMANCE OPTIMIZATION - Add Missing Indexes
-- ============================================================
-- This migration adds indexes to improve query performance
-- Run this on production to speed up all queries
-- ============================================================

BEGIN;

-- Indexes for purchases table (most critical for performance)
CREATE INDEX IF NOT EXISTS idx_purchases_product_type_id_date ON purchases(product_type_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_name_lower ON purchases(LOWER(supplier_name));
CREATE INDEX IF NOT EXISTS idx_purchases_product_sku_lower ON purchases(LOWER(product_sku));
CREATE INDEX IF NOT EXISTS idx_purchases_serial_number_lower ON purchases(LOWER(serial_number));
CREATE INDEX IF NOT EXISTS idx_purchases_product_series_lower ON purchases(LOWER(product_series));
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_number_lower ON purchases(LOWER(purchase_number));
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_purchases_type_date_supplier ON purchases(product_type_id, purchase_date, supplier_name);

-- Indexes for stock table
CREATE INDEX IF NOT EXISTS idx_stock_product_serial_status ON stock(product_id, serial_number, status);
CREATE INDEX IF NOT EXISTS idx_stock_status_available ON stock(status) WHERE status = 'available';

-- Indexes for sales_item table (if not already exists)
CREATE INDEX IF NOT EXISTS idx_sales_item_created_at_desc ON sales_item(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_item_purchase_date_desc ON sales_item(purchase_date DESC);

-- Indexes for products table
CREATE INDEX IF NOT EXISTS idx_products_type_category ON products(product_type_id, category);

-- Indexes for service_requests (dashboard overview, recent-transactions, services)
CREATE INDEX IF NOT EXISTS idx_service_requests_updated_at ON service_requests(updated_at);
CREATE INDEX IF NOT EXISTS idx_service_requests_created_at ON service_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status) WHERE status IN ('pending', 'in_progress');

-- Indexes for notifications (scheduled task, notification panel)
CREATE INDEX IF NOT EXISTS idx_notifications_title_created ON notifications(title, created_at);

-- Index for battery_replacements batch lookup (expiring guarantees task)
CREATE INDEX IF NOT EXISTS idx_battery_replacements_original_serial ON battery_replacements(original_serial_number);

COMMIT;

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE tablename IN ('purchases', 'stock', 'sales_item', 'products', 'service_requests', 'notifications', 'battery_replacements')
ORDER BY tablename, indexname;

