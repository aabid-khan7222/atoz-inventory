#!/usr/bin/env node
/**
 * Insert users for Sahara Battery (shop_id=2) and Anand Battery (shop_id=3).
 * Run AFTER multi_shop_migration.sql
 *
 * Usage: node server/scripts/insert-multi-shop-users.js
 */

require("dotenv").config();
const bcrypt = require("bcrypt");
const db = require("../db");

const USERS_TO_INSERT = [
  // Sahara Battery - shop_id = 2
  { full_name: "Sahara Super Admin", email: "superadmin@saharabattery.com", password: "Sahara@123", role_id: 1, shop_id: 2 },
  { full_name: "Sahara Admin", email: "admin@saharabattery.com", password: "Sahara@123", role_id: 2, shop_id: 2 },
  // Anand Battery - shop_id = 3
  { full_name: "Anand Super Admin", email: "superadmin@anandbattery.com", password: "Anand@123", role_id: 1, shop_id: 3 },
  { full_name: "Anand Admin", email: "admin@anandbattery.com", password: "Anand@123", role_id: 2, shop_id: 3 },
];

async function main() {
  console.log("Inserting multi-shop users...\n");

  for (const u of USERS_TO_INSERT) {
    try {
      const existing = await db.query(
        "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1",
        [u.email.toLowerCase()]
      );
      if (existing.rows.length > 0) {
        console.log(`  ⏭️  ${u.email} already exists, skipping`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(u.password, 10);

      await db.query(
        `INSERT INTO users (full_name, email, password, role_id, is_active, shop_id)
         VALUES ($1, $2, $3, $4, true, $5)`,
        [u.full_name, u.email.toLowerCase(), hashedPassword, u.role_id, u.shop_id]
      );
      console.log(`  ✅ Inserted: ${u.email} (shop_id=${u.shop_id}, role_id=${u.role_id})`);
    } catch (err) {
      if (err.code === "42703") {
        console.error(`  ❌ ${u.email}: users table may not have shop_id column. Run multi_shop_migration.sql first.`);
      } else {
        console.error(`  ❌ ${u.email}:`, err.message);
      }
    }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
