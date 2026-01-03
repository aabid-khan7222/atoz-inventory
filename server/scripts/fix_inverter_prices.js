// Script to fix and verify B2B and B2C prices for inverter products
require('dotenv').config();
const db = require('../db');

async function fixPrices() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Checking and fixing prices for all inverter & battery products...\n');

    // Get all inverter products (product_type_id = 3)
    const products = await client.query(`
      SELECT id, sku, name, series, mrp_price, selling_price, b2b_selling_price
      FROM products 
      WHERE product_type_id = 3
      ORDER BY series, id
    `);

    let fixed = 0;
    let correct = 0;
    let errors = [];

    for (const product of products.rows) {
      const mrp = parseFloat(product.mrp_price);
      let expectedB2C, expectedB2B, discountPercent;
      
      // Determine pricing based on series
      if (['INVATUBULAR', 'INVAMASTER', 'INVAMAGIC'].includes(product.series)) {
        // Batteries: B2C = -32%, B2B = -37%
        expectedB2C = Math.round(mrp * 0.68 * 100) / 100;
        expectedB2B = Math.round(mrp * 0.63 * 100) / 100;
        discountPercent = 32.00;
      } else if (['GQP', 'STAR', 'MAGIC', 'HKVA'].includes(product.series)) {
        // Inverters: B2C = -34%, B2B = -40%
        expectedB2C = Math.round(mrp * 0.66 * 100) / 100;
        expectedB2B = Math.round(mrp * 0.60 * 100) / 100;
        discountPercent = 34.00;
      } else {
        console.log(`⚠ Unknown series: ${product.series} for SKU: ${product.sku}`);
        continue;
      }

      const currentB2C = parseFloat(product.selling_price);
      const currentB2B = parseFloat(product.b2b_selling_price);

      // Check if prices need to be fixed
      const b2cDiff = Math.abs(currentB2C - expectedB2C);
      const b2bDiff = Math.abs(currentB2B - expectedB2B);
      const tolerance = 0.01; // Allow small rounding differences

      if (b2cDiff > tolerance || b2bDiff > tolerance || !product.b2b_selling_price) {
        const discount = mrp - expectedB2C;
        
        await client.query(`
          UPDATE products SET
            selling_price = $1,
            b2b_selling_price = $2,
            discount = $3,
            discount_percent = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `, [expectedB2C, expectedB2B, discount, discountPercent, product.id]);

        fixed++;
        console.log(`✓ Fixed: ${product.sku}`);
        console.log(`  MRP: ₹${mrp.toLocaleString('en-IN')}`);
        console.log(`  B2C: ₹${currentB2C.toLocaleString('en-IN')} → ₹${expectedB2C.toLocaleString('en-IN')}`);
        console.log(`  B2B: ₹${currentB2B.toLocaleString('en-IN') || 'NULL'} → ₹${expectedB2B.toLocaleString('en-IN')}`);
        console.log('');
      } else {
        correct++;
      }
    }

    await client.query('COMMIT');
    
    console.log('='.repeat(60));
    console.log('✅ Price verification and fix completed!');
    console.log('='.repeat(60));
    console.log(`Products with correct prices: ${correct}`);
    console.log(`Products fixed: ${fixed}`);
    console.log(`Total products checked: ${products.rows.length}`);
    console.log('\n💡 Pricing Summary:');
    console.log('  Batteries (INVATUBULAR, INVAMASTER, INVAMAGIC):');
    console.log('    - B2C: MRP - 32%');
    console.log('    - B2B: MRP - 37%');
    console.log('  Inverters (GQP, STAR, MAGIC, HKVA):');
    console.log('    - B2C: MRP - 34%');
    console.log('    - B2B: MRP - 40%');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

fixPrices().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

