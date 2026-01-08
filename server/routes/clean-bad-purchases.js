// Endpoint to clean bad/placeholder purchases data
const express = require("express");
const db = require("../db");

const router = express.Router();

router.post("/clean-bad-purchases", async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    console.log("🧹 Starting bad purchases cleanup...");
    
    // Find purchases with placeholder/corrupted data
    const badPurchases = await client.query(`
      SELECT id, product_sku, purchase_number, dp, purchase_value
      FROM purchases
      WHERE product_sku LIKE 'UNKNOWN%'
         OR purchase_number LIKE '%al Time)%'
         OR (dp = 0 AND purchase_value = 0)
         OR purchase_number IS NULL
         OR product_sku IS NULL
    `);
    
    console.log(`📋 Found ${badPurchases.rows.length} bad/placeholder purchases`);
    
    if (badPurchases.rows.length === 0) {
      return res.json({
        success: true,
        message: "No bad purchases found. All data looks good!",
        deleted: 0
      });
    }
    
    // Ask for confirmation or delete directly
    const { confirm } = req.body;
    
    if (!confirm) {
      return res.json({
        success: true,
        message: `Found ${badPurchases.rows.length} bad purchases. Send confirm: true to delete them.`,
        found: badPurchases.rows.length,
        sample: badPurchases.rows.slice(0, 5).map(r => ({
          id: r.id,
          product_sku: r.product_sku,
          purchase_number: r.purchase_number
        }))
      });
    }
    
    // Delete bad purchases
    let deleted = 0;
    const errors = [];
    
    for (const row of badPurchases.rows) {
      try {
        await client.query('DELETE FROM purchases WHERE id = $1', [row.id]);
        deleted++;
        console.log(`✅ Deleted bad purchase ID ${row.id}`);
      } catch (err) {
        console.error(`❌ Error deleting purchase ${row.id}:`, err.message);
        errors.push(`ID ${row.id}: ${err.message}`);
      }
    }
    
    res.json({
      success: true,
      message: `Cleaned ${deleted} bad purchases. ${errors.length} errors.`,
      deleted,
      errors: errors.slice(0, 10)
    });
    
  } catch (error) {
    console.error("❌ Clean bad purchases error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clean bad purchases",
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;

