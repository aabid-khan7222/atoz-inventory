// Script to update existing company_returns records with sku and product_name
// This updates NULL values from the products table based on returned_product_id

const db = require('../db');

async function updateCompanyReturns() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Updating company_returns records with sku and product_name...\n');
    
    // Update sku and product_name from products table where they are NULL
    const result = await client.query(`
      UPDATE company_returns cr
      SET 
        sku = p.sku,
        product_name = p.name
      FROM products p
      WHERE cr.returned_product_id = p.id
        AND (cr.sku IS NULL OR cr.product_name IS NULL)
    `);
    
    console.log(`✓ Updated ${result.rowCount} company_returns records with sku and product_name`);
    
    // Check if there are any remaining NULL values
    const nullCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM company_returns
      WHERE returned_product_id IS NOT NULL
        AND (sku IS NULL OR product_name IS NULL)
    `);
    
    const remainingNulls = parseInt(nullCheck.rows[0].count, 10);
    if (remainingNulls > 0) {
      console.log(`⚠ Warning: ${remainingNulls} records still have NULL sku or product_name (likely missing returned_product_id)`);
    } else {
      console.log('✓ All records with returned_product_id now have sku and product_name');
    }
    
    await client.query('COMMIT');
    console.log('\n✓ Update completed successfully!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Error updating company_returns:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run the update
updateCompanyReturns()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nScript failed:', err);
    process.exit(1);
  });
