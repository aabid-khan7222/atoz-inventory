// Script to update all 2-WHEELER (bike) product prices from EXIDE XPLORE price list
// This script:
// 1. Removes old prices for all bike products
// 2. Updates MRP from EXIDE XPLORE list
// 3. Calculates selling_price = MRP - 12% (MRP * 0.88)
// 4. Updates discount and discount_percent
// 5. Ensures GST is fixed at 18% (included in MRP, non-editable)
require('dotenv').config();
const db = require('../db');

async function updateBikePrices() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Updating 2-WHEELER product prices from EXIDE XPLORE price list...\n');

    // EXIDE XPLORE Price List - 2-WHEELER Batteries (48M WARRANTY)
    // Format: { sku, mrp_price }
    // Data from the user's image: "2-WHEELER: EXIDE XPLORE: 48M WARRANTY"
    const priceList = [
      { sku: '12XL2.5L-C', mrp_price: 1086 },
      { sku: 'XLTZ4A', mrp_price: 1298 },
      { sku: 'XLTZ5A', mrp_price: 1501 },
      { sku: 'XLTZ6', mrp_price: 1612 },
      { sku: '12XL5L-B', mrp_price: 1691 },
      { sku: 'XLTZ7', mrp_price: 1965 },
      { sku: '12XL7B-B', mrp_price: 1740 },
      { sku: 'XLTZ9', mrp_price: 2385 },
      { sku: '12XL9-B', mrp_price: 2453 },
      { sku: 'XLTX14', mrp_price: 3434 },
      { sku: '12XL14L-A2', mrp_price: 3951 },
    ];

    console.log(`Found ${priceList.length} products in EXIDE XPLORE price list...\n`);

    // Step 1: Clear all existing prices for bike products (product_type_id = 2)
    console.log('Step 1: Clearing all existing prices for bike products...');
    const clearResult = await client.query(`
      UPDATE products 
      SET 
        mrp_price = 0,
        selling_price = 0,
        discount = 0,
        discount_percent = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE product_type_id = 2
    `);
    console.log(`   Cleared prices for ${clearResult.rowCount} bike products\n`);

    // Step 2: Update prices from the new list
    console.log('Step 2: Updating prices from EXIDE XPLORE list...\n');
    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    for (const priceItem of priceList) {
      try {
        const mrpPrice = priceItem.mrp_price;
        
        // Calculate selling_price = MRP - 12% (MRP * 0.88)
        const sellingPrice = Math.round(mrpPrice * 0.88 * 100) / 100;
        
        // Calculate discount amount
        const discount = Math.round((mrpPrice - sellingPrice) * 100) / 100;
        
        // Calculate discount percentage (should be 12%)
        const discountPercent = 12.00; // Fixed 12%

        // Update product by SKU
        const result = await client.query(`
          UPDATE products 
          SET 
            mrp_price = $1,
            selling_price = $2,
            discount = $3,
            discount_percent = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE sku = $5 AND product_type_id = 2
          RETURNING id, sku, name, mrp_price, selling_price, discount, discount_percent
        `, [mrpPrice, sellingPrice, discount, discountPercent, priceItem.sku]);

        if (result.rowCount > 0) {
          const product = result.rows[0];
          updatedCount++;
          console.log(`✓ Updated: ${product.name || 'N/A'} (${product.sku}) - MRP: ₹${product.mrp_price}, Selling: ₹${product.selling_price}, Discount: ${product.discount_percent}%`);
        } else {
          notFoundCount++;
          console.log(`⚠ Not found: ${priceItem.sku} (product_type_id = 2)`);
        }
      } catch (err) {
        errorCount++;
        console.error(`✗ Error updating ${priceItem.sku}:`, err.message);
      }
    }

    // Step 3: Check for any remaining bike products not in the list
    console.log('\nStep 3: Checking for other bike products not in price list...');
    const otherProducts = await client.query(`
      SELECT sku, name, mrp_price, selling_price 
      FROM products 
      WHERE product_type_id = 2 
      AND sku NOT IN (${priceList.map((_, i) => `$${i + 1}`).join(', ')})
    `, priceList.map(p => p.sku));

    if (otherProducts.rows.length > 0) {
      console.log(`Found ${otherProducts.rows.length} bike products not in price list (prices cleared):`);
      for (const product of otherProducts.rows) {
        console.log(`  - ${product.name || 'N/A'} (${product.sku}) - MRP: ₹${product.mrp_price || 0}, Selling: ₹${product.selling_price || 0}`);
      }
    } else {
      console.log('   All bike products are in the price list.');
    }

    await client.query('COMMIT');
    
    console.log(`\n✅ Summary:`);
    console.log(`   Updated: ${updatedCount} products`);
    console.log(`   Not found: ${notFoundCount} products`);
    console.log(`   Errors: ${errorCount} products`);
    console.log(`   Total in price list: ${priceList.length} products`);
    console.log(`\n📝 Pricing Rules Applied:`);
    console.log(`   - MRP: From EXIDE XPLORE price list (includes 18% GST)`);
    console.log(`   - Selling Price: MRP - 12% (MRP * 0.88)`);
    console.log(`   - Discount: 12% fixed`);
    console.log(`   - GST: 18% (included in MRP, non-editable)`);
    console.log(`   - All old prices cleared for bike products`);
    
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

updateBikePrices().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

