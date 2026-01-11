#!/usr/bin/env node
/**
 * Script to verify production database connection and check all tables
 * Usage: NODE_ENV=production DATABASE_URL=<connection_string> node server/scripts/verify-production-db.js
 */

require("dotenv").config();
const { Pool } = require("pg");

// Get database URL - same logic as db.js
function getDatabaseUrl() {
  const dbUrl = process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error("❌ Error: DATABASE_URL environment variable is not set!");
    console.error("Please set DATABASE_URL or DATABASE_URL_PROD in your environment");
    process.exit(1);
  }
  
  return dbUrl;
}

async function verifyDatabase() {
  const dbUrl = getDatabaseUrl();
  console.log("🔍 Verifying database connection...\n");
  
  // Parse connection string to show database name
  try {
    const urlParts = new URL(dbUrl);
    const databaseName = urlParts.pathname.replace('/', '');
    const host = urlParts.hostname;
    console.log(`📊 Database: ${databaseName}`);
    console.log(`🌐 Host: ${host}\n`);
  } catch (e) {
    console.log("⚠️  Could not parse connection string\n");
  }
  
  const poolConfig = {
    connectionString: dbUrl,
  };
  
  // Add SSL for production databases (Render, Railway, etc.)
  if (process.env.NODE_ENV === "production") {
    poolConfig.ssl = {
      rejectUnauthorized: false,
    };
  }
  
  const pool = new Pool(poolConfig);
  
  try {
    // Test connection
    console.log("🔌 Testing connection...");
    const connectionTest = await pool.query('SELECT NOW() as current_time, current_database() as database_name, version() as pg_version');
    console.log("✅ Connection successful!");
    console.log(`   Database: ${connectionTest.rows[0].database_name}`);
    console.log(`   Time: ${connectionTest.rows[0].current_time}`);
    console.log(`   PostgreSQL Version: ${connectionTest.rows[0].pg_version.split(' ')[0]} ${connectionTest.rows[0].pg_version.split(' ')[1]}\n`);
    
    // Check if database name matches expected
    const dbName = connectionTest.rows[0].database_name;
    if (dbName === 'atoz_inventory' || dbName === 'atos_inventory') {
      console.log("✅ Database name matches expected (atoz_inventory/atos_inventory)\n");
    } else {
      console.log(`⚠️  Warning: Database name is "${dbName}", expected "atoz_inventory" or "atos_inventory"\n`);
    }
    
    // Get all tables
    console.log("📋 Fetching all tables...");
    const tablesResult = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows;
    console.log(`\n✅ Found ${tables.length} tables in database:\n`);
    
    // Key tables that should exist
    const keyTables = [
      'roles',
      'users',
      'customer_profiles',
      'product_type',
      'products',
      'stock',
      'stock_history',
      'sales_types',
      'sales_id',
      'sales_item',
      'purchases',
      'notifications',
      'charging_services',
      'service_requests',
      'company_returns',
      'employees',
      'commission_agents',
      'daily_attendance',
      'warranty_slabs',
      'battery_replacements'
    ];
    
    // Check which key tables exist
    const existingTables = tables.map(t => t.table_name);
    const missingTables = keyTables.filter(t => !existingTables.includes(t));
    
    console.log("📊 Table List:");
    tables.forEach((table, index) => {
      const isKeyTable = keyTables.includes(table.table_name);
      const marker = isKeyTable ? '✅' : '  ';
      console.log(`   ${marker} ${index + 1}. ${table.table_name} (${table.table_type})`);
    });
    
    if (missingTables.length > 0) {
      console.log(`\n⚠️  Missing key tables (${missingTables.length}):`);
      missingTables.forEach(table => {
        console.log(`   ❌ ${table}`);
      });
      console.log("\n💡 Recommendation: Run migrations or /api/init endpoint to create missing tables\n");
    } else {
      console.log("\n✅ All key tables exist!\n");
    }
    
    // Check table counts (sample)
    console.log("📈 Sample table record counts:");
    for (const table of keyTables.slice(0, 10)) {
      if (existingTables.includes(table)) {
        try {
          const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`   ${table}: ${countResult.rows[0].count} records`);
        } catch (e) {
          console.log(`   ${table}: Error counting (${e.message})`);
        }
      }
    }
    
    console.log("\n✅ Database verification complete!\n");
    
    // Summary
    console.log("📝 Summary:");
    console.log(`   ✅ Connection: Working`);
    console.log(`   ✅ Database: ${dbName}`);
    console.log(`   ✅ Total Tables: ${tables.length}`);
    console.log(`   ${missingTables.length === 0 ? '✅' : '⚠️'} Key Tables: ${keyTables.length - missingTables.length}/${keyTables.length} present`);
    
    if (missingTables.length > 0) {
      console.log("\n🔧 Next Steps:");
      console.log("   1. Ensure all migrations are run");
      console.log("   2. Or call /api/init endpoint to initialize database");
      console.log("   3. Verify production environment has DATABASE_URL set correctly");
    } else {
      console.log("\n🎉 Database is properly configured and ready for production use!");
    }
    
  } catch (error) {
    console.error("\n❌ Database verification failed!");
    console.error(`   Error: ${error.message}`);
    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("\n   Full error:", error);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run verification
verifyDatabase().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

