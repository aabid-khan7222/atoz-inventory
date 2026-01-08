// Quick script to check migration results
// Run this in browser console on production frontend

fetch('https://atoz-backend-qq3k.onrender.com/api/products')
  .then(r => r.json())
  .then(products => {
    console.log('📦 Current Products Count:', products.length);
    console.log('📦 Sample Products:', products.slice(0, 5).map(p => p.name));
  })
  .catch(err => console.error('❌ Error:', err));

fetch('https://atoz-backend-qq3k.onrender.com/api/sales/pending/orders')
  .then(r => r.json())
  .then(sales => {
    console.log('💰 Current Sales Count:', sales.length || 0);
  })
  .catch(err => console.error('❌ Sales Error:', err));

