// Update DP values for Automotive products based on provided list
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

// DP values from the provided list (Product Code -> DP)
const dpValues = {
  // CAR/SUV: EXIDE EPIQ: 77M WARRANTY
  'EPIQ35L': 4172,
  'EPIQ40LBH': 4687,
  'EPIQDIN74L': 10114,
  
  // CAR/SUV: EXIDE MATRIX: 72M WARRANTY
  'MT40B20L/R': 3776,
  'MTRED45L': 6883,
  'MTREDDIN100': 15614,
  
  // CAR/SUV: EXIDE MILEAGE ISS: 60M WARRANTY
  'MLM42(ISS)': 4654,
  'MLN55(ISS)': 6105,
  'MLDIN70(ISS)': 8010,
  
  // CAR/SUV: EXIDE MILEAGE: 60M WARRANTY
  'ML38B20L/R': 3600,
  'ML40LBH/RBH': 4410,
  'MLDIN44R/LH': 5322,
  'ML45D21LBH': 5810,
  'ML55B24L(T1)': 5879,
  'MLDIN50': 5844,
  'ML55D23L': 6109,
  'MLDIN55/R': 6686,
  'MLDIN60': 6847,
  'MLDIN66/66A': 6876,
  'ML75D23LBH': 6434,
  'ML85D26R': 7396,
  'MLDIN80': 9995,
  
  // CAR/SUV: EXIDE EEZY ISS: 48M WARRANTY
  'EYDIN47RMFEFB': 5655,
  'EYDIN52RMFEFB': 5923,
  'EYDIN78LMFEFB': 8020,
  
  // CAR/SUV: EXIDE EEZY: 48M WARRANTY
  'EY34B19L/R': 3283,
  'EY700L/R': 6624,
  'EY700F/EY700LF': 6624,
  'EY80D23R': 6624,
  'EY105D31L/R': 7190,
  
  // CAR/SUV: EXIDE RIDE: 24M WARRANTY
  'RIDE35L': 2951,
  'RIDE45L': 4939,
  'RIDE700L/R': 5055,
  'RIDE700LF/RF': 5055,
  
  // 3W/LCV: EXIDE EKO: 24M WARRANTY
  'EKO32': 2958,
  'EKO40L': 3493,
  'EKO50L': 4786,
  'EKO55L': 4877,
  'EKO60L/R': 4991,
  
  // CV: EXIDE XPRESS: 42M WARRANTY
  'XP800': 6709,
  'XP800F': 6709,
  'XP880': 7421,
  'XP1000': 8428,
  'XP1000H29R': 8175,
  'XP1200/L(RH)': 10319,
  'XP1300': 10545,
  'XP1500': 13499,
  'XP1800': 15946,
  'XP2000': 21368,
  
  // TRACTOR: EXIDE JAI KISAN: 42M WARRANTY
  'KI75TF': 6571,
  'KI80T': 6701,
  'KI88T/TLH': 6839,
  'KI90H29L': 6839,
  'KI99T': 7842,
  
  // CAR/SUV/3W/TRACTOR/CV: EXIDE DRIVE: 36M WARRANTY
  'DRIVE35L': 3142,
  'DRIVE40LBH': 3683,
  'DRIVE45L/R': 5312,
  'DRIVE700R': 6224,
  'DRIVE700RF': 6224,
  'DRIVE80L/R': 6019,
  'DRIVE80LF/RF': 6019,
  'DRIVE88L': 6444,
  'DRIVE100L': 7039,
  'DRIVE100H29R': 7039,
  'DRIVE130R': 9562,
  'DRIVE150R': 11423,
  'DRIVE180R': 14814,
};

async function updateDPValues() {
  try {
    console.log('Starting DP value update for Automotive products...');
    console.log(`Total DP values in list: ${Object.keys(dpValues).length}\n`);
    
    // Get all products in car-truck-tractor category (product_type_id = 1)
    const { rows: products } = await db.query(`
      SELECT id, sku, name, dp, mrp_price 
      FROM products 
      WHERE product_type_id = 1
      ORDER BY sku
    `);
    
    console.log(`Found ${products.length} products in Automotive category\n`);
    
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

updateDPValues();

