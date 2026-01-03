// Check DP vs MRP values
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

async function checkDPvsMRP() {
  try {
    console.log('Checking DP vs MRP values for Automotive products...\n');
    
    // Get all products in car-truck-tractor category
    const { rows: products } = await db.query(`
      SELECT id, sku, name, dp, mrp_price, 
             (dp - mrp_price) as difference,
             CASE 
               WHEN mrp_price > 0 THEN ROUND(((dp - mrp_price) / mrp_price * 100)::numeric, 2)
               ELSE 0
             END as percent_diff
      FROM products 
      WHERE product_type_id = 1
      ORDER BY sku
    `);
    
    console.log(`Total products: ${products.length}\n`);
    
    const sameValues = products.filter(p => parseFloat(p.dp || 0) === parseFloat(p.mrp_price || 0));
    const dpHigher = products.filter(p => parseFloat(p.dp || 0) > parseFloat(p.mrp_price || 0));
    const dpLower = products.filter(p => parseFloat(p.dp || 0) < parseFloat(p.mrp_price || 0));
    
    console.log(`Products where DP = MRP: ${sameValues.length}`);
    console.log(`Products where DP > MRP: ${dpHigher.length}`);
    console.log(`Products where DP < MRP: ${dpLower.length}\n`);
    
    if (sameValues.length > 0) {
      console.log('Products where DP = MRP (should be different):');
      sameValues.slice(0, 10).forEach(p => {
        console.log(`  ${p.sku} - ${p.name}`);
        console.log(`    MRP: ₹${p.mrp_price}, DP: ₹${p.dp}`);
      });
      if (sameValues.length > 10) {
        console.log(`  ... and ${sameValues.length - 10} more`);
      }
    }
    
    if (dpHigher.length > 0) {
      console.log('\nProducts where DP > MRP (incorrect):');
      dpHigher.slice(0, 5).forEach(p => {
        console.log(`  ${p.sku} - ${p.name}`);
        console.log(`    MRP: ₹${p.mrp_price}, DP: ₹${p.dp} (Difference: +₹${p.difference})`);
      });
    }
    
    console.log('\n✅ Check completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkDPvsMRP();

