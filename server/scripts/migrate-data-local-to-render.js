// server/scripts/migrate-data-local-to-render.js
// Script to migrate all data from local PostgreSQL 17 to Render "atoz" database

require("dotenv").config();
const { Pool } = require("pg");

// Database connections
const localDbConfig = {
  host: process.env.LOCAL_DB_HOST || "localhost",
  port: process.env.LOCAL_DB_PORT || 5432,
  database: process.env.LOCAL_DB_NAME || "atoz_inventory",
  user: process.env.LOCAL_DB_USER || "postgres",
  password: process.env.LOCAL_DB_PASSWORD || "",
};

// Render database (atoz) - from DATABASE_URL_PROD or DATABASE_URL
const renderDbUrl = process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;

if (!renderDbUrl) {
  console.error("❌ Error: DATABASE_URL_PROD or DATABASE_URL not found in .env");
  console.error("Please set DATABASE_URL_PROD to your Render database connection string");
  process.exit(1);
}

const localPool = new Pool(localDbConfig);
const renderPool = new Pool({
  connectionString: renderDbUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Tables to migrate (in order - respecting foreign key dependencies)
const tablesOrder = [
  // Base tables (no dependencies)
  "product_type",
  "roles",
  "sales_types",
  "warranty_slabs",
  "service_types",
  
  // User-related tables
  "users",
  "customer_profiles",
  "commission_agents",
  "employees",
  
  // Product-related tables
  "products",
  "product_images",
  
  // Stock and inventory
  "stock",
  "stock_history",
  "purchases",
  
  // Sales
  "sales",
  "sells",
  
  // Services
  "charging_services",
  "service_requests",
  
  // Guarantee & Warranty
  "guarantee_warranty_replacements",
  
  // Company returns
  "company_returns",
  
  // Other
  "notifications",
  "employee_attendance",
  "daily_attendance",
  "employee_payments",
];

// Function to get all tables from database
async function getAllTables(pool) {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  return result.rows.map(row => row.table_name);
}

// Function to get table columns
async function getTableColumns(pool, tableName) {
  const result = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position;
  `, [tableName]);
  return result.rows;
}

// Function to disable/enable triggers (for faster inserts)
async function disableTriggers(pool, tableName) {
  try {
    await pool.query(`ALTER TABLE ${tableName} DISABLE TRIGGER ALL;`);
  } catch (err) {
    // Ignore if triggers don't exist
    console.log(`  ⚠️  Could not disable triggers for ${tableName}: ${err.message}`);
  }
}

async function enableTriggers(pool, tableName) {
  try {
    await pool.query(`ALTER TABLE ${tableName} ENABLE TRIGGER ALL;`);
  } catch (err) {
    // Ignore if triggers don't exist
  }
}

// Function to migrate a single table
async function migrateTable(tableName) {
  console.log(`\n📦 Migrating table: ${tableName}`);
  
  try {
    // Check if table exists in both databases
    const localCheck = await localPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    
    const renderCheck = await renderPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    
    if (!localCheck.rows[0].exists) {
      console.log(`  ⚠️  Table ${tableName} does not exist in local database, skipping...`);
      return { success: false, skipped: true };
    }
    
    if (!renderCheck.rows[0].exists) {
      console.log(`  ⚠️  Table ${tableName} does not exist in Render database, skipping...`);
      return { success: false, skipped: true };
    }
    
    // Get data from local database
    const localData = await localPool.query(`SELECT * FROM ${tableName} ORDER BY id;`);
    const rowCount = localData.rows.length;
    
    if (rowCount === 0) {
      console.log(`  ℹ️  No data in ${tableName}, skipping...`);
      return { success: true, rowsMigrated: 0 };
    }
    
    console.log(`  📊 Found ${rowCount} rows in local database`);
    
    // Get columns
    const columns = await getTableColumns(localPool, tableName);
    const columnNames = columns.map(col => col.column_name).filter(col => col !== 'id' || tableName === 'product_type' || tableName === 'roles' || tableName === 'sales_types');
    
    // Clear existing data in Render and reset sequences
    console.log(`  🗑️  Clearing existing data in Render database...`);
    await renderPool.query(`TRUNCATE TABLE ${tableName} CASCADE;`);
    
    // Reset sequences for tables with SERIAL/auto-increment columns
    try {
      const sequenceResult = await renderPool.query(`
        SELECT column_name, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = $1
        AND column_default LIKE 'nextval%';
      `, [tableName]);
      
      for (const col of sequenceResult.rows) {
        const sequenceMatch = col.column_default.match(/nextval\('([^']+)'/);
        if (sequenceMatch) {
          const sequenceName = sequenceMatch[1];
          // Get max ID from local database
          const maxIdResult = await localPool.query(`SELECT MAX(id) as max_id FROM ${tableName};`);
          const maxId = maxIdResult.rows[0]?.max_id || 0;
          if (maxId > 0) {
            await renderPool.query(`SELECT setval('${sequenceName}', ${maxId}, true);`);
            console.log(`  🔄 Reset sequence ${sequenceName} to ${maxId}`);
          }
        }
      }
    } catch (seqErr) {
      console.log(`  ⚠️  Could not reset sequences: ${seqErr.message}`);
    }
    
    // Disable triggers for faster inserts
    await disableTriggers(renderPool, tableName);
    
    // Insert data in batches
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < localData.rows.length; i += batchSize) {
      const batch = localData.rows.slice(i, i + batchSize);
      
      for (const row of batch) {
        try {
          // Build INSERT query
          const values = [];
          const placeholders = [];
          let placeholderIndex = 1;
          
          // Handle special cases for tables with fixed IDs
          if (tableName === 'product_type' || tableName === 'roles' || tableName === 'sales_types') {
            // Include id for these tables
            values.push(row.id);
            placeholders.push(`$${placeholderIndex++}`);
          }
          
          for (const col of columnNames) {
            if (col === 'id' && (tableName === 'product_type' || tableName === 'roles' || tableName === 'sales_types')) {
              continue; // Already added
            }
            values.push(row[col] !== undefined ? row[col] : null);
            placeholders.push(`$${placeholderIndex++}`);
          }
          
          const allColumns = (tableName === 'product_type' || tableName === 'roles' || tableName === 'sales_types') 
            ? ['id', ...columnNames] 
            : columnNames;
          
          const insertQuery = `
            INSERT INTO ${tableName} (${allColumns.join(', ')})
            VALUES (${placeholders.join(', ')})
            ON CONFLICT DO NOTHING;
          `;
          
          await renderPool.query(insertQuery, values);
          inserted++;
        } catch (err) {
          console.error(`  ❌ Error inserting row ${i + batch.indexOf(row) + 1}:`, err.message);
          console.error(`     Row data:`, JSON.stringify(row, null, 2));
          // Continue with next row
        }
      }
      
      console.log(`  ✅ Inserted ${Math.min(i + batchSize, localData.rows.length)}/${rowCount} rows...`);
    }
    
    // Re-enable triggers
    await enableTriggers(renderPool, tableName);
    
    console.log(`  ✅ Successfully migrated ${inserted}/${rowCount} rows`);
    
    return { success: true, rowsMigrated: inserted, totalRows: rowCount };
  } catch (err) {
    console.error(`  ❌ Error migrating table ${tableName}:`, err.message);
    console.error(`     Stack:`, err.stack);
    return { success: false, error: err.message };
  }
}

// Main migration function
async function migrateAllData() {
  console.log("🚀 Starting data migration from Local PostgreSQL 17 to Render 'atoz' database\n");
  console.log("=" .repeat(70));
  
  try {
    // Test connections
    console.log("\n📡 Testing database connections...");
    await localPool.query("SELECT 1");
    console.log("  ✅ Local PostgreSQL 17 connected");
    
    await renderPool.query("SELECT 1");
    console.log("  ✅ Render 'atoz' database connected");
    
    // Get all tables
    console.log("\n📋 Getting list of tables...");
    const allTables = await getAllTables(localPool);
    console.log(`  ✅ Found ${allTables.length} tables in local database`);
    
    // Migrate tables in order
    const results = [];
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    let totalRowsMigrated = 0;
    
    for (const tableName of tablesOrder) {
      if (allTables.includes(tableName)) {
        const result = await migrateTable(tableName);
        results.push({ table: tableName, ...result });
        
        if (result.success) {
          successCount++;
          totalRowsMigrated += result.rowsMigrated || 0;
        } else if (result.skipped) {
          skippedCount++;
        } else {
          failCount++;
        }
      } else {
        console.log(`\n⚠️  Table ${tableName} not found in local database, skipping...`);
        skippedCount++;
      }
    }
    
    // Migrate any remaining tables not in the ordered list
    const remainingTables = allTables.filter(t => !tablesOrder.includes(t));
    if (remainingTables.length > 0) {
      console.log(`\n📋 Found ${remainingTables.length} additional tables, migrating...`);
      for (const tableName of remainingTables) {
        const result = await migrateTable(tableName);
        results.push({ table: tableName, ...result });
        
        if (result.success) {
          successCount++;
          totalRowsMigrated += result.rowsMigrated || 0;
        } else if (result.skipped) {
          skippedCount++;
        } else {
          failCount++;
        }
      }
    }
    
    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("📊 MIGRATION SUMMARY");
    console.log("=".repeat(70));
    console.log(`✅ Successfully migrated: ${successCount} tables`);
    console.log(`❌ Failed: ${failCount} tables`);
    console.log(`⚠️  Skipped: ${skippedCount} tables`);
    console.log(`📦 Total rows migrated: ${totalRowsMigrated}`);
    console.log("=".repeat(70));
    
    if (failCount > 0) {
      console.log("\n❌ Failed tables:");
      results.filter(r => !r.success && !r.skipped).forEach(r => {
        console.log(`   - ${r.table}: ${r.error || 'Unknown error'}`);
      });
    }
    
  } catch (err) {
    console.error("\n❌ Fatal error during migration:", err);
    console.error("Stack:", err.stack);
    process.exit(1);
  } finally {
    await localPool.end();
    await renderPool.end();
    console.log("\n✅ Database connections closed");
  }
}

// Run migration
if (require.main === module) {
  migrateAllData()
    .then(() => {
      console.log("\n🎉 Migration completed!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n💥 Migration failed:", err);
      process.exit(1);
    });
}

module.exports = { migrateAllData };

