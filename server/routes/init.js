// Database initialization endpoint
// Call this ONCE to set up base tables and admin user
const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");

const router = express.Router();

// GET endpoint to check initialization status
router.get("/init", async (req, res) => {
  const client = await db.pool.connect();
  try {
    // Check if tables exist
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'products', 'roles', 'purchases')
    `);
    
    const existingTables = tablesCheck.rows.map(r => r.table_name);
    const requiredTables = ['users', 'products', 'roles', 'purchases'];
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    // Check if admin user exists
    let adminExists = false;
    if (existingTables.includes('users')) {
      const adminCheck = await client.query(`
        SELECT COUNT(*) as count FROM users WHERE role_id = 1 OR role_id = 2
      `);
      adminExists = parseInt(adminCheck.rows[0].count) > 0;
    }
    
    // Check if purchases table has required columns
    let purchasesColumnsOk = false;
    if (existingTables.includes('purchases')) {
      const columnsCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'purchases'
        AND column_name IN ('dp', 'purchase_value', 'discount_amount', 'discount_percent')
      `);
      purchasesColumnsOk = columnsCheck.rows.length >= 4;
    }
    
    res.json({
      initialized: missingTables.length === 0 && adminExists && purchasesColumnsOk,
      tables: {
        existing: existingTables,
        missing: missingTables,
        allPresent: missingTables.length === 0
      },
      adminExists,
      purchasesColumnsOk,
      message: missingTables.length > 0 
        ? "Database not initialized. Use POST /api/init to initialize."
        : !adminExists
        ? "Database tables exist but admin user not found. Use POST /api/init to create admin."
        : !purchasesColumnsOk
        ? "Purchases table missing required columns. Use POST /api/init to add them."
        : "Database is initialized and ready.",
      usage: "Use POST /api/init to initialize the database"
    });
  } catch (error) {
    console.error("GET /api/init error:", error);
    res.status(500).json({
      initialized: false,
      error: "Error checking initialization status",
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  } finally {
    client.release();
  }
});

router.post("/init", async (req, res) => {
  const client = await db.pool.connect();
  const fs = require('fs');
  const path = require('path');
  
  try {
    console.log("🚀 Starting complete database initialization...");
    
    // Read and execute comprehensive base tables migration
    const baseTablesPath = path.join(__dirname, '../migrations/000_create_all_base_tables.sql');
    const baseTablesSQL = fs.readFileSync(baseTablesPath, 'utf8');
    
    console.log("📋 Creating all base tables...");
    await client.query(baseTablesSQL);
    console.log("✅ All base tables created");
          
          // Run commission_agents migration (adds commission columns to sales_item)
          try {
            const commissionAgentsPath = path.join(__dirname, '../migrations/create_commission_agents_table.sql');
            if (fs.existsSync(commissionAgentsPath)) {
              const commissionAgentsSQL = fs.readFileSync(commissionAgentsPath, 'utf8');
              console.log("📋 Adding commission agents table and columns...");
              await client.query(commissionAgentsSQL);
              console.log("✅ Commission agents table and columns added");
            }
          } catch (err) {
            console.warn("⚠️  Commission agents migration skipped (may already exist):", err.message);
          }
          
          // Run create_purchase_tables migration first (ensures purchases table exists with base schema)
          try {
            const createPurchaseTablesPath = path.join(__dirname, '../migrations/create_purchase_tables.sql');
            if (fs.existsSync(createPurchaseTablesPath)) {
              const createPurchaseTablesSQL = fs.readFileSync(createPurchaseTablesPath, 'utf8');
              console.log("📋 Ensuring purchases table has correct base schema...");
              await client.query(createPurchaseTablesSQL);
              console.log("✅ Purchases table base schema verified");
            }
          } catch (err) {
            console.warn("⚠️  Create purchase tables migration skipped (may already exist):", err.message);
          }
          
          // Run add_dp_to_purchases migration (adds dp, purchase_value, discount columns)
          try {
            const addDpToPurchasesPath = path.join(__dirname, '../migrations/add_dp_to_purchases.sql');
            if (fs.existsSync(addDpToPurchasesPath)) {
              const addDpToPurchasesSQL = fs.readFileSync(addDpToPurchasesPath, 'utf8');
              console.log("📋 Adding DP and discount columns to purchases table...");
              await client.query(addDpToPurchasesSQL);
              console.log("✅ DP and discount columns added to purchases table");
            }
          } catch (err) {
            console.warn("⚠️  Add DP to purchases migration skipped (may already exist):", err.message);
          }
          
          // Make old purchases columns nullable (if they exist)
          try {
            const makeOldColumnsNullablePath = path.join(__dirname, '../migrations/make_old_purchases_columns_nullable.sql');
            if (fs.existsSync(makeOldColumnsNullablePath)) {
              const makeOldColumnsNullableSQL = fs.readFileSync(makeOldColumnsNullablePath, 'utf8');
              console.log("📋 Making old purchases columns nullable...");
              await client.query(makeOldColumnsNullableSQL);
              console.log("✅ Old purchases columns made nullable");
            }
          } catch (err) {
            console.warn("⚠️  Make old columns nullable migration skipped (may already be done):", err.message);
          }
          
          // Ensure purchases table has all required columns (safety check)
          try {
            console.log("📋 Verifying purchases table columns...");
            const checkColumns = await client.query(`
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = 'purchases'
            `);
            const columnNames = checkColumns.rows.map(r => r.column_name);
            console.log("📋 Purchases table columns:", columnNames.join(', '));
            
            // Add missing columns if they don't exist
            const requiredColumns = {
              'dp': 'NUMERIC(12, 2) DEFAULT 0',
              'purchase_value': 'NUMERIC(12, 2) DEFAULT 0',
              'discount_amount': 'NUMERIC(12, 2) DEFAULT 0',
              'discount_percent': 'NUMERIC(5, 2) DEFAULT 0',
              'product_sku': 'VARCHAR(100)',
              'product_series': 'VARCHAR(100)',
              'serial_number': 'VARCHAR(255)',
              'purchase_number': 'VARCHAR(50)',
              'product_type_id': 'INTEGER'
            };
            
            for (const [colName, colType] of Object.entries(requiredColumns)) {
              if (!columnNames.includes(colName)) {
                console.log(`📋 Adding missing column: ${colName}`);
                try {
                  // For product_type_id, add without foreign key first, then add FK if needed
                  if (colName === 'product_type_id') {
                    await client.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS ${colName} ${colType}`);
                    // Try to add foreign key constraint separately
                    try {
                      await client.query(`
                        ALTER TABLE purchases 
                        ADD CONSTRAINT purchases_product_type_id_fkey 
                        FOREIGN KEY (product_type_id) 
                        REFERENCES purchase_product_type(id)
                      `);
                      console.log(`✅ Added foreign key constraint for ${colName}`);
                    } catch (fkErr) {
                      console.warn(`⚠️  Foreign key constraint may already exist for ${colName}:`, fkErr.message);
                    }
                  } else {
                    await client.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS ${colName} ${colType}`);
                  }
                  console.log(`✅ Added column: ${colName}`);
                } catch (colErr) {
                  console.warn(`⚠️  Could not add column ${colName}:`, colErr.message);
                }
              } else {
                console.log(`✅ Column already exists: ${colName}`);
              }
            }
            
            // Add unique constraint if it doesn't exist
            const constraintCheck = await client.query(`
              SELECT constraint_name 
              FROM information_schema.table_constraints 
              WHERE table_name = 'purchases' 
              AND constraint_type = 'UNIQUE'
              AND constraint_name LIKE '%product_sku%serial_number%'
            `);
            
            if (constraintCheck.rows.length === 0) {
              try {
                await client.query(`
                  ALTER TABLE purchases 
                  ADD CONSTRAINT purchases_product_sku_serial_number_unique 
                  UNIQUE (product_sku, serial_number)
                `);
                console.log("✅ Added unique constraint on (product_sku, serial_number)");
              } catch (constraintErr) {
                console.warn("⚠️  Unique constraint may already exist:", constraintErr.message);
              }
            }
            
            console.log("✅ Purchases table columns verified");
          } catch (err) {
            console.warn("⚠️  Column verification skipped:", err.message);
          }
    
    // Create roles table (if not already created)
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        role_name VARCHAR(50) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Insert default roles
    await client.query(`
      INSERT INTO roles (id, role_name) VALUES 
        (1, 'Super Admin'),
        (2, 'Admin'),
        (3, 'Customer')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log("✅ Roles table ready");
    
    // Create users table (if not already created)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20),
        password VARCHAR(255),
        role_id INTEGER NOT NULL DEFAULT 3,
        is_active BOOLEAN DEFAULT true,
        state VARCHAR(100),
        city VARCHAR(100),
        address TEXT,
        gst_number VARCHAR(50),
        company_name VARCHAR(255),
        company_address TEXT,
        user_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      );
    `);
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
      CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
    `);
    console.log("✅ Users table ready");
    
    // Create customer_profiles table (if not already created)
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_profiles (
        user_id INTEGER PRIMARY KEY,
        full_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(20),
        state VARCHAR(100),
        city VARCHAR(100),
        address TEXT,
        pincode VARCHAR(10),
        is_business_customer BOOLEAN DEFAULT false,
        company_name VARCHAR(255),
        gst_number VARCHAR(50),
        company_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log("✅ Customer profiles table ready");
    
    // Check if admin exists
    const adminCheck = await client.query(
      "SELECT id FROM users WHERE email = 'admin@atozinventory.com' LIMIT 1"
    );
    
    if (adminCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        `INSERT INTO users (full_name, email, password, role_id, is_active)
         VALUES ($1, $2, $3, $4, $5)`,
        ['Super Admin', 'admin@atozinventory.com', hashedPassword, 1, true]
      );
      console.log("✅ Default admin user created");
    } else {
      console.log("ℹ️  Admin user already exists");
    }
    
    // Sample products insertion removed - user's own products will be migrated
    // No dummy products will be added automatically
    
    res.json({
      success: true,
      message: "Complete database initialized successfully! All tables created and sample data inserted.",
      admin: {
        email: "admin@atozinventory.com",
        password: "admin123",
        note: "Please change password after first login"
      },
      tablesCreated: [
        "roles", "users", "customer_profiles",
        "product_type", "products", "stock",
        "sales_types", "sales_id", "sales_item",
        "purchases", "notifications",
        "charging_services", "service_requests", "company_returns",
        "warranty_slabs", "battery_replacements", "stock_history",
        "employees", "commission_agents", "daily_attendance"
      ],
      sampleDataInserted: {
        products: 0,
        note: "No sample products added. Add your products through the admin panel or migrate from localhost."
      }
    });
    
  } catch (error) {
    console.error("❌ Initialization failed:", error);
    res.status(500).json({
      success: false,
      error: "Database initialization failed",
      details: process.env.NODE_ENV === 'production' ? undefined : error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  } finally {
    client.release();
  }
});

// Endpoint to delete dummy/sample products
router.post("/delete-dummy-products", async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    console.log("🗑️  Deleting dummy products...");
    
    // List of dummy product SKUs and name patterns that were added during initialization
    const dummyProductSKUs = [
      'EXIDE-CAR-100AH',
      'EXIDE-BIKE-7AH',
      'EXIDE-UPS-150AH',
      'EXIDE-DW-5L',
      'GEN-DW-5L'
    ];
    
    const dummyProductNamePatterns = [
      'Exide Car Battery 100AH',
      'Exide Bike Battery 7AH',
      'Exide UPS Battery 150AH',
      'Exide Distilled Water 5L',
      'Generic Distilled Water 5L'
    ];
    
    let deletedCount = 0;
    const deletedProducts = [];
    
    // Delete by SKU first
    for (const sku of dummyProductSKUs) {
      try {
        const checkResult = await client.query(
          'SELECT id, name, sku FROM products WHERE sku = $1',
          [sku]
        );
        
        if (checkResult.rows.length > 0) {
          const product = checkResult.rows[0];
          const deleteResult = await client.query(
            'DELETE FROM products WHERE sku = $1',
            [sku]
          );
          
          if (deleteResult.rowCount > 0) {
            deletedCount++;
            deletedProducts.push({ sku: product.sku, name: product.name });
            console.log(`✅ Deleted by SKU: ${product.sku} - ${product.name}`);
          }
        }
      } catch (err) {
        console.error(`❌ Error deleting product ${sku}:`, err.message);
      }
    }
    
    // Also delete by exact name match (in case SKU is different)
    for (const namePattern of dummyProductNamePatterns) {
      try {
        const checkResult = await client.query(
          'SELECT id, name, sku FROM products WHERE name = $1',
          [namePattern]
        );
        
        if (checkResult.rows.length > 0) {
          for (const product of checkResult.rows) {
            // Skip if already deleted
            if (deletedProducts.some(p => p.sku === product.sku)) {
              continue;
            }
            
            const deleteResult = await client.query(
              'DELETE FROM products WHERE id = $1',
              [product.id]
            );
            
            if (deleteResult.rowCount > 0) {
              deletedCount++;
              deletedProducts.push({ sku: product.sku, name: product.name });
              console.log(`✅ Deleted by name: ${product.sku} - ${product.name}`);
            }
          }
        }
      } catch (err) {
        console.error(`❌ Error deleting product by name ${namePattern}:`, err.message);
      }
    }
    
    res.json({
      success: true,
      message: `Deleted ${deletedCount} dummy product(s)`,
      deletedCount,
      deletedProducts,
      totalDummyProducts: dummyProductSKUs.length
    });
    
  } catch (error) {
    console.error("❌ Failed to delete dummy products:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete dummy products",
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;

