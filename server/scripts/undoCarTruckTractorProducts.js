// Script to undo Car/Truck/Tractor products import
// Deletes all products we just inserted from the EXIDE vehicular price list
require('dotenv').config();
const db = require('../db');

async function undoCarTruckProducts() {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Undoing Car/Truck/Tractor products import...\n');

    // All SKUs inserted by addCarTruckTractorProducts.js
    const skus = [
      'EPIQ35L',
      'EPIQ40LBH',
      'EPIQDIN74L',
      'MT40B20L',
      'MT40B20R',
      'MTRED45L',
      'MTREDDIN100',
      'MLM42ISS',
      'MLN55ISS',
      'MLDIN70ISS',
      'ML38B20L',
      'ML38B20R',
      'ML40LBH',
      'ML40RBH',
      'MLDIN44R',
      'MLDIN44L',
      'MLDIN44LH',
      'ML45D21LBH',
      'ML55B24L',
      'MLDIN50',
      'ML55D23L',
      'MLDIN55',
      'MLDIN55R',
      'MLDIN60',
      'MLDIN66',
      'MLDIN66A',
      'ML75D23LBH',
      'ML85D26R',
      'MLDIN80',
      'EYDIN47RMFEFB',
      'EYDIN52RMFEFB',
      'EYDIN78LMFEFB',
      'EY34B19L',
      'EY34B19R',
      'EY700L',
      'EY700R',
      'EY700F',
      'EY700LF',
      'EY80D23R',
      'EY105D31L',
      'EY105D31R',
      'RIDE35L',
      'RIDE45L',
      'RIDE700L',
      'RIDE700R',
      'RIDE700LF',
      'RIDE700RF',
      'EKO32',
      'EKO40L',
      'EKO50L',
      'EKO55L',
      'EKO60L',
      'EKO60R',
      'XP800',
      'XP800F',
      'XP880',
      'XP1000',
      'XP1000H29R',
      'XP1200L',
      'XP1200R',
      'XP1200RH',
      'XP1300',
      'XP1500',
      'XP1800',
      'XP2000',
      'KI75TF',
      'KI80T',
      'KI88T',
      'KI88TLH',
      'KI90H29L',
      'KI99T',
      'DRIVE35L',
      'DRIVE40LBH',
      'DRIVE45L',
      'DRIVE45R',
      'DRIVE700R',
      'DRIVE700RF',
      'DRIVE80L',
      'DRIVE80R',
      'DRIVE80LF',
      'DRIVE80RF',
      'DRIVE88L',
      'DRIVE100L',
      'DRIVE100H29R',
      'DRIVE130R',
      'DRIVE150R',
      'DRIVE180R',
    ];

    const { rowCount } = await client.query(
      `DELETE FROM products WHERE sku = ANY($1::text[])`,
      [skus]
    );

    await client.query('COMMIT');

    console.log(`Deleted ${rowCount} products from products table.`);
    console.log('✅ Undo complete.');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during undo:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

undoCarTruckProducts().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});


