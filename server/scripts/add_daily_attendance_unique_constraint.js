// Script to add unique constraint to daily_attendance table
// This ensures ON CONFLICT clause works properly

const db = require('../db');
const fs = require('fs');
const path = require('path');

async function addUniqueConstraint() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Checking for unique constraint on daily_attendance table...\n');
    
    // Check if constraint already exists
    const constraintCheck = await client.query(`
      SELECT 1 
      FROM pg_constraint 
      WHERE conname = 'daily_attendance_employee_id_attendance_date_key'
      AND conrelid = 'daily_attendance'::regclass
    `);
    
    if (constraintCheck.rows.length > 0) {
      console.log('✓ Unique constraint already exists');
    } else {
      console.log('Adding unique constraint...');
      
      // Add unique constraint
      await client.query(`
        ALTER TABLE daily_attendance 
        ADD CONSTRAINT daily_attendance_employee_id_attendance_date_key 
        UNIQUE (employee_id, attendance_date)
      `);
      
      console.log('✓ Unique constraint added successfully');
    }
    
    await client.query('COMMIT');
    console.log('\n✓ Migration completed successfully!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Error adding unique constraint:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run the migration
addUniqueConstraint()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nScript failed:', err);
    process.exit(1);
  });
