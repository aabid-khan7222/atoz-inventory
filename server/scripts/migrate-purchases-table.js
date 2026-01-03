// Migration script to ensure purchases table has required columns for replacement tracking
// This adds columns if they don't exist and creates unique constraint

const db = require('../db');

async function migratePurchasesTable() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting purchases table migration...');
    
    // Add columns if they don't exist
    await client.query(`
      ALTER TABLE purchases 
      ADD COLUMN IF NOT EXISTS product_type_id INTEGER,
      ADD COLUMN IF NOT EXISTS product_series VARCHAR(255),
      ADD COLUMN IF NOT EXISTS product_sku VARCHAR(100),
      ADD COLUMN IF NOT EXISTS serial_number VARCHAR(255),
      ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) DEFAULT 0
    `);
    
    console.log('Added columns if they did not exist');
    
    // Create unique constraint if it doesn't exist
    try {
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS purchases_product_sku_serial_number_unique 
        ON purchases(product_sku, serial_number) 
        WHERE product_sku IS NOT NULL AND serial_number IS NOT NULL
      `);
      console.log('Created unique constraint on (product_sku, serial_number)');
    } catch (err) {
      if (err.code === '42P07') {
        // Index already exists
        console.log('Unique constraint already exists');
      } else {
        throw err;
      }
    }
    
    await client.query('COMMIT');
    console.log('Migration completed successfully!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during migration:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run the migration
if (require.main === module) {
  migratePurchasesTable()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration script failed:', err);
      process.exit(1);
    });
}

module.exports = { migratePurchasesTable };

