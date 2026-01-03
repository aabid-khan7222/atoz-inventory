// Script to clear all stock from database
require('dotenv').config();
const db = require('../db');

async function clearAllStock() {
  const client = await db.pool.connect();
  
  try {
    console.log('Starting stock clearance...\n');
    
    await client.query('BEGIN');
    
    // Step 1: Set all product quantities to 0
    console.log('Setting all product quantities to 0...');
    const productsResult = await client.query(`
      UPDATE products 
      SET qty = 0, updated_at = CURRENT_TIMESTAMP
      WHERE qty > 0
      RETURNING id, name, sku, qty
    `);
    console.log(`✅ Updated ${productsResult.rows.length} products to 0 stock`);
    
    // Step 2: Delete all available stock from stock table
    console.log('\nDeleting all available stock from stock table...');
    const stockResult = await client.query(`
      DELETE FROM stock 
      WHERE status = 'available'
      RETURNING id, serial_number, product_id
    `);
    console.log(`✅ Deleted ${stockResult.rows.length} stock items`);
    
    // Step 3: Verify - Check remaining stock
    console.log('\nVerifying stock clearance...');
    const verifyProducts = await client.query(`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE qty > 0
    `);
    const verifyStock = await client.query(`
      SELECT COUNT(*) as count 
      FROM stock 
      WHERE status = 'available'
    `);
    
    console.log(`\n📊 Verification Results:`);
    console.log(`   Products with stock > 0: ${verifyProducts.rows[0].count}`);
    console.log(`   Available stock items: ${verifyStock.rows[0].count}`);
    
    await client.query('COMMIT');
    
    console.log('\n✅ Stock clearance completed successfully!');
    console.log('✅ All products now show 0 stock');
    console.log('✅ All available stock items removed');
    console.log('\n⚠️  Note: This action cannot be undone. Stock must be re-added manually.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error clearing stock:', error);
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
