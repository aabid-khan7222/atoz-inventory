// Script to drop product table and create products table with exact structure
require('dotenv').config();
const db = require('../db');

async function createProductsTable() {
  const client = await db.pool.connect();
  
  try {
    console.log('Starting migration to products table...\n');

    // Step 1: Fetch all existing data from product or products table (BEFORE transaction)
    console.log('Step 1: Fetching existing data...');
    let allProducts = [];
    
    // Try products table first (plural)
    try {
      const result = await client.query('SELECT * FROM products');
      console.log(`  Found ${result.rows.length} products in products table`);
      allProducts = result.rows;
    } catch (err) {
      if (err.code === '42P01') {
        // Try product table (singular)
        try {
          const result = await client.query('SELECT * FROM product');
          console.log(`  Found ${result.rows.length} products in product table`);
          allProducts = result.rows;
        } catch (err2) {
          if (err2.code === '42P01') {
            console.log('  No existing product tables found, starting fresh...');
          } else {
            console.log(`  Error reading product table: ${err2.message}, continuing...`);
          }
        }
      } else {
        console.log(`  Error reading products table: ${err.message}, continuing...`);
      }
    }

    // NOW start transaction
    await client.query('BEGIN');

    // Step 2: Drop old tables
    console.log('\nStep 2: Dropping old tables...');
    await client.query('DROP TABLE IF EXISTS products CASCADE');
    await client.query('DROP TABLE IF EXISTS product CASCADE');
    console.log('  ✓ Dropped old tables');

    // Step 3: Create products table with exact structure
    console.log('\nStep 3: Creating products table...');
    await client.query(`
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        sku VARCHAR(100) UNIQUE NOT NULL,
        series VARCHAR(100),
        category VARCHAR(100),
        name VARCHAR(255) NOT NULL,
        qty INTEGER DEFAULT 0,
        selling_price DECIMAL(10, 2) NOT NULL,
        mrp_price DECIMAL(10, 2),
        discount DECIMAL(10, 2) DEFAULT 0,
        discount_percent DECIMAL(5, 2) DEFAULT 0,
        ah_va VARCHAR(20),
        warranty VARCHAR(50),
        order_index INTEGER,
        product_type_id INTEGER NOT NULL REFERENCES product_type(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX idx_products_sku ON products(sku);
      CREATE INDEX idx_products_product_type_id ON products(product_type_id);
      CREATE INDEX idx_products_series ON products(series);
      CREATE INDEX idx_products_order_index ON products(order_index);
    `);

    console.log('  ✓ products table created with indexes');

    // Step 4: Migrate data if we have products
    if (allProducts.length > 0) {
      console.log(`\nStep 4: Migrating ${allProducts.length} products...`);
      
      // Sort products: car-truck-tractor first (type_id=1), then bike (type_id=2), then hups-inverter (type_id=3)
      const sortedProducts = allProducts.sort((a, b) => {
        if (a.product_type_id !== b.product_type_id) {
          return a.product_type_id - b.product_type_id;
        }
        const orderA = a.order_index ?? a.id ?? 999999;
        const orderB = b.order_index ?? b.id ?? 999999;
        return orderA - orderB;
      });

      let migratedCount = 0;
      let errorCount = 0;

      for (const product of sortedProducts) {
        try {
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
            product.selling_price || 0,
            product.mrp_price || product.mrp || null,
            product.discount || 0,
            (product.discount_percent !== undefined && product.discount_percent !== null)
              ? product.discount_percent
              : (
                  product.mrp_price && product.selling_price
                    ? Math.round(((product.mrp_price - product.selling_price) / product.mrp_price) * 10000) / 100
                    : 0
                ),
            product.ah_va || null,
            product.warranty || null,
            product.order_index || null,
            product.product_type_id,
            product.created_at || new Date(),
            product.updated_at || new Date()
          ]);

          migratedCount++;
          if (migratedCount % 50 === 0) {
            console.log(`  Migrated ${migratedCount} products...`);
          }
        } catch (err) {
          errorCount++;
          if (err.code === '23505') {
            console.log(`  ⚠ Skipped duplicate SKU: ${product.sku}`);
          } else {
            console.error(`  ✗ Error migrating ${product.sku}:`, err.message);
          }
        }
      }

      console.log(`\n  ✓ Migrated ${migratedCount} products (${errorCount} errors)`);
    } else {
      console.log('\nStep 4: No products to migrate, table is ready for new data');
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');
    console.log('   Table: products (plural)');
    console.log('   Structure: id, sku, series, category, name, qty, selling_price, mrp_price, discount, ah_va, warranty, order_index, product_type_id, created_at, updated_at');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✗ Migration failed, transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

createProductsTable().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

