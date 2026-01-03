// Script to add products from a list provided by the user
// Usage: node scripts/addProductsFromList.js
require('dotenv').config();
const db = require('../db');

async function addProducts() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Adding products to database...\n');

    // ============================================
    // ADD YOUR PRODUCT LIST HERE
    // ============================================
    // Format: Each product should have:
    // - sku: Unique SKU code
    // - name: Product name
    // - series: Series name (optional)
    // - category: 'car-truck-tractor', 'bike', or 'ups-inverter'
    // - qty: Stock quantity (number)
    // - selling_price: Selling price (number)
    // - mrp_price: MRP price (number)
    // - discount: Discount amount (number, optional - will auto-calculate)
    // - discount_percent: Discount percentage (number, optional - will auto-calculate)
    // - ah_va: Ah/VA value (string, optional)
    // - warranty: Warranty period (string, optional)
    // - order_index: Order index (number, optional)
    
    const products = [
      // 2-WHEELER: EXIDE XPLORE: 48M WARRANTY (Bike batteries - product_type_id = 2)
      // Selling price is set to 12% less than MRP (rounded to nearest rupee)
      {
        sku: '12XL2.5L-C',
        name: 'EXIDE XPLORE 12XL2.5L-C',
        series: 'EXIDE XPLORE: 48M WARRANTY',
        category: 'bike',
        qty: 0,
        mrp_price: 1086,
        selling_price: Math.round(1086 * 0.88),
        ah_va: '2.5Ah',
        warranty: '24F+24P',
        order_index: 1,
      },
      {
        sku: 'XLTZ4A',
        name: 'EXIDE XPLORE XLTZ4A',
        series: 'EXIDE XPLORE: 48M WARRANTY',
        category: 'bike',
        qty: 0,
        mrp_price: 1298,
        selling_price: Math.round(1298 * 0.88),
        ah_va: '4Ah',
        warranty: '24F+24P',
        order_index: 2,
      },
      {
        sku: 'XLTZ5A',
        name: 'EXIDE XPLORE XLTZ5A',
        series: 'EXIDE XPLORE: 48M WARRANTY',
        category: 'bike',
        qty: 0,
        mrp_price: 1501,
        selling_price: Math.round(1501 * 0.88),
        ah_va: '5Ah',
        warranty: '24F+24P',
        order_index: 3,
      },
      {
        sku: 'XLTZ6',
        name: 'EXIDE XPLORE XLTZ6',
        series: 'EXIDE XPLORE: 48M WARRANTY',
        category: 'bike',
        qty: 0,
        mrp_price: 1612,
        selling_price: Math.round(1612 * 0.88),
        ah_va: '5Ah',
        warranty: '24F+24P',
        order_index: 4,
      },
      {
        sku: '12XL5L-B',
        name: 'EXIDE XPLORE 12XL5L-B',
        series: 'EXIDE XPLORE: 48M WARRANTY',
        category: 'bike',
        qty: 0,
        mrp_price: 1691,
        selling_price: Math.round(1691 * 0.88),
        ah_va: '5Ah',
        warranty: '24F+24P',
        order_index: 5,
      },
      {
        sku: 'XLTZ7',
        name: 'EXIDE XPLORE XLTZ7',
        series: 'EXIDE XPLORE: 48M WARRANTY',
        category: 'bike',
        qty: 0,
        mrp_price: 1965,
        selling_price: Math.round(1965 * 0.88),
        ah_va: '6Ah',
        warranty: '24F+24P',
        order_index: 6,
      },
      {
        sku: '12XL7B-B',
        name: 'EXIDE XPLORE 12XL7B-B',
        series: 'EXIDE XPLORE: 48M WARRANTY',
        category: 'bike',
        qty: 0,
        mrp_price: 1740,
        selling_price: Math.round(1740 * 0.88),
        ah_va: '7Ah',
        warranty: '24F+24P',
        order_index: 7,
      },
      {
        sku: 'XLTZ9',
        name: 'EXIDE XPLORE XLTZ9',
        series: 'EXIDE XPLORE: 48M WARRANTY',
        category: 'bike',
        qty: 0,
        mrp_price: 2385,
        selling_price: Math.round(2385 * 0.88),
        ah_va: '9Ah',
        warranty: '24F+24P',
        order_index: 8,
      },
      {
        sku: '12XL9-B',
        name: 'EXIDE XPLORE 12XL9-B',
        series: 'EXIDE XPLORE: 48M WARRANTY',
        category: 'bike',
        qty: 0,
        mrp_price: 2453,
        selling_price: Math.round(2453 * 0.88),
        ah_va: '9Ah',
        warranty: '24F+24P',
        order_index: 9,
      },
      {
        sku: 'XLTX14',
        name: 'EXIDE XPLORE XLTX14',
        series: 'EXIDE XPLORE: 48M WARRANTY',
        category: 'bike',
        qty: 0,
        mrp_price: 3434,
        selling_price: Math.round(3434 * 0.88),
        ah_va: '12Ah',
        warranty: '24F+24P',
        order_index: 10,
      },
      {
        sku: '12XL14L-A2',
        name: 'EXIDE XPLORE 12XL14L-A2',
        series: 'EXIDE XPLORE: 48M WARRANTY',
        category: 'bike',
        qty: 0,
        mrp_price: 3951,
        selling_price: Math.round(3951 * 0.88),
        ah_va: '14Ah',
        warranty: '24F+24P',
        order_index: 11,
      },
    ];

    if (products.length === 0) {
      console.log('⚠️  No products in the list!');
      console.log('   Please add your products to the products array in this script.');
      await client.query('ROLLBACK');
      process.exit(0);
    }

    console.log(`Found ${products.length} products to add...\n`);

    // Product type mapping
    const categoryToTypeId = {
      'car-truck-tractor': 1,
      'bike': 2,
      'ups-inverter': 3,
      'hups-inverter': 3
    };

    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    let orderIndexByType = { 1: 1, 2: 1, 3: 1 };

    // Sort products by category first, then by order_index
    const sortedProducts = products.sort((a, b) => {
      const typeA = categoryToTypeId[a.category] || 1;
      const typeB = categoryToTypeId[b.category] || 1;
      
      if (typeA !== typeB) {
        return typeA - typeB;
      }
      
      return (a.order_index || 9999) - (b.order_index || 9999);
    });

    for (const product of sortedProducts) {
      try {
        const productTypeId = categoryToTypeId[product.category] || 1;
        const finalOrderIndex = product.order_index || orderIndexByType[productTypeId]++;
        
        // Calculate discount and discount_percent if not provided
        const discount = product.discount || 
          (product.mrp_price && product.selling_price ? 
            Math.max(0, product.mrp_price - product.selling_price) : 0);
        const discountPercent = product.discount_percent ||
          (product.mrp_price && product.selling_price
            ? Math.max(0, Math.round(((product.mrp_price - product.selling_price) / product.mrp_price) * 10000) / 100)
            : 0);

        const result = await client.query(`
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
          RETURNING id, sku
        `, [
          product.sku.trim(),
          product.series ? product.series.trim() : null,
          product.category,
          product.name.trim(),
          product.qty || 0,
          product.selling_price,
          product.mrp_price || product.selling_price,
          discount,
          discountPercent,
          product.ah_va ? product.ah_va.trim() : null,
          product.warranty ? product.warranty.trim() : null,
          finalOrderIndex,
          productTypeId
        ]);

        if (result.rows[0]) {
          const action = result.rows[0].id ? 'Inserted' : 'Updated';
          if (action === 'Inserted') {
            insertedCount++;
            console.log(`✓ ${action}: ${product.name} (${product.sku})`);
          } else {
            updatedCount++;
            console.log(`↻ ${action}: ${product.name} (${product.sku})`);
          }
        }
      } catch (err) {
        errorCount++;
        if (err.code === '23505') {
          console.log(`⚠ Skipped duplicate SKU: ${product.sku}`);
        } else {
          console.error(`✗ Error with ${product.sku || 'unknown'}:`, err.message);
        }
      }
    }

    await client.query('COMMIT');
    
    console.log(`\n✅ Summary:`);
    console.log(`   Inserted: ${insertedCount} products`);
    console.log(`   Updated: ${updatedCount} products`);
    console.log(`   Errors: ${errorCount} products`);
    console.log(`   Total processed: ${products.length} products`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', err.message);
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}

addProducts().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

