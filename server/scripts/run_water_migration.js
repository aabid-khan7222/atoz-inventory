const fs = require('fs');
const db = require('../db');
const path = require('path');

async function runMigration() {
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/add_water_products.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Run migration
    await db.query(sql);
    console.log('✓ Migration completed successfully');
    
    // Add purchase product type
    await db.query(`
      INSERT INTO purchase_product_type (id, name) VALUES (4, 'Water Products')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✓ Purchase product type added');
    
    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    console.error(err);
    process.exit(1);
  }
}

runMigration();

