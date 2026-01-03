// Script to update existing products with B2B pricing and guarantee_period_months
// Usage: node server/scripts/run_update_existing_products_b2b_pricing.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  const migrationFile = path.join(__dirname, '../migrations/update_existing_products_b2b_pricing.sql');
  
  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Running migration: update_existing_products_b2b_pricing.sql');
    
    // Execute SQL statements one by one
    // Step 1: Update B2B pricing
    console.log('Step 1: Updating B2B pricing for existing products...');
    await db.query(`
      UPDATE products
      SET 
        b2b_selling_price = COALESCE(b2b_selling_price, selling_price),
        b2b_discount = COALESCE(b2b_discount, discount),
        b2b_discount_percent = COALESCE(b2b_discount_percent, discount_percent)
      WHERE 
        b2b_selling_price IS NULL 
        OR b2b_discount IS NULL 
        OR b2b_discount_percent IS NULL
    `);
    
    // Step 2: Ensure b2b_mrp_price is NULL
    console.log('Step 2: Setting b2b_mrp_price to NULL (using single MRP)...');
    await db.query(`
      UPDATE products
      SET b2b_mrp_price = NULL
      WHERE b2b_mrp_price IS NOT NULL
    `);
    
    // Step 3: Update guarantee_period_months from warranty field
    console.log('Step 3: Updating guarantee_period_months from warranty field...');
    await db.query(`
      UPDATE products
      SET guarantee_period_months = CASE
        WHEN warranty IS NOT NULL AND warranty ~ '^[0-9]+' THEN
          CAST(SUBSTRING(warranty FROM '^([0-9]+)') AS INTEGER)
        WHEN warranty IS NOT NULL AND warranty ~ '[0-9]+' THEN
          CAST(SUBSTRING(warranty FROM '([0-9]+)') AS INTEGER)
        ELSE 0
      END
      WHERE guarantee_period_months IS NULL
    `);
    
    // Step 4: Set default guarantee_period_months to 0 for any remaining NULL values
    console.log('Step 4: Setting default guarantee_period_months to 0...');
    await db.query(`
      UPDATE products
      SET guarantee_period_months = 0
      WHERE guarantee_period_months IS NULL
    `);
    
    // Check how many products were updated
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN b2b_selling_price IS NOT NULL THEN 1 END) as products_with_b2b_price,
        COUNT(CASE WHEN b2b_discount IS NOT NULL THEN 1 END) as products_with_b2b_discount,
        COUNT(CASE WHEN b2b_discount_percent IS NOT NULL THEN 1 END) as products_with_b2b_discount_percent,
        COUNT(CASE WHEN guarantee_period_months IS NOT NULL THEN 1 END) as products_with_guarantee
      FROM products
    `);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\nProduct Statistics:');
    console.log(`  Total Products: ${result.rows[0].total_products}`);
    console.log(`  Products with B2B Price: ${result.rows[0].products_with_b2b_price}`);
    console.log(`  Products with B2B Discount: ${result.rows[0].products_with_b2b_discount}`);
    console.log(`  Products with B2B Discount %: ${result.rows[0].products_with_b2b_discount_percent}`);
    console.log(`  Products with Guarantee Period: ${result.rows[0].products_with_guarantee}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

