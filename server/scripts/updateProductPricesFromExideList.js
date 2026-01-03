// Script to update all car/truck/tractor product prices from EXIDE price list
// This script:
// 1. Removes old prices
// 2. Updates MRP from EXIDE list
// 3. Calculates selling_price = MRP - 12% (MRP * 0.88)
// 4. Updates discount and discount_percent
require('dotenv').config();
const db = require('../db');

async function updatePrices() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Updating product prices from EXIDE price list...\n');

    // EXIDE Price List - Car/Truck/Tractor Batteries
    // Format: { sku, mrp_price }
    const priceList = [
      // EXIDE EPIQ: 77M WARRANTY
      { sku: 'EPIQ35L', mrp_price: 5473 },
      { sku: 'EPIQ40LBH', mrp_price: 6150 },
      { sku: 'EPIQDIN74L', mrp_price: 13271 },

      // EXIDE MATRIX: 72M WARRANTY
      { sku: 'MT40B20L', mrp_price: 4889 },
      { sku: 'MT40B20R', mrp_price: 4889 },
      { sku: 'MTRED45L', mrp_price: 8912 },
      { sku: 'MTREDDIN100', mrp_price: 20215 },

      // EXIDE MILEAGE ISS: 60M WARRANTY
      { sku: 'MLM42ISS', mrp_price: 5944 },
      { sku: 'MLN55ISS', mrp_price: 7799 },
      { sku: 'MLDIN70ISS', mrp_price: 10234 },

      // EXIDE MILEAGE: 60M WARRANTY
      { sku: 'ML38B20L', mrp_price: 4599 },
      { sku: 'ML38B20R', mrp_price: 4599 },
      { sku: 'ML40LBH', mrp_price: 5635 },
      { sku: 'ML40RBH', mrp_price: 5635 },
      { sku: 'MLDIN44R', mrp_price: 6799 },
      { sku: 'MLDIN44L', mrp_price: 6799 },
      { sku: 'MLDIN44LH', mrp_price: 6799 },
      { sku: 'ML45D21LBH', mrp_price: 7422 },
      { sku: 'ML55B24L', mrp_price: 7511 },
      { sku: 'MLDIN50', mrp_price: 7464 },
      { sku: 'ML55D23L', mrp_price: 7806 },
      { sku: 'MLDIN55', mrp_price: 8541 },
      { sku: 'MLDIN55R', mrp_price: 8541 },
      { sku: 'MLDIN60', mrp_price: 8748 },
      { sku: 'MLDIN66', mrp_price: 8782 },
      { sku: 'MLDIN66A', mrp_price: 8782 },
      { sku: 'ML75D23LBH', mrp_price: 8220 },
      { sku: 'ML85D26R', mrp_price: 9446 },
      { sku: 'MLDIN80', mrp_price: 12768 },

      // EXIDE EEZY ISS: 48M WARRANTY
      { sku: 'EYDIN47RMFEFB', mrp_price: 7039 },
      { sku: 'EYDIN52RMFEFB', mrp_price: 7373 },
      { sku: 'EYDIN78LMFEFB', mrp_price: 9982 },

      // EXIDE EEZY: 48M WARRANTY
      { sku: 'EY34B19L', mrp_price: 4087 },
      { sku: 'EY34B19R', mrp_price: 4087 },
      { sku: 'EY700L', mrp_price: 8244 },
      { sku: 'EY700R', mrp_price: 8244 },
      { sku: 'EY700F', mrp_price: 8244 },
      { sku: 'EY700LF', mrp_price: 8244 },
      { sku: 'EY80D23R', mrp_price: 8244 },
      { sku: 'EY105D31L', mrp_price: 8950 },
      { sku: 'EY105D31R', mrp_price: 8950 },

      // EXIDE RIDE: 24M WARRANTY
      { sku: 'RIDE35L', mrp_price: 3507 },
      { sku: 'RIDE45L', mrp_price: 5870 },
      { sku: 'RIDE700L', mrp_price: 6009 },
      { sku: 'RIDE700R', mrp_price: 6009 },
      { sku: 'RIDE700LF', mrp_price: 6009 },
      { sku: 'RIDE700RF', mrp_price: 6009 },

      // 3W/LCV: EXIDE EKO: 24M WARRANTY
      { sku: 'EKO32', mrp_price: 3603 },
      { sku: 'EKO40L', mrp_price: 4253 },
      { sku: 'EKO50L', mrp_price: 5829 },
      { sku: 'EKO55L', mrp_price: 5940 },
      { sku: 'EKO60L', mrp_price: 6078 },
      { sku: 'EKO60R', mrp_price: 6078 },

      // CV: EXIDE XPRESS: 42M WARRANTY
      { sku: 'XP800', mrp_price: 8145 },
      { sku: 'XP800F', mrp_price: 8145 },
      { sku: 'XP880', mrp_price: 9007 },
      { sku: 'XP1000', mrp_price: 10228 },
      { sku: 'XP1000H29R', mrp_price: 9921 },
      { sku: 'XP1200L', mrp_price: 12522 },
      { sku: 'XP1200R', mrp_price: 12522 },
      { sku: 'XP1200RH', mrp_price: 12522 },
      { sku: 'XP1300', mrp_price: 12797 },
      { sku: 'XP1500', mrp_price: 16381 },
      { sku: 'XP1800', mrp_price: 19354 },
      { sku: 'XP2000', mrp_price: 25933 },

      // TRACTOR: EXIDE JAI KISAN: 42M WARRANTY
      { sku: 'KI75TF', mrp_price: 7594 },
      { sku: 'KI80T', mrp_price: 7747 },
      { sku: 'KI88T', mrp_price: 7905 },
      { sku: 'KI88TLH', mrp_price: 7905 },
      { sku: 'KI90H29L', mrp_price: 7905 },
      { sku: 'KI99T', mrp_price: 9064 },

      // CAR/SUV/3W/TRACTOR/CV: EXIDE DRIVE: 36M WARRANTY
      { sku: 'DRIVE35L', mrp_price: 3825 },
      { sku: 'DRIVE40LBH', mrp_price: 4484 },
      { sku: 'DRIVE45L', mrp_price: 6469 },
      { sku: 'DRIVE45R', mrp_price: 6469 },
      { sku: 'DRIVE700R', mrp_price: 7579 },
      { sku: 'DRIVE700RF', mrp_price: 7579 },
      { sku: 'DRIVE80L', mrp_price: 7330 },
      { sku: 'DRIVE80R', mrp_price: 7330 },
      { sku: 'DRIVE80LF', mrp_price: 7330 },
      { sku: 'DRIVE80RF', mrp_price: 7330 },
      { sku: 'DRIVE88L', mrp_price: 7847 },
      { sku: 'DRIVE100L', mrp_price: 8573 },
      { sku: 'DRIVE100H29R', mrp_price: 8573 },
      { sku: 'DRIVE130R', mrp_price: 11646 },
      { sku: 'DRIVE150R', mrp_price: 13914 },
      { sku: 'DRIVE180R', mrp_price: 18044 },
    ];

    console.log(`Found ${priceList.length} products in price list...\n`);

    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    for (const priceItem of priceList) {
      try {
        const mrpPrice = priceItem.mrp_price;
        
        // Calculate selling_price = MRP - 12% (MRP * 0.88)
        const sellingPrice = Math.round(mrpPrice * 0.88 * 100) / 100;
        
        // Calculate discount amount
        const discount = Math.round((mrpPrice - sellingPrice) * 100) / 100;
        
        // Calculate discount percentage (should be 12%)
        const discountPercent = 12.00; // Fixed 12%

        // Update product
        const result = await client.query(`
          UPDATE products 
          SET 
            mrp_price = $1,
            selling_price = $2,
            discount = $3,
            discount_percent = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE sku = $5
          RETURNING id, sku, name, mrp_price, selling_price, discount, discount_percent
        `, [mrpPrice, sellingPrice, discount, discountPercent, priceItem.sku]);

        if (result.rowCount > 0) {
          const product = result.rows[0];
          updatedCount++;
          console.log(`✓ Updated: ${product.name} (${product.sku}) - MRP: ₹${product.mrp_price}, Selling: ₹${product.selling_price}, Discount: ${product.discount_percent}%`);
        } else {
          notFoundCount++;
          console.log(`⚠ Not found: ${priceItem.sku}`);
        }
      } catch (err) {
        errorCount++;
        console.error(`✗ Error updating ${priceItem.sku}:`, err.message);
      }
    }

    // Also update any remaining car/truck/tractor products that are not in the list
    // Set their prices to 0 or keep existing (user's choice - we'll keep existing for now)
    console.log('\nChecking for other car/truck/tractor products not in price list...');
    const otherProducts = await client.query(`
      SELECT sku, name, mrp_price, selling_price 
      FROM products 
      WHERE product_type_id = 1 
      AND sku NOT IN (${priceList.map((_, i) => `$${i + 1}`).join(', ')})
    `, priceList.map(p => p.sku));

    if (otherProducts.rows.length > 0) {
      console.log(`Found ${otherProducts.rows.length} products not in price list. Keeping existing prices.`);
      for (const product of otherProducts.rows) {
        console.log(`  - ${product.name} (${product.sku}) - MRP: ₹${product.mrp_price || 'N/A'}, Selling: ₹${product.selling_price || 'N/A'}`);
      }
    }

    await client.query('COMMIT');
    
    console.log(`\n✅ Summary:`);
    console.log(`   Updated: ${updatedCount} products`);
    console.log(`   Not found: ${notFoundCount} products`);
    console.log(`   Errors: ${errorCount} products`);
    console.log(`   Total in price list: ${priceList.length} products`);
    console.log(`\n📝 Note: All prices now follow the rule:`);
    console.log(`   - MRP: From EXIDE price list (includes 18% GST)`);
    console.log(`   - Selling Price: MRP - 12% (MRP * 0.88)`);
    console.log(`   - Discount: 12% fixed`);
    console.log(`   - GST: 18% (included in MRP, non-editable)`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', err.message);
    console.error(err);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

updatePrices().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

