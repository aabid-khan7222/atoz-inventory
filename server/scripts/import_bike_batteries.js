// Script to import Bike batteries from EXIDE XPLORE price list
require('dotenv').config();
const db = require('../db');

async function importBikeBatteries() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting import of Bike batteries...\n');

    // Product data from the price list
    // Series: EXIDE XPLORE (48M WARRANTY - 24F+24P)
    const batteryData = [
      {
        series: 'XPLORE',
        warranty: '48M (24F+24P)',
        category: '2-WHEELER',
        products: [
          { ah_va: '2.5', sku: '12XL2.5L-C', warranty: '24F+24P', mrp: 1086 },
          { ah_va: '4', sku: 'XLTZ4A', warranty: '24F+24P', mrp: 1298 },
          { ah_va: '5', sku: 'XLTZ5A', warranty: '24F+24P', mrp: 1501 },
          { ah_va: '5', sku: 'XLTZ6', warranty: '24F+24P', mrp: 1612 },
          { ah_va: '5', sku: '12XL5L-B', warranty: '24F+24P', mrp: 1691 },
          { ah_va: '6', sku: 'XLTZ7', warranty: '24F+24P', mrp: 1965 },
          { ah_va: '7', sku: '12XL7B-B', warranty: '24F+24P', mrp: 1740 },
          { ah_va: '9', sku: 'XLTZ9', warranty: '24F+24P', mrp: 2385 },
          { ah_va: '9', sku: '12XL9-B', warranty: '24F+24P', mrp: 2453 },
          { ah_va: '12', sku: 'XLTX14', warranty: '24F+24P', mrp: 3434 },
          { ah_va: '14', sku: '12XL14L-A2', warranty: '24F+24P', mrp: 3951 },
        ]
      }
    ];

    // Bike Battery category = product_type_id = 2
    const productTypeId = 2;
    let totalInserted = 0;
    let totalUpdated = 0;
    let orderIndex = 1;

    for (const seriesData of batteryData) {
      console.log(`\n📦 Processing series: ${seriesData.series} (${seriesData.warranty})`);
      
      for (const product of seriesData.products) {
        try {
          // Calculate prices
          const mrp = parseFloat(product.mrp);
          const sellingPrice = Math.round(mrp * 0.88 * 100) / 100; // 12% discount (regular customer)
          const b2bSellingPrice = Math.round(mrp * 0.82 * 100) / 100; // 18% discount (B2B customer)
          const discount = mrp - sellingPrice;
          const discountPercent = 12.00; // Regular customer discount
          
          // Create product name
          const productName = `EXIDE ${seriesData.series} ${product.ah_va}Ah`;
          
          // Check if product already exists
          const existing = await client.query(
            'SELECT id FROM products WHERE sku = $1',
            [product.sku]
          );
          
          if (existing.rows.length > 0) {
            // Update existing product
            await client.query(`
              UPDATE products SET
                name = $1,
                series = $2,
                category = $3,
                mrp_price = $4,
                selling_price = $5,
                b2b_selling_price = $6,
                discount = $7,
                discount_percent = $8,
                ah_va = $9,
                warranty = $10,
                product_type_id = $11,
                order_index = $12,
                updated_at = CURRENT_TIMESTAMP
              WHERE sku = $13
            `, [
              productName,
              seriesData.series,
              seriesData.category,
              mrp,
              sellingPrice,
              b2bSellingPrice,
              discount,
              discountPercent,
              product.ah_va,
              product.warranty,
              productTypeId,
              orderIndex++,
              product.sku
            ]);
            totalUpdated++;
            console.log(`  ✓ Updated: ${product.sku} - ${productName} (MRP: ₹${mrp}, Regular: ₹${sellingPrice}, B2B: ₹${b2bSellingPrice})`);
          } else {
            // Insert new product
            await client.query(`
              INSERT INTO products (
                sku, name, series, category, qty, 
                mrp_price, selling_price, b2b_selling_price, discount, discount_percent,
                ah_va, warranty, product_type_id, order_index, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
              product.sku,
              productName,
              seriesData.series,
              seriesData.category,
              0, // Initial quantity is 0
              mrp,
              sellingPrice,
              b2bSellingPrice,
              discount,
              discountPercent,
              product.ah_va,
              product.warranty,
              productTypeId,
              orderIndex++
            ]);
            totalInserted++;
            console.log(`  ✓ Inserted: ${product.sku} - ${productName} (MRP: ₹${mrp}, Regular: ₹${sellingPrice}, B2B: ₹${b2bSellingPrice})`);
          }
        } catch (err) {
          if (err.code === '23505') {
            // Duplicate SKU - skip
            console.log(`  ⚠ Skipped (duplicate): ${product.sku}`);
          } else {
            console.error(`  ✗ Error processing ${product.sku}:`, err.message);
          }
        }
      }
    }

    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Import completed successfully!');
    console.log('='.repeat(60));
    console.log(`Total products inserted: ${totalInserted}`);
    console.log(`Total products updated: ${totalUpdated}`);
    console.log(`Total products processed: ${totalInserted + totalUpdated}`);
    console.log('\n💡 Note:');
    console.log('  - Regular customer price: MRP - 12% discount');
    console.log('  - B2B customer price: MRP - 18% discount');
    console.log('  - Initial stock quantity: 0 (can be added via Purchase Section)');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error during import:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

importBikeBatteries().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

