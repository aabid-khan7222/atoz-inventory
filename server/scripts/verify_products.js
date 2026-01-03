// Quick script to verify imported products
require('dotenv').config();
const db = require('../db');

async function verifyProducts() {
  try {
    const result = await db.query(`
      SELECT series, COUNT(*) as count 
      FROM products 
      WHERE product_type_id = 1 
      GROUP BY series 
      ORDER BY series
    `);
    
    console.log('\n📊 Products by Series:\n');
    result.rows.forEach(r => {
      console.log(`  ${r.series}: ${r.count} products`);
    });
    
    const sample = await db.query(`
      SELECT sku, name, series, mrp_price, selling_price, b2b_selling_price 
      FROM products 
      WHERE product_type_id = 1 
      LIMIT 3
    `);
    
    console.log('\n📋 Sample Products:\n');
    sample.rows.forEach(p => {
      console.log(`  ${p.sku} - ${p.name}`);
      console.log(`    MRP: ₹${p.mrp_price}`);
      console.log(`    Regular Price (12% off): ₹${p.selling_price}`);
      console.log(`    B2B Price (18% off): ₹${p.b2b_selling_price}`);
      console.log('');
    });
    
    const total = await db.query('SELECT COUNT(*) as count FROM products WHERE product_type_id = 1');
    console.log(`\n✅ Total products: ${total.rows[0].count}\n`);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

verifyProducts();

