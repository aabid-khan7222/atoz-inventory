// Script to normalize all product categories based on product_type_id
const db = require('../db');

(async () => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Fixing product categories...\n');
    
    // Update products table: normalize categories based on product_type_id
    console.log('1. Updating products table categories...');
    
    // product_type_id = 1 -> 'car-truck-tractor'
    const result1 = await client.query(`
      UPDATE products 
      SET category = 'car-truck-tractor'
      WHERE product_type_id = 1
    `);
    console.log(`   Updated ${result1.rowCount} products to 'car-truck-tractor'`);
    
    // product_type_id = 2 -> 'bike'
    const result2 = await client.query(`
      UPDATE products 
      SET category = 'bike'
      WHERE product_type_id = 2
    `);
    console.log(`   Updated ${result2.rowCount} products to 'bike'`);
    
    // product_type_id = 3 -> 'ups-inverter'
    const result3 = await client.query(`
      UPDATE products 
      SET category = 'ups-inverter'
      WHERE product_type_id = 3
    `);
    console.log(`   Updated ${result3.rowCount} products to 'ups-inverter'`);
    
    console.log('\n2. Updating sales_item table categories...');
    
    // Update sales_item: normalize categories based on product_type_id from products table
    const result4 = await client.query(`
      UPDATE sales_item si
      SET CATEGORY = CASE 
        WHEN p.product_type_id = 1 THEN 'car-truck-tractor'
        WHEN p.product_type_id = 2 THEN 'bike'
        WHEN p.product_type_id = 3 THEN 'ups-inverter'
        ELSE 'car-truck-tractor'
      END
      FROM products p
      WHERE si.product_id = p.id
        AND (
          si.CATEGORY != CASE 
            WHEN p.product_type_id = 1 THEN 'car-truck-tractor'
            WHEN p.product_type_id = 2 THEN 'bike'
            WHEN p.product_type_id = 3 THEN 'ups-inverter'
            ELSE 'car-truck-tractor'
          END
          OR si.CATEGORY IS NULL
        )
    `);
    console.log(`   Updated ${result4.rowCount} sales_item records`);
    
    // Also update sales_item where product_id is NULL (use series/name heuristics)
    const result5 = await client.query(`
      UPDATE sales_item si
      SET CATEGORY = CASE 
        WHEN UPPER(si.SERIES) LIKE '%XPLORE%' OR UPPER(si.NAME) LIKE '%XPLORE%' THEN 'bike'
        WHEN UPPER(si.CATEGORY) LIKE '%WHEELER%' OR si.CATEGORY = '2-WHEELER' THEN 'bike'
        WHEN UPPER(si.CATEGORY) LIKE '%UPS%' OR UPPER(si.CATEGORY) LIKE '%INVERTER%' THEN 'ups-inverter'
        WHEN si.CATEGORY IS NULL THEN 'car-truck-tractor'
        ELSE 'car-truck-tractor'
      END
      WHERE si.product_id IS NULL
        AND (
          si.CATEGORY IS NULL 
          OR si.CATEGORY NOT IN ('car-truck-tractor', 'bike', 'ups-inverter')
        )
    `);
    console.log(`   Updated ${result5.rowCount} sales_item records (no product_id)`);
    
    await client.query('COMMIT');
    console.log('\n✅ All categories normalized successfully!');
    
    // Verify
    console.log('\n3. Verifying categories...');
    const verifyProducts = await client.query(`
      SELECT DISTINCT category, product_type_id, COUNT(*) as count
      FROM products
      GROUP BY category, product_type_id
      ORDER BY product_type_id, category
    `);
    console.log('Products categories:', JSON.stringify(verifyProducts.rows, null, 2));
    
    const verifySales = await client.query(`
      SELECT DISTINCT CATEGORY, COUNT(*) as count
      FROM sales_item
      GROUP BY CATEGORY
      ORDER BY CATEGORY
    `);
    console.log('Sales_item categories:', JSON.stringify(verifySales.rows, null, 2));
    
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
    process.exit(1);
  } finally {
    client.release();
  }
})();

