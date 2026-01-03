const db = require('../db');

async function addWaterPurchaseType() {
  try {
    await db.query(`
      INSERT INTO purchase_product_type (id, name) VALUES (4, 'Water Products')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Water Products added to purchase_product_type table');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

addWaterPurchaseType();

