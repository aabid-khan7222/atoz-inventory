// Database initialization endpoint
// Call this ONCE to set up base tables and admin user
const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");

const router = express.Router();

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
    
    // List of dummy product SKUs that were added during initialization
    const dummyProductSKUs = [
      'EXIDE-CAR-100AH',
      'EXIDE-BIKE-7AH',
      'EXIDE-UPS-150AH',
      'EXIDE-DW-5L',
      'GEN-DW-5L'
    ];
    
    let deletedCount = 0;
    const deletedProducts = [];
    
    for (const sku of dummyProductSKUs) {
      try {
        // First check if product exists
        const checkResult = await client.query(
          'SELECT id, name FROM products WHERE sku = $1',
          [sku]
        );
        
        if (checkResult.rows.length > 0) {
          const product = checkResult.rows[0];
          
          // Delete the product
          const deleteResult = await client.query(
            'DELETE FROM products WHERE sku = $1',
            [sku]
          );
          
          if (deleteResult.rowCount > 0) {
            deletedCount++;
            deletedProducts.push({ sku, name: product.name });
            console.log(`✅ Deleted: ${sku} - ${product.name}`);
          }
        } else {
          console.log(`ℹ️  Product not found (may already be deleted): ${sku}`);
        }
      } catch (err) {
        console.error(`❌ Error deleting product ${sku}:`, err.message);
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

