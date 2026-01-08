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
    
    // Insert sample products data
    console.log("📦 Inserting sample products...");
    
    // Sample Car/Truck/Tractor Battery
    await client.query(`
      INSERT INTO products (
        sku, series, category, name, qty,
        mrp_price, selling_price, discount, discount_percent,
        b2b_selling_price, b2b_discount, b2b_discount_percent,
        ah_va, warranty, guarantee_period_months, order_index, product_type_id, dp
      ) VALUES (
        'EXIDE-CAR-100AH', 'EXIDE', 'car-truck-tractor', 'Exide Car Battery 100AH', 0,
        5000, 4500, 500, 10.00,
        4000, 1000, 20.00,
        '100AH', '24F', 24, 1, 1, 5000
      ) ON CONFLICT (sku) DO NOTHING;
    `);
    
    // Sample Bike Battery
    await client.query(`
      INSERT INTO products (
        sku, series, category, name, qty,
        mrp_price, selling_price, discount, discount_percent,
        b2b_selling_price, b2b_discount, b2b_discount_percent,
        ah_va, warranty, guarantee_period_months, order_index, product_type_id, dp
      ) VALUES (
        'EXIDE-BIKE-7AH', 'EXIDE', 'bike', 'Exide Bike Battery 7AH', 0,
        2000, 1800, 200, 10.00,
        1600, 400, 20.00,
        '7AH', '12F', 12, 1, 2, 2000
      ) ON CONFLICT (sku) DO NOTHING;
    `);
    
    // Sample UPS/Inverter Battery
    await client.query(`
      INSERT INTO products (
        sku, series, category, name, qty,
        mrp_price, selling_price, discount, discount_percent,
        b2b_selling_price, b2b_discount, b2b_discount_percent,
        ah_va, warranty, guarantee_period_months, order_index, product_type_id, dp
      ) VALUES (
        'EXIDE-UPS-150AH', 'EXIDE', 'ups-inverter', 'Exide UPS Battery 150AH', 0,
        8000, 7200, 800, 10.00,
        6400, 1600, 20.00,
        '150AH', '36F', 36, 1, 3, 8000
      ) ON CONFLICT (sku) DO NOTHING;
    `);
    
    // Sample Water Products
    await client.query(`
      INSERT INTO products (
        sku, series, category, name, qty,
        mrp_price, selling_price, discount, discount_percent,
        b2b_selling_price, b2b_discount, b2b_discount_percent,
        ah_va, warranty, guarantee_period_months, order_index, product_type_id, dp
      ) VALUES 
        ('EXIDE-DW-5L', 'EXIDE', 'water', 'Exide Distilled Water 5L', 0,
         153, 130, 23, 15.03,
         100, 53, 34.64,
         '5L', NULL, 0, 1, 4, 153),
        ('GEN-DW-5L', 'GENERIC', 'water', 'Generic Distilled Water 5L', 0,
         110, 70, 40, 36.36,
         50, 60, 54.55,
         '5L', NULL, 0, 2, 4, 110)
      ON CONFLICT (sku) DO NOTHING;
    `);
    
    console.log("✅ Sample products inserted");
    
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
        products: 5,
        note: "Sample products added. You can add more products through the admin panel."
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

module.exports = router;

