// Script to check and display sales_types table
require('dotenv').config();
const db = require('../db');

async function checkSalesTypes() {
  try {
    console.log('Checking sales_types table...\n');
    
    // Check if table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sales_types'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ sales_types table does not exist!');
      console.log('Running migration to create it...\n');
      
      const fs = require('fs');
      const path = require('path');
      const sql = fs.readFileSync(
        path.join(__dirname, '../migrations/create_sales_types_lookup.sql'),
        'utf8'
      );
      
      await db.query(sql);
      console.log('✅ sales_types table created!\n');
    }
    
    // Get all sales types
    const result = await db.query('SELECT * FROM sales_types ORDER BY id');
    
    if (result.rows.length === 0) {
      console.log('⚠️  sales_types table is empty!');
      console.log('Inserting the two required IDs...\n');
      
      await db.query(`
        INSERT INTO sales_types (id, type_name, description) VALUES
          (1, 'retail', 'Retail customers (normal customers)'),
          (2, 'wholesale', 'Wholesale/B2B customers')
        ON CONFLICT (id) DO NOTHING;
      `);
      
      // Get again after insert
      const result2 = await db.query('SELECT * FROM sales_types ORDER BY id');
      console.log('✅ Sales types inserted!\n');
      console.log('Sales Types in Database:');
      console.log(JSON.stringify(result2.rows, null, 2));
    } else {
      console.log('✅ Sales Types in Database:');
      console.log(JSON.stringify(result.rows, null, 2));
    }
    
    // Also check sales_id table
    const salesIdCount = await db.query('SELECT COUNT(*) as count FROM sales_id');
    console.log(`\n📊 sales_id table has ${salesIdCount.rows[0].count} records`);
    console.log('(This table will have records when sales are made)');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkSalesTypes();

