// Script to drop old battery columns from sales_item table
// Run this with: node server/scripts/drop_old_battery_columns.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function dropOldBatteryColumns() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Dropping old battery columns from sales_item table...');
    
    // Drop columns one by one
    const columns = [
      'old_battery_brand',
      'old_battery_name',
      'old_battery_serial_number',
      'old_battery_ah_va',
      'old_battery_trade_in_value'
    ];
    
    for (const column of columns) {
      try {
        await client.query(`ALTER TABLE sales_item DROP COLUMN IF EXISTS ${column}`);
        console.log(`✓ Dropped column: ${column}`);
      } catch (err) {
        console.error(`✗ Error dropping column ${column}:`, err.message);
      }
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Successfully dropped all old battery columns!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error dropping columns:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

dropOldBatteryColumns();

