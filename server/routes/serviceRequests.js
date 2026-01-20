const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { requireAuth, requireSuperAdminOrAdmin } = require('../middleware/auth');
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

async function getCustomerContact(userId) {
  const result = await db.query(
    `SELECT id, full_name, phone, email 
     FROM users 
     WHERE id = $1 
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

// Customer: create a new service request (stored in service_requests with status='requested')
router.post('/', requireAuth, async (req, res) => {
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
    const customer = await getCustomerContact(req.user.id);
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
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'requested', NOW(), NOW()
      ) RETURNING *`,
      [
        req.user.id,
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
        `SELECT id FROM users WHERE role_id IN (1, 2) AND is_active = true`
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

    const filters = ['user_id = $1'];
    const params = [req.user.id];
    let paramIndex = params.length;

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
router.get('/', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const {
      status = 'all',
      serviceType,
      page = 1,
      limit = 20
    } = req.query;

    const filters = ['1=1'];
    const params = [];
    let paramIndex = 0;

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
    console.error('Error fetching all service requests:', err);
    res.status(500).json({ error: 'Failed to fetch service requests' });
  }
});

// Admin/Super Admin: confirm pending service request (change status from 'requested' to 'pending')
router.post('/pending/:id/confirm', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the pending request
    const pendingResult = await db.query(
      `SELECT * FROM service_requests WHERE id = $1 AND status = 'requested'`,
      [id]
    );

    if (!pendingResult.rows.length) {
      return res.status(404).json({ error: 'Pending service request not found' });
    }

    const pendingRequest = pendingResult.rows[0];

    // Update status from 'requested' to 'pending' (confirmed)
    const updateResult = await db.query(
      `UPDATE service_requests
       SET status = 'pending', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
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
router.delete('/pending/:id/cancel', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the pending request before deleting (only if status is 'requested')
    const pendingResult = await db.query(
      `SELECT * FROM service_requests WHERE id = $1 AND status = 'requested'`,
      [id]
    );

    if (!pendingResult.rows.length) {
      return res.status(404).json({ error: 'Pending service request not found or already confirmed' });
    }

    const pendingRequest = pendingResult.rows[0];

    // Delete from service_requests (only if status is 'requested', not confirmed yet)
    await db.query(
      `DELETE FROM service_requests WHERE id = $1 AND status = 'requested'`,
      [id]
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
router.delete('/my/pending/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the pending request and verify ownership (only if status is 'requested')
    const pendingResult = await db.query(
      `SELECT * FROM service_requests WHERE id = $1 AND user_id = $2 AND status = 'requested'`,
      [id, req.user.id]
    );

    if (!pendingResult.rows.length) {
      return res.status(404).json({ error: 'Pending service request not found, already confirmed, or you do not have permission to cancel it' });
    }

    // Delete from service_requests (only if status is 'requested', not confirmed yet)
    await db.query(
      `DELETE FROM service_requests WHERE id = $1 AND user_id = $2 AND status = 'requested'`,
      [id, req.user.id]
    );

    res.json({ success: true, message: 'Service request cancelled successfully' });
  } catch (err) {
    console.error('Error cancelling pending service request:', err);
    res.status(500).json({ error: 'Failed to cancel service request' });
  }
});

// Admin/Super Admin: update status
router.patch('/:id/status', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
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

module.exports = router;

