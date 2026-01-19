// Script to fix b2b_mrp NULL values in products table
// This script updates all products where b2b_mrp is NULL to set it to mrp_price
// Usage: node server/scripts/fix_b2b_mrp_null_values.js

require('dotenv').config();
const db = require('../db');

async function fixB2bMrp() {
  try {
    console.log('Fixing b2b_mrp NULL values in products table...');
    
    // First, check how many products have NULL b2b_mrp
    const beforeResult = await db.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN b2b_mrp IS NULL THEN 1 END) as products_with_null_b2b_mrp,
        COUNT(CASE WHEN b2b_mrp IS NOT NULL THEN 1 END) as products_with_b2b_mrp
      FROM products
    `);
    
    console.log('\nBefore Update:');
    console.log(`  Total Products: ${beforeResult.rows[0].total_products}`);
    console.log(`  Products with NULL b2b_mrp: ${beforeResult.rows[0].products_with_null_b2b_mrp}`);
    console.log(`  Products with b2b_mrp: ${beforeResult.rows[0].products_with_b2b_mrp}`);
    
    // Update b2b_mrp to mrp_price where b2b_mrp is NULL
    console.log('\nUpdating b2b_mrp to mrp_price where b2b_mrp is NULL...');
    const updateResult = await db.query(`
      UPDATE products
      SET b2b_mrp = mrp_price
      WHERE b2b_mrp IS NULL AND mrp_price IS NOT NULL
    `);
    
    console.log(`  Updated ${updateResult.rowCount} products`);
    
    // Check results after update
    const afterResult = await db.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN b2b_mrp IS NULL THEN 1 END) as products_with_null_b2b_mrp,
        COUNT(CASE WHEN b2b_mrp IS NOT NULL THEN 1 END) as products_with_b2b_mrp,
        COUNT(CASE WHEN b2b_mrp = mrp_price THEN 1 END) as products_with_matching_b2b_mrp
      FROM products
    `);
    
    console.log('\nAfter Update:');
    console.log(`  Total Products: ${afterResult.rows[0].total_products}`);
    console.log(`  Products with NULL b2b_mrp: ${afterResult.rows[0].products_with_null_b2b_mrp}`);
    console.log(`  Products with b2b_mrp: ${afterResult.rows[0].products_with_b2b_mrp}`);
    console.log(`  Products where b2b_mrp = mrp_price: ${afterResult.rows[0].products_with_matching_b2b_mrp}`);
    
    // Add comment to column
    try {
      await db.query(`
        COMMENT ON COLUMN products.b2b_mrp IS 'B2B MRP (same as mrp_price for single MRP system)'
      `);
      console.log('\n✅ Added comment to b2b_mrp column');
    } catch (commentError) {
      console.warn('  Warning: Could not add comment to column (this is okay)');
    }
    
    console.log('\n✅ Migration completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

fixB2bMrp();

