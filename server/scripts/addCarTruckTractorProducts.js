// Script to add all Car/Truck/Tractor batteries from EXIDE price list
require('dotenv').config();
const db = require('../db');

async function addProducts() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Adding Car/Truck/Tractor batteries to database...\n');

    // All products from the EXIDE price list
    // Category: car-truck-tractor (product_type_id = 1)
    const products = [
      // EXIDE EPIQ: 77M WARRANTY
      { sku: 'EPIQ35L', name: 'EPIQ Battery 35Ah', series: 'EXIDE EPIQ', category: 'car-truck-tractor', qty: 0, mrp_price: 5473, ah_va: '35Ah', warranty: '42F+35P', order_index: 1 },
      { sku: 'EPIQ40LBH', name: 'EPIQ Battery 40Ah', series: 'EXIDE EPIQ', category: 'car-truck-tractor', qty: 0, mrp_price: 6150, ah_va: '40Ah', warranty: '42F+35P', order_index: 2 },
      { sku: 'EPIQDIN74L', name: 'EPIQ Battery 74Ah', series: 'EXIDE EPIQ', category: 'car-truck-tractor', qty: 0, mrp_price: 13271, ah_va: '74Ah', warranty: '42F+35P', order_index: 3 },

      // EXIDE MATRIX: 72M WARRANTY
      { sku: 'MT40B20L', name: 'MATRIX Battery 35Ah', series: 'EXIDE MATRIX', category: 'car-truck-tractor', qty: 0, mrp_price: 4889, ah_va: '35Ah', warranty: '36F+36P', order_index: 4 },
      { sku: 'MT40B20R', name: 'MATRIX Battery 35Ah', series: 'EXIDE MATRIX', category: 'car-truck-tractor', qty: 0, mrp_price: 4889, ah_va: '35Ah', warranty: '36F+36P', order_index: 5 },
      { sku: 'MTRED45L', name: 'MATRIX Battery 45Ah', series: 'EXIDE MATRIX', category: 'car-truck-tractor', qty: 0, mrp_price: 8912, ah_va: '45Ah', warranty: '36F+36P', order_index: 6 },
      { sku: 'MTREDDIN100', name: 'MATRIX Battery 100Ah', series: 'EXIDE MATRIX', category: 'car-truck-tractor', qty: 0, mrp_price: 20215, ah_va: '100Ah', warranty: '36F+36P', order_index: 7 },

      // EXIDE MILEAGE ISS: 60M WARRANTY
      { sku: 'MLM42ISS', name: 'MILEAGE ISS Battery 38Ah', series: 'EXIDE MILEAGE ISS', category: 'car-truck-tractor', qty: 0, mrp_price: 5944, ah_va: '38Ah', warranty: '30F+30P', order_index: 8 },
      { sku: 'MLN55ISS', name: 'MILEAGE ISS Battery 45Ah', series: 'EXIDE MILEAGE ISS', category: 'car-truck-tractor', qty: 0, mrp_price: 7799, ah_va: '45Ah', warranty: '30F+30P', order_index: 9 },
      { sku: 'MLDIN70ISS', name: 'MILEAGE ISS Battery 70Ah', series: 'EXIDE MILEAGE ISS', category: 'car-truck-tractor', qty: 0, mrp_price: 10234, ah_va: '70Ah', warranty: '30F+30P', order_index: 10 },

      // EXIDE MILEAGE: 60M WARRANTY
      { sku: 'ML38B20L', name: 'MILEAGE Battery 35Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 4599, ah_va: '35Ah', warranty: '30F+30P', order_index: 11 },
      { sku: 'ML38B20R', name: 'MILEAGE Battery 35Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 4599, ah_va: '35Ah', warranty: '30F+30P', order_index: 12 },
      { sku: 'ML40LBH', name: 'MILEAGE Battery 40Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 5635, ah_va: '40Ah', warranty: '30F+30P', order_index: 13 },
      { sku: 'ML40RBH', name: 'MILEAGE Battery 40Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 5635, ah_va: '40Ah', warranty: '30F+30P', order_index: 14 },
      { sku: 'MLDIN44R', name: 'MILEAGE Battery 44Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 6799, ah_va: '44Ah', warranty: '30F+30P', order_index: 15 },
      { sku: 'MLDIN44L', name: 'MILEAGE Battery 44Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 6799, ah_va: '44Ah', warranty: '30F+30P', order_index: 16 },
      { sku: 'MLDIN44LH', name: 'MILEAGE Battery 44Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 6799, ah_va: '44Ah', warranty: '30F+30P', order_index: 17 },
      { sku: 'ML45D21LBH', name: 'MILEAGE Battery 45Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 7422, ah_va: '45Ah', warranty: '30F+30P', order_index: 18 },
      { sku: 'ML55B24L', name: 'MILEAGE Battery 50Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 7511, ah_va: '50Ah', warranty: '30F+30P', order_index: 19 },
      { sku: 'MLDIN50', name: 'MILEAGE Battery 50Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 7464, ah_va: '50Ah', warranty: '30F+30P', order_index: 20 },
      { sku: 'ML55D23L', name: 'MILEAGE Battery 54Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 7806, ah_va: '54Ah', warranty: '30F+30P', order_index: 21 },
      { sku: 'MLDIN55', name: 'MILEAGE Battery 55Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 8541, ah_va: '55Ah', warranty: '30F+30P', order_index: 22 },
      { sku: 'MLDIN55R', name: 'MILEAGE Battery 55Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 8541, ah_va: '55Ah', warranty: '30F+30P', order_index: 23 },
      { sku: 'MLDIN60', name: 'MILEAGE Battery 60Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 8748, ah_va: '60Ah', warranty: '30F+30P', order_index: 24 },
      { sku: 'MLDIN66', name: 'MILEAGE Battery 66Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 8782, ah_va: '66Ah', warranty: '30F+30P', order_index: 25 },
      { sku: 'MLDIN66A', name: 'MILEAGE Battery 66Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 8782, ah_va: '66Ah', warranty: '30F+30P', order_index: 26 },
      { sku: 'ML75D23LBH', name: 'MILEAGE Battery 68Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 8220, ah_va: '68Ah', warranty: '30F+30P', order_index: 27 },
      { sku: 'ML85D26R', name: 'MILEAGE Battery 72Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 9446, ah_va: '72Ah', warranty: '30F+30P', order_index: 28 },
      { sku: 'MLDIN80', name: 'MILEAGE Battery 80Ah', series: 'EXIDE MILEAGE', category: 'car-truck-tractor', qty: 0, mrp_price: 12768, ah_va: '80Ah', warranty: '30F+30P', order_index: 29 },

      // EXIDE EEZY ISS: 48M WARRANTY
      { sku: 'EYDIN47RMFEFB', name: 'EEZY ISS Battery 47Ah', series: 'EXIDE EEZY ISS', category: 'car-truck-tractor', qty: 0, mrp_price: 7039, ah_va: '47Ah', warranty: '24F+24P', order_index: 30 },
      { sku: 'EYDIN52RMFEFB', name: 'EEZY ISS Battery 52Ah', series: 'EXIDE EEZY ISS', category: 'car-truck-tractor', qty: 0, mrp_price: 7373, ah_va: '52Ah', warranty: '24F+24P', order_index: 31 },
      { sku: 'EYDIN78LMFEFB', name: 'EEZY ISS Battery 78Ah', series: 'EXIDE EEZY ISS', category: 'car-truck-tractor', qty: 0, mrp_price: 9982, ah_va: '78Ah', warranty: '24F+24P', order_index: 32 },

      // EXIDE EEZY: 48M WARRANTY
      { sku: 'EY34B19L', name: 'EEZY Battery 33Ah', series: 'EXIDE EEZY', category: 'car-truck-tractor', qty: 0, mrp_price: 4087, ah_va: '33Ah', warranty: '24F+24P', order_index: 33 },
      { sku: 'EY34B19R', name: 'EEZY Battery 33Ah', series: 'EXIDE EEZY', category: 'car-truck-tractor', qty: 0, mrp_price: 4087, ah_va: '33Ah', warranty: '24F+24P', order_index: 34 },
      { sku: 'EY700L', name: 'EEZY Battery 65Ah', series: 'EXIDE EEZY', category: 'car-truck-tractor', qty: 0, mrp_price: 8244, ah_va: '65Ah', warranty: '24F+24P', order_index: 35 },
      { sku: 'EY700R', name: 'EEZY Battery 65Ah', series: 'EXIDE EEZY', category: 'car-truck-tractor', qty: 0, mrp_price: 8244, ah_va: '65Ah', warranty: '24F+24P', order_index: 36 },
      { sku: 'EY700F', name: 'EEZY Battery 65Ah', series: 'EXIDE EEZY', category: 'car-truck-tractor', qty: 0, mrp_price: 8244, ah_va: '65Ah', warranty: '24F+24P', order_index: 37 },
      { sku: 'EY700LF', name: 'EEZY Battery 65Ah', series: 'EXIDE EEZY', category: 'car-truck-tractor', qty: 0, mrp_price: 8244, ah_va: '65Ah', warranty: '24F+24P', order_index: 38 },
      { sku: 'EY80D23R', name: 'EEZY Battery 68Ah', series: 'EXIDE EEZY', category: 'car-truck-tractor', qty: 0, mrp_price: 8244, ah_va: '68Ah', warranty: '24F+24P', order_index: 39 },
      { sku: 'EY105D31L', name: 'EEZY Battery 85Ah', series: 'EXIDE EEZY', category: 'car-truck-tractor', qty: 0, mrp_price: 8950, ah_va: '85Ah', warranty: '24F+24P', order_index: 40 },
      { sku: 'EY105D31R', name: 'EEZY Battery 85Ah', series: 'EXIDE EEZY', category: 'car-truck-tractor', qty: 0, mrp_price: 8950, ah_va: '85Ah', warranty: '24F+24P', order_index: 41 },

      // EXIDE RIDE: 24M WARRANTY
      { sku: 'RIDE35L', name: 'RIDE Battery 35Ah', series: 'EXIDE RIDE', category: 'car-truck-tractor', qty: 0, mrp_price: 3507, ah_va: '35Ah', warranty: '12F+12P', order_index: 42 },
      { sku: 'RIDE45L', name: 'RIDE Battery 45Ah', series: 'EXIDE RIDE', category: 'car-truck-tractor', qty: 0, mrp_price: 5870, ah_va: '45Ah', warranty: '12F+12P', order_index: 43 },
      { sku: 'RIDE700L', name: 'RIDE Battery 65Ah', series: 'EXIDE RIDE', category: 'car-truck-tractor', qty: 0, mrp_price: 6009, ah_va: '65Ah', warranty: '12F+12P', order_index: 44 },
      { sku: 'RIDE700R', name: 'RIDE Battery 65Ah', series: 'EXIDE RIDE', category: 'car-truck-tractor', qty: 0, mrp_price: 6009, ah_va: '65Ah', warranty: '12F+12P', order_index: 45 },
      { sku: 'RIDE700LF', name: 'RIDE Battery 65Ah', series: 'EXIDE RIDE', category: 'car-truck-tractor', qty: 0, mrp_price: 6009, ah_va: '65Ah', warranty: '12F+12P', order_index: 46 },
      { sku: 'RIDE700RF', name: 'RIDE Battery 65Ah', series: 'EXIDE RIDE', category: 'car-truck-tractor', qty: 0, mrp_price: 6009, ah_va: '65Ah', warranty: '12F+12P', order_index: 47 },

      // 3W/LCV: EXIDE EKO: 24M WARRANTY
      { sku: 'EKO32', name: 'EKO Battery 32Ah', series: 'EXIDE EKO', category: 'car-truck-tractor', qty: 0, mrp_price: 3603, ah_va: '32Ah', warranty: '24F', order_index: 48 },
      { sku: 'EKO40L', name: 'EKO Battery 35Ah', series: 'EXIDE EKO', category: 'car-truck-tractor', qty: 0, mrp_price: 4253, ah_va: '35Ah', warranty: '24F', order_index: 49 },
      { sku: 'EKO50L', name: 'EKO Battery 50Ah', series: 'EXIDE EKO', category: 'car-truck-tractor', qty: 0, mrp_price: 5829, ah_va: '50Ah', warranty: '24F', order_index: 50 },
      { sku: 'EKO55L', name: 'EKO Battery 55Ah', series: 'EXIDE EKO', category: 'car-truck-tractor', qty: 0, mrp_price: 5940, ah_va: '55Ah', warranty: '24F', order_index: 51 },
      { sku: 'EKO60L', name: 'EKO Battery 60Ah', series: 'EXIDE EKO', category: 'car-truck-tractor', qty: 0, mrp_price: 6078, ah_va: '60Ah', warranty: '24F', order_index: 52 },
      { sku: 'EKO60R', name: 'EKO Battery 60Ah', series: 'EXIDE EKO', category: 'car-truck-tractor', qty: 0, mrp_price: 6078, ah_va: '60Ah', warranty: '24F', order_index: 53 },

      // CV: EXIDE XPRESS: 42M WARRANTY
      { sku: 'XP800', name: 'XPRESS Battery 80Ah', series: 'EXIDE XPRESS', category: 'car-truck-tractor', qty: 0, mrp_price: 8145, ah_va: '80Ah', warranty: '24F+18P', order_index: 54 },
      { sku: 'XP800F', name: 'XPRESS Battery 80Ah', series: 'EXIDE XPRESS', category: 'car-truck-tractor', qty: 0, mrp_price: 8145, ah_va: '80Ah', warranty: '24F+18P', order_index: 55 },
      { sku: 'XP880', name: 'XPRESS Battery 88Ah', series: 'EXIDE XPRESS', category: 'car-truck-tractor', qty: 0, mrp_price: 9007, ah_va: '88Ah', warranty: '24F+18P', order_index: 56 },
      { sku: 'XP1000', name: 'XPRESS Battery 100Ah', series: 'EXIDE XPRESS', category: 'car-truck-tractor', qty: 0, mrp_price: 10228, ah_va: '100Ah', warranty: '24F+18P', order_index: 57 },
      { sku: 'XP1000H29R', name: 'XPRESS Battery 100Ah', series: 'EXIDE XPRESS', category: 'car-truck-tractor', qty: 0, mrp_price: 9921, ah_va: '100Ah', warranty: '24F+18P', order_index: 58 },
      { sku: 'XP1200L', name: 'XPRESS Battery 120Ah', series: 'EXIDE XPRESS', category: 'car-truck-tractor', qty: 0, mrp_price: 12522, ah_va: '120Ah', warranty: '24F+18P', order_index: 59 },
      { sku: 'XP1200R', name: 'XPRESS Battery 120Ah', series: 'EXIDE XPRESS', category: 'car-truck-tractor', qty: 0, mrp_price: 12522, ah_va: '120Ah', warranty: '24F+18P', order_index: 60 },
      { sku: 'XP1200RH', name: 'XPRESS Battery 120Ah', series: 'EXIDE XPRESS', category: 'car-truck-tractor', qty: 0, mrp_price: 12522, ah_va: '120Ah', warranty: '24F+18P', order_index: 61 },
      { sku: 'XP1300', name: 'XPRESS Battery 130Ah', series: 'EXIDE XPRESS', category: 'car-truck-tractor', qty: 0, mrp_price: 12797, ah_va: '130Ah', warranty: '24F+18P', order_index: 62 },
      { sku: 'XP1500', name: 'XPRESS Battery 150Ah', series: 'EXIDE XPRESS', category: 'car-truck-tractor', qty: 0, mrp_price: 16381, ah_va: '150Ah', warranty: '24F+18P', order_index: 63 },
      { sku: 'XP1800', name: 'XPRESS Battery 180Ah', series: 'EXIDE XPRESS', category: 'car-truck-tractor', qty: 0, mrp_price: 19354, ah_va: '180Ah', warranty: '24F+18P', order_index: 64 },
      { sku: 'XP2000', name: 'XPRESS Battery 200Ah', series: 'EXIDE XPRESS', category: 'car-truck-tractor', qty: 0, mrp_price: 25933, ah_va: '200Ah', warranty: '24F+18P', order_index: 65 },

      // TRACTOR: EXIDE JAI KISAN: 42M WARRANTY
      { sku: 'KI75TF', name: 'JAI KISAN Battery 75Ah', series: 'EXIDE JAI KISAN', category: 'car-truck-tractor', qty: 0, mrp_price: 7594, ah_va: '75Ah', warranty: '24F+18P', order_index: 66 },
      { sku: 'KI80T', name: 'JAI KISAN Battery 80Ah', series: 'EXIDE JAI KISAN', category: 'car-truck-tractor', qty: 0, mrp_price: 7747, ah_va: '80Ah', warranty: '24F+18P', order_index: 67 },
      { sku: 'KI88T', name: 'JAI KISAN Battery 88Ah', series: 'EXIDE JAI KISAN', category: 'car-truck-tractor', qty: 0, mrp_price: 7905, ah_va: '88Ah', warranty: '24F+18P', order_index: 68 },
      { sku: 'KI88TLH', name: 'JAI KISAN Battery 88Ah', series: 'EXIDE JAI KISAN', category: 'car-truck-tractor', qty: 0, mrp_price: 7905, ah_va: '88Ah', warranty: '24F+18P', order_index: 69 },
      { sku: 'KI90H29L', name: 'JAI KISAN Battery 90Ah', series: 'EXIDE JAI KISAN', category: 'car-truck-tractor', qty: 0, mrp_price: 7905, ah_va: '90Ah', warranty: '24F+18P', order_index: 70 },
      { sku: 'KI99T', name: 'JAI KISAN Battery 99Ah', series: 'EXIDE JAI KISAN', category: 'car-truck-tractor', qty: 0, mrp_price: 9064, ah_va: '99Ah', warranty: '24F+18P', order_index: 71 },

      // CAR/SUV/3W/TRACTOR/CV: EXIDE DRIVE: 36M WARRANTY
      { sku: 'DRIVE35L', name: 'DRIVE Battery 35Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 3825, ah_va: '35Ah', warranty: '18F+18P', order_index: 72 },
      { sku: 'DRIVE40LBH', name: 'DRIVE Battery 40Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 4484, ah_va: '40Ah', warranty: '18F+18P', order_index: 73 },
      { sku: 'DRIVE45L', name: 'DRIVE Battery 45Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 6469, ah_va: '45Ah', warranty: '18F+18P', order_index: 74 },
      { sku: 'DRIVE45R', name: 'DRIVE Battery 45Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 6469, ah_va: '45Ah', warranty: '18F+18P', order_index: 75 },
      { sku: 'DRIVE700R', name: 'DRIVE Battery 65Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 7579, ah_va: '65Ah', warranty: '18F+18P', order_index: 76 },
      { sku: 'DRIVE700RF', name: 'DRIVE Battery 65Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 7579, ah_va: '65Ah', warranty: '18F+18P', order_index: 77 },
      { sku: 'DRIVE80L', name: 'DRIVE Battery 80Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 7330, ah_va: '80Ah', warranty: '18F+18P', order_index: 78 },
      { sku: 'DRIVE80R', name: 'DRIVE Battery 80Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 7330, ah_va: '80Ah', warranty: '18F+18P', order_index: 79 },
      { sku: 'DRIVE80LF', name: 'DRIVE Battery 80Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 7330, ah_va: '80Ah', warranty: '18F+18P', order_index: 80 },
      { sku: 'DRIVE80RF', name: 'DRIVE Battery 80Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 7330, ah_va: '80Ah', warranty: '18F+18P', order_index: 81 },
      { sku: 'DRIVE88L', name: 'DRIVE Battery 88Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 7847, ah_va: '88Ah', warranty: '18F+18P', order_index: 82 },
      { sku: 'DRIVE100L', name: 'DRIVE Battery 100Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 8573, ah_va: '100Ah', warranty: '18F+18P', order_index: 83 },
      { sku: 'DRIVE100H29R', name: 'DRIVE Battery 100Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 8573, ah_va: '100Ah', warranty: '18F+18P', order_index: 84 },
      { sku: 'DRIVE130R', name: 'DRIVE Battery 130Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 11646, ah_va: '130Ah', warranty: '18F+18P', order_index: 85 },
      { sku: 'DRIVE150R', name: 'DRIVE Battery 150Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 13914, ah_va: '150Ah', warranty: '18F+18P', order_index: 86 },
      { sku: 'DRIVE180R', name: 'DRIVE Battery 180Ah', series: 'EXIDE DRIVE', category: 'car-truck-tractor', qty: 0, mrp_price: 18044, ah_va: '180Ah', warranty: '18F+18P', order_index: 87 },
    ];

    console.log(`Found ${products.length} products to add...\n`);

    const categoryToTypeId = {
      'car-truck-tractor': 1,
      'bike': 2,
      'ups-inverter': 3,
      'hups-inverter': 3
    };

    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        const productTypeId = categoryToTypeId[product.category] || 1;
        
        // Keep MRP as given in list, calculate selling_price as MRP - 12% (MRP * 0.88)
        const mrpPrice = product.mrp_price || product.selling_price;
        const sellingPrice = Math.round(mrpPrice * 0.88 * 100) / 100; // Round to 2 decimal places
        const discount = Math.round((mrpPrice - sellingPrice) * 100) / 100; // Calculate discount
        const discountPercent = mrpPrice > 0
          ? Math.round(((mrpPrice - sellingPrice) / mrpPrice) * 10000) / 100
          : 0;

        const result = await client.query(`
          INSERT INTO products (
            sku, series, category, name, qty, selling_price, mrp_price, discount, discount_percent,
            ah_va, warranty, order_index, product_type_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (sku) DO UPDATE SET
            series = EXCLUDED.series,
            category = EXCLUDED.category,
            name = EXCLUDED.name,
            qty = EXCLUDED.qty,
            selling_price = EXCLUDED.selling_price,
            mrp_price = EXCLUDED.mrp_price,
            discount = EXCLUDED.discount,
            discount_percent = EXCLUDED.discount_percent,
            ah_va = EXCLUDED.ah_va,
            warranty = EXCLUDED.warranty,
            order_index = EXCLUDED.order_index,
            product_type_id = EXCLUDED.product_type_id,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, sku
        `, [
          product.sku.trim(),
          product.series ? product.series.trim() : null,
          product.category,
          product.name.trim(),
          product.qty || 0,
          sellingPrice,
          mrpPrice,
          discount,
          discountPercent,
          product.ah_va ? product.ah_va.trim() : null,
          product.warranty ? product.warranty.trim() : null,
          product.order_index,
          productTypeId
        ]);

        if (result.rows[0]) {
          insertedCount++;
          console.log(`✓ Added: ${product.name} (${product.sku}) - MRP: ₹${mrpPrice}, Selling: ₹${sellingPrice}, Discount: ₹${discount}`);
        }
      } catch (err) {
        errorCount++;
        if (err.code === '23505') {
          console.log(`⚠ Skipped duplicate SKU: ${product.sku}`);
        } else {
          console.error(`✗ Error with ${product.sku || 'unknown'}:`, err.message);
        }
      }
    }

    await client.query('COMMIT');
    
    console.log(`\n✅ Summary:`);
    console.log(`   Inserted: ${insertedCount} products`);
    console.log(`   Updated: ${updatedCount} products`);
    console.log(`   Errors: ${errorCount} products`);
    console.log(`   Total processed: ${products.length} products`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', err.message);
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}

addProducts().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

