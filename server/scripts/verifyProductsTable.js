// Script to verify products table structure
require('dotenv').config();
const db = require('../db');

async function verifyTable() {
  try {
    console.log('Verifying products table structure...\n');
    
    const { rows } = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      ORDER BY ordinal_position
    `);
    
    console.log('Products table columns:');
    rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Check product count
    const countResult = await db.query('SELECT COUNT(*) as count FROM products');
    console.log(`\nTotal products in table: ${countResult.rows[0].count}`);
    
    // Check product_type_id distribution
    const typeResult = await db.query(`
      SELECT product_type_id, COUNT(*) as count 
      FROM products 
      GROUP BY product_type_id 
      ORDER BY product_type_id
    `);
    
    if (typeResult.rows.length > 0) {
      console.log('\nProducts by type:');
      typeResult.rows.forEach(row => {
        const typeName = row.product_type_id === 1 ? 'Car/Truck/Tractor' : 
                        row.product_type_id === 2 ? 'Bike' : 'HUPS/Inverter';
        console.log(`  - Type ${row.product_type_id} (${typeName}): ${row.count} products`);
      });
    }
    
    console.log('\n✅ Table verification complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

verifyTable();

