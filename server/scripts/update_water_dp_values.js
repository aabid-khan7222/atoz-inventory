// Update DP values for Water Products based on provided list
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

// DP values from the provided list
// Matching by SKU patterns and product names
const dpMappings = [
  // EXIDE 5 Liter Bottle - DP: 95
  { skuPattern: /EXIDE.*5.*L|5.*L.*EXIDE/i, namePattern: /exide.*5.*liter|exide.*5.*litre|exide.*distilled.*water.*5/i, dp: 95 },
  
  // GENERIC 5 Litre Distill Water Bottle - DP: 40
  { skuPattern: /GEN.*DW.*5|GEN.*5.*DW|GENERIC.*5.*L/i, namePattern: /generic.*5.*litre.*distill|generic.*5.*liter.*distill|generic.*distilled.*water.*5/i, dp: 40 },
  
  // GENERIC 1 Litre Distill Water Bottle - DP: 8
  { skuPattern: /GEN.*DW.*1|GEN.*1.*DW|GENERIC.*1.*L/i, namePattern: /generic.*1.*litre.*distill|generic.*1.*liter.*distill|generic.*distilled.*water.*1/i, dp: 8 },
  
  // GENERIC 1 Litre Acid Bottle - DP: 18
  { skuPattern: /GEN.*BA.*1|GEN.*ACID.*1|GENERIC.*ACID.*1/i, namePattern: /generic.*1.*litre.*acid|generic.*1.*liter.*acid|generic.*battery.*acid.*1/i, dp: 18 },
];

async function updateWaterDPValues() {
  try {
    console.log('Starting DP value update for Water Products...');
    console.log(`Total DP values in list: ${dpMappings.length}\n`);
    
    // Get all products in water category (product_type_id = 4)
    const { rows: products } = await db.query(`
      SELECT id, sku, name, dp, mrp_price 
      FROM products 
      WHERE product_type_id = 4
      ORDER BY sku
    `);
    
    console.log(`Found ${products.length} products in Water Products category\n`);
    
    if (products.length === 0) {
      console.log('No water products found in database.');
      process.exit(0);
    }
    
    console.log('Products found in database:');
    products.forEach(p => {
      console.log(`  - SKU: ${p.sku}, Name: ${p.name}, Current DP: ₹${p.dp || p.mrp_price || 0}`);
    });
    console.log('');
    
    let matched = 0;
    let updated = 0;
    const matchedProducts = [];
    
    // Try to match products by SKU and name patterns
    for (const mapping of dpMappings) {
      const matchingProducts = products.filter(p => {
        const skuMatch = mapping.skuPattern.test(p.sku);
        const nameMatch = mapping.namePattern.test(p.name);
        return skuMatch || nameMatch;
      });
      
      if (matchingProducts.length > 0) {
        for (const product of matchingProducts) {
          // Skip if already matched
          if (matchedProducts.some(mp => mp.sku === product.sku)) {
            continue;
          }
          
          matched++;
          if (parseFloat(product.dp || 0) !== mapping.dp) {
            await db.query(`
              UPDATE products 
              SET dp = $1, updated_at = CURRENT_TIMESTAMP 
              WHERE id = $2
            `, [mapping.dp, product.id]);
            updated++;
            console.log(`✓ Updated: ${product.sku} (${product.name}) -> DP: ₹${mapping.dp}`);
            matchedProducts.push({ sku: product.sku, name: product.name, dp: mapping.dp });
          } else {
            console.log(`- Already set: ${product.sku} (${product.name}) -> DP: ₹${mapping.dp}`);
            matchedProducts.push({ sku: product.sku, name: product.name, dp: mapping.dp });
          }
        }
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Total DP values in list: ${dpMappings.length}`);
    console.log(`Matched: ${matched}`);
    console.log(`Updated: ${updated}`);
    
    // Show products that weren't matched
    const unmatchedProducts = products.filter(p => {
      return !matchedProducts.some(mp => mp.sku === p.sku);
    });
    
    if (unmatchedProducts.length > 0) {
      console.log(`\nProducts in database but not matched (${unmatchedProducts.length}):`);
      unmatchedProducts.forEach(p => {
        console.log(`  - SKU: ${p.sku}, Name: ${p.name}, Current DP: ₹${p.dp || p.mrp_price || 0}`);
      });
    }
    
    console.log('\n✅ DP value update completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updateWaterDPValues();

