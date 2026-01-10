// Automated migration script: Local PostgreSQL -> Render PostgreSQL
// SAFETY: Only reads from local DB, writes to Render DB

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOCAL_DB_URL = process.env.DATABASE_URL || 'postgres://postgres:007222@localhost:5432/inventory_db';
const RENDER_DB_URL = process.env.DATABASE_URL_PROD || 'postgresql://atoz_inventory_user:5onz8uUNT7j5UicfQyVEztDXK4lwOSgz@dpg-d5eekfvgi27c73av6nh0-a:5432/atoz_inventory';

const DUMP_FILE = path.join(__dirname, '../../local_db_data_dump.sql');

console.log('🚀 Starting Automated Migration: Local DB -> Render DB\n');

// Step 1: Verify credentials
console.log('📋 Step 1: Verifying database credentials...');
try {
  execSync('node server/scripts/verify-db-credentials.js', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '../..')
  });
  console.log('✅ Credentials verified\n');
} catch (error) {
  console.error('❌ Credential verification failed. Aborting migration.');
  process.exit(1);
}

// Step 2: Create tables on Render DB
console.log('📋 Step 2: Creating tables on Render DB...');
console.log('   ⚠️  Please ensure your backend server is running with NODE_ENV=production');
console.log('   ⚠️  Or run: POST http://localhost:4000/api/init manually\n');
console.log('   Press ENTER after tables are created, or Ctrl+C to abort...');
// Wait for user confirmation
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', () => {
  process.stdin.setRawMode(false);
  process.stdin.pause();
  continueMigration();
});

function continueMigration() {
  // Step 3: Export data from local DB
  console.log('\n📋 Step 3: Exporting data from local database...');
  console.log('   ⚠️  This will prompt for your local PostgreSQL password');
  console.log('   ⚠️  Default password: 007222\n');
  
  try {
    // Extract password from connection string for pg_dump
    const localUrl = new URL(LOCAL_DB_URL);
    const dbName = localUrl.pathname.replace('/', '');
    const dbUser = localUrl.username;
    const dbHost = localUrl.hostname;
    const dbPort = localUrl.port || '5432';
    
    // Set PGPASSWORD environment variable to avoid prompt
    const dbPassword = localUrl.password;
    process.env.PGPASSWORD = dbPassword;
    
    console.log(`   Exporting from: ${dbHost}:${dbPort}/${dbName}...`);
    
    // Export data only (safe - no schema changes)
    execSync(
      `pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --data-only --column-inserts --no-owner --no-privileges -f "${DUMP_FILE}"`,
      { stdio: 'inherit' }
    );
    
    // Clear password from environment
    delete process.env.PGPASSWORD;
    
    if (!fs.existsSync(DUMP_FILE)) {
      throw new Error('Dump file was not created');
    }
    
    const fileSize = fs.statSync(DUMP_FILE).size;
    console.log(`✅ Data exported successfully (${(fileSize / 1024).toFixed(2)} KB)\n`);
    
    // Step 4: Restore data to Render DB
    console.log('📋 Step 4: Restoring data to Render database...');
    console.log('   ⚠️  This will INSERT data into Render DB only\n');
    
    // Parse Render DB URL
    const renderUrl = new URL(RENDER_DB_URL);
    const renderPassword = renderUrl.password;
    
    // Set PGPASSWORD for Render DB
    process.env.PGPASSWORD = renderPassword;
    
    console.log(`   Restoring to: ${renderUrl.hostname}/${renderUrl.pathname.replace('/', '')}...`);
    
    // Restore data
    execSync(
      `psql "${RENDER_DB_URL}" -f "${DUMP_FILE}" --set ON_ERROR_STOP=on`,
      { stdio: 'inherit' }
    );
    
    // Clear password from environment
    delete process.env.PGPASSWORD;
    
    console.log('✅ Data restored successfully\n');
    
    // Step 5: Verify migration
    console.log('📋 Step 5: Verifying migration...');
    
    process.env.PGPASSWORD = renderPassword;
    
    // Check tables exist
    const tablesCheck = execSync(
      `psql "${RENDER_DB_URL}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"`,
      { encoding: 'utf-8' }
    );
    
    const tableCount = parseInt(tablesCheck.trim());
    console.log(`   ✓ Found ${tableCount} tables in Render DB`);
    
    // Check row counts for key tables
    const keyTables = ['users', 'products', 'purchases', 'sales_item'];
    console.log('\n   Row counts:');
    
    for (const table of keyTables) {
      try {
        const countResult = execSync(
          `psql "${RENDER_DB_URL}" -t -c "SELECT COUNT(*) FROM ${table};"`,
          { encoding: 'utf-8' }
        );
        const count = parseInt(countResult.trim()) || 0;
        console.log(`     - ${table}: ${count} rows`);
      } catch (err) {
        console.log(`     - ${table}: Table not found or error`);
      }
    }
    
    delete process.env.PGPASSWORD;
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Verify data in Render database');
    console.log('   2. Update backend .env to use DATABASE_URL_PROD');
    console.log('   3. Restart backend server on Render');
    console.log('   4. Test application with Render database');
    console.log('\n💾 Dump file saved at:', DUMP_FILE);
    console.log('   You can delete it after verifying migration.\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n⚠️  Your local database was NOT modified.');
    console.error('⚠️  Only the export/restore step failed.');
    process.exit(1);
  }
}

