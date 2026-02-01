const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin, requireShopId } = require('../middleware/auth');
const db = require('../db');

// Default shop object when table is missing or empty (fallback for invoice)
function getDefaultShop() {
  return {
    shop_name: 'A TO Z BATTERIES & ELECTRICAL PARTS',
    address_line1: 'Near Ajanta Chawfully,',
    address_line2: 'Front of HP Petrol Pump,',
    address_line3: 'Taiba Washing,',
    city: 'Jalgaon',
    pincode: '425001',
    state: 'Maharashtra',
    state_code: '27',
    phone: '9890412516',
    email: 'atozbatteries7222@gmail.com',
    gstin: '27CHVPP1094F1ZT'
  };
}

// GET shop settings (admin/super admin only - for Settings page)
router.get('/', requireAuth, requireAdmin, requireShopId, async (req, res) => {
  try {
    const shopId = req.shop_id;
    const result = await db.query(
      `SELECT id, shop_name, address_line1, address_line2, address_line3, city, pincode, state, state_code, phone, email, gstin, updated_at
       FROM shop_settings WHERE shop_id = $1`,
      [shopId]
    );
    if (result.rows.length === 0) {
      // New shop without settings - return shop name from shops table
      const shopRow = await db.query(`SELECT name FROM shops WHERE id = $1`, [shopId]);
      if (shopRow.rows.length > 0) {
        return res.json({ ...getDefaultShop(), shop_name: shopRow.rows[0].name });
      }
      return res.json(getDefaultShop());
    }
    const row = result.rows[0];
    res.json({
      id: row.id,
      shop_name: row.shop_name || '',
      address_line1: row.address_line1 || '',
      address_line2: row.address_line2 || '',
      address_line3: row.address_line3 || '',
      city: row.city || '',
      pincode: row.pincode || '',
      state: row.state || '',
      state_code: row.state_code || '',
      phone: row.phone || '',
      email: row.email || '',
      gstin: row.gstin || '',
      updated_at: row.updated_at
    });
  } catch (err) {
    if (err.code === '42P01') {
      return res.json(getDefaultShop());
    }
    console.error('Error fetching shop settings:', err);
    res.status(500).json({ error: 'Failed to fetch shop settings' });
  }
});

// PUT shop settings (admin/super admin only)
router.put('/', requireAuth, requireAdmin, requireShopId, async (req, res) => {
  try {
    const {
      shop_name,
      address_line1,
      address_line2,
      address_line3,
      city,
      pincode,
      state,
      state_code,
      phone,
      email,
      gstin
    } = req.body;

    if (!shop_name || !String(shop_name).trim()) {
      return res.status(400).json({ error: 'Shop name is required' });
    }

    const shopId = req.shop_id;
    await db.query(
      `INSERT INTO shop_settings (id, shop_id, shop_name, address_line1, address_line2, address_line3, city, pincode, state, state_code, phone, email, gstin, updated_at)
       VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
       ON CONFLICT (shop_id) DO UPDATE SET
         shop_name = EXCLUDED.shop_name,
         address_line1 = EXCLUDED.address_line1,
         address_line2 = EXCLUDED.address_line2,
         address_line3 = EXCLUDED.address_line3,
         city = EXCLUDED.city,
         pincode = EXCLUDED.pincode,
         state = EXCLUDED.state,
         state_code = EXCLUDED.state_code,
         phone = EXCLUDED.phone,
         email = EXCLUDED.email,
         gstin = EXCLUDED.gstin,
         updated_at = CURRENT_TIMESTAMP`,
      [
        shopId,
        (shop_name || '').trim(),
        (address_line1 || '').trim(),
        (address_line2 || '').trim(),
        (address_line3 || '').trim(),
        (city || '').trim(),
        (pincode || '').trim(),
        (state || '').trim(),
        (state_code || '').trim(),
        (phone || '').trim(),
        (email || '').trim(),
        (gstin || '').trim()
      ]
    );

    const result = await db.query(
      `SELECT id, shop_name, address_line1, address_line2, address_line3, city, pincode, state, state_code, phone, email, gstin, updated_at
       FROM shop_settings WHERE shop_id = $1`,
      [shopId]
    );
    const row = result.rows[0];
    res.json({
      id: row.id,
      shop_name: row.shop_name || '',
      address_line1: row.address_line1 || '',
      address_line2: row.address_line2 || '',
      address_line3: row.address_line3 || '',
      city: row.city || '',
      pincode: row.pincode || '',
      state: row.state || '',
      state_code: row.state_code || '',
      phone: row.phone || '',
      email: row.email || '',
      gstin: row.gstin || '',
      updated_at: row.updated_at
    });
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(400).json({ error: 'Shop settings table not found. Run migration: create_shop_settings_table.sql' });
    }
    console.error('Error updating shop settings:', err);
    res.status(500).json({ error: 'Failed to update shop settings' });
  }
});

// Get shop for invoice (used by invoices route). Returns promise. Pass shopId for multi-tenant.
async function getShop(shopId) {
  try {
    const result = shopId != null
      ? await db.query(
          `SELECT shop_name, address_line1, address_line2, address_line3, city, pincode, state, state_code, phone, email, gstin
           FROM shop_settings WHERE shop_id = $1`,
          [shopId]
        )
      : await db.query(
          `SELECT shop_name, address_line1, address_line2, address_line3, city, pincode, state, state_code, phone, email, gstin
           FROM shop_settings WHERE id = 1`
        );
    if (result.rows.length === 0) {
      // For new shops without shop_settings, use name from shops table
      if (shopId != null) {
        const shopRow = await db.query(`SELECT name FROM shops WHERE id = $1`, [shopId]);
        if (shopRow.rows.length > 0) {
          return { shop_name: shopRow.rows[0].name, address_line1: '', address_line2: '', address_line3: '', city: '', pincode: '', state: '', state_code: '', phone: '', email: '', gstin: '' };
        }
      }
      return getDefaultShop();
    }
    const row = result.rows[0];
    return {
      shop_name: row.shop_name || '',
      address_line1: row.address_line1 || '',
      address_line2: row.address_line2 || '',
      address_line3: row.address_line3 || '',
      city: row.city || '',
      pincode: row.pincode || '',
      state: row.state || '',
      state_code: row.state_code || '',
      phone: row.phone || '',
      email: row.email || '',
      gstin: row.gstin || ''
    };
  } catch (err) {
    if (err.code === '42P01') return getDefaultShop();
    throw err;
  }
}

module.exports = router;
module.exports.getDefaultShop = getDefaultShop;
module.exports.getShop = getShop;
