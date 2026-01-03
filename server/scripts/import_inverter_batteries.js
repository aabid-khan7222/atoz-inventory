// Script to import Inverter & Battery products from EXIDE HOME price list
require('dotenv').config();
const db = require('../db');

async function importInverterBatteries() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting import of Inverter & Battery products...\n');

    // Product data from the price list
    const batteryData = [
      {
        series: 'INVATUBULAR',
        warranty: '66M (48F+18P)',
        category: 'ups-inverter',
        products: [
          { ah_va: '150', sku: 'IT500', type: 'Tall Tubular', warranty: '48F+18P', mrp: 24784 },
          { ah_va: '150', sku: 'IT500-SLK', type: 'Tall Tubular', warranty: '48F+18P', mrp: 24784 },
          { ah_va: '180', sku: 'IT650', type: 'Tall Tubular', warranty: '48F+18P', mrp: 29742 },
          { ah_va: '200', sku: 'IT750', type: 'Tall Tubular', warranty: '48F+18P', mrp: 33046 },
          { ah_va: '240', sku: 'IT900', type: 'Tall Tubular', warranty: '48F+18P', mrp: 39655 },
          { ah_va: '260', sku: 'IT950', type: 'Tall Tubular', warranty: '48F+18P', mrp: 42959 },
        ]
      },
      {
        series: 'INVAMASTER',
        warranty: '60M (36F+24P)',
        category: 'ups-inverter',
        products: [
          { ah_va: '100', sku: 'IMST1000', type: 'Short Tubular', warranty: '36F+24P', mrp: 15801 },
          { ah_va: '150', sku: 'IMST1500', type: 'Short Tubular', warranty: '36F+24P', mrp: 19313 },
          { ah_va: '150', sku: 'IMTT1500', type: 'Tall Tubular', warranty: '36F+24P', mrp: 20880 },
          { ah_va: '180', sku: 'IMTT1800', type: 'Tall Tubular', warranty: '36F+24P', mrp: 25090 },
          { ah_va: '200', sku: 'IMTT2000', type: 'Tall Tubular', warranty: '36F+24P', mrp: 27476 },
          { ah_va: '220', sku: 'IMTT2200', type: 'Tall Tubular', warranty: '36F+24P', mrp: 30385 },
          { ah_va: '250', sku: 'IMTT2500', type: 'Tall Tubular', warranty: '36F+24P', mrp: 33646 },
        ]
      },
      {
        series: 'INVAMAGIC',
        warranty: '48M (24F+24P)',
        category: 'ups-inverter',
        products: [
          { ah_va: '80', sku: 'MGST800', type: 'Short Tubular', warranty: '24F+24P', mrp: 11613 },
          { ah_va: '100', sku: 'MGST1000', type: 'Short Tubular', warranty: '24F+24P', mrp: 14117 },
          { ah_va: '120', sku: 'MGST1200', type: 'Short Tubular', warranty: '24F+24P', mrp: 14738 },
          { ah_va: '150', sku: 'MGST1500', type: 'Short Tubular', warranty: '24F+24P', mrp: 17562 },
          { ah_va: '180', sku: 'MGJT1800', type: 'Jumbo Tubular', warranty: '24F+24P', mrp: 21452 },
          { ah_va: '130', sku: 'MGTT1300', type: 'Tall Tubular', warranty: '24F+24P', mrp: 15890 },
          { ah_va: '150', sku: 'MGTT1500', type: 'Tall Tubular', warranty: '24F+24P', mrp: 19089 },
          { ah_va: '180', sku: 'MGTT1800', type: 'Tall Tubular', warranty: '24F+24P', mrp: 22669 },
          { ah_va: '200', sku: 'MGTT2000', type: 'Tall Tubular', warranty: '24F+24P', mrp: 24879 },
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

    for (const seriesData of batteryData) {
      console.log(`\n📦 Processing series: EXIDE HOME ${seriesData.series} (${seriesData.warranty})`);
      
      for (const product of seriesData.products) {
        try {
          // Calculate prices
          const mrp = parseFloat(product.mrp);
          const b2cSellingPrice = Math.round(mrp * 0.68 * 100) / 100; // 32% discount (B2C customer)
          const b2bSellingPrice = Math.round(mrp * 0.63 * 100) / 100; // 37% discount (B2B customer)
          const discount = mrp - b2cSellingPrice;
          const discountPercent = 32.00; // B2C customer discount
          
          // Create product name
          const productName = `EXIDE HOME ${seriesData.series} ${product.sku} ${product.type} ${product.ah_va}Ah`;
          
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
    console.log('  - B2C customer price: MRP - 32% discount');
    console.log('  - B2B customer price: MRP - 37% discount');
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

importInverterBatteries().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

