// Script to add discount_percent column to products and backfill values
require('dotenv').config();
const db = require('../db');

async function addDiscountPercentColumn() {
  const client = await db.pool.connect();

  try {
    console.log('Checking for discount_percent column on products table...');

    const { rows } = await client.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'discount_percent'
      `
    );

    if (rows.length > 0) {
      console.log('✓ discount_percent column already exists. Backfilling values...');
    } else {
      console.log('Adding discount_percent column to products table...');
      await client.query(`
        ALTER TABLE products
        ADD COLUMN discount_percent DECIMAL(5, 2) DEFAULT 0
      `);
      console.log('✓ discount_percent column added.');
    }

    console.log('Backfilling discount_percent values based on mrp_price and selling_price...');

    await client.query(`
      UPDATE products
      SET discount_percent = CASE
        WHEN mrp_price IS NOT NULL
          AND mrp_price > 0
          AND selling_price IS NOT NULL
          AND selling_price >= 0
        THEN ROUND(((mrp_price - selling_price) / mrp_price) * 100::numeric, 2)
        ELSE 0
      END
    `);

    console.log('✓ discount_percent values backfilled successfully.');
  } catch (err) {
    console.error('✗ Error adding/backfilling discount_percent column:', err.message);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

addDiscountPercentColumn().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});


