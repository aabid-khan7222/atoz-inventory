// Script to run company returns table migration
// Usage: node server/scripts/run_company_returns_migration.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  const migrationFile = path.join(__dirname, '../migrations/create_company_returns_table.sql');
  
  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Running migration: create_company_returns_table.sql');
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('Company returns table has been created.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42P07') {
      console.log('ℹ️  Table already exists. Migration may have already been run.');
    }
    process.exit(1);
  }
}

runMigration();

