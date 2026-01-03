// Update DP values for Bike (Two Wheeler) products based on provided list
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

// DP values from the provided list (Product Code -> DP)
const dpValues = {
  // 2-WHEELER: EXIDE XPLORE: 48M WARRANTY
  '12XL2.5L-C': 727,
  'XLTZ4A': 869,
  'XLTZ5A': 1005,
  'XLTZ6': 1080,
  '12XL5L-B': 1132,
  'XLTZ7': 1397,
  '12XL7B-B': 1236,
  'XLTZ9': 1695,
  '12XL9-B': 1743,
  'XLTX14': 2440,
  '12XL14L-A2': 2808,
};

async function updateBikeDPValues() {
  try {
    console.log('Starting DP value update for Bike (Two Wheeler) products...');
    console.log(`Total DP values in list: ${Object.keys(dpValues).length}\n`);
    
    // Get all products in bike category (product_type_id = 2)
    const { rows: products } = await db.query(`
      SELECT id, sku, name, dp, mrp_price 
      FROM products 
      WHERE product_type_id = 2
      ORDER BY sku
    `);
    
    console.log(`Found ${products.length} products in Bike category\n`);
    
    let matched = 0;
    let updated = 0;
    let notFound = [];
    
    // Try to match products by SKU (exact match and variations)
    for (const [skuFromList, dpValue] of Object.entries(dpValues)) {
      // Try exact match first
      let product = products.find(p => 
        p.sku.toUpperCase().trim() === skuFromList.toUpperCase().trim()
      );
      
      // If not found, try partial match (SKU contains the code)
      if (!product) {
        product = products.find(p => 
          p.sku.toUpperCase().includes(skuFromList.toUpperCase()) ||
          skuFromList.toUpperCase().includes(p.sku.toUpperCase())
        );
      }
      
      if (product) {
        matched++;
        // Only update if DP is different
        if (parseFloat(product.dp || 0) !== dpValue) {
          await db.query(`
            UPDATE products 
            SET dp = $1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2
          `, [dpValue, product.id]);
          updated++;
          console.log(`✓ Updated: ${product.sku} (${product.name}) -> DP: ₹${dpValue}`);
        } else {
          console.log(`- Already set: ${product.sku} (${product.name}) -> DP: ₹${dpValue}`);
        }
      } else {
        notFound.push(skuFromList);
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Total products in list: ${Object.keys(dpValues).length}`);
    console.log(`Matched: ${matched}`);
    console.log(`Updated: ${updated}`);
    console.log(`Not found in database: ${notFound.length}`);
    
    if (notFound.length > 0) {
      console.log(`\nProducts not found in database:`);
      notFound.forEach(sku => console.log(`  - ${sku}`));
    }
    
    // Show products that exist but don't have DP in the list
    const productsWithoutDP = products.filter(p => {
      const skuUpper = p.sku.toUpperCase().trim();
      return !Object.keys(dpValues).some(listSku => 
        skuUpper === listSku.toUpperCase().trim() ||
        skuUpper.includes(listSku.toUpperCase()) ||
        listSku.toUpperCase().includes(skuUpper)
      );
    });
    
    if (productsWithoutDP.length > 0) {
      console.log(`\nProducts in database but not in DP list (${productsWithoutDP.length}):`);
      productsWithoutDP.slice(0, 20).forEach(p => {
        console.log(`  - ${p.sku} (${p.name}) - Current DP: ₹${p.dp || p.mrp_price || 0}`);
      });
      if (productsWithoutDP.length > 20) {
        console.log(`  ... and ${productsWithoutDP.length - 20} more`);
      }
    }
    
    console.log('\n✅ DP value update completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updateBikeDPValues();

