// Backfill script to add purchase records for replacement batteries
// This script will process all battery_replacements that have new_serial_number
// and add them to purchases table if they don't already exist

const db = require('../db');

async function backfillReplacementPurchases() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting backfill of replacement purchases...');
    
    // Get all replacement batteries from stock table that were added via company returns
    // These are batteries where purchased_from = 'Exide Company Return' and don't have purchase records
    const replacementsResult = await client.query(`
      SELECT 
        s.id,
        s.serial_number as new_serial_number,
        s.purchase_date as replacement_date,
        s.product_id,
        p.sku,
        p.product_type_id,
        p.series,
        p.name
      FROM stock s
      JOIN products p ON s.product_id = p.id
      LEFT JOIN purchases pur ON pur.product_sku = p.sku AND pur.serial_number = s.serial_number
      WHERE s.purchased_from = 'Exide Company Return'
        AND s.serial_number IS NOT NULL 
        AND TRIM(s.serial_number) != ''
        AND pur.id IS NULL
        AND s.status = 'available'
      ORDER BY s.purchase_date ASC
    `);
    
    console.log(`Found ${replacementsResult.rows.length} replacements to process`);
    
    let added = 0;
    let skipped = 0;
    let errors = 0;
    
    // Helper function to generate purchase number
    async function generatePurchaseNumber(purchaseDate) {
      const dateObj = purchaseDate ? new Date(purchaseDate) : new Date();
      const dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, '');
      
      try {
        const result = await client.query(
          `SELECT purchase_number FROM purchases 
           WHERE purchase_number LIKE $1 
           ORDER BY purchase_number DESC 
           LIMIT 1`,
          [`PO-${dateStr}-%`]
        );
        
        if (result.rows.length === 0) {
          return `PO-${dateStr}-0001`;
        }
        
        const lastNumber = result.rows[0].purchase_number.split('-')[2];
        const nextNumber = String(parseInt(lastNumber, 10) + 1).padStart(4, '0');
        return `PO-${dateStr}-${nextNumber}`;
      } catch (err) {
        const fallback = Date.now().toString().slice(-4);
        return `PO-${dateStr}-${fallback}`;
      }
    }
    
    // Helper function to get average purchase price
    async function getAveragePurchasePrice(productSku) {
      try {
        const result = await client.query(
          `SELECT AVG(amount) as avg_amount 
           FROM purchases 
           WHERE product_sku = $1 
           AND amount > 0
           AND supplier_name != 'replace'`,
          [productSku]
        );
        
        if (result.rows.length > 0 && result.rows[0].avg_amount) {
          return parseFloat(result.rows[0].avg_amount || 0);
        }
        
        return 0;
      } catch (err) {
        console.error('Error getting average purchase price:', err);
        return 0;
      }
    }
    
    for (const replacement of replacementsResult.rows) {
      try {
        const serialNumber = replacement.new_serial_number.trim();
        const replacementDate = replacement.replacement_date || new Date();
        const purchaseDateStr = replacementDate instanceof Date 
          ? replacementDate.toISOString().split('T')[0] 
          : new Date(replacementDate).toISOString().split('T')[0];
        
        // Check if purchase record already exists
        const existingPurchase = await client.query(
          `SELECT id FROM purchases 
           WHERE product_sku = $1 AND serial_number = $2`,
          [replacement.sku, serialNumber]
        );
        
        if (existingPurchase.rows.length > 0) {
          console.log(`Skipping ${serialNumber} - purchase record already exists`);
          skipped++;
          continue;
        }
        
        // Serial number already verified from stock table query, so skip this check
        
        // Get average purchase price
        const avgPurchasePrice = await getAveragePurchasePrice(replacement.sku);
        
        // Generate purchase number
        const purchaseNumber = await generatePurchaseNumber(purchaseDateStr);
        
        // Insert purchase record
        await client.query(
          `INSERT INTO purchases (
            product_type_id, purchase_date, purchase_number, product_series,
            product_sku, serial_number, supplier_name, amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            replacement.product_type_id,
            purchaseDateStr,
            purchaseNumber,
            replacement.series || null,
            replacement.sku,
            serialNumber,
            'replace',
            avgPurchasePrice
          ]
        );
        
        console.log(`Added purchase record for ${serialNumber} (SKU: ${replacement.sku}, Price: ${avgPurchasePrice})`);
        added++;
      } catch (err) {
        console.error(`Error processing replacement ${replacement.id}:`, err.message);
        errors++;
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n=== Backfill Summary ===');
    console.log(`Total replacements processed: ${replacementsResult.rows.length}`);
    console.log(`Purchase records added: ${added}`);
    console.log(`Skipped (already exists or not in stock): ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log('Backfill completed successfully!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during backfill:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run the backfill
if (require.main === module) {
  backfillReplacementPurchases()
    .then(() => {
      console.log('Script completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Script failed:', err);
      process.exit(1);
    });
}

module.exports = { backfillReplacementPurchases };

