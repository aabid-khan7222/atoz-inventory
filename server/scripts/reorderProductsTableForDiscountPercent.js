// Script to reorder products table so that discount_percent column
// physically sits immediately to the right of discount in the schema.
//
// Usage (from server directory):
//   node scripts/reorderProductsTableForDiscountPercent.js
//
// This script:
// 1. Creates a new table products_reordered with the desired column order
// 2. Copies all data from existing products table into it
// 3. Drops the old products table and renames products_reordered to products
// 4. Recreates the common indexes
//
// All existing data (including discount, discount_percent if present) is preserved.

require('dotenv').config();
const db = require('../db');

async function reorderProductsTable() {
  const client = await db.pool.connect();

  try {
    console.log('Starting products table reorder to place discount_percent after discount...\n');

    await client.query('BEGIN');

    // 1) Create new table with desired column order
    console.log('Creating temporary table products_reordered...');
    await client.query(`
      DROP TABLE IF EXISTS products_reordered CASCADE;

      CREATE TABLE products_reordered (
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
      );
    `);

    console.log('Copying data from existing products table into products_reordered...');

    // 2) Copy data from old products into new table
    // Handle both cases:
    // - old table already has discount_percent
    // - old table does not have discount_percent (compute from mrp/selling/discount)
    await client.query(`
      INSERT INTO products_reordered (
        id,
        sku,
        series,
        category,
        name,
        qty,
        selling_price,
        mrp_price,
        discount,
        discount_percent,
        ah_va,
        warranty,
        order_index,
        product_type_id,
        created_at,
        updated_at
      )
      SELECT
        p.id,
        p.sku,
        p.series,
        p.category,
        p.name,
        p.qty,
        p.selling_price,
        p.mrp_price,
        COALESCE(p.discount, 0) AS discount,
        CASE
          WHEN p.discount_percent IS NOT NULL THEN p.discount_percent
          WHEN p.mrp_price IS NOT NULL AND p.mrp_price > 0
            THEN ROUND(((p.mrp_price - COALESCE(p.selling_price, 0)) / p.mrp_price) * 100::numeric, 2)
          ELSE 0
        END AS discount_percent,
        p.ah_va,
        p.warranty,
        p.order_index,
        p.product_type_id,
        p.created_at,
        p.updated_at
      FROM products p;
    `);

    console.log('Dropping old products table and renaming products_reordered -> products...');

    // 3) Drop old table, rename new one
    await client.query(`
      DROP TABLE products CASCADE;
      ALTER TABLE products_reordered RENAME TO products;
    `);

    // 4) Recreate indexes
    console.log('Recreating indexes on products table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_product_type_id ON products(product_type_id);
      CREATE INDEX IF NOT EXISTS idx_products_series ON products(series);
      CREATE INDEX IF NOT EXISTS idx_products_order_index ON products(order_index);
    `);

    await client.query('COMMIT');

    console.log('\n✅ Reorder completed successfully.');
    console.log('   Column order is now:');
    console.log('   ... mrp_price, discount, discount_percent, ah_va, warranty, ...');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✗ Reorder failed, transaction rolled back:', err.message);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

reorderProductsTable().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});


