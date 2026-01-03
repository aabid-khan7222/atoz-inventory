// Script to import Inverter products from EXIDE price list
require('dotenv').config();
const db = require('../db');

async function importInverters() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting import of Inverter products...\n');

    // Product data from the price list
    const inverterData = [
      {
        series: 'GQP',
        warranty: '42M',
        category: 'ups-inverter',
        products: [
          { ah_va: '12V700', sku: 'GQP12V700', type: 'DSP Cu Pure Sine', warranty: '42M', mrp: 11361 },
          { ah_va: '12V900', sku: 'GQP12V900', type: 'DSP Cu Pure Sine', warranty: '42M', mrp: 11790 },
          { ah_va: '12V1125', sku: 'GQP12V1125', type: 'DSP Cu Pure Sine', warranty: '42M', mrp: 13504 },
          { ah_va: '12V1450N', sku: 'GQP12V1450N', type: 'MC Cu Pure Sine', warranty: '42M', mrp: 17272 },
          { ah_va: '24V1625', sku: 'GQP24V1625', type: 'DSP Cu Pure Sine', warranty: '42M', mrp: 18435 },
        ]
      },
      {
        series: 'STAR',
        warranty: '42M',
        category: 'ups-inverter',
        products: [
          { ah_va: '12V700', sku: 'STAR12V700', type: 'MC Al Pure Sine', warranty: '42M', mrp: 8215 },
          { ah_va: '12V900', sku: 'STAR12V900', type: 'MC Al Pure Sine', warranty: '42M', mrp: 8598 },
          { ah_va: '12V1125', sku: 'STAR12V1125', type: 'MC Al Pure Sine', warranty: '42M', mrp: 9744 },
          { ah_va: '12V1375', sku: 'STAR12V1375', type: 'MC Al Pure Sine', warranty: '42M', mrp: 12037 },
          { ah_va: '12V1625', sku: 'STAR12V1625', type: 'MC Al Pure Sine', warranty: '42M', mrp: 14328 },
          { ah_va: '24V1625', sku: 'STAR24V1625', type: 'MC Al Pure Sine', warranty: '42M', mrp: 13756 },
          { ah_va: '24V2550', sku: 'STAR24V2550', type: 'MC Al Pure Sine', warranty: '42M', mrp: 21016 },
        ]
      },
      {
        series: 'MAGIC',
        warranty: '42M',
        category: 'ups-inverter',
        products: [
          { ah_va: '12V800', sku: 'MAGIC12V800', type: 'MC Aluminium', warranty: '42M', mrp: 6549 },
          { ah_va: '12V875', sku: 'MAGIC12V875', type: 'MC Aluminium', warranty: '42M', mrp: 7006 },
          { ah_va: '12V1125', sku: 'MAGIC12V1125', type: 'MC Aluminium', warranty: '42M', mrp: 7532 },
          { ah_va: '12V1625', sku: 'MAGIC24V1625', type: 'MC Aluminium', warranty: '42M', mrp: 10508 },
        ]
      },
      {
        series: 'HKVA',
        warranty: '24M',
        category: 'ups-inverter',
        products: [
          { ah_va: '24V2KVA', sku: '024EXIDEN020', type: 'MC Al Pure Sine', warranty: '24M', mrp: 21057 },
          { ah_va: '36V2.5KVA', sku: '036EXIDEP025M', type: 'DSP Al Pure Sine', warranty: '24M', mrp: 36617 },
          { ah_va: '48V3.5KVA', sku: '048EXIDEP035M', type: 'DSP Al Pure Sine', warranty: '24M', mrp: 36979 },
          { ah_va: '48V5.2KVA', sku: '048EXIDEP052M', type: 'DSP Al Pure Sine', warranty: '24M', mrp: 56325 },
        ]
      }
    ];

    // Inverter & Battery category = product_type_id = 3
    const productTypeId = 3;
    let totalInserted = 0;
    let totalUpdated = 0;
    let orderIndex = 1;

    // Get current max order_index for this product type
    const orderResult = await client.query(`
      SELECT MAX(order_index) as max_order 
      FROM products 
      WHERE product_type_id = $1
    `, [productTypeId]);
    orderIndex = (orderResult.rows[0]?.max_order || 0) + 1;

    for (const seriesData of inverterData) {
      console.log(`\n📦 Processing series: EXIDE ${seriesData.series} (${seriesData.warranty} WARRANTY)`);
      
      for (const product of seriesData.products) {
        try {
          // Calculate prices
          const mrp = parseFloat(product.mrp);
          const b2cSellingPrice = Math.round(mrp * 0.66 * 100) / 100; // 34% discount (B2C customer)
          const b2bSellingPrice = Math.round(mrp * 0.60 * 100) / 100; // 40% discount (B2B customer)
          const discount = mrp - b2cSellingPrice;
          const discountPercent = 34.00; // B2C customer discount
          
          // Create product name
          const productName = `EXIDE ${seriesData.series} ${product.sku} ${product.type} ${product.ah_va}`;
          
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
              b2cSellingPrice,
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
            console.log(`  ✓ Updated: ${product.sku} - ${productName}`);
            console.log(`    MRP: ₹${mrp.toLocaleString('en-IN')}, B2C: ₹${b2cSellingPrice.toLocaleString('en-IN')}, B2B: ₹${b2bSellingPrice.toLocaleString('en-IN')}`);
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
              b2cSellingPrice,
              b2bSellingPrice,
              discount,
              discountPercent,
              product.ah_va,
              product.warranty,
              productTypeId,
              orderIndex++
            ]);
            totalInserted++;
            console.log(`  ✓ Inserted: ${product.sku} - ${productName}`);
            console.log(`    MRP: ₹${mrp.toLocaleString('en-IN')}, B2C: ₹${b2cSellingPrice.toLocaleString('en-IN')}, B2B: ₹${b2bSellingPrice.toLocaleString('en-IN')}`);
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
    console.log('\n💡 Pricing Information:');
    console.log('  - MRP: As per price list (inclusive of GST)');
    console.log('  - B2C customer price: MRP - 34% discount');
    console.log('  - B2B customer price: MRP - 40% discount');
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

importInverters().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

