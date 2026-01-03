require('dotenv').config();
const db = require('../db');

async function cleanup() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Delete all remaining customer_profiles (including admin ones)
    const result = await client.query('DELETE FROM customer_profiles');
    
    await client.query('COMMIT');
    console.log(`✓ Deleted ${result.rowCount} remaining customer_profile(s)`);
    
    // Verify
    const remaining = await client.query('SELECT COUNT(*) as count FROM customer_profiles');
    console.log(`Customer profiles remaining: ${remaining.rows[0].count}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await db.pool.end();
  }
}

cleanup();

