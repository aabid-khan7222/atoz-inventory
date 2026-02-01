const express = require('express');
const db = require('../db');
const { requireAuth, requireShop } = require('../middleware/auth');

const router = express.Router();

// Get all sales types (the two IDs: 1 for retail, 2 for wholesale)
router.get('/', requireAuth, requireShop, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM sales_types ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sales types:', err);
    res.status(500).json({ error: 'Failed to fetch sales types' });
  }
});

// Get sales type by ID
router.get('/:id', requireAuth, requireShop, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM sales_types WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sales type not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching sales type:', err);
    res.status(500).json({ error: 'Failed to fetch sales type' });
  }
});

module.exports = router;

