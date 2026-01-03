// Script to clear all product prices (product-wise and series-wise)
// This removes old prices from all products
require('dotenv').config();
const db = require('../db');

async function clearAllPrices() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Clearing all product prices...\n');

    // Clear all prices for all products
    const result = await client.query(`
      UPDATE products 
      SET 
        mrp_price = 0,
        selling_price = 0,
        discount = 0,
        discount_percent = 0,
        updated_at = CURRENT_TIMESTAMP
    `);

    console.log(`✅ Cleared prices for ${result.rowCount} products\n`);
    console.log('📝 Note: All product prices have been reset to 0.');
    console.log('   You can now update prices using the price update scripts.\n');

    await client.query('COMMIT');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', err.message);
    console.error(err);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

clearAllPrices().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

