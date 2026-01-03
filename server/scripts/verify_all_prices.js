// Script to verify all prices are different for B2B and B2C
require('dotenv').config();
const db = require('../db');

async function verifyPrices() {
  try {
    console.log('='.repeat(80));
    console.log('VERIFICATION: B2B vs B2C PRICES FOR ALL INVERTER & BATTERY PRODUCTS');
    console.log('='.repeat(80));
    console.log('');

    const products = await db.query(`
      SELECT sku, name, series, mrp_price, selling_price, b2b_selling_price,
             ROUND(((mrp_price - selling_price) / mrp_price * 100), 2) as b2c_discount,
             ROUND(((mrp_price - b2b_selling_price) / mrp_price * 100), 2) as b2b_discount
      FROM products 
      WHERE product_type_id = 3
      ORDER BY series, sku
    `);

    let samePriceCount = 0;
    let differentPriceCount = 0;

    console.log('BATTERY PRODUCTS:\n');
    const batteries = products.rows.filter(p => ['INVATUBULAR', 'INVAMASTER', 'INVAMAGIC'].includes(p.series));
    batteries.forEach(p => {
      const same = parseFloat(p.selling_price) === parseFloat(p.b2b_selling_price);
      if (same) samePriceCount++;
      else differentPriceCount++;
      
      const status = same ? '❌ SAME!' : '✅ DIFFERENT';
      console.log(`${status} ${p.sku} (${p.series})`);
      console.log(`  MRP: ₹${parseFloat(p.mrp_price).toLocaleString('en-IN')}`);
      console.log(`  B2C: ₹${parseFloat(p.selling_price).toLocaleString('en-IN')} (${p.b2c_discount}% off)`);
      console.log(`  B2B: ₹${parseFloat(p.b2b_selling_price).toLocaleString('en-IN')} (${p.b2b_discount}% off)`);
      console.log('');
    });

    console.log('\nINVERTER PRODUCTS:\n');
    const inverters = products.rows.filter(p => ['GQP', 'STAR', 'MAGIC', 'HKVA'].includes(p.series));
    inverters.forEach(p => {
      const same = parseFloat(p.selling_price) === parseFloat(p.b2b_selling_price);
      if (same) samePriceCount++;
      else differentPriceCount++;
      
      const status = same ? '❌ SAME!' : '✅ DIFFERENT';
      console.log(`${status} ${p.sku} (${p.series})`);
      console.log(`  MRP: ₹${parseFloat(p.mrp_price).toLocaleString('en-IN')}`);
      console.log(`  B2C: ₹${parseFloat(p.selling_price).toLocaleString('en-IN')} (${p.b2c_discount}% off)`);
      console.log(`  B2B: ₹${parseFloat(p.b2b_selling_price).toLocaleString('en-IN')} (${p.b2b_discount}% off)`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('SUMMARY:');
    console.log(`  Products with DIFFERENT prices: ${differentPriceCount} ✅`);
    console.log(`  Products with SAME prices: ${samePriceCount} ${samePriceCount > 0 ? '❌' : '✅'}`);
    console.log(`  Total products: ${products.rows.length}`);
    console.log('='.repeat(80));

    if (samePriceCount > 0) {
      console.log('\n⚠️  WARNING: Some products have the same B2B and B2C prices!');
    } else {
      console.log('\n✅ SUCCESS: All products have different B2B and B2C prices!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyPrices();

