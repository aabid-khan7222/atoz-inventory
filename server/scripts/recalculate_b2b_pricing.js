// Script to recalculate B2B pricing for all products based on their MRP
// This ensures each product has correct B2B values based on its individual MRP
// Usage: node server/scripts/recalculate_b2b_pricing.js

require('dotenv').config();
const db = require('../db');

async function recalculateB2BPricing() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Recalculating B2B pricing for all products...\n');
    
    // Get all products
    const products = await client.query(`
      SELECT id, sku, name, mrp_price, b2b_selling_price, b2b_discount, b2b_discount_percent
      FROM products
      ORDER BY id
    `);
    
    console.log(`Found ${products.rows.length} products to process...\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const product of products.rows) {
      const mrp = parseFloat(product.mrp_price) || 0;
      
      if (mrp <= 0) {
        console.log(`⚠ Skipping ${product.sku} (${product.name}) - Invalid MRP: ${mrp}`);
        skippedCount++;
        continue;
      }
      
      // Calculate B2B pricing: 18% discount from MRP (standard B2B discount)
      const b2bDiscountPercent = 18.00;
      const b2bDiscountAmount = Math.round((mrp * 0.18) * 100) / 100;
      const b2bSellingPrice = Math.round((mrp - b2bDiscountAmount) * 100) / 100;
      
      // Only update if values are different (to avoid unnecessary updates)
      const currentB2bDiscount = parseFloat(product.b2b_discount) || 0;
      const currentB2bSellingPrice = parseFloat(product.b2b_selling_price) || 0;
      
      if (Math.abs(currentB2bDiscount - b2bDiscountAmount) > 0.01 || 
          Math.abs(currentB2bSellingPrice - b2bSellingPrice) > 0.01) {
        
        await client.query(`
          UPDATE products
          SET 
            b2b_discount = $1,
            b2b_discount_percent = $2,
            b2b_selling_price = $3,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [b2bDiscountAmount, b2bDiscountPercent, b2bSellingPrice, product.id]);
        
        updatedCount++;
        console.log(`✓ Updated: ${product.sku} (${product.name})`);
        console.log(`  MRP: ₹${mrp.toFixed(2)} → B2B Discount: ₹${b2bDiscountAmount.toFixed(2)} (18%), B2B Selling: ₹${b2bSellingPrice.toFixed(2)}`);
      } else {
        skippedCount++;
        console.log(`- Skipped: ${product.sku} (${product.name}) - Already correct`);
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`\n✅ Summary:`);
    console.log(`   Updated: ${updatedCount} products`);
    console.log(`   Skipped: ${skippedCount} products`);
    console.log(`   Total: ${products.rows.length} products`);
    console.log(`\n📝 Note: All B2B pricing now calculated as:`);
    console.log(`   - B2B Discount: 18% of MRP`);
    console.log(`   - B2B Selling Price: MRP - B2B Discount`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', err.message);
    console.error(err);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

recalculateB2BPricing().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

