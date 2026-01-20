/**
 * Migration script to backfill existing purchases data into stock table
 * 
 * This script reads all records from the purchases table and creates corresponding
 * entries in the stock table so they appear in the Current Stock section.
 * 
 * Usage: node server/scripts/backfill_purchases_to_stock.js
 */

require('dotenv').config();
const db = require('../db');

async function backfillPurchasesToStock() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('🔄 Starting backfill of purchases to stock table...\n');

    // First, check if stock table exists
    const stockTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'stock'
      )
    `);
    
    if (!stockTableCheck.rows[0].exists) {
      console.error('❌ Stock table does not exist. Please create it first.');
      await client.query('ROLLBACK');
      return;
    }

    // Get all purchases that have serial numbers and product_sku
    const purchasesResult = await client.query(`
      SELECT 
        p.id as purchase_id,
        p.product_type_id,
        p.purchase_date,
        p.product_sku,
        p.product_series,
        p.serial_number,
        p.supplier_name,
        p.dp,
        p.purchase_value,
        p.discount_amount,
        p.discount_percent,
        p.quantity
      FROM purchases p
      WHERE p.serial_number IS NOT NULL 
        AND p.product_sku IS NOT NULL
        AND p.product_sku != ''
        AND p.serial_number != ''
      ORDER BY p.id
    `);

    console.log(`📊 Found ${purchasesResult.rows.length} purchase records to process\n`);

    if (purchasesResult.rows.length === 0) {
      console.log('✅ No purchases to backfill. Stock table is up to date.');
      await client.query('COMMIT');
      return;
    }

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    // Process each purchase
    for (const purchase of purchasesResult.rows) {
      try {
        // Find the product_id from products table using SKU
        const productResult = await client.query(`
          SELECT id, name, category, ah_va, warranty, series
          FROM products
          WHERE sku = $1
          LIMIT 1
        `, [purchase.product_sku]);

        if (productResult.rows.length === 0) {
          console.warn(`⚠️  Product not found for SKU: ${purchase.product_sku}, serial: ${purchase.serial_number}`);
          skipped++;
          continue;
        }

        const product = productResult.rows[0];

        // Check if this stock entry already exists
        const existingStock = await client.query(`
          SELECT id FROM stock
          WHERE product_id = $1 AND serial_number = $2
        `, [product.id, purchase.serial_number]);

        if (existingStock.rows.length > 0) {
          // Update existing stock entry with purchase info
          await client.query(`
            UPDATE stock
            SET purchase_date = $1,
                purchased_from = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE product_id = $3 AND serial_number = $4
          `, [
            purchase.purchase_date,
            purchase.supplier_name || null,
            product.id,
            purchase.serial_number
          ]);
          skipped++;
          continue;
        }

        // Insert new stock entry
        await client.query(`
          INSERT INTO stock (
            purchase_date, sku, series, category, name, ah_va, quantity,
            purchased_from, warranty, product_type_id, product_id, serial_number, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'available')
        `, [
          purchase.purchase_date,
          purchase.product_sku,
          purchase.product_series || product.series || null,
          product.category || null,
          product.name,
          product.ah_va || null,
          purchase.quantity || 1,
          purchase.supplier_name || null,
          product.warranty || null,
          purchase.product_type_id,
          product.id,
          purchase.serial_number
        ]);

        inserted++;
        
        if (inserted % 100 === 0) {
          console.log(`  Processed ${inserted + skipped} records...`);
        }
      } catch (err) {
        console.error(`❌ Error processing purchase ID ${purchase.purchase_id}:`, err.message);
        errors++;
      }
    }

    console.log('\n✅ Backfill completed!');
    console.log(`   Inserted: ${inserted} new stock records`);
    console.log(`   Skipped: ${skipped} (already exist or missing product)`);
    console.log(`   Errors: ${errors}`);

    await client.query('COMMIT');
    console.log('\n✅ Transaction committed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error during backfill:', err);
    console.error('Transaction rolled back.');
    throw err;
  } finally {
    client.release();
    await db.pool.end();
  }
}

// Run the migration
backfillPurchasesToStock()
  .then(() => {
    console.log('\n🎉 Migration script completed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Migration script failed:', err);
    process.exit(1);
  });

