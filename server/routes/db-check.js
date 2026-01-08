// Endpoint to check database connection and table structure
const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/db-check", async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    console.log("🔍 Checking database connection and structure...");
    
    // Test basic connection
    const connectionTest = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log("✅ Database connection successful");
    
    // Check purchases table structure
    const purchasesColumns = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'purchases'
      ORDER BY ordinal_position
    `);
    
    // Check stock table structure
    const stockColumns = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'stock'
      ORDER BY ordinal_position
    `);
    
    // Check constraints on purchases table
    const purchasesConstraints = await client.query(`
      SELECT 
        constraint_name,
        constraint_type
      FROM information_schema.table_constraints 
      WHERE table_name = 'purchases'
    `);
    
    // Check unique constraint specifically
    const uniqueConstraint = await client.query(`
      SELECT 
        constraint_name,
        constraint_type
      FROM information_schema.table_constraints 
      WHERE table_name = 'purchases' 
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%product_sku%serial_number%'
    `);
    
    // Check if required columns exist
    const requiredPurchasesColumns = [
      'product_sku', 'product_series', 'serial_number', 
      'purchase_number', 'dp', 'purchase_value', 
      'discount_amount', 'discount_percent', 'product_type_id'
    ];
    const existingPurchasesColumns = purchasesColumns.rows.map(r => r.column_name);
    const missingPurchasesColumns = requiredPurchasesColumns.filter(col => !existingPurchasesColumns.includes(col));
    
    // Test a simple query on purchases table
    let purchasesTestQuery = null;
    try {
      const testResult = await client.query('SELECT COUNT(*) as count FROM purchases LIMIT 1');
      purchasesTestQuery = { success: true, count: testResult.rows[0].count };
    } catch (testErr) {
      purchasesTestQuery = { success: false, error: testErr.message };
    }
    
    // Test a simple query on stock table
    let stockTestQuery = null;
    try {
      const testResult = await client.query('SELECT COUNT(*) as count FROM stock LIMIT 1');
      stockTestQuery = { success: true, count: testResult.rows[0].count };
    } catch (testErr) {
      stockTestQuery = { success: false, error: testErr.message };
    }
    
    res.json({
      success: true,
      connection: {
        status: "connected",
        current_time: connectionTest.rows[0].current_time,
        pg_version: connectionTest.rows[0].pg_version.split(' ')[0] + ' ' + connectionTest.rows[0].pg_version.split(' ')[1]
      },
      purchases_table: {
        exists: purchasesColumns.rows.length > 0,
        columns: purchasesColumns.rows,
        required_columns: {
          expected: requiredPurchasesColumns,
          existing: existingPurchasesColumns,
          missing: missingPurchasesColumns
        },
        constraints: purchasesConstraints.rows,
        unique_constraint: uniqueConstraint.rows.length > 0 ? uniqueConstraint.rows[0] : null,
        test_query: purchasesTestQuery
      },
      stock_table: {
        exists: stockColumns.rows.length > 0,
        columns: stockColumns.rows,
        test_query: stockTestQuery
      },
      recommendations: [
        ...(missingPurchasesColumns.length > 0 ? [`Run /api/init to add missing columns: ${missingPurchasesColumns.join(', ')}`] : []),
        ...(uniqueConstraint.rows.length === 0 ? ['Unique constraint on (product_sku, serial_number) is missing. Run /api/init to add it.'] : []),
        ...(!purchasesTestQuery.success ? [`Purchases table query failed: ${purchasesTestQuery.error}`] : []),
        ...(!stockTestQuery.success ? [`Stock table query failed: ${stockTestQuery.error}`] : [])
      ]
    });
    
  } catch (error) {
    console.error("❌ DB check error:", error);
    res.status(500).json({
      success: false,
      error: "Database check failed",
      details: process.env.NODE_ENV === 'production' ? undefined : error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  } finally {
    client.release();
  }
});

module.exports = router;

