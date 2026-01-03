// Verify all stock is cleared
require('dotenv').config();
const db = require('../db');

async function verifyStock() {
  try {
    console.log('Verifying stock clearance...\n');
    
    // Check products with stock > 0
    const productsWithStock = await db.query(`
      SELECT id, sku, name, qty 
      FROM products 
      WHERE qty > 0
      ORDER BY qty DESC
      LIMIT 10
    `);
    
    // Check available stock items
    const availableStock = await db.query(`
      SELECT COUNT(*) as count 
      FROM stock 
      WHERE status = 'available'
    `);
    
    // Check specific product ML55B24L
    const mlProduct = await db.query(`
      SELECT id, sku, name, qty 
      FROM products 
      WHERE sku ILIKE '%ML55B24L%' OR name ILIKE '%ML55B24L%'
    `);
    
    // Check stock items for ML55B24L
    const mlStock = await db.query(`
      SELECT COUNT(*) as count, s.*
      FROM stock s
      JOIN products p ON s.product_id = p.id
      WHERE s.status = 'available' 
      AND (p.sku ILIKE '%ML55B24L%' OR p.name ILIKE '%ML55B24L%')
      GROUP BY s.id
    `);
    
    console.log('📊 Stock Verification Results:\n');
    console.log(`Products with stock > 0: ${productsWithStock.rows.length}`);
    if (productsWithStock.rows.length > 0) {
      console.log('Products still showing stock:');
      productsWithStock.rows.forEach(p => {
        console.log(`  - ${p.sku} (${p.name}): ${p.qty} units`);
      });
    }
    
    console.log(`\nAvailable stock items in stock table: ${availableStock.rows[0].count}`);
    
    console.log(`\nProduct ML55B24L:`);
    if (mlProduct.rows.length > 0) {
      mlProduct.rows.forEach(p => {
        console.log(`  SKU: ${p.sku}, Name: ${p.name}, Qty: ${p.qty}`);
      });
    } else {
      console.log('  Not found');
    }
    
    console.log(`\nStock items for ML55B24L: ${mlStock.rows.length}`);
    
    if (productsWithStock.rows.length === 0 && availableStock.rows[0].count === '0') {
      console.log('\n✅ All stock is cleared! Everything shows zero.');
    } else {
      console.log('\n⚠️  Some stock still exists. Clearing again...');
      
      // Clear again
      await db.query('UPDATE products SET qty = 0 WHERE qty > 0');
      await db.query('DELETE FROM stock WHERE status = \'available\'');
      console.log('✅ Cleared again. Please refresh your browser.');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

verifyStock();

