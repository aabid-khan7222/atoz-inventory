// Script to migrate from separate product tables to unified product table with product_type
require('dotenv').config();
const db = require('../db');

async function migrateToUnifiedTable() {
  const client = await db.pool.connect();
  
  try {
    console.log('Starting migration to unified product table...\n');

    // Step 1: Backup existing data by fetching all products from old tables (BEFORE transaction)
    console.log('Step 1: Fetching existing data from old tables...');
    
    const oldTables = [
      { name: 'car_truck_tractor_batteries', typeId: 1 },
      { name: 'bike_batteries', typeId: 2 },
      { name: 'ups_inverter_batteries', typeId: 3 },
      { name: 'hups_inverter_batteries', typeId: 3 }, // Also check this variant if it exists
    ];

    const allProducts = [];
    let orderIndex = 1;

    // Fetch data BEFORE starting transaction to avoid transaction errors
    for (const table of oldTables) {
      try {
        const result = await client.query(`SELECT * FROM ${table.name}`);
        console.log(`  Found ${result.rows.length} products in ${table.name}`);
        
        for (const product of result.rows) {
          allProducts.push({
            ...product,
            product_type_id: table.typeId,
            original_table: table.name
          });
        }
      } catch (err) {
        if (err.code === '42P01') {
          console.log(`  Table ${table.name} does not exist, skipping...`);
        } else {
          console.log(`  Error reading ${table.name}: ${err.message}, skipping...`);
        }
      }
    }

    // Also check the old 'product' table if it exists
    try {
      const oldProductResult = await client.query('SELECT * FROM product');
      console.log(`  Found ${oldProductResult.rows.length} products in old 'product' table`);
      
      for (const product of oldProductResult.rows) {
        // Determine product_type_id based on category
        let typeId = 1; // Default to car-truck-tractor
        const category = (product.category || '').toLowerCase();
        if (category === 'bike') {
          typeId = 2;
        } else if (category === 'ups-inverter' || category === 'hups-inverter') {
          typeId = 3;
        }
        
        allProducts.push({
          ...product,
          product_type_id: typeId,
          original_table: 'product'
        });
      }
    } catch (err) {
      if (err.code === '42P01') {
        console.log(`  Old 'product' table does not exist, skipping...`);
      } else {
        console.log(`  Error checking old product table: ${err.message}, continuing...`);
      }
    }
    
    // NOW start transaction after data is fetched
    await client.query('BEGIN');

    console.log(`\nTotal products to migrate: ${allProducts.length}\n`);

    // Step 2: Create product_type table
    console.log('Step 2: Creating product_type table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_type (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert product types (using ON CONFLICT to handle duplicates)
    await client.query(`
      INSERT INTO product_type (id, name) VALUES
      (1, 'car_truck_tractor_batteries'),
      (2, 'bike_batteries'),
      (3, 'hups_inverter_batteries')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `);
    
    // Also ensure by name (in case id conflicts)
    await client.query(`
      INSERT INTO product_type (id, name) VALUES
      (1, 'car_truck_tractor_batteries'),
      (2, 'bike_batteries'),
      (3, 'hups_inverter_batteries')
      ON CONFLICT (name) DO NOTHING
    `);

    console.log('  ✓ product_type table created and populated\n');

    // Step 3: Create unified product table
    console.log('Step 3: Creating unified product table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS product (
        id SERIAL PRIMARY KEY,
        sku VARCHAR(100) UNIQUE NOT NULL,
        series VARCHAR(100),
        category VARCHAR(100),
        name VARCHAR(255) NOT NULL,
        qty INTEGER DEFAULT 0,
        selling_price DECIMAL(10, 2) NOT NULL,
        mrp_price DECIMAL(10, 2),
        discount DECIMAL(10, 2) DEFAULT 0,
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
      CREATE INDEX IF NOT EXISTS idx_product_sku ON product(sku);
      CREATE INDEX IF NOT EXISTS idx_product_type_id ON product(product_type_id);
      CREATE INDEX IF NOT EXISTS idx_product_series ON product(series);
      CREATE INDEX IF NOT EXISTS idx_product_order_index ON product(order_index);
    `);

    console.log('  ✓ product table created with indexes\n');

    // Step 4: Migrate data in the correct order
    console.log('Step 4: Migrating products...');
    
    // Sort products: car-truck-tractor first (type_id=1), then bike (type_id=2), then hups-inverter (type_id=3)
    const sortedProducts = allProducts.sort((a, b) => {
      // First sort by product_type_id
      if (a.product_type_id !== b.product_type_id) {
        return a.product_type_id - b.product_type_id;
      }
      // Then by order_index if available
      const orderA = a.order_index ?? a.id ?? 999999;
      const orderB = b.order_index ?? b.id ?? 999999;
      return orderA - orderB;
    });

    let migratedCount = 0;
    let errorCount = 0;
    let currentOrderIndex = 1;

    for (const product of sortedProducts) {
      try {
        const sku = product.sku;
        const series = product.series || null;
        const category = product.category || null;
        const name = product.name;
        const qty = product.qty || 0;
        const sellingPrice = product.selling_price || product.price || 0;
        const mrpPrice = product.mrp || product.mrp_price || sellingPrice;
        const discount = mrpPrice > sellingPrice ? mrpPrice - sellingPrice : 0;
        const ahVa = product.ah_va || null;
        const warranty = product.warranty || null;
        const orderIndex = product.order_index || currentOrderIndex;
        const productTypeId = product.product_type_id;

        // Update currentOrderIndex for next product
        currentOrderIndex = orderIndex + 1;

        await client.query(`
          INSERT INTO product (
            sku, series, category, name, qty, selling_price, mrp_price, discount,
            ah_va, warranty, order_index, product_type_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (sku) DO UPDATE SET
            series = EXCLUDED.series,
            category = EXCLUDED.category,
            name = EXCLUDED.name,
            qty = EXCLUDED.qty,
            selling_price = EXCLUDED.selling_price,
            mrp_price = EXCLUDED.mrp_price,
            discount = EXCLUDED.discount,
            ah_va = EXCLUDED.ah_va,
            warranty = EXCLUDED.warranty,
            order_index = EXCLUDED.order_index,
            product_type_id = EXCLUDED.product_type_id,
            updated_at = CURRENT_TIMESTAMP
        `, [
          sku, series, category, name, qty, sellingPrice, mrpPrice, discount,
          ahVa, warranty, orderIndex, productTypeId,
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

    console.log(`\n  ✓ Migrated ${migratedCount} products (${errorCount} errors)\n`);

    // Step 5: Delete old tables
    console.log('Step 5: Deleting old tables...');
    
    const tablesToDelete = [
      'bike_batteries',
      'car_truck_tractor_batteries',
      'hups_inverter_batteries',
      'ups_inverter_batteries',
      'product' // Old product table if it exists
    ];

    for (const tableName of tablesToDelete) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
        console.log(`  ✓ Deleted table: ${tableName}`);
      } catch (err) {
        console.log(`  ⚠ Could not delete ${tableName}: ${err.message}`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log(`   Total products migrated: ${migratedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Product types: 3 (car-truck-tractor, bike, hups-inverter)`);

    await client.query('COMMIT');
    console.log('\n✓ Transaction committed');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✗ Migration failed, transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

migrateToUnifiedTable().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

