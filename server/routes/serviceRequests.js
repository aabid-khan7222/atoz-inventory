const express = require('express');
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
const STATUS_VALUES = ['pending', 'in_progress', 'completed', 'cancelled'];

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

// Customer: create a new service request (stored in pending_service_requests, not in DB yet)
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

    // Store in pending_service_requests (temporary, can be deleted if cancelled)
    const insertResult = await db.query(
      `INSERT INTO pending_service_requests (
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

    // Get pending requests (from pending_service_requests)
    let pendingQuery = `SELECT *, 'pending' as request_type FROM pending_service_requests WHERE user_id = $1`;
    const allParams = [req.user.id];
    let paramIndex = allParams.length;

    if (status && status !== 'all') {
      // For pending requests, 'requested' status maps to 'pending' filter
      if (status === 'pending') {
        paramIndex += 1;
        pendingQuery += ` AND status = $${paramIndex}`;
        allParams.push('requested');
      } else {
        // If status is not 'pending', don't include pending requests
        pendingQuery += ` AND 1=0`; // Always false
      }
    } else {
      // If status is 'all', only show 'requested' status from pending table
      paramIndex += 1;
      pendingQuery += ` AND status = $${paramIndex}`;
      allParams.push('requested');
    }

    if (serviceType && SERVICE_TYPES[serviceType]) {
      paramIndex += 1;
      pendingQuery += ` AND service_type = $${paramIndex}`;
      allParams.push(serviceType);
    }
    
    // Get confirmed requests (from service_requests)
    let confirmedQuery = `SELECT *, 'confirmed' as request_type FROM service_requests WHERE user_id = $${paramIndex + 1}`;
    allParams.push(req.user.id);
    paramIndex = allParams.length;

    if (status && status !== 'all') {
      paramIndex += 1;
      confirmedQuery += ` AND status = $${paramIndex}`;
      allParams.push(status);
    }

    if (serviceType && SERVICE_TYPES[serviceType]) {
      paramIndex += 1;
      confirmedQuery += ` AND service_type = $${paramIndex}`;
      allParams.push(serviceType);
    }

    // Combine both queries
    const unionQuery = `
      ${pendingQuery}
      UNION ALL
      ${confirmedQuery}
      ORDER BY created_at DESC
    `;

    const countResult = await db.query(
      `SELECT COUNT(*) AS count FROM (${unionQuery}) AS combined`,
      allParams
    );
    const totalItems = parseInt(countResult.rows[0].count, 10) || 0;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    paramIndex = allParams.length;
    const dataResult = await db.query(
      `${unionQuery} LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}`,
      [...allParams, parseInt(limit, 10), offset]
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

    // Get pending requests (from pending_service_requests)
    let pendingQuery = `SELECT *, 'pending' as request_type FROM pending_service_requests WHERE 1=1`;
    const allParams = [];
    let paramIndex = 0;

    if (status && status !== 'all') {
      // For pending requests, 'requested' status maps to 'pending' filter
      if (status === 'pending') {
        paramIndex += 1;
        pendingQuery += ` AND status = $${paramIndex}`;
        allParams.push('requested');
      } else {
        // If status is not 'pending', don't include pending requests
        pendingQuery += ` AND 1=0`; // Always false
      }
    } else {
      // If status is 'all', only show 'requested' status from pending table
      paramIndex += 1;
      pendingQuery += ` AND status = $${paramIndex}`;
      allParams.push('requested');
    }

    if (serviceType && SERVICE_TYPES[serviceType]) {
      paramIndex += 1;
      pendingQuery += ` AND service_type = $${paramIndex}`;
      allParams.push(serviceType);
    }
    
    // Get confirmed requests (from service_requests)
    let confirmedQuery = `SELECT *, 'confirmed' as request_type FROM service_requests WHERE 1=1`;
    let confirmedParamIndex = allParams.length;

    if (status && status !== 'all') {
      confirmedParamIndex += 1;
      confirmedQuery += ` AND status = $${confirmedParamIndex}`;
      allParams.push(status);
    }

    if (serviceType && SERVICE_TYPES[serviceType]) {
      confirmedParamIndex += 1;
      confirmedQuery += ` AND service_type = $${confirmedParamIndex}`;
      allParams.push(serviceType);
    }

    // Combine both queries
    const unionQuery = `
      ${pendingQuery}
      UNION ALL
      ${confirmedQuery}
      ORDER BY created_at DESC
    `;

    const countResult = await db.query(
      `SELECT COUNT(*) AS count FROM (${unionQuery}) AS combined`,
      allParams
    );
    const totalItems = parseInt(countResult.rows[0].count, 10) || 0;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    paramIndex = allParams.length;
    const dataResult = await db.query(
      `${unionQuery} LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}`,
      [...allParams, parseInt(limit, 10), offset]
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

// Admin/Super Admin: confirm pending service request (move from pending_service_requests to service_requests)
router.post('/pending/:id/confirm', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the pending request
    const pendingResult = await db.query(
      `SELECT * FROM pending_service_requests WHERE id = $1`,
      [id]
    );

    if (!pendingResult.rows.length) {
      return res.status(404).json({ error: 'Pending service request not found' });
    }

    const pendingRequest = pendingResult.rows[0];

    // Move to service_requests table with status 'pending'
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
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13, NOW()
      ) RETURNING *`,
      [
        pendingRequest.user_id,
        pendingRequest.customer_name,
        pendingRequest.customer_phone,
        pendingRequest.customer_email,
        pendingRequest.service_type,
        pendingRequest.vehicle_name,
        pendingRequest.fuel_type,
        pendingRequest.vehicle_number,
        pendingRequest.inverter_va,
        pendingRequest.inverter_voltage,
        pendingRequest.battery_ampere_rating,
        pendingRequest.notes,
        pendingRequest.created_at
      ]
    );

    const confirmedService = insertResult.rows[0];

    // Delete from pending_service_requests
    await db.query(
      `DELETE FROM pending_service_requests WHERE id = $1`,
      [id]
    );

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

// Admin/Super Admin: cancel pending service request (delete from pending_service_requests)
router.delete('/pending/:id/cancel', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the pending request before deleting
    const pendingResult = await db.query(
      `SELECT * FROM pending_service_requests WHERE id = $1`,
      [id]
    );

    if (!pendingResult.rows.length) {
      return res.status(404).json({ error: 'Pending service request not found' });
    }

    const pendingRequest = pendingResult.rows[0];

    // Delete from pending_service_requests
    await db.query(
      `DELETE FROM pending_service_requests WHERE id = $1`,
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

// Customer: cancel own pending service request (delete from pending_service_requests)
router.delete('/my/pending/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the pending request and verify ownership
    const pendingResult = await db.query(
      `SELECT * FROM pending_service_requests WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (!pendingResult.rows.length) {
      return res.status(404).json({ error: 'Pending service request not found or you do not have permission to cancel it' });
    }

    // Delete from pending_service_requests
    await db.query(
      `DELETE FROM pending_service_requests WHERE id = $1 AND user_id = $2`,
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

