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

-- 6. purchase_items (by purchase_id; table may not have shop_id)
DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE shop_id IN (2, 3));

-- 7. purchases
DELETE FROM purchases WHERE shop_id IN (2, 3);

-- 8. notifications
DELETE FROM notifications WHERE shop_id IN (2, 3);

-- 9. charging_services
DELETE FROM charging_services WHERE shop_id IN (2, 3);

-- 10. service_requests
DELETE FROM service_requests WHERE shop_id IN (2, 3);

-- 11. daily_attendance (by employee_id for shop 2,3 employees)
DELETE FROM daily_attendance WHERE employee_id IN (SELECT id FROM employees WHERE shop_id IN (2, 3));

-- 12. employee_payments (by employee_id)
DELETE FROM employee_payments WHERE employee_id IN (SELECT id FROM employees WHERE shop_id IN (2, 3));

-- 13. employee_history (by employee_id)
DELETE FROM employee_history WHERE employee_id IN (SELECT id FROM employees WHERE shop_id IN (2, 3));

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
