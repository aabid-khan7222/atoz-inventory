// Direct script to delete dummy products
// Run this with: node delete-dummy-products-direct.js

require('dotenv').config();
const { Pool } = require('pg');

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
};

if (process.env.NODE_ENV === 'production') {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = new Pool(poolConfig);

async function deleteDummyProducts() {
  const client = await pool.connect();
  
  try {
    console.log('🗑️  Starting deletion of dummy products...');
    
    const dummyProductSKUs = [
      'EXIDE-CAR-100AH',
      'EXIDE-BIKE-7AH',
      'EXIDE-UPS-150AH',
      'EXIDE-DW-5L',
      'GEN-DW-5L'
    ];
    
    let deletedCount = 0;
    const deletedProducts = [];
    const notFoundProducts = [];
    
    for (const sku of dummyProductSKUs) {
      try {
        // Check if product exists
        const checkResult = await client.query(
          'SELECT id, name FROM products WHERE sku = $1',
          [sku]
        );
        
        if (checkResult.rows.length > 0) {
          const product = checkResult.rows[0];
          
          // Delete the product
          const deleteResult = await client.query(
            'DELETE FROM products WHERE sku = $1',
            [sku]
          );
          
          if (deleteResult.rowCount > 0) {
            deletedCount++;
            deletedProducts.push({ sku, name: product.name });
            console.log(`✅ Deleted: ${sku} - ${product.name}`);
          }
        } else {
          notFoundProducts.push(sku);
          console.log(`ℹ️  Product not found (may already be deleted): ${sku}`);
        }
      } catch (err) {
        console.error(`❌ Error deleting product ${sku}:`, err.message);
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Deleted: ${deletedCount} products`);
    console.log(`ℹ️  Not found: ${notFoundProducts.length} products`);
    
    if (deletedProducts.length > 0) {
      console.log('\nDeleted Products:');
      deletedProducts.forEach(p => console.log(`  - ${p.sku}: ${p.name}`));
    }
    
    if (notFoundProducts.length > 0) {
      console.log('\nNot Found Products:');
      notFoundProducts.forEach(sku => console.log(`  - ${sku}`));
    }
    
    console.log('\n✅ Process completed!');
    
  } catch (error) {
    console.error('❌ Failed to delete dummy products:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

deleteDummyProducts();

