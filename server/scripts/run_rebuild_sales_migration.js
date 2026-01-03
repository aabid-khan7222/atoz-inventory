// Script to run the rebuild sales system migration
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  const client = await db.pool.connect();
  
  try {
    console.log('Starting sales system rebuild migration...');
    
    // Read the SQL files
    const salesSqlPath = path.join(__dirname, '../migrations/rebuild_sales_system.sql');
    const notificationsSqlPath = path.join(__dirname, '../migrations/create_notifications_table.sql');
    
    const salesSql = fs.readFileSync(salesSqlPath, 'utf8');
    const notificationsSql = fs.readFileSync(notificationsSqlPath, 'utf8');
    
    // Execute the SQL
    await client.query('BEGIN');
    
    console.log('Running sales system migration...');
    await client.query(salesSql);
    
    console.log('Running notifications table migration...');
    await client.query(notificationsSql);
    
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ Dropped old sales and sale_items tables');
    console.log('✅ Created new sales_id and sales_item tables');
    console.log('✅ Created notifications table');
    console.log('✅ All indexes and constraints created');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

