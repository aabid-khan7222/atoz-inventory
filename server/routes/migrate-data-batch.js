// Batch migration endpoint - Migrate data in smaller chunks
// This handles large datasets by processing in batches
const express = require("express");
const db = require("../db");

const router = express.Router();

// POST /api/migrate-data-batch
// Body: { batch: 'products'|'sales'|'purchases'|'users', data: [...], batchNumber: 1, totalBatches: 5 }
router.post("/migrate-data-batch", async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { batch, data, batchNumber, totalBatches } = req.body;
    
    if (!batch || !data || !Array.isArray(data)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: "Invalid batch data. Need: batch, data array, batchNumber, totalBatches"
      });
    }
    
    console.log(`🚀 Processing batch ${batchNumber}/${totalBatches} for ${batch} (${data.length} items)...`);
    
    let inserted = 0;
    let skipped = 0;
    const errors = [];
    
    // Process based on batch type
    if (batch === 'products') {
      for (const product of data) {
        try {
          const result = await client.query(`
            INSERT INTO products (
              sku, series, category, name, qty,
              mrp_price, selling_price, discount, discount_percent,
              b2b_selling_price, b2b_discount, b2b_discount_percent,
              b2b_mrp, dp, ah_va, warranty, guarantee_period_months,
              order_index, product_type_id, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
            ON CONFLICT (sku) DO UPDATE SET
              series = EXCLUDED.series,
              category = EXCLUDED.category,
              name = EXCLUDED.name,
              qty = EXCLUDED.qty,
              mrp_price = EXCLUDED.mrp_price,
              selling_price = EXCLUDED.selling_price,
              discount = EXCLUDED.discount,
              discount_percent = EXCLUDED.discount_percent,
              b2b_selling_price = EXCLUDED.b2b_selling_price,
              b2b_discount = EXCLUDED.b2b_discount,
              b2b_discount_percent = EXCLUDED.b2b_discount_percent,
              b2b_mrp = EXCLUDED.b2b_mrp,
              dp = EXCLUDED.dp,
              ah_va = EXCLUDED.ah_va,
              warranty = EXCLUDED.warranty,
              guarantee_period_months = EXCLUDED.guarantee_period_months,
              order_index = EXCLUDED.order_index,
              product_type_id = EXCLUDED.product_type_id,
              updated_at = CURRENT_TIMESTAMP
          `, [
            product.sku || null, 
            product.series || null, 
            product.category || null, 
            product.name || null, 
            parseInt(product.qty) || 0,
            parseFloat(product.mrp_price) || 0, 
            parseFloat(product.selling_price) || 0, 
            parseFloat(product.discount) || 0, 
            parseFloat(product.discount_percent) || 0,
            product.b2b_selling_price ? parseFloat(product.b2b_selling_price) : null, 
            product.b2b_discount ? parseFloat(product.b2b_discount) : 0, 
            product.b2b_discount_percent ? parseFloat(product.b2b_discount_percent) : 0,
            product.b2b_mrp ? parseFloat(product.b2b_mrp) : null, 
            product.dp ? parseFloat(product.dp) : null, 
            product.ah_va || null, 
            product.warranty || null, 
            parseInt(product.guarantee_period_months) || 0,
            product.order_index ? parseInt(product.order_index) : null, 
            parseInt(product.product_type_id) || 1,
            product.created_at ? new Date(product.created_at) : new Date(), 
            product.updated_at ? new Date(product.updated_at) : new Date()
          ]);
          
          if (result.rowCount > 0) inserted++;
          else skipped++;
        } catch (err) {
          errors.push(`${product.sku}: ${err.message}`);
          skipped++;
        }
      }
    }
    // Add other batch types (sales, purchases, users) similarly
    
    await client.query('COMMIT');
    
    console.log(`✅ Batch ${batchNumber}/${totalBatches} complete: ${inserted} inserted, ${skipped} skipped`);
    
    res.json({
      success: true,
      batch,
      batchNumber,
      totalBatches,
      inserted,
      skipped,
      total: data.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined // Show first 5 errors
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Batch ${batchNumber} failed:`, error);
    res.status(500).json({
      success: false,
      error: "Batch migration failed",
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;

