-- Fix NULL shop_id in customer_profiles (Sahara/Anand customers)
-- Run this to backfill shop_id from users table for existing rows
-- A TO Z Battery (shop_id=1) customers are unaffected

UPDATE customer_profiles cp
SET shop_id = u.shop_id
FROM users u
WHERE cp.user_id = u.id
  AND (cp.shop_id IS NULL OR cp.shop_id != u.shop_id);
