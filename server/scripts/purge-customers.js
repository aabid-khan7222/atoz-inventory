/**
 * Purge all customer data, leaving only admin (role_id = 2) and super admin (role_id = 1).
 *
 * Usage:
 *   DATABASE_URL=... node server/scripts/purge-customers.js
 */
require('dotenv').config();
const db = require('../db');

async function purgeCustomers() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Delete customer profile rows first to satisfy FKs
    await client.query(`
      DELETE FROM customer_profiles
      WHERE user_id IN (
        SELECT id FROM users WHERE role_id NOT IN (1, 2)
      );
    `);

    // Delete all non-admin users
    const deleteUsers = await client.query(`
      DELETE FROM users
      WHERE role_id NOT IN (1, 2)
      RETURNING id, full_name, email, role_id;
    `);

    await client.query('COMMIT');

    console.log(`Purged ${deleteUsers.rowCount} users. Remaining users should be admin/super admin only.`);
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to purge customers:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

purgeCustomers();

