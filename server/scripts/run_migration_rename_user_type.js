// Script to rename customer_type to user_type and update values
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  try {
    console.log('Starting migration: Rename customer_type to user_type...');
    
    // Read the SQL file
    const sqlFile = path.join(__dirname, '../migrations/rename_customer_type_to_user_type.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // First, let's check current state
    console.log('\n--- Checking current state ---');
    const currentState = await db.query(`
      SELECT 
        role_id,
        customer_type,
        COUNT(*) as count
      FROM users
      GROUP BY role_id, customer_type
      ORDER BY role_id, customer_type
    `);
    
    console.log('Current distribution:');
    currentState.rows.forEach(row => {
      console.log(`  role_id=${row.role_id}, customer_type='${row.customer_type}': ${row.count} users`);
    });
    
    // Check if column exists
    const columnCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'customer_type'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('\n⚠️  Column customer_type does not exist. Checking for user_type...');
      const userTypeCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'user_type'
      `);
      
      if (userTypeCheck.rows.length > 0) {
        console.log('✅ Column user_type already exists. Migration may have already been run.');
        return;
      } else {
        console.log('❌ Neither customer_type nor user_type column exists.');
        return;
      }
    }
    
    console.log('\n--- Running migration ---');
    
    // Execute the migration SQL
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    
    // Check final state
    console.log('\n--- Checking final state ---');
    const finalState = await db.query(`
      SELECT 
        role_id,
        user_type,
        COUNT(*) as count
      FROM users
      GROUP BY role_id, user_type
      ORDER BY role_id, user_type
    `);
    
    console.log('Final distribution:');
    finalState.rows.forEach(row => {
      console.log(`  role_id=${row.role_id}, user_type='${row.user_type}': ${row.count} users`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

