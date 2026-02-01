-- ============================================================
-- INSERT USERS FOR MULTI-SHOP (Sahara Battery & Anand Battery)
-- Run this AFTER multi_shop_migration.sql and after users table has shop_id.
--
-- IMPORTANT: Passwords are bcrypt hashed. You must generate hashes for:
--   Sahara@123
--   Anand@123
--
-- Use: node -e "const bcrypt=require('bcrypt'); bcrypt.hash('Sahara@123',10).then(h=>console.log(h))"
-- Use: node -e "const bcrypt=require('bcrypt'); bcrypt.hash('Anand@123',10).then(h=>console.log(h))"
--
-- Or run the companion script: node server/scripts/insert-multi-shop-users.js
-- ============================================================

-- Sahara Battery (shop_id = 2)
-- Super Admin: superadmin@saharabattery.com / Sahara@123
-- Admin: admin@saharabattery.com / Sahara@123

-- Anand Battery (shop_id = 3)
-- Super Admin: superadmin@anandbattery.com / Anand@123
-- Admin: admin@anandbattery.com / Anand@123

-- NOTE: Run the Node.js script instead - it hashes passwords correctly:
--   cd c:\Users\Aabid\OneDrive\Desktop\atoz-inventory
--   node server/scripts/insert-multi-shop-users.js
