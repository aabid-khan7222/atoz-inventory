// Script to check if B2B and B2C prices are different
require('dotenv').config();
const db = require('../db');

async function checkPrices() {
  try {
    // Check battery products
    console.log('=== BATTERY PRODUCTS (INVATUBULAR, INVAMASTER, INVAMAGIC) ===\n');
    const batteryResult = await db.query(`
      SELECT sku, name, mrp_price, selling_price, b2b_selling_price, 
             ROUND((selling_price / mrp_price * 100), 2) as b2c_discount_pct,
             ROUND((b2b_selling_price / mrp_price * 100), 2) as b2b_discount_pct
      FROM products 
      WHERE product_type_id = 3 AND series IN ('INVATUBULAR', 'INVAMASTER', 'INVAMAGIC')
      ORDER BY id LIMIT 5
    `);
    
    batteryResult.rows.forEach(r => {
      console.log(`SKU: ${r.sku}`);
      console.log(`  MRP: ₹${parseFloat(r.mrp_price).toLocaleString('en-IN')}`);
      console.log(`  B2C Price: ₹${parseFloat(r.selling_price).toLocaleString('en-IN')} (${100 - parseFloat(r.b2c_discount_pct)}% discount)`);
      console.log(`  B2B Price: ₹${parseFloat(r.b2b_selling_price).toLocaleString('en-IN')} (${100 - parseFloat(r.b2b_discount_pct)}% discount)`);
      console.log(`  Same Price? ${r.selling_price === r.b2b_selling_price ? '❌ YES - ERROR!' : '✅ NO - CORRECT'}\n`);
    });

    // Check inverter products
    console.log('\n=== INVERTER PRODUCTS (GQP, STAR, MAGIC, HKVA) ===\n');
    const inverterResult = await db.query(`
      SELECT sku, name, mrp_price, selling_price, b2b_selling_price,
             ROUND((selling_price / mrp_price * 100), 2) as b2c_discount_pct,
             ROUND((b2b_selling_price / mrp_price * 100), 2) as b2b_discount_pct
      FROM products 
      WHERE product_type_id = 3 AND series IN ('GQP', 'STAR', 'MAGIC', 'HKVA')
      ORDER BY id LIMIT 5
    `);
    
    inverterResult.rows.forEach(r => {
      console.log(`SKU: ${r.sku}`);
      console.log(`  MRP: ₹${parseFloat(r.mrp_price).toLocaleString('en-IN')}`);
      console.log(`  B2C Price: ₹${parseFloat(r.selling_price).toLocaleString('en-IN')} (${100 - parseFloat(r.b2c_discount_pct)}% discount)`);
      console.log(`  B2B Price: ₹${parseFloat(r.b2b_selling_price).toLocaleString('en-IN')} (${100 - parseFloat(r.b2b_discount_pct)}% discount)`);
      console.log(`  Same Price? ${r.selling_price === r.b2b_selling_price ? '❌ YES - ERROR!' : '✅ NO - CORRECT'}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPrices();

