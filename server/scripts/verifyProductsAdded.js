// Script to verify products were added successfully
require('dotenv').config();
const db = require('../db');

async function verify() {
  try {
    console.log('Verifying products in database...\n');
    
    // Count by type
    const typeResult = await db.query(`
      SELECT product_type_id, COUNT(*) as count 
      FROM products 
      GROUP BY product_type_id 
      ORDER BY product_type_id
    `);
    
    console.log('Products by Type:');
    typeResult.rows.forEach(row => {
      const typeName = row.product_type_id === 1 ? 'Car/Truck/Tractor' : 
                      row.product_type_id === 2 ? 'Bike' : 'HUPS/Inverter';
      console.log(`  Type ${row.product_type_id} (${typeName}): ${row.count} products`);
    });
    
    // Count by series for car/truck/tractor
    const seriesResult = await db.query(`
      SELECT series, COUNT(*) as count 
      FROM products 
      WHERE product_type_id = 1 
      GROUP BY series 
      ORDER BY series
    `);
    
    console.log('\nProducts by Series (Car/Truck/Tractor):');
    seriesResult.rows.forEach(row => {
      console.log(`  ${row.series}: ${row.count} products`);
    });
    
    // Sample products
    const sampleResult = await db.query(`
      SELECT sku, name, series, selling_price, mrp_price 
      FROM products 
      WHERE product_type_id = 1 
      ORDER BY order_index 
      LIMIT 5
    `);
    
    console.log('\nSample Products (first 5):');
    sampleResult.rows.forEach(row => {
      console.log(`  ${row.sku}: ${row.name} (${row.series}) - ₹${row.selling_price}`);
    });
    
    console.log('\n✅ Verification complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

verify();

