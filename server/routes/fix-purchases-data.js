// Endpoint to fix existing purchases data - migrate from old schema to new schema
const express = require("express");
const db = require("../db");

const router = express.Router();

router.post("/fix-purchases-data", async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    console.log("🔧 Starting purchases data fix...");
    
    // Check what columns exist in purchases table
    const columnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'purchases'
      ORDER BY column_name
    `);
    const existingColumns = columnsCheck.rows.map(r => r.column_name);
    console.log("📋 Existing columns:", existingColumns.join(', '));
    
    // Check if we have old schema columns (sku, series, name) or new schema (product_sku, product_series)
    const hasOldSchema = existingColumns.includes('sku') && existingColumns.includes('series');
    const hasNewSchema = existingColumns.includes('product_sku') && existingColumns.includes('product_series');
    
    let updated = 0;
    let skipped = 0;
    const errors = [];
    
    if (hasOldSchema && !hasNewSchema) {
      // Old schema exists, need to migrate to new schema
      console.log("📋 Detected old schema. Migrating to new schema...");
      
      // First, ensure new columns exist
      const newColumns = {
        'product_sku': 'VARCHAR(100)',
        'product_series': 'VARCHAR(100)',
        'serial_number': 'VARCHAR(255)',
        'purchase_number': 'VARCHAR(50)',
        'product_type_id': 'INTEGER',
        'dp': 'NUMERIC(12, 2) DEFAULT 0',
        'purchase_value': 'NUMERIC(12, 2) DEFAULT 0',
        'discount_amount': 'NUMERIC(12, 2) DEFAULT 0',
        'discount_percent': 'NUMERIC(5, 2) DEFAULT 0'
      };
      
      for (const [colName, colType] of Object.entries(newColumns)) {
        if (!existingColumns.includes(colName)) {
          console.log(`📋 Adding column: ${colName}`);
          try {
            await client.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS ${colName} ${colType}`);
          } catch (err) {
            console.warn(`⚠️  Could not add column ${colName}:`, err.message);
          }
        }
      }
      
      // Now migrate data from old columns to new columns
      // First check if old columns have actual data (not just NULLs)
      const oldDataCheck = await client.query(`
        SELECT COUNT(*) as count
        FROM purchases
        WHERE sku IS NOT NULL AND sku != '' AND sku != 'UNKNOWN'
      `);
      
      const oldDataCount = parseInt(oldDataCheck.rows[0].count);
      console.log(`📋 Found ${oldDataCount} records with valid SKU in old schema`);
      
      if (oldDataCount === 0) {
        console.log("⚠️  No valid old schema data found. Records may need to be re-migrated from localhost export.");
      }
      
      const oldData = await client.query(`
        SELECT id, sku, series, name, purchase_date, purchase_price, total_amount, 
               supplier_name, invoice_number, product_type_id, quantity
        FROM purchases
        WHERE (product_sku IS NULL OR product_sku = '' OR product_sku LIKE 'UNKNOWN%') 
        AND sku IS NOT NULL AND sku != '' AND sku != 'UNKNOWN'
      `);
      
      console.log(`📋 Found ${oldData.rows.length} records to migrate from old schema`);
      
      for (const row of oldData.rows) {
        try {
          // Generate purchase number if missing (max 50 chars)
          let purchaseNumber = row.invoice_number;
          if (!purchaseNumber || purchaseNumber === '' || purchaseNumber.includes('al Time)')) {
            // Clean date string - handle Date objects properly
            let dateStr;
            if (row.purchase_date) {
              const dateObj = row.purchase_date instanceof Date ? row.purchase_date : new Date(row.purchase_date);
              dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, '');
            } else {
              dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            }
            // Keep it short: PUR-YYYYMMDD-ID (max 50 chars)
            purchaseNumber = `PUR-${dateStr}-${row.id}`;
            // Truncate if too long (max 50 chars)
            if (purchaseNumber.length > 50) {
              purchaseNumber = purchaseNumber.slice(0, 50);
            }
          } else if (purchaseNumber.includes('al Time)')) {
            // Fix corrupted purchase numbers
            const dateStr = row.purchase_date ? new Date(row.purchase_date).toISOString().slice(0, 10).replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');
            purchaseNumber = `PUR-${dateStr}-${row.id}`;
            if (purchaseNumber.length > 50) {
              purchaseNumber = purchaseNumber.slice(0, 50);
            }
          }
          
          // Generate serial number if missing (max 255 chars)
          let serialNumber = `${purchaseNumber}-1`;
          if (row.quantity > 1) {
            // For multiple items, we need to create multiple rows
            // But for now, just use the first one
            serialNumber = `${purchaseNumber}-1`;
          }
          // Ensure serial number doesn't exceed 255 chars
          if (serialNumber.length > 255) {
            serialNumber = serialNumber.slice(0, 255);
          }
          
          // Calculate prices - use actual values from old schema
          const purchasePrice = parseFloat(row.purchase_price) || 0;
          const totalAmount = parseFloat(row.total_amount) || 0;
          
          // If both are 0, try to get from amount column if it exists
          let dp = purchasePrice || totalAmount;
          let purchaseValue = totalAmount || purchasePrice;
          
          // Check if amount column exists and use it as fallback
          if ((dp === 0 || purchaseValue === 0) && existingColumns.includes('amount')) {
            const amountCheck = await client.query('SELECT amount FROM purchases WHERE id = $1', [row.id]);
            if (amountCheck.rows.length > 0 && amountCheck.rows[0].amount) {
              const amount = parseFloat(amountCheck.rows[0].amount);
              if (dp === 0) dp = amount;
              if (purchaseValue === 0) purchaseValue = amount;
            }
          }
          
          const discountAmount = Math.max(0, dp - purchaseValue);
          const discountPercent = dp > 0 ? Math.round((discountAmount / dp) * 10000) / 100 : 0;
          
          await client.query(`
            UPDATE purchases
            SET 
              product_sku = $1,
              product_series = $2,
              serial_number = $3,
              purchase_number = $4,
              product_type_id = COALESCE($5, 1),
              dp = $6,
              purchase_value = $7,
              discount_amount = $8,
              discount_percent = $9,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $10
          `, [
            row.sku,
            row.series || null,
            serialNumber,
            purchaseNumber,
            row.product_type_id || 1,
            dp,
            purchaseValue,
            discountAmount,
            discountPercent,
            row.id
          ]);
          
          updated++;
        } catch (err) {
          console.error(`❌ Error updating purchase ${row.id}:`, err.message);
          errors.push(`ID ${row.id}: ${err.message}`);
          skipped++;
        }
      }
      
    } else if (hasNewSchema) {
      // New schema exists, but some records might have NULL values or values too long
      console.log("📋 Detected new schema. Fixing NULL values and length issues...");
      
      // First, fix purchase_numbers that are too long (VARCHAR(50) limit)
      const longPurchaseNumbers = await client.query(`
        SELECT id, purchase_number
        FROM purchases
        WHERE LENGTH(purchase_number) > 50
      `);
      
      console.log(`📋 Found ${longPurchaseNumbers.rows.length} records with purchase_number > 50 chars`);
      
      for (const row of longPurchaseNumbers.rows) {
        try {
          const truncated = row.purchase_number.slice(0, 50);
          await client.query(`
            UPDATE purchases
            SET purchase_number = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [truncated, row.id]);
          updated++;
          console.log(`✅ Truncated purchase_number for ID ${row.id}: ${row.purchase_number.length} -> 50 chars`);
        } catch (err) {
          console.error(`❌ Error truncating purchase_number for ID ${row.id}:`, err.message);
          errors.push(`ID ${row.id}: ${err.message}`);
          skipped++;
        }
      }
      
      // Fix records with NULL product_sku or purchase_number
      const nullRecords = await client.query(`
        SELECT id, product_sku, purchase_number, serial_number, purchase_date
        FROM purchases
        WHERE (product_sku IS NULL OR product_sku = '') 
           OR (purchase_number IS NULL OR purchase_number = '')
           OR (serial_number IS NULL OR serial_number = '')
      `);
      
      console.log(`📋 Found ${nullRecords.rows.length} records with NULL values`);
      
      for (const row of nullRecords.rows) {
        try {
          // Generate missing values (ensure they fit column sizes)
          let purchaseNumber = row.purchase_number;
          if (!purchaseNumber || purchaseNumber === '') {
            const dateStr = row.purchase_date ? row.purchase_date.toString().replace(/-/g, '').slice(-8) : Date.now().toString().slice(-8);
            purchaseNumber = `PUR-${dateStr}-${row.id}`;
            // Truncate if too long (max 50 chars for purchase_number)
            if (purchaseNumber.length > 50) {
              purchaseNumber = purchaseNumber.slice(0, 50);
            }
          } else if (purchaseNumber.length > 50) {
            // Truncate existing purchase_number if too long
            purchaseNumber = purchaseNumber.slice(0, 50);
          }
          
          let serialNumber = row.serial_number;
          if (!serialNumber || serialNumber === '') {
            serialNumber = `${purchaseNumber}-1`;
          }
          // Ensure serial_number doesn't exceed 255 chars
          if (serialNumber.length > 255) {
            serialNumber = serialNumber.slice(0, 255);
          }
          
          let productSku = row.product_sku;
          if (!productSku || productSku === '' || productSku.startsWith('UNKNOWN')) {
            // Try to get from products table by matching name or SKU
            if (row.sku && row.sku !== 'UNKNOWN') {
              const productCheck = await client.query('SELECT sku FROM products WHERE sku = $1 LIMIT 1', [row.sku]);
              if (productCheck.rows.length > 0) {
                productSku = productCheck.rows[0].sku;
              } else {
                // Use the SKU from old schema
                productSku = row.sku;
              }
            } else {
              // Last resort: use placeholder but log it
              productSku = `UNKNOWN-${row.id}`;
              console.warn(`⚠️  Using placeholder SKU for purchase ID ${row.id}`);
            }
          }
          // Ensure product_sku doesn't exceed 100 chars
          if (productSku.length > 100) {
            productSku = productSku.slice(0, 100);
          }
          
          await client.query(`
            UPDATE purchases
            SET 
              product_sku = COALESCE(NULLIF(product_sku, ''), $1),
              purchase_number = COALESCE(NULLIF(purchase_number, ''), $2),
              serial_number = COALESCE(NULLIF(serial_number, ''), $3),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
          `, [productSku, purchaseNumber, serialNumber, row.id]);
          
          updated++;
        } catch (err) {
          console.error(`❌ Error fixing purchase ${row.id}:`, err.message);
          errors.push(`ID ${row.id}: ${err.message}`);
          skipped++;
        }
      }
      
      // Also ensure dp and purchase_value are set
      const zeroValueRecords = await client.query(`
        SELECT id, dp, purchase_value
        FROM purchases
        WHERE (dp IS NULL OR dp = 0) 
           OR (purchase_value IS NULL OR purchase_value = 0)
      `);
      
      console.log(`📋 Found ${zeroValueRecords.rows.length} records with zero/null values`);
      
      for (const row of zeroValueRecords.rows) {
        try {
          // Try to get from old amount column if it exists
          let dp = row.dp || 0;
          let purchaseValue = row.purchase_value || 0;
          
          if (existingColumns.includes('amount')) {
            const amountCheck = await client.query('SELECT amount FROM purchases WHERE id = $1', [row.id]);
            if (amountCheck.rows.length > 0 && amountCheck.rows[0].amount) {
              const amount = parseFloat(amountCheck.rows[0].amount);
              if (dp === 0 || !dp) dp = amount;
              if (purchaseValue === 0 || !purchaseValue) purchaseValue = amount;
            }
          }
          
          if (dp > 0 || purchaseValue > 0) {
            const finalDp = dp || purchaseValue;
            const finalPurchaseValue = purchaseValue || dp;
            const discountAmount = Math.max(0, finalDp - finalPurchaseValue);
            const discountPercent = finalDp > 0 ? Math.round((discountAmount / finalDp) * 10000) / 100 : 0;
            
            await client.query(`
              UPDATE purchases
              SET 
                dp = $1,
                purchase_value = $2,
                discount_amount = $3,
                discount_percent = $4,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $5
            `, [finalDp, finalPurchaseValue, discountAmount, discountPercent, row.id]);
            
            updated++;
          }
        } catch (err) {
          console.error(`❌ Error updating purchase ${row.id}:`, err.message);
          errors.push(`ID ${row.id}: ${err.message}`);
          skipped++;
        }
      }
    }
    
    res.json({
      success: true,
      message: `Purchases data fix completed. ${updated} records updated, ${skipped} skipped.`,
      updated,
      skipped,
      errors: errors.slice(0, 10),
      columns: existingColumns
    });
    
  } catch (error) {
    console.error("❌ Fix purchases data error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fix purchases data",
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;

