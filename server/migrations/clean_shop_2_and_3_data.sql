-- ============================================================
-- CLEAN ALL DATA FOR SHOP 2 (Sahara) AND SHOP 3 (Anand) ONLY
-- A TO Z BATTERY (shop_id = 1) is NOT touched.
--
-- Run this ONCE on production DB so Sahara and Anand start with
-- empty data: no products, sales, purchases, services, etc.
-- Admin users for shop 2 and 3 are KEPT (for login).
--
-- Usage: Run in Render PostgreSQL shell or psql against production.
-- ============================================================

-- Delete in order (child tables / dependent rows first)

-- 1. stock_history (references stock, products)
DELETE FROM stock_history WHERE shop_id IN (2, 3);

-- 2. stock (references products)
DELETE FROM stock WHERE shop_id IN (2, 3);

-- 3. sales_item (references products, users)
DELETE FROM sales_item WHERE shop_id IN (2, 3);

-- 4. battery_replacements
DELETE FROM battery_replacements WHERE shop_id IN (2, 3);

-- 5. company_returns
DELETE FROM company_returns WHERE shop_id IN (2, 3);

-- 6. purchase_items (table/column may not exist in all DBs; skip if missing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_items') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_items' AND column_name = 'purchase_id') THEN
      DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE shop_id IN (2, 3));
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_items' AND column_name = 'purchases_id') THEN
      DELETE FROM purchase_items WHERE purchases_id IN (SELECT id FROM purchases WHERE shop_id IN (2, 3));
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped purchase_items: %', SQLERRM;
END $$;

-- 7. purchases
DELETE FROM purchases WHERE shop_id IN (2, 3);

-- 8. notifications
DELETE FROM notifications WHERE shop_id IN (2, 3);

-- 9. charging_services
DELETE FROM charging_services WHERE shop_id IN (2, 3);

-- 10. service_requests
DELETE FROM service_requests WHERE shop_id IN (2, 3);

-- 11. daily_attendance (use actual FK column name from schema)
DO $$
DECLARE
  col TEXT;
  emp_pk TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_attendance') THEN
    SELECT constraint_name INTO emp_pk FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'employees' AND constraint_type = 'PRIMARY KEY' LIMIT 1;
    SELECT kcu.column_name INTO col FROM information_schema.key_column_usage kcu
    JOIN information_schema.referential_constraints rc ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
    WHERE kcu.table_schema = 'public' AND kcu.table_name = 'daily_attendance' AND rc.unique_constraint_name = emp_pk
    LIMIT 1;
    IF col IS NOT NULL THEN
      EXECUTE format('DELETE FROM daily_attendance WHERE %I IN (SELECT id FROM employees WHERE shop_id IN (2, 3))', col);
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped daily_attendance: %', SQLERRM;
END $$;

-- 12. employee_payments
DO $$
DECLARE
  col TEXT;
  emp_pk TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_payments') THEN
    SELECT constraint_name INTO emp_pk FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'employees' AND constraint_type = 'PRIMARY KEY' LIMIT 1;
    SELECT kcu.column_name INTO col FROM information_schema.key_column_usage kcu
    JOIN information_schema.referential_constraints rc ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
    WHERE kcu.table_schema = 'public' AND kcu.table_name = 'employee_payments' AND rc.unique_constraint_name = emp_pk
    LIMIT 1;
    IF col IS NOT NULL THEN
      EXECUTE format('DELETE FROM employee_payments WHERE %I IN (SELECT id FROM employees WHERE shop_id IN (2, 3))', col);
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped employee_payments: %', SQLERRM;
END $$;

-- 13. employee_history
DO $$
DECLARE
  col TEXT;
  emp_pk TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_history') THEN
    SELECT constraint_name INTO emp_pk FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'employees' AND constraint_type = 'PRIMARY KEY' LIMIT 1;
    SELECT kcu.column_name INTO col FROM information_schema.key_column_usage kcu
    JOIN information_schema.referential_constraints rc ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.table_schema
    WHERE kcu.table_schema = 'public' AND kcu.table_name = 'employee_history' AND rc.unique_constraint_name = emp_pk
    LIMIT 1;
    IF col IS NOT NULL THEN
      EXECUTE format('DELETE FROM employee_history WHERE %I IN (SELECT id FROM employees WHERE shop_id IN (2, 3))', col);
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped employee_history: %', SQLERRM;
END $$;

-- 14. employees
DELETE FROM employees WHERE shop_id IN (2, 3);

-- 15. commission_agents
DELETE FROM commission_agents WHERE shop_id IN (2, 3);

-- 16. products
DELETE FROM products WHERE shop_id IN (2, 3);

-- 17. shop_settings (rows for shop 2 and 3)
DELETE FROM shop_settings WHERE shop_id IN (2, 3);

-- DO NOT delete from users - Sahara and Anand admin/superadmin must remain for login.

-- Optional: remove customer_profiles for users that belong to shop 2 or 3 (non-admin customers only)
-- Uncomment if you want to remove any customer signups for Sahara/Anand:
-- DELETE FROM customer_profiles WHERE user_id IN (SELECT id FROM users WHERE shop_id IN (2, 3) AND role_id > 2);
