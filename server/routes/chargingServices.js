const express = require('express');
const db = require('../db');
const bcrypt = require('bcrypt');
const { requireAuth, requireSuperAdminOrAdmin } = require('../middleware/auth');
const { createNotification } = require('./notifications');

const router = express.Router();

// Get charging services for the logged-in customer
// Customers can only see their own charging services
router.get('/my-services', requireAuth, async (req, res) => {
  try {
    const { 
      status, 
      search, 
      dateFrom, 
      dateTo, 
      sortBy = 'created_at', 
      sortOrder = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    const offset = (page - 1) * limit;
    const customerEmail = req.user.email ? req.user.email.toLowerCase().trim() : null;
    const customerPhone = req.user.phone ? req.user.phone.trim() : null;

    if (!customerEmail && !customerPhone) {
      return res.status(400).json({ error: 'Customer email or phone is required' });
    }

    let baseQuery = `
      FROM charging_services cs
      LEFT JOIN users u ON cs.created_by = u.id
      WHERE (LOWER(cs.customer_email) = $1 OR cs.customer_mobile_number = $2)
    `;
    const params = [customerEmail, customerPhone];
    let paramCount = 2;

    // Filter by status
    if (status && status !== 'all') {
      paramCount++;
      baseQuery += ` AND cs.status = $${paramCount}`;
      params.push(status);
    }

    // Filter by date range
    if (dateFrom) {
      paramCount++;
      baseQuery += ` AND cs.created_at >= $${paramCount}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      paramCount++;
      baseQuery += ` AND cs.created_at <= $${paramCount}`;
      params.push(dateTo + ' 23:59:59');
    }

    // Search filter
    if (search) {
      paramCount++;
      baseQuery += ` AND (
        cs.battery_serial_number ILIKE $${paramCount} OR
        cs.vehicle_number ILIKE $${paramCount} OR
        cs.battery_sku ILIKE $${paramCount} OR
        cs.battery_brand ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // Get total count for pagination
    const countResult = await db.query(`SELECT COUNT(*) ${baseQuery}`, params);
    const totalItems = parseInt(countResult.rows[0].count);

    // Validate sortBy to prevent SQL injection
    const validSortFields = ['created_at', 'battery_serial_number', 'status', 'service_price', 'expected_completion_time'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Get paginated data
    let dataQuery = `
      SELECT 
        cs.*,
        u.full_name as created_by_name
      ${baseQuery}
      ORDER BY cs.${sortField} ${sortDir}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    params.push(parseInt(limit), offset);

    const result = await db.query(dataQuery, params);
    
    res.json({
      items: result.rows,
      pagination: {
        totalItems,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / limit),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    console.error('Error fetching customer charging services:', err);
    res.status(500).json({ error: 'Failed to fetch charging services' });
  }
});

// Helper function to find or create customer account
// Same logic as in adminSales.js - creates user with email as username and mobile as password
async function findOrCreateCustomer(email, mobileNumber, customerName, client) {
  try {
    console.log('[findOrCreateCustomer] Starting with:', { email, mobileNumber, customerName });
    
    // Validate inputs
    if (!email || !email.trim()) {
      throw new Error('Email is required to create customer account');
    }
    if (!mobileNumber || !mobileNumber.trim()) {
      throw new Error('Mobile number is required to create customer account');
    }
    if (!customerName || !customerName.trim()) {
      throw new Error('Customer name is required to create customer account');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedMobile = mobileNumber.trim();

    // Check for optional columns first
    let hasUserTypeCol = false;
    let hasIsB2BCol = false;
    try {
      const colChecks = await Promise.all([
        client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'user_type'
        `),
        client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'customer_profiles' AND column_name = 'is_business_customer'
        `)
      ]);
      hasUserTypeCol = colChecks[0].rows.length > 0;
      hasIsB2BCol = colChecks[1].rows.length > 0;
    } catch (err) {
      console.warn('[findOrCreateCustomer] Could not check for optional columns:', err.message);
    }

    // Try to find by email
    const userSelect = hasUserTypeCol 
      ? 'id, email, phone, user_type' 
      : 'id, email, phone';
      
    let customerResult = await client.query(
      `SELECT ${userSelect} FROM users WHERE LOWER(email) = $1 AND role_id >= 3 LIMIT 1`,
      [normalizedEmail]
    );

    if (customerResult.rows.length > 0) {
      const customer = customerResult.rows[0];
      customer.was_auto_created = false;
      console.log('[findOrCreateCustomer] Found existing customer by email:', customer.id);
      
      // Update customer_profiles
      let profileQuery = `INSERT INTO customer_profiles (user_id, full_name, email, phone`;
      let profileValues = [customer.id, customerName.trim(), customer.email || normalizedEmail, customer.phone || normalizedMobile];
      
      if (hasIsB2BCol) {
        profileQuery += `, is_business_customer) VALUES ($1, $2, $3, $4, $5)`;
        profileValues.push(false);
      } else {
        profileQuery += `) VALUES ($1, $2, $3, $4)`;
      }
      
      profileQuery += ` ON CONFLICT (user_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone`;
      
      await client.query(profileQuery, profileValues);
      return customer;
    }

    // Try to find by mobile number (only customers, role_id >= 3)
    customerResult = await client.query(
      `SELECT ${userSelect} FROM users WHERE phone = $1 AND role_id >= 3 LIMIT 1`,
      [normalizedMobile]
    );

    if (customerResult.rows.length > 0) {
      const customer = customerResult.rows[0];
      customer.was_auto_created = false;
      console.log('[findOrCreateCustomer] Found existing customer by phone:', customer.id);
      
      // Update customer_profiles
      let profileQuery = `INSERT INTO customer_profiles (user_id, full_name, email, phone`;
      let profileValues = [customer.id, customerName.trim(), customer.email || normalizedEmail, customer.phone || normalizedMobile];
      
      if (hasIsB2BCol) {
        profileQuery += `, is_business_customer) VALUES ($1, $2, $3, $4, $5)`;
        profileValues.push(false);
      } else {
        profileQuery += `) VALUES ($1, $2, $3, $4)`;
      }
      
      profileQuery += ` ON CONFLICT (user_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone`;
      
      await client.query(profileQuery, profileValues);
      return customer;
    }

    // Create new customer account
    console.log('[findOrCreateCustomer] Creating new customer account...');
    const roleResult = await client.query(
      `SELECT id FROM roles WHERE LOWER(role_name) = 'customer' LIMIT 1`
    );

    if (!roleResult.rows.length) {
      throw new Error('Customer role not found in database');
    }

    const customerRoleId = roleResult.rows[0].id;
    const hashedPassword = await bcrypt.hash(normalizedMobile, 10);

    // Insert user
    let userInsertQuery = `INSERT INTO users (full_name, email, phone, password, role_id, is_active`;
    let userValues = [customerName.trim(), normalizedEmail, normalizedMobile, hashedPassword, customerRoleId, true];
    
    if (hasUserTypeCol) {
      userInsertQuery += `, user_type) VALUES ($1, $2, $3, $4, $5, $6, $7)`;
      userValues.push('b2c');
    } else {
      userInsertQuery += `) VALUES ($1, $2, $3, $4, $5, $6)`;
    }
    
    userInsertQuery += ` RETURNING id, email, phone`;
    if (hasUserTypeCol) userInsertQuery = userInsertQuery.replace('RETURNING id', 'RETURNING id, user_type');

    const insertResult = await client.query(userInsertQuery, userValues);

    if (!insertResult.rows || insertResult.rows.length === 0) {
      throw new Error('Failed to create user - no data returned');
    }

    const newUser = insertResult.rows[0];
    newUser.was_auto_created = true;
    console.log('[findOrCreateCustomer] Auto-created customer user:', { id: newUser.id, email: newUser.email, phone: newUser.phone });

    // Also create entry in customer_profiles table
    let profileInsertQuery = `INSERT INTO customer_profiles (user_id, full_name, email, phone`;
    let profileInsertValues = [newUser.id, customerName.trim(), normalizedEmail, normalizedMobile];
    
    if (hasIsB2BCol) {
      profileInsertQuery += `, is_business_customer) VALUES ($1, $2, $3, $4, $5)`;
      profileInsertValues.push(false);
    } else {
      profileInsertQuery += `) VALUES ($1, $2, $3, $4)`;
    }
    
    profileInsertQuery += ` ON CONFLICT (user_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone`;
    
    await client.query(profileInsertQuery, profileInsertValues);

    console.log('[findOrCreateCustomer] Successfully created customer:', { id: newUser.id, email: newUser.email });
    return newUser;
  } catch (error) {
    console.error('[findOrCreateCustomer] Error:', error);
    throw error;
  }
}

// Get all charging services with optional filters and pagination
router.get('/', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { 
      status, 
      search, 
      dateFrom, 
      dateTo, 
      sortBy = 'created_at', 
      sortOrder = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    const offset = (page - 1) * limit;

    let baseQuery = `
      FROM charging_services cs
      LEFT JOIN users u ON cs.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // Filter by status
    if (status && status !== 'all') {
      paramCount++;
      baseQuery += ` AND cs.status = $${paramCount}`;
      params.push(status);
    }

    // Filter by date range
    if (dateFrom) {
      paramCount++;
      baseQuery += ` AND cs.created_at >= $${paramCount}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      paramCount++;
      baseQuery += ` AND cs.created_at <= $${paramCount}`;
      params.push(dateTo + ' 23:59:59');
    }

    // Search filter
    if (search) {
      paramCount++;
      baseQuery += ` AND (
        cs.battery_serial_number ILIKE $${paramCount} OR
        cs.customer_name ILIKE $${paramCount} OR
        cs.customer_mobile_number ILIKE $${paramCount} OR
        cs.customer_email ILIKE $${paramCount} OR
        cs.vehicle_number ILIKE $${paramCount} OR
        cs.battery_sku ILIKE $${paramCount} OR
        cs.battery_brand ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // Get total count for pagination
    const countResult = await db.query(`SELECT COUNT(*) ${baseQuery}`, params);
    const totalItems = parseInt(countResult.rows[0].count);

    // Validate sortBy to prevent SQL injection
    const validSortFields = ['created_at', 'battery_serial_number', 'customer_name', 'status', 'service_price', 'expected_completion_time'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Get paginated data
    let dataQuery = `
      SELECT 
        cs.*,
        u.full_name as created_by_name
      ${baseQuery}
      ORDER BY cs.${sortField} ${sortDir}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    params.push(parseInt(limit), offset);

    const result = await db.query(dataQuery, params);
    
    res.json({
      items: result.rows,
      pagination: {
        totalItems,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / limit),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    console.error('Error fetching charging services:', err);
    res.status(500).json({ error: 'Failed to fetch charging services' });
  }
});

// Get a single charging service by ID
router.get('/:id', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        cs.*,
        u.full_name as created_by_name
      FROM charging_services cs
      LEFT JOIN users u ON cs.created_by = u.id
      WHERE cs.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Charging service not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching charging service:', err);
    res.status(500).json({ error: 'Failed to fetch charging service' });
  }
});

// Create a new charging service
router.post('/', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    const {
      batterySerialNumber,
      customerName,
      customerMobileNumber,
      customerEmail,
      vehicleNumber,
      batteryBrand,
      batterySku,
      batteryAmpereRating,
      batteryCondition,
      servicePrice,
      expectedCompletionTime,
      notes,
      customerId // Existing customer ID if selected
    } = req.body;

    // Validation
    if (!batterySerialNumber || !customerName || !customerMobileNumber || !batteryCondition || !servicePrice || !expectedCompletionTime) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate email - if not provided, use mobile number as email
    const finalCustomerEmail = customerEmail || `${customerMobileNumber}@customer.local`;

    // If customerId is provided, use existing customer; otherwise find or create
    let customer;
    if (customerId) {
      // Use existing customer - verify they exist
      try {
        const customerResult = await client.query(
          'SELECT id, email, phone FROM users WHERE id = $1',
          [customerId]
        );
        if (customerResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Selected customer not found' });
        }
        customer = {
          id: customerResult.rows[0].id,
          email: customerResult.rows[0].email,
          was_auto_created: false
        };
        console.log('[ChargingService] Using existing customer:', { id: customer.id, email: customer.email });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[ChargingService] Error fetching existing customer:', err);
        return res.status(400).json({ error: 'Failed to verify existing customer' });
      }
    } else {
      // Find or create customer account (username = email, password = mobile number)
      try {
        customer = await findOrCreateCustomer(
          finalCustomerEmail,
          customerMobileNumber,
          customerName,
          client
        );
        console.log('[ChargingService] Customer found/created:', { id: customer.id, email: customer.email, was_auto_created: customer.was_auto_created });
      } catch (customerError) {
        await client.query('ROLLBACK');
        console.error('[ChargingService] Error finding/creating customer:', customerError);
        return res.status(400).json({ error: `Failed to create customer account: ${customerError.message}` });
      }
    }

    // Check for optional columns in charging_services
    let hasEmailCol = false;
    let hasBrandCol = false;
    try {
      const colChecks = await Promise.all([
        client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'charging_services' AND column_name = 'customer_email'
        `),
        client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'charging_services' AND column_name = 'battery_brand'
        `)
      ]);
      hasEmailCol = colChecks[0].rows.length > 0;
      hasBrandCol = colChecks[1].rows.length > 0;
    } catch (err) {
      console.warn('Could not check for optional columns in charging_services:', err.message);
    }

    // Prepare dynamic query based on existing columns
    const columns = [
      'battery_serial_number',
      'customer_name',
      'customer_mobile_number',
      'vehicle_number',
      'battery_sku',
      'battery_ampere_rating',
      'battery_condition',
      'service_price',
      'expected_completion_time',
      'notes',
      'created_by'
    ];
    const values = [
      batterySerialNumber,
      customerName,
      customerMobileNumber,
      vehicleNumber || null,
      batterySku || null,
      batteryAmpereRating || null,
      batteryCondition,
      servicePrice,
      expectedCompletionTime,
      notes || null,
      req.user.id
    ];

    if (hasEmailCol) {
      columns.push('customer_email');
      values.push(finalCustomerEmail);
    }
    if (hasBrandCol) {
      columns.push('battery_brand');
      values.push(batteryBrand || null);
    }

    const columnNames = columns.join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    // Insert charging service
    const result = await client.query(
      `INSERT INTO charging_services (${columnNames}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      service: result.rows[0],
      customer: {
        id: customer.id,
        email: customer.email,
        was_auto_created: customer.was_auto_created
      },
      message: customer.was_auto_created 
        ? 'Charging service created successfully. Customer user auto-created (email as username, mobile as password).'
        : 'Charging service created successfully.'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating charging service:', err);
    res.status(500).json({ error: 'Failed to create charging service' });
  } finally {
    client.release();
  }
});

// Update charging service status
router.patch('/:id/status', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'in_progress', 'completed', 'collected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    let updateQuery = `UPDATE charging_services SET status = $1, updated_at = CURRENT_TIMESTAMP`;
    const params = [status, id];

    // Set completed_at when status is 'completed'
    if (status === 'completed') {
      updateQuery += `, completed_at = CURRENT_TIMESTAMP`;
    }

    // Set collected_at when status is 'collected'
    if (status === 'collected') {
      updateQuery += `, collected_at = CURRENT_TIMESTAMP`;
    }

    updateQuery += ` WHERE id = $2 RETURNING *`;

    const result = await db.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Charging service not found' });
    }

    const service = result.rows[0];

    // Create notification for customer when status changes
    try {
      // Get customer user_id from email or phone
      if (service.customer_email || service.customer_mobile_number) {
        const customerQuery = service.customer_email
          ? `SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`
          : `SELECT id FROM users WHERE phone = $1 LIMIT 1`;
        const customerParam = service.customer_email
          ? service.customer_email.toLowerCase()
          : service.customer_mobile_number;

        const customerResult = await db.query(customerQuery, [customerParam]);
        
        if (customerResult.rows.length > 0) {
          const customerId = customerResult.rows[0].id;
          const statusMessages = {
            'pending': 'Your charging service request has been received and is pending.',
            'in_progress': 'Your battery charging service is now in progress.',
            'completed': 'Your battery charging service has been completed and is ready for collection.',
            'collected': 'Your battery has been collected. Thank you for using our service!'
          };

          const message = statusMessages[status] || `Your charging service status has been updated to: ${status}`;
          
          await createNotification(
            customerId,
            'Charging Service Update',
            `Service ID: ${service.id}. ${message}${service.battery_serial_number ? ` Battery Serial: ${service.battery_serial_number}` : ''}`,
            status === 'completed' || status === 'collected' ? 'success' : 'info',
            null
          );
        }
      }
    } catch (notifErr) {
      console.warn('Failed to create customer notification for charging service:', notifErr);
      // Don't fail the status update if notification fails
    }

    res.json({
      success: true,
      service: result.rows[0],
      message: 'Service status updated successfully'
    });
  } catch (err) {
    console.error('Error updating charging service status:', err);
    res.status(500).json({ error: 'Failed to update service status' });
  }
});

// Update charging service details
router.put('/:id', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const {
      batterySerialNumber,
      customerName,
      customerMobileNumber,
      customerEmail,
      vehicleNumber,
      batteryBrand,
      batterySku,
      batteryAmpereRating,
      batteryCondition,
      servicePrice,
      expectedCompletionTime,
      notes
    } = req.body;

    // Validate email - if not provided, use mobile number as email
    const finalCustomerEmail = customerEmail || `${customerMobileNumber}@customer.local`;

    // Find or create customer account if email or mobile changed
    // First, get the existing service to check if customer details changed
    const existingService = await client.query(
      `SELECT customer_email, customer_mobile_number FROM charging_services WHERE id = $1`,
      [id]
    );

    if (existingService.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Charging service not found' });
    }

    const existingEmail = existingService.rows[0].customer_email;
    const existingMobile = existingService.rows[0].customer_mobile_number;

    // If email or mobile changed, update/create customer
    if (finalCustomerEmail !== existingEmail || customerMobileNumber !== existingMobile) {
      try {
        const customer = await findOrCreateCustomer(
          finalCustomerEmail,
          customerMobileNumber,
          customerName,
          client
        );
        console.log('[ChargingService] Customer updated/created on edit:', { id: customer.id, email: customer.email });
      } catch (customerError) {
        await client.query('ROLLBACK');
        console.error('[ChargingService] Error finding/creating customer on edit:', customerError);
        return res.status(400).json({ error: `Failed to update customer account: ${customerError.message}` });
      }
    }

    // Check for optional columns in charging_services
    let hasEmailCol = false;
    let hasBrandCol = false;
    try {
      const colChecks = await Promise.all([
        client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'charging_services' AND column_name = 'customer_email'
        `),
        client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'charging_services' AND column_name = 'battery_brand'
        `)
      ]);
      hasEmailCol = colChecks[0].rows.length > 0;
      hasBrandCol = colChecks[1].rows.length > 0;
    } catch (err) {
      console.warn('Could not check for optional columns in charging_services:', err.message);
    }

    // Update charging service
    let updateQuery = `UPDATE charging_services SET
        battery_serial_number = $1,
        customer_name = $2,
        customer_mobile_number = $3,
        vehicle_number = $4,
        battery_sku = $5,
        battery_ampere_rating = $6,
        battery_condition = $7,
        service_price = $8,
        expected_completion_time = $9,
        notes = $10,
        updated_at = CURRENT_TIMESTAMP`;
    
    const params = [
      batterySerialNumber,
      customerName,
      customerMobileNumber,
      vehicleNumber || null,
      batterySku || null,
      batteryAmpereRating || null,
      batteryCondition,
      servicePrice,
      expectedCompletionTime,
      notes || null
    ];

    let paramCount = 10;

    if (hasEmailCol) {
      paramCount++;
      updateQuery += `, customer_email = $${paramCount}`;
      params.push(finalCustomerEmail);
    }
    if (hasBrandCol) {
      paramCount++;
      updateQuery += `, battery_brand = $${paramCount}`;
      params.push(batteryBrand || null);
    }

    paramCount++;
    updateQuery += ` WHERE id = $${paramCount} RETURNING *`;
    params.push(id);

    const result = await client.query(updateQuery, params);

    await client.query('COMMIT');

    res.json({
      success: true,
      service: result.rows[0],
      message: 'Charging service updated successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating charging service:', err);
    res.status(500).json({ error: 'Failed to update charging service' });
  } finally {
    client.release();
  }
});

// Delete charging service (soft delete by setting status to 'cancelled' or hard delete)
router.delete('/:id', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM charging_services WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Charging service not found' });
    }

    res.json({
      success: true,
      message: 'Charging service deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting charging service:', err);
    res.status(500).json({ error: 'Failed to delete charging service' });
  }
});

// Get charging service statistics
router.get('/stats/overview', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    let query = `
      SELECT 
        COUNT(*) as total_services,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'collected') as collected_count,
        COALESCE(SUM(service_price) FILTER (WHERE status IN ('completed', 'collected')), 0) as total_revenue
      FROM charging_services
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (dateFrom) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      paramCount++;
      query += ` AND created_at <= $${paramCount}`;
      params.push(dateTo + ' 23:59:59');
    }

    const result = await db.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching charging service stats:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;

