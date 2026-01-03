// Update DP values for Battery products (Inverter & Battery category) based on provided list
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

// DP values from the provided list (Product Code -> DP)
const dpValues = {
  // EXIDE HOME INVATUBULAR: 66M WARRANTY
  'IT500': 14204,
  'IT500-SLK': 14204,
  'IT650': 17045,
  'IT750': 18939,
  'IT900': 22727,
  'IT950': 24620,
  
  // EXIDE HOME INVAMASTER: 60M WARRANTY
  'IMST1000': 9379,
  'IMST1500': 11464,
  'IMTT1500': 12394,
  'IMTT1800': 14892,
  'IMTT2000': 16309,
  'IMTT2200': 18036,
  'IMTT2500': 19971,
  
  // EXIDE HOME INVAMAGIC: 48M WARRANTY
  'MGST800': 7131,
  'MGST1000': 8668,
  'MGST1200': 9050,
  'MGST1500': 10784,
  'MGJT1800': 13172,
  'MGTT1300': 9757,
  'MGTT1500': 11721,
  'MGTT1800': 13920,
  'MGTT2000': 15276,
};

async function updateBatteryDPValues() {
  try {
    console.log('Starting DP value update for Battery products (Inverter & Battery category)...');
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

updateBatteryDPValues();

