// Simple script to clear all stock
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function clearAllStock() {
  const client = await db.pool.connect();
  
  try {
    console.log('Starting stock clearance...\n');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, '../migrations/clear_all_stock.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query('BEGIN');
    
    // Execute SQL
    console.log('Setting all product quantities to 0...');
    await client.query('UPDATE products SET qty = 0, updated_at = CURRENT_TIMESTAMP WHERE qty > 0');
    
    console.log('Deleting all available stock items...');
    await client.query('DELETE FROM stock WHERE status = \'available\'');
    
    // Verify
    const productsCheck = await client.query('SELECT COUNT(*) as count FROM products WHERE qty > 0');
    const stockCheck = await client.query('SELECT COUNT(*) as count FROM stock WHERE status = \'available\'');
    
    await client.query('COMMIT');
    
    console.log('\n✅ Stock clearance completed!');
    console.log(`   Products with stock > 0: ${productsCheck.rows[0].count}`);
    console.log(`   Available stock items: ${stockCheck.rows[0].count}`);
    console.log('\n✅ All stock is now zero everywhere!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

clearAllStock().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

