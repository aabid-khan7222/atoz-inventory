// Script to insert sample products into products table
// This is a template - you can modify the products array with your actual product data
require('dotenv').config();
const db = require('../db');

async function insertProducts() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Inserting products into products table...\n');

    // Sample products - REPLACE THIS WITH YOUR ACTUAL PRODUCT DATA
    // Format: Car/Truck/Tractor first (type_id=1), then Bike (type_id=2), then HUPS/Inverter (type_id=3)
    const products = [
      // CAR/TRUCK/TRACTOR BATTERIES (product_type_id = 1)
      // Add your car/truck/tractor battery products here
      // Example:
      // {
      //   sku: 'EPIQ-001',
      //   series: 'EXIDE EPIQ',
      //   category: 'car-truck-tractor',
      //   name: 'EPIQ Battery 12V 100Ah',
      //   qty: 10,
      //   selling_price: 9000,
      //   mrp_price: 10000,
      //   discount: 1000,
      //   ah_va: '100Ah',
      //   warranty: '2 Years',
      //   order_index: 1,
      //   product_type_id: 1
      // },
      
      // BIKE BATTERIES (product_type_id = 2)
      // Add your bike battery products here
      
      // HUPS/INVERTER BATTERIES (product_type_id = 3)
      // Add your HUPS/inverter battery products here
    ];

    if (products.length === 0) {
      console.log('⚠️  No products to insert!');
      console.log('   Please add your product data to the products array in this script.');
      console.log('   Or use the API to add products through the admin interface.');
      await client.query('ROLLBACK');
      process.exit(0);
    }

    let insertedCount = 0;
    let errorCount = 0;
    let orderIndex = 1;

    // Sort products by product_type_id first, then by order_index
    const sortedProducts = products.sort((a, b) => {
      if (a.product_type_id !== b.product_type_id) {
        return a.product_type_id - b.product_type_id;
      }
      return (a.order_index || orderIndex) - (b.order_index || orderIndex);
    });

    for (const product of sortedProducts) {
      try {
        const finalOrderIndex = product.order_index || orderIndex++;
        
        // Calculate discount_percent if not explicitly provided
        const discount = product.discount || 
          (product.mrp_price && product.selling_price
            ? Math.max(0, product.mrp_price - product.selling_price)
            : 0);
        const discountPercent = product.discount_percent ||
          (product.mrp_price && product.selling_price
            ? Math.max(0, Math.round(((product.mrp_price - product.selling_price) / product.mrp_price) * 10000) / 100)
            : 0);

        await client.query(`
          INSERT INTO products (
            sku, series, category, name, qty, selling_price, mrp_price, discount, discount_percent,
            ah_va, warranty, order_index, product_type_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (sku) DO UPDATE SET
            series = EXCLUDED.series,
            category = EXCLUDED.category,
            name = EXCLUDED.name,
            qty = EXCLUDED.qty,
            selling_price = EXCLUDED.selling_price,
            mrp_price = EXCLUDED.mrp_price,
            discount = EXCLUDED.discount,
            discount_percent = EXCLUDED.discount_percent,
            ah_va = EXCLUDED.ah_va,
            warranty = EXCLUDED.warranty,
            order_index = EXCLUDED.order_index,
            product_type_id = EXCLUDED.product_type_id,
            updated_at = CURRENT_TIMESTAMP
        `, [
          product.sku,
          product.series || null,
          product.category || null,
          product.name,
          product.qty || 0,
          product.selling_price,
          product.mrp_price || product.selling_price,
          discount,
          discountPercent,
          product.ah_va || null,
          product.warranty || null,
          finalOrderIndex,
          product.product_type_id
        ]);

        insertedCount++;
        console.log(`✓ Inserted: ${product.name} (${product.sku})`);
      } catch (err) {
        errorCount++;
        if (err.code === '23505') {
          console.log(`⚠ Skipped duplicate SKU: ${product.sku}`);
        } else {
          console.error(`✗ Error inserting ${product.sku}:`, err.message);
        }
      }
    }

    await client.query('COMMIT');
    console.log(`\n✅ Inserted ${insertedCount} products (${errorCount} errors)`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

insertProducts().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

