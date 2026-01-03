// Quick script to verify imported bike products
require('dotenv').config();
const db = require('../db');

async function verifyBikeProducts() {
  try {
    const result = await db.query(`
      SELECT series, COUNT(*) as count 
      FROM products 
      WHERE product_type_id = 2 
      GROUP BY series 
      ORDER BY series
    `);
    
    console.log('\n📊 Bike Products by Series:\n');
    result.rows.forEach(r => {
      console.log(`  ${r.series}: ${r.count} products`);
    });
    
    const sample = await db.query(`
      SELECT sku, name, series, ah_va, mrp_price, selling_price, b2b_selling_price, warranty
      FROM products 
      WHERE product_type_id = 2 
      ORDER BY ah_va::numeric
      LIMIT 5
    `);
    
    console.log('\n📋 Sample Bike Products:\n');
    sample.rows.forEach(p => {
      console.log(`  ${p.sku} - ${p.name}`);
      console.log(`    Capacity: ${p.ah_va}Ah | Warranty: ${p.warranty}`);
      console.log(`    MRP: ₹${p.mrp_price}`);
      console.log(`    Regular Price (12% off): ₹${p.selling_price}`);
      console.log(`    B2B Price (18% off): ₹${p.b2b_selling_price}`);
      console.log('');
    });
    
    const total = await db.query('SELECT COUNT(*) as count FROM products WHERE product_type_id = 2');
    console.log(`\n✅ Total bike products: ${total.rows[0].count}\n`);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

verifyBikeProducts();

