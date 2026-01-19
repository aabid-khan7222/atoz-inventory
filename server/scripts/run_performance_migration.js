// Script to run performance optimization migration
// This adds indexes to improve query performance
// Run: node server/scripts/run_performance_migration.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runPerformanceMigration() {
  const client = await db.pool.connect();
  
  try {
    console.log('🚀 Starting performance optimization migration...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../migrations/add_performance_indexes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✅ Performance indexes created successfully!');
    console.log('📊 Query performance should be significantly improved.');
    console.log('\n🔄 Next steps:');
    console.log('   1. Restart your server');
    console.log('   2. Test the application - it should be much faster now!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error running performance migration:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

runPerformanceMigration();

