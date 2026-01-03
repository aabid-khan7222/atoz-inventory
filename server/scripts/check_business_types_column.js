// Script to check if business_types column exists in customer_profiles table
const db = require('../db');

(async () => {
  try {
    const result = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customer_profiles' 
      AND (column_name LIKE '%business%' OR column_name LIKE '%type%')
      ORDER BY column_name
    `);
    
    console.log('Columns with "business" or "type" in customer_profiles:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    if (result.rows.length === 0) {
      console.log('\nNo columns found with "business" or "type" in the name.');
    }
  } catch (e) {
    console.error('ERROR:', e);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
})();

