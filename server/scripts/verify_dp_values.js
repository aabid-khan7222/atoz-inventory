// Verify DP values are correctly set
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

// The DP values that were set
const expectedDPValues = {
  'EPIQ35L': 4172,
  'EPIQ40LBH': 4687,
  'EPIQDIN74L': 10114,
  'MT40B20L/R': 3776,
  'MTRED45L': 6883,
  'MTREDDIN100': 15614,
  'MLM42(ISS)': 4654,
  'MLN55(ISS)': 6105,
  'MLDIN70(ISS)': 8010,
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
  'EYDIN47RMFEFB': 5655,
  'EYDIN52RMFEFB': 5923,
  'EYDIN78LMFEFB': 8020,
  'EY34B19L/R': 3283,
  'EY700L/R': 6624,
  'EY700F/EY700LF': 6624,
  'EY80D23R': 6624,
  'EY105D31L/R': 7190,
  'RIDE35L': 2951,
  'RIDE45L': 4939,
  'RIDE700L/R': 5055,
  'RIDE700LF/RF': 5055,
  'EKO32': 2958,
  'EKO40L': 3493,
  'EKO50L': 4786,
  'EKO55L': 4877,
  'EKO60L/R': 4991,
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
  'KI75TF': 6571,
  'KI80T': 6701,
  'KI88T/TLH': 6839,
  'KI90H29L': 6839,
  'KI99T': 7842,
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

async function verifyDPValues() {
  try {
    console.log('Verifying DP values in database...\n');
    
    // Get all products in car-truck-tractor category
    const { rows: products } = await db.query(`
      SELECT id, sku, name, dp, mrp_price 
      FROM products 
      WHERE product_type_id = 1
      ORDER BY sku
    `);
    
    console.log(`Total products: ${products.length}\n`);
    
    let correct = 0;
    let incorrect = [];
    
    // Check each product
    for (const [skuFromList, expectedDP] of Object.entries(expectedDPValues)) {
      // Find matching product
      let product = products.find(p => 
        p.sku.toUpperCase().trim() === skuFromList.toUpperCase().trim()
      );
      
      if (!product) {
        product = products.find(p => 
          p.sku.toUpperCase().includes(skuFromList.toUpperCase()) ||
          skuFromList.toUpperCase().includes(p.sku.toUpperCase())
        );
      }
      
      if (product) {
        const actualDP = parseFloat(product.dp || 0);
        if (actualDP === expectedDP) {
          correct++;
        } else {
          incorrect.push({
            sku: product.sku,
            name: product.name,
            expected: expectedDP,
            actual: actualDP
          });
        }
      }
    }
    
    console.log(`✓ Correct DP values: ${correct}/${Object.keys(expectedDPValues).length}`);
    
    if (incorrect.length > 0) {
      console.log(`\n✗ Incorrect DP values: ${incorrect.length}`);
      incorrect.forEach(item => {
        console.log(`  ${item.sku} - ${item.name}`);
        console.log(`    Expected: ₹${item.expected}, Actual: ₹${item.actual}`);
      });
    }
    
    // Show all products with their DP and MRP
    console.log('\n=== All Products (DP vs MRP) ===');
    products.forEach(p => {
      const dp = parseFloat(p.dp || 0);
      const mrp = parseFloat(p.mrp_price || 0);
      const match = dp === mrp ? '⚠️ SAME' : '✓';
      console.log(`${match} ${p.sku.padEnd(20)} - DP: ₹${dp.toString().padStart(8)} | MRP: ₹${mrp.toString().padStart(8)}`);
    });
    
    console.log('\n✅ Verification completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyDPValues();

