// Script to check if we can recover products data
// This will check if old tables still exist or if we need to re-insert
require('dotenv').config();
const db = require('../db');

async function checkAndRestore() {
  const client = await db.pool.connect();
  
  try {
    console.log('Checking for existing product data...\n');

    // Check if old separate tables still exist
    const oldTables = [
      'car_truck_tractor_batteries',
      'bike_batteries',
      'ups_inverter_batteries',
      'hups_inverter_batteries'
    ];

    let foundData = [];
    
    for (const tableName of oldTables) {
      try {
        const result = await client.query(`SELECT * FROM ${tableName}`);
        if (result.rows.length > 0) {
          console.log(`✓ Found ${result.rows.length} products in ${tableName}`);
          foundData.push({ table: tableName, products: result.rows });
        }
      } catch (err) {
        if (err.code === '42P01') {
          console.log(`✗ Table ${tableName} does not exist`);
        }
      }
    }

    // Check if product table exists
    try {
      const result = await client.query('SELECT * FROM product');
      if (result.rows.length > 0) {
        console.log(`✓ Found ${result.rows.length} products in product table`);
        foundData.push({ table: 'product', products: result.rows });
      }
    } catch (err) {
      console.log('✗ product table does not exist');
    }

    // Check current products table
    const currentResult = await client.query('SELECT COUNT(*) as count FROM products');
    console.log(`\nCurrent products table has: ${currentResult.rows[0].count} products`);

    if (foundData.length === 0 && currentResult.rows[0].count === '0') {
      console.log('\n⚠️  No product data found anywhere!');
      console.log('   You will need to re-insert products manually or restore from backup.');
      return;
    }

    // If we found data, migrate it
    if (foundData.length > 0) {
      console.log('\n📦 Found data to migrate! Starting migration...\n');
      
      await client.query('BEGIN');

      // Get product_type mapping
      const typeMap = {
        'car_truck_tractor_batteries': 1,
        'bike_batteries': 2,
        'ups_inverter_batteries': 3,
        'hups_inverter_batteries': 3,
      };

      let totalMigrated = 0;
      let orderIndex = 1;

      for (const source of foundData) {
        const productTypeId = typeMap[source.table] || 
          (source.table === 'product' ? null : 1);
        
        for (const product of source.products) {
          try {
            const finalTypeId = productTypeId || product.product_type_id || 1;
            
            // Calculate discount_percent if not present
            const discount = product.discount || 
              (product.mrp_price && product.selling_price
                ? Math.max(0, product.mrp_price - product.selling_price)
                : (product.mrp && product.selling_price
                  ? Math.max(0, product.mrp - product.selling_price)
                  : 0));
            const effectiveMrp = product.mrp_price || product.mrp || null;
            const discountPercent = product.discount_percent ||
              (effectiveMrp && product.selling_price
                ? Math.max(0, Math.round(((effectiveMrp - product.selling_price) / effectiveMrp) * 10000) / 100)
                : 0);

            await client.query(`
              INSERT INTO products (
                sku, series, category, name, qty, selling_price, mrp_price, discount, discount_percent,
                ah_va, warranty, order_index, product_type_id, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
              product.selling_price || product.price || 0,
              effectiveMrp,
              discount,
              discountPercent,
              product.ah_va || null,
              product.warranty || null,
              product.order_index || orderIndex++,
              finalTypeId,
              product.created_at || new Date(),
              product.updated_at || new Date()
            ]);

            totalMigrated++;
          } catch (err) {
            if (err.code !== '23505') { // Skip duplicate SKU errors
              console.error(`  Error migrating ${product.sku}:`, err.message);
            }
          }
        }
      }

      await client.query('COMMIT');
      console.log(`\n✅ Migrated ${totalMigrated} products to products table!`);
    } else {
      console.log('\n✅ Products table is ready. No migration needed.');
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

checkAndRestore().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

