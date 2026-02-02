const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { requireAuth, requireShopId, requireSuperAdminOrAdmin } = require('../middleware/auth');
const { createNotification } = require('./notifications');

const router = express.Router();

const SERVICE_TYPES = {
  battery_testing: 'Battery Testing Service',
  jump_start: 'Jump Start Service',
  inverter_repair: 'Inverter Repairing Service',
  inverter_battery: 'Inverter Battery Service'
};

const FUEL_TYPES = ['petrol', 'diesel', 'gas', 'electric'];
const STATUS_VALUES = ['requested', 'pending', 'in_progress', 'completed', 'cancelled'];

async function getCustomerContact(userId, shopId) {
  if (!shopId) return null;
  const result = await db.query(
    `SELECT id, full_name, phone, email 
     FROM users 
     WHERE id = $1 AND shop_id = $2
     LIMIT 1`,
    [userId, shopId]
  );
  return result.rows[0] || null;
}

// Customer: create a new service request (stored in service_requests with status='requested')
router.post('/', requireAuth, requireShopId, async (req, res) => {
  try {
    const {
      serviceType,
      vehicleName,
      fuelType,
      vehicleNumber,
      inverterVa,
      inverterVoltage,
      batteryAmpereRating,
      notes
    } = req.body;

    if (!SERVICE_TYPES[serviceType]) {
      return res.status(400).json({ error: 'Invalid service type' });
    }

    // Per-service validation
    if (['battery_testing', 'jump_start'].includes(serviceType)) {
      if (!vehicleName || !fuelType || !vehicleNumber) {
        return res.status(400).json({ error: 'Vehicle name, fuel type and vehicle number are required' });
      }
      if (!FUEL_TYPES.includes((fuelType || '').toLowerCase())) {
        return res.status(400).json({ error: 'Invalid fuel type' });
      }
    }

    if (serviceType === 'inverter_repair') {
      if (!inverterVa || !inverterVoltage) {
        return res.status(400).json({ error: 'Inverter VA and voltage are required' });
      }
    }

    if (serviceType === 'inverter_battery') {
      if (!batteryAmpereRating) {
        return res.status(400).json({ error: 'Battery ampere rating is required' });
      }
    }

    // Fetch customer details for audit + admin visibility
    const customer = await getCustomerContact(req.user_id ?? req.user?.id, req.shop_id);
    const customerName = customer?.full_name || req.user.full_name || 'Customer';
    const customerPhone = customer?.phone || req.user.phone || null;
    const customerEmail = (customer?.email || req.user.email || '').toLowerCase() || null;

    // Store in service_requests with status='requested' (not confirmed yet, can be deleted if cancelled)
    const insertResult = await db.query(
      `INSERT INTO service_requests (
        user_id,
        customer_name,
        customer_phone,
        customer_email,
        service_type,
        vehicle_name,
        fuel_type,
        vehicle_number,
        inverter_va,
        inverter_voltage,
        battery_ampere_rating,
        notes,
        status,
        shop_id,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'requested', $13, NOW(), NOW()
      ) RETURNING *`,
      [
        req.user_id ?? req.user?.id,
        customerName,
        customerPhone,
        customerEmail,
        serviceType,
        vehicleName || null,
        fuelType ? fuelType.toLowerCase() : null,
        vehicleNumber || null,
        inverterVa || null,
        inverterVoltage || null,
        batteryAmpereRating || null,
        notes || null
      ]
    );

    const service = insertResult.rows[0];

    // Notify admins and super admins
    try {
      const adminUsers = await db.query(
        `SELECT id FROM users WHERE role_id IN (1, 2) AND is_active = true AND shop_id = $1`,
        [req.shop_id]
      );
      const adminIds = adminUsers.rows.map((row) => row.id);

      if (adminIds.length > 0) {
        const parts = [
          `${SERVICE_TYPES[serviceType]}`,
          customerName ? `Customer: ${customerName}` : null,
          customerPhone ? `Phone: ${customerPhone}` : null,
          serviceType === 'battery_testing' || serviceType === 'jump_start'
            ? `Vehicle: ${vehicleName || 'N/A'}, Fuel: ${fuelType || 'N/A'}, Number: ${vehicleNumber || 'N/A'}`
            : null,
          serviceType === 'inverter_repair'
            ? `Inverter: ${inverterVa || 'N/A'} VA / ${inverterVoltage || 'N/A'}`
            : null,
          serviceType === 'inverter_battery'
            ? `Battery Ampere: ${batteryAmpereRating || 'N/A'}`
            : null
        ].filter(Boolean);

        await createNotification(
          adminIds,
          'New Service Request',
          parts.join(' | '),
          'info',
          null
        );
      }
    } catch (notifErr) {
      console.warn('Failed to notify admins for service request:', notifErr);
    }

    res.status(201).json({ success: true, service });
  } catch (err) {
    console.error('Error creating service request:', err);
    res.status(500).json({ error: 'Failed to create service request' });
  }
});

// Customer: fetch own service requests (both pending and confirmed)
router.get('/my', requireAuth, async (req, res) => {
  try {
    const {
      status = 'all',
      serviceType,
      page = 1,
      limit = 10
    } = req.query;

    const filters = ['user_id = $1', 'shop_id = $2'];
    const params = [req.user_id ?? req.user?.id, req.shop_id];
    let paramIndex = 2;

    if (status && status !== 'all') {
      paramIndex += 1;
      filters.push(`status = $${paramIndex}`);
      params.push(status);
    }

    if (serviceType && SERVICE_TYPES[serviceType]) {
      paramIndex += 1;
      filters.push(`service_type = $${paramIndex}`);
      params.push(serviceType);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) AS count FROM service_requests ${whereClause}`,
      params
    );
    const totalItems = parseInt(countResult.rows[0].count, 10) || 0;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const dataResult = await db.query(
      `SELECT *, 
        CASE WHEN status = 'requested' THEN 'pending' ELSE 'confirmed' END as request_type
       FROM service_requests 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit, 10), offset]
    );

    res.json({
      items: dataResult.rows,
      pagination: {
        totalItems,
        currentPage: parseInt(page, 10),
        totalPages: Math.ceil(totalItems / parseInt(limit, 10)) || 1,
        limit: parseInt(limit, 10)
      }
    });
  } catch (err) {
    console.error('Error fetching customer service requests:', err);
    res.status(500).json({ error: 'Failed to fetch service requests' });
  }
});

// Admin/Super Admin: fetch all service requests (both pending and confirmed)
router.get('/', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const {
      status = 'all',
      serviceType,
      page = 1,
      limit = 20
    } = req.query;

    const filters = ['shop_id = $1'];
    const params = [req.shop_id];
    let paramIndex = 1;

    if (status && status !== 'all') {
      paramIndex += 1;
      filters.push(`status = $${paramIndex}`);
      params.push(status);
    }

    if (serviceType && SERVICE_TYPES[serviceType]) {
      paramIndex += 1;
      filters.push(`service_type = $${paramIndex}`);
      params.push(serviceType);
    }

    const whereClause = `WHERE ${filters.join(' AND ')}`;

    const countResult = await db.query(
      `SELECT COUNT(*) AS count FROM service_requests ${whereClause}`,
      params
    );
    const totalItems = parseInt(countResult.rows[0].count, 10) || 0;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const dataResult = await db.query(
      `SELECT *, 
        CASE WHEN status = 'requested' THEN 'pending' ELSE 'confirmed' END as request_type
       FROM service_requests 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit, 10), offset]
    );

    res.json({
      items: dataResult.rows,
      pagination: {
        totalItems,
        currentPage: parseInt(page, 10),
        totalPages: Math.ceil(totalItems / parseInt(limit, 10)) || 1,
        limit: parseInt(limit, 10)
      }
    });
  } catch (err) {
    console.error('Error fetching all service requests:', err);
    res.status(500).json({ error: 'Failed to fetch service requests' });
  }
});

// Admin/Super Admin: confirm pending service request (change status from 'requested' to 'pending')
router.post('/pending/:id/confirm', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the pending request
    const pendingResult = await db.query(
      `SELECT * FROM service_requests WHERE id = $1 AND status = 'requested' AND shop_id = $2`,
      [id, req.shop_id]
    );

    if (!pendingResult.rows.length) {
      return res.status(404).json({ error: 'Pending service request not found' });
    }

    const pendingRequest = pendingResult.rows[0];

    const updateResult = await db.query(
      `UPDATE service_requests
       SET status = 'pending', updated_at = NOW()
       WHERE id = $1 AND shop_id = $2
       RETURNING *`,
      [id, req.shop_id]
    );

    const confirmedService = updateResult.rows[0];

    // Notify customer
    try {
      if (pendingRequest.user_id) {
        await createNotification(
          pendingRequest.user_id,
          'Service Request Confirmed',
          `Your service request #${id} has been confirmed. Our team will contact you soon.`,
          'success',
          null
        );
      }
    } catch (notifErr) {
      console.warn('Failed to notify customer about service confirmation:', notifErr);
    }

    res.json({ success: true, service: confirmedService });
  } catch (err) {
    console.error('Error confirming service request:', err);
    res.status(500).json({ error: 'Failed to confirm service request' });
  }
});

// Admin/Super Admin: cancel pending service request (delete from service_requests if status='requested')
router.delete('/pending/:id/cancel', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the pending request before deleting (only if status is 'requested')
    const pendingResult = await db.query(
      `SELECT * FROM service_requests WHERE id = $1 AND status = 'requested' AND shop_id = $2`,
      [id, req.shop_id]
    );

    if (!pendingResult.rows.length) {
      return res.status(404).json({ error: 'Pending service request not found or already confirmed' });
    }

    const pendingRequest = pendingResult.rows[0];

    await db.query(
      `DELETE FROM service_requests WHERE id = $1 AND status = 'requested' AND shop_id = $2`,
      [id, req.shop_id]
    );

    // Notify customer
    try {
      if (pendingRequest.user_id) {
        await createNotification(
          pendingRequest.user_id,
          'Service Request Cancelled',
          `Your service request #${id} has been cancelled by admin.`,
          'info',
          null
        );
      }
    } catch (notifErr) {
      console.warn('Failed to notify customer about service cancellation:', notifErr);
    }

    res.json({ success: true, message: 'Pending service request cancelled successfully' });
  } catch (err) {
    console.error('Error cancelling pending service request:', err);
    res.status(500).json({ error: 'Failed to cancel pending service request' });
  }
});

// Customer: cancel own pending service request (delete from service_requests if status='requested')
router.delete('/my/pending/:id/cancel', requireAuth, requireShopId, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the pending request and verify ownership (only if status is 'requested')
    const pendingResult = await db.query(
      `SELECT * FROM service_requests WHERE id = $1 AND user_id = $2 AND status = 'requested' AND shop_id = $3`,
      [id, req.user_id ?? req.user?.id, req.shop_id]
    );

    if (!pendingResult.rows.length) {
      return res.status(404).json({ error: 'Pending service request not found, already confirmed, or you do not have permission to cancel it' });
    }

    await db.query(
      `DELETE FROM service_requests WHERE id = $1 AND user_id = $2 AND status = 'requested' AND shop_id = $3`,
      [id, req.user_id ?? req.user?.id, req.shop_id]
    );

    res.json({ success: true, message: 'Service request cancelled successfully' });
  } catch (err) {
    console.error('Error cancelling pending service request:', err);
    res.status(500).json({ error: 'Failed to cancel service request' });
  }
});

// Admin/Super Admin: update status
router.patch('/:id/status', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, amount } = req.body;

    if (!STATUS_VALUES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // If status is 'completed', amount is required
    if (status === 'completed' && (amount === undefined || amount === null || amount === '')) {
      return res.status(400).json({ error: 'Amount is required when completing a service' });
    }

    // Validate amount if provided
    if (amount !== undefined && amount !== null && amount !== '') {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum < 0) {
        return res.status(400).json({ error: 'Invalid amount value' });
      }
    }

    // Build update query based on status
    let updateQuery;
    let queryParams;

    if (status === 'completed' && amount !== undefined && amount !== null && amount !== '') {
      // Update status and amount when completing
      updateQuery = `UPDATE service_requests
                     SET status = $1, amount = $2, updated_at = NOW()
                     WHERE id = $3
                     RETURNING *`;
      queryParams = [status, parseFloat(amount), id];
    } else {
      // Update only status for other status changes
      updateQuery = `UPDATE service_requests
                     SET status = $1, updated_at = NOW()
                     WHERE id = $2
                     RETURNING *`;
      queryParams = [status, id];
    }

    const updateResult = await db.query(updateQuery, queryParams);

    if (!updateResult.rows.length) {
      return res.status(404).json({ error: 'Service request not found' });
    }

    const service = updateResult.rows[0];

    // Notify customer on status change if possible
    try {
      if (service.user_id) {
        const statusMessages = {
          pending: 'Your service request is pending.',
          in_progress: 'Your service request is now in progress.',
          completed: `Your service request has been completed.${service.amount ? ` Amount charged: ₹${service.amount}` : ''}`,
          cancelled: 'Your service request has been cancelled.'
        };

        await createNotification(
          service.user_id,
          'Service Request Update',
          `Service #${service.id}: ${statusMessages[status] || status}.`,
          status === 'completed' ? 'success' : 'info',
          null
        );
      }
    } catch (notifErr) {
      console.warn('Failed to notify customer about service status change:', notifErr);
    }

    res.json({ success: true, service });
  } catch (err) {
    console.error('Error updating service request status:', err);
    res.status(500).json({ error: 'Failed to update service request' });
  }
});

// Admin/Super Admin: Create service request for customer (with optional new customer creation)
router.post('/admin', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const {
      customerId,
      isNewCustomer,
      customerName,
      customerPhone,
      customerEmail,
      serviceType,
      vehicleName,
      fuelType,
      vehicleNumber,
      inverterVa,
      inverterVoltage,
      batteryAmpereRating,
      notes
    } = req.body;

    if (!SERVICE_TYPES[serviceType]) {
      return res.status(400).json({ error: 'Invalid service type' });
    }

    // Per-service validation
    if (['battery_testing', 'jump_start'].includes(serviceType)) {
      if (!vehicleName || !fuelType || !vehicleNumber) {
        return res.status(400).json({ error: 'Vehicle name, fuel type and vehicle number are required' });
      }
      if (!FUEL_TYPES.includes((fuelType || '').toLowerCase())) {
        return res.status(400).json({ error: 'Invalid fuel type' });
      }
    }

    if (serviceType === 'inverter_repair') {
      if (!inverterVa || !inverterVoltage) {
        return res.status(400).json({ error: 'Inverter VA and voltage are required' });
      }
    }

    if (serviceType === 'inverter_battery') {
      if (!batteryAmpereRating) {
        return res.status(400).json({ error: 'Battery ampere rating is required' });
      }
    }

    let userId = customerId;
    let customerNameFinal = customerName;
    let customerPhoneFinal = customerPhone;
    let customerEmailFinal = customerEmail;
    const shopId = req.shop_id || 1;

    // If new customer, create user and customer profile
    if (isNewCustomer) {
      if (!customerName || !customerPhone || !customerEmail) {
        return res.status(400).json({ error: 'Customer name, phone, and email are required for new customer' });
      }

      // Check if customer already exists (email/phone unique globally)
      const existingUser = await db.query(
        `SELECT id FROM users WHERE email = $1 OR phone = $2 LIMIT 1`,
        [customerEmail.toLowerCase(), customerPhone]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Customer with this email or phone already exists' });
      }

      // Get customer role_id
      const roleResult = await db.query(
        `SELECT id FROM roles WHERE LOWER(role_name) = 'customer' LIMIT 1`
      );

      if (!roleResult.rows.length) {
        return res.status(500).json({ error: 'Customer role not found' });
      }

      const customerRoleId = roleResult.rows[0].id;

      // Use mobile number as password (hash it)
      const hashedPassword = await bcrypt.hash(customerPhone, 10);

      // Create user (shop_id for multi-shop - Sahara/Anand)
      const userResult = await db.query(
        `INSERT INTO users (
          full_name, email, phone, password, role_id, is_active, shop_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, email, phone`,
        [customerName.trim(), customerEmail.toLowerCase(), customerPhone, hashedPassword, customerRoleId, true, shopId]
      );

      userId = userResult.rows[0].id;
      customerNameFinal = customerName;
      customerPhoneFinal = customerPhone;
      customerEmailFinal = customerEmail.toLowerCase();

      // Create customer profile (shop_id for multi-shop)
      await db.query(
        `INSERT INTO customer_profiles (
          user_id, full_name, email, phone, is_business_customer, shop_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          shop_id = EXCLUDED.shop_id`,
        [userId, customerNameFinal, customerEmailFinal, customerPhoneFinal, false, shopId]
      );
    } else {
      // Existing customer - verify and get details
      if (!customerId) {
        return res.status(400).json({ error: 'Customer ID is required for existing customer' });
      }

      const customerResult = await db.query(
        `SELECT u.id, u.full_name, u.phone, u.email, cp.full_name as profile_name, cp.phone as profile_phone, cp.email as profile_email
         FROM users u
         LEFT JOIN customer_profiles cp ON u.id = cp.user_id
         WHERE u.id = $1 AND u.role_id >= 3 AND u.shop_id = $2
         LIMIT 1`,
        [customerId, shopId]
      );

      if (!customerResult.rows.length) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const customer = customerResult.rows[0];
      userId = customer.id;
      customerNameFinal = customer.profile_name || customer.full_name;
      customerPhoneFinal = customer.profile_phone || customer.phone;
      customerEmailFinal = customer.profile_email || customer.email;
    }

    // Create service request (shop_id for multi-shop)
    const insertResult = await db.query(
      `INSERT INTO service_requests (
        user_id,
        customer_name,
        customer_phone,
        customer_email,
        service_type,
        vehicle_name,
        fuel_type,
        vehicle_number,
        inverter_va,
        inverter_voltage,
        battery_ampere_rating,
        notes,
        status,
        shop_id,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'requested', $13, NOW(), NOW()
      ) RETURNING *`,
      [
        userId,
        customerNameFinal,
        customerPhoneFinal,
        customerEmailFinal,
        serviceType,
        vehicleName || null,
        fuelType ? fuelType.toLowerCase() : null,
        vehicleNumber || null,
        inverterVa || null,
        inverterVoltage || null,
        batteryAmpereRating || null,
        notes || null,
        shopId
      ]
    );

    const service = insertResult.rows[0];

    // Notify customer
    try {
      if (userId) {
        await createNotification(
          userId,
          'New Service Request',
          `A service request has been created for you: ${SERVICE_TYPES[serviceType]}. Our team will contact you soon.`,
          'info',
          null
        );
      }
    } catch (notifErr) {
      console.warn('Failed to notify customer about service request:', notifErr);
    }

    res.status(201).json({ success: true, service });
  } catch (err) {
    console.error('Error creating service request by admin:', err);
    res.status(500).json({ error: 'Failed to create service request' });
  }
});

module.exports = router;

