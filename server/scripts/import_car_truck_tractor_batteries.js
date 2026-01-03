// Script to import Car/Truck/Tractor batteries from EXIDE price list
require('dotenv').config();
const db = require('../db');

async function importBatteries() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting import of Car/Truck/Tractor batteries...\n');

    // Product data from the price list
    // Format: { series: string, warranty: string, products: [{ ah_va, sku, warranty, mrp }] }
    const batteryData = [
      {
        series: 'EPIQ',
        warranty: '77M (42F+35P)',
        category: 'CAR/SUV',
        products: [
          { ah_va: '35', sku: 'EPIQ35L', warranty: '42F+35P', mrp: 5473 },
          { ah_va: '40', sku: 'EPIQ40LBH', warranty: '42F+35P', mrp: 6150 },
          { ah_va: '74', sku: 'EPIQDIN74L', warranty: '42F+35P', mrp: 13271 },
        ]
      },
      {
        series: 'MATRIX',
        warranty: '72M (36F+36P)',
        category: 'CAR/SUV',
        products: [
          { ah_va: '35', sku: 'MT40B20L/R', warranty: '36F+36P', mrp: 4889 },
          { ah_va: '45', sku: 'MTRED45L', warranty: '36F+36P', mrp: 8912 },
          { ah_va: '100', sku: 'MTREDDIN100', warranty: '36F+36P', mrp: 20215 },
        ]
      },
      {
        series: 'MILEAGE ISS',
        warranty: '60M (30F+30P)',
        category: 'CAR/SUV',
        products: [
          { ah_va: '38', sku: 'MLM42(ISS)', warranty: '30F+30P', mrp: 5944 },
          { ah_va: '45', sku: 'MLN55(ISS)', warranty: '30F+30P', mrp: 7799 },
          { ah_va: '70', sku: 'MLDIN70(ISS)', warranty: '30F+30P', mrp: 10234 },
        ]
      },
      {
        series: 'MILEAGE',
        warranty: '60M (30F+30P)',
        category: 'CAR/SUV',
        products: [
          { ah_va: '35', sku: 'ML38B20L/R', warranty: '30F+30P', mrp: 4599 },
          { ah_va: '40', sku: 'ML40LBH/RBH', warranty: '30F+30P', mrp: 5635 },
          { ah_va: '44', sku: 'MLDIN44R/LH', warranty: '30F+30P', mrp: 6799 },
          { ah_va: '45', sku: 'ML45D21LBH', warranty: '30F+30P', mrp: 7422 },
          { ah_va: '50', sku: 'ML55B24L(T1)', warranty: '30F+30P', mrp: 7511 },
          { ah_va: '50', sku: 'MLDIN50', warranty: '30F+30P', mrp: 7464 },
          { ah_va: '54', sku: 'ML55D23L', warranty: '30F+30P', mrp: 7806 },
          { ah_va: '55', sku: 'MLDIN55/R', warranty: '30F+30P', mrp: 8541 },
          { ah_va: '60', sku: 'MLDIN60', warranty: '30F+30P', mrp: 8748 },
          { ah_va: '66', sku: 'MLDIN66/66A', warranty: '30F+30P', mrp: 8782 },
          { ah_va: '68', sku: 'ML75D23LBH', warranty: '30F+30P', mrp: 8220 },
          { ah_va: '72', sku: 'ML85D26R', warranty: '30F+30P', mrp: 9446 },
          { ah_va: '80', sku: 'MLDIN80', warranty: '30F+30P', mrp: 12768 },
        ]
      },
      {
        series: 'EEZY ISS',
        warranty: '48M (24F+24P)',
        category: 'CAR/SUV',
        products: [
          { ah_va: '47', sku: 'EYDIN47RMFEFB', warranty: '24F+24P', mrp: 7039 },
          { ah_va: '52', sku: 'EYDIN52RMFEFB', warranty: '24F+24P', mrp: 7373 },
          { ah_va: '78', sku: 'EYDIN78LMFEFB', warranty: '24F+24P', mrp: 9982 },
        ]
      },
      {
        series: 'EEZY',
        warranty: '48M (24F+24P)',
        category: 'CAR/SUV',
        products: [
          { ah_va: '33', sku: 'EY34B19L/R', warranty: '24F+24P', mrp: 4087 },
          { ah_va: '65', sku: 'EY700L/R', warranty: '24F+24P', mrp: 8244 },
          { ah_va: '65', sku: 'EY700F/EY700LF', warranty: '24F+24P', mrp: 8244 },
          { ah_va: '68', sku: 'EY80D23R', warranty: '24F+24P', mrp: 8244 },
          { ah_va: '85', sku: 'EY105D31L/R', warranty: '24F+24P', mrp: 8950 },
        ]
      },
      {
        series: 'RIDE',
        warranty: '24M (12F+12P)',
        category: 'CAR/SUV',
        products: [
          { ah_va: '35', sku: 'RIDE35L', warranty: '12F+12P', mrp: 3507 },
          { ah_va: '45', sku: 'RIDE45L', warranty: '12F+12P', mrp: 5870 },
          { ah_va: '65', sku: 'RIDE700L/R', warranty: '12F+12P', mrp: 6009 },
          { ah_va: '65', sku: 'RIDE700LF/RF', warranty: '12F+12P', mrp: 6009 },
        ]
      },
      {
        series: 'EKO',
        warranty: '24M (24F)',
        category: '3W/LCV',
        products: [
          { ah_va: '32', sku: 'EKO32', warranty: '24F', mrp: 3603 },
          { ah_va: '35', sku: 'EKO40L', warranty: '24F', mrp: 4253 },
          { ah_va: '50', sku: 'EKO50L', warranty: '24F', mrp: 5829 },
          { ah_va: '55', sku: 'EKO55L', warranty: '24F', mrp: 5940 },
          { ah_va: '60', sku: 'EKO60L/R', warranty: '24F', mrp: 6078 },
        ]
      },
      {
        series: 'XPRESS',
        warranty: '42M (24F+18P)',
        category: 'CV',
        products: [
          { ah_va: '80', sku: 'XP800', warranty: '24F+18P', mrp: 8145 },
          { ah_va: '80', sku: 'XP800F', warranty: '24F+18P', mrp: 8145 },
          { ah_va: '88', sku: 'XP880', warranty: '24F+18P', mrp: 9007 },
          { ah_va: '100', sku: 'XP1000', warranty: '24F+18P', mrp: 10228 },
          { ah_va: '100', sku: 'XP1000H29R', warranty: '24F+18P', mrp: 9921 },
          { ah_va: '120', sku: 'XP1200/L(RH)', warranty: '24F+18P', mrp: 12522 },
          { ah_va: '130', sku: 'XP1300', warranty: '24F+18P', mrp: 12797 },
          { ah_va: '150', sku: 'XP1500', warranty: '24F+18P', mrp: 16381 },
          { ah_va: '180', sku: 'XP1800', warranty: '24F+18P', mrp: 19354 },
          { ah_va: '200', sku: 'XP2000', warranty: '24F+18P', mrp: 25933 },
        ]
      },
      {
        series: 'JAI KISAN',
        warranty: '42M (24F+18P)',
        category: 'TRACTOR',
        products: [
          { ah_va: '75', sku: 'KI75TF', warranty: '24F+18P', mrp: 7594 },
          { ah_va: '80', sku: 'KI80T', warranty: '24F+18P', mrp: 7747 },
          { ah_va: '88', sku: 'KI88T/TLH', warranty: '24F+18P', mrp: 7905 },
          { ah_va: '90', sku: 'KI90H29L', warranty: '24F+18P', mrp: 7905 },
          { ah_va: '99', sku: 'KI99T', warranty: '24F+18P', mrp: 9064 },
        ]
      },
      {
        series: 'DRIVE',
        warranty: '36M (18F+18P)',
        category: 'CAR/SUV/3W/TRACTOR/CV',
        products: [
          { ah_va: '35', sku: 'DRIVE35L', warranty: '18F+18P', mrp: 3825 },
          { ah_va: '40', sku: 'DRIVE40LBH', warranty: '18F+18P', mrp: 4484 },
          { ah_va: '45', sku: 'DRIVE45L/R', warranty: '18F+18P', mrp: 6469 },
          { ah_va: '65', sku: 'DRIVE700R', warranty: '18F+18P', mrp: 7579 },
          { ah_va: '65', sku: 'DRIVE700RF', warranty: '18F+18P', mrp: 7579 },
          { ah_va: '80', sku: 'DRIVE80L/R', warranty: '18F+18P', mrp: 7330 },
          { ah_va: '80', sku: 'DRIVE80LF/RF', warranty: '18F+18P', mrp: 7330 },
          { ah_va: '88', sku: 'DRIVE88L', warranty: '18F+18P', mrp: 7847 },
          { ah_va: '100', sku: 'DRIVE100L', warranty: '18F+18P', mrp: 8573 },
          { ah_va: '100', sku: 'DRIVE100H29R', warranty: '18F+18P', mrp: 8573 },
          { ah_va: '130', sku: 'DRIVE130R', warranty: '18F+18P', mrp: 11646 },
          { ah_va: '150', sku: 'DRIVE150R', warranty: '18F+18P', mrp: 13914 },
          { ah_va: '180', sku: 'DRIVE180R', warranty: '18F+18P', mrp: 18044 },
        ]
      },
    ];

    // Car/Truck/Tractor category = product_type_id = 1
    const productTypeId = 1;
    let totalInserted = 0;
    let totalUpdated = 0;
    let orderIndex = 1;

    for (const seriesData of batteryData) {
      console.log(`\n📦 Processing series: ${seriesData.series} (${seriesData.warranty})`);
      
      for (const product of seriesData.products) {
        try {
          // Calculate prices
          const mrp = parseFloat(product.mrp);
          const sellingPrice = Math.round(mrp * 0.88 * 100) / 100; // 12% discount (regular customer)
          const b2bSellingPrice = Math.round(mrp * 0.82 * 100) / 100; // 18% discount (B2B customer)
          const discount = mrp - sellingPrice;
          const discountPercent = 12.00; // Regular customer discount
          
          // Create product name
          const productName = `EXIDE ${seriesData.series} ${product.ah_va}Ah`;
          
          // Check if product already exists
          const existing = await client.query(
            'SELECT id FROM products WHERE sku = $1',
            [product.sku]
          );
          
          if (existing.rows.length > 0) {
            // Update existing product
            await client.query(`
              UPDATE products SET
                name = $1,
                series = $2,
                category = $3,
                mrp_price = $4,
                selling_price = $5,
                b2b_selling_price = $6,
                discount = $7,
                discount_percent = $8,
                ah_va = $9,
                warranty = $10,
                product_type_id = $11,
                order_index = $12,
                updated_at = CURRENT_TIMESTAMP
              WHERE sku = $13
            `, [
              productName,
              seriesData.series,
              seriesData.category,
              mrp,
              sellingPrice,
              b2bSellingPrice,
              discount,
              discountPercent,
              product.ah_va,
              product.warranty,
              productTypeId,
              orderIndex++,
              product.sku
            ]);
            totalUpdated++;
            console.log(`  ✓ Updated: ${product.sku} - ${productName} (MRP: ₹${mrp}, Regular: ₹${sellingPrice}, B2B: ₹${b2bSellingPrice})`);
          } else {
            // Insert new product
            await client.query(`
              INSERT INTO products (
                sku, name, series, category, qty, 
                mrp_price, selling_price, b2b_selling_price, discount, discount_percent,
                ah_va, warranty, product_type_id, order_index, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
              product.sku,
              productName,
              seriesData.series,
              seriesData.category,
              0, // Initial quantity is 0
              mrp,
              sellingPrice,
              b2bSellingPrice,
              discount,
              discountPercent,
              product.ah_va,
              product.warranty,
              productTypeId,
              orderIndex++
            ]);
            totalInserted++;
            console.log(`  ✓ Inserted: ${product.sku} - ${productName} (MRP: ₹${mrp}, Regular: ₹${sellingPrice}, B2B: ₹${b2bSellingPrice})`);
          }
        } catch (err) {
          if (err.code === '23505') {
            // Duplicate SKU - skip
            console.log(`  ⚠ Skipped (duplicate): ${product.sku}`);
          } else {
            console.error(`  ✗ Error processing ${product.sku}:`, err.message);
          }
        }
      }
    }

    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Import completed successfully!');
    console.log('='.repeat(60));
    console.log(`Total products inserted: ${totalInserted}`);
    console.log(`Total products updated: ${totalUpdated}`);
    console.log(`Total products processed: ${totalInserted + totalUpdated}`);
    console.log('\n💡 Note:');
    console.log('  - Regular customer price: MRP - 12% discount');
    console.log('  - B2B customer price: MRP - 18% discount');
    console.log('  - Initial stock quantity: 0 (can be added via Purchase Section)');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error during import:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

importBatteries().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

