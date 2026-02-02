-- Fix shop_id for Sahara & Anand Battery admin users
-- Run this if admin users have wrong shop_id (NULL or 1) - causing new customers to get wrong shop
-- A TO Z Battery (shop_id=1) admins are NOT touched

UPDATE users SET shop_id = 2
WHERE LOWER(email) IN ('superadmin@saharabattery.com', 'admin@saharabattery.com')
  AND (shop_id IS NULL OR shop_id != 2);

UPDATE users SET shop_id = 3
WHERE LOWER(email) IN ('superadmin@anandbattery.com', 'admin@anandbattery.com')
  AND (shop_id IS NULL OR shop_id != 3);
