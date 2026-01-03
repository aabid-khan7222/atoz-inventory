const express = require('express');
const db = require('../db');
const { requireAuth, requireSuperAdminOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all commission agents (searchable)
router.get('/', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = `
      SELECT 
        id,
        name,
        mobile_number,
        email,
        address,
        total_commission_paid,
        created_at,
        updated_at
      FROM commission_agents
      WHERE 1=1
    `;
    const params = [];
    
    if (search) {
      query += ` AND (
        name ILIKE $1 OR
        mobile_number ILIKE $1 OR
        email ILIKE $1
      )`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY name ASC`;
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching commission agents:', err);
    res.status(500).json({ error: 'Failed to fetch commission agents' });
  }
});

// Get single commission agent by ID
router.get('/:id', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({ error: 'Invalid agent ID' });
    }
    
    const result = await db.query(
      `SELECT * FROM commission_agents WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commission agent not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching commission agent:', err);
    res.status(500).json({ error: 'Failed to fetch commission agent' });
  }
});

// Create new commission agent
router.post('/', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { name, mobile_number, email, address } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Agent name is required' });
    }
    
    if (!mobile_number || !mobile_number.trim()) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }
    
    // Validate mobile number format (10 digits)
    const cleanMobile = mobile_number.trim().replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      return res.status(400).json({ error: 'Mobile number must be 10 digits' });
    }
    
    // Check if agent with same mobile number already exists
    const existing = await db.query(
      `SELECT id FROM commission_agents WHERE mobile_number = $1`,
      [cleanMobile]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Commission agent with this mobile number already exists',
        agent_id: existing.rows[0].id
      });
    }
    
    // Insert new agent
    const result = await db.query(
      `INSERT INTO commission_agents (
        name, mobile_number, email, address
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        name.trim(),
        cleanMobile,
        email ? email.trim() : null,
        address ? address.trim() : null
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    // Handle unique constraint violation
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Commission agent with this mobile number already exists' });
    }
    
    console.error('Error creating commission agent:', err);
    res.status(500).json({ error: 'Failed to create commission agent' });
  }
});

// Update commission agent
router.put('/:id', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mobile_number, email, address } = req.body;
    
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({ error: 'Invalid agent ID' });
    }
    
    // Check if agent exists
    const existing = await db.query(
      `SELECT id FROM commission_agents WHERE id = $1`,
      [id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Commission agent not found' });
    }
    
    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Agent name cannot be empty' });
      }
      updates.push(`name = $${paramCount}`);
      params.push(name.trim());
      paramCount++;
    }
    
    if (mobile_number !== undefined) {
      const cleanMobile = mobile_number.trim().replace(/\D/g, '');
      if (cleanMobile.length !== 10) {
        return res.status(400).json({ error: 'Mobile number must be 10 digits' });
      }
      
      // Check if another agent has this mobile number
      const duplicate = await db.query(
        `SELECT id FROM commission_agents WHERE mobile_number = $1 AND id != $2`,
        [cleanMobile, id]
      );
      
      if (duplicate.rows.length > 0) {
        return res.status(400).json({ error: 'Another agent with this mobile number already exists' });
      }
      
      updates.push(`mobile_number = $${paramCount}`);
      params.push(cleanMobile);
      paramCount++;
    }
    
    if (email !== undefined) {
      updates.push(`email = $${paramCount}`);
      params.push(email ? email.trim() : null);
      paramCount++;
    }
    
    if (address !== undefined) {
      updates.push(`address = $${paramCount}`);
      params.push(address ? address.trim() : null);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);
    
    const result = await db.query(
      `UPDATE commission_agents 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      params
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Commission agent with this mobile number already exists' });
    }
    
    console.error('Error updating commission agent:', err);
    res.status(500).json({ error: 'Failed to update commission agent' });
  }
});

// Get commission history for an agent
router.get('/:id/commission-history', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { dateFrom, dateTo } = req.query;
    
    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({ error: 'Invalid agent ID' });
    }
    
    let query = `
      SELECT 
        si.id,
        si.invoice_number,
        si.customer_name,
        si.customer_mobile_number,
        si.NAME as product_name,
        si.SKU,
        si.SERIAL_NUMBER,
        si.commission_amount,
        si.purchase_date,
        si.created_at
      FROM sales_item si
      WHERE si.commission_agent_id = $1
        AND si.has_commission = true
    `;
    const params = [id];
    let paramCount = 2;
    
    if (dateFrom) {
      query += ` AND si.purchase_date >= $${paramCount}`;
      params.push(dateFrom);
      paramCount++;
    }
    
    if (dateTo) {
      query += ` AND si.purchase_date <= $${paramCount}`;
      params.push(dateTo + ' 23:59:59');
      paramCount++;
    }
    
    query += ` ORDER BY si.purchase_date DESC, si.created_at DESC`;
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching commission history:', err);
    res.status(500).json({ error: 'Failed to fetch commission history' });
  }
});

module.exports = router;

