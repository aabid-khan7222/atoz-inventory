#!/usr/bin/env node
/**
 * Fix passwords for Sahara Battery & Anand Battery admin/super-admin users.
 * Run this if login fails with "Invalid email or password" for these users.
 *
 * Local:  node server/scripts/fix-sahara-anand-passwords.js  (uses .env DATABASE_URL_LOCAL)
 * Render: In Dashboard → Backend service → Shell, run:
 *         NODE_ENV=production node server/scripts/fix-sahara-anand-passwords.js
 *         (uses DATABASE_URL from Render env)
 */

require("dotenv").config();
const bcrypt = require("bcrypt");
const db = require("../db");

const USERS_TO_FIX = [
  { email: "superadmin@saharabattery.com", password: "Sahara@123", shop_id: 2 },
  { email: "admin@saharabattery.com", password: "Sahara@123", shop_id: 2 },
  { email: "superadmin@anandbattery.com", password: "Anand@123", shop_id: 3 },
  { email: "admin@anandbattery.com", password: "Anand@123", shop_id: 3 },
];

async function main() {
  console.log("Fixing Sahara & Anand user passwords...\n");

  for (const u of USERS_TO_FIX) {
    try {
      const email = u.email.toLowerCase();
      const existing = await db.query(
        "SELECT id, email, shop_id FROM users WHERE LOWER(email) = $1",
        [email]
      );

      if (existing.rows.length === 0) {
        console.log(`  ❌ ${u.email} - User NOT found in database. Run: node server/scripts/insert-multi-shop-users.js`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(u.password, 10);

      await db.query(
        "UPDATE users SET password = $1 WHERE LOWER(email) = $2",
        [hashedPassword, email]
      );

      console.log(`  ✅ Fixed: ${u.email} (shop_id=${u.shop_id})`);
    } catch (err) {
      console.error(`  ❌ ${u.email}:`, err.message);
    }
  }

  console.log("\nDone. Try logging in again with:");
  console.log("  Sahara: admin@saharabattery.com / Sahara@123");
  console.log("  Anand:  admin@anandbattery.com / Anand@123");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
