// Update DP values for Inverter products based on provided list
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

// DP values from the provided list (Product Code -> DP)
const dpValues = {
  // EXIDE GQP: 42M WARRANTY
  'GQP12V700': 5794,
  'GQP12V900': 6012,
  'GQP12V1125': 6887,
  'GQP12V1450N': 8810,
  'GQP24V1625': 9401,
  
  // EXIDE STAR: 42M WARRANTY
  'STAR12V700': 4609,
  'STAR12V900': 4824,
  'STAR12V1125': 5466,
  'STAR12V1375': 6752,
  'STAR12V1625': 8040,
  'STAR24V1625': 7716,
  'STAR24V2550': 11790,
  
  // EXIDE MAGIC: 42M WARRANTY
  'MAGIC12V800': 4009,
  'MAGIC12V875': 4287,
  'MAGIC12V1125': 4609,
  'MAGIC24V1625': 6431,
  
  // EXIDE HKVA: 24M WARRANTY
  '024EXIDEN020': 11565,
  '036EXIDEP025M': 16066,
  '048EXIDEP035M': 18053,
  '048EXIDEP052M': 33962,
};

async function updateInverterDPValues() {
  try {
    console.log('Starting DP value update for Inverter products...');
    console.log(`Total DP values in list: ${Object.keys(dpValues).length}\n`);
    
    // Get all products in ups-inverter category (product_type_id = 3)
    const { rows: products } = await db.query(`
      SELECT id, sku, name, dp, mrp_price 
      FROM products 
      WHERE product_type_id = 3
      ORDER BY sku
    `);
    
    console.log(`Found ${products.length} products in Inverter & Battery category\n`);
    
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

updateInverterDPValues();

