const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin, requireSuperAdminOrAdmin } = require('../middleware/auth');

const router = express.Router();

// ============================================
// EMPLOYEE CRUD OPERATIONS
// ============================================

// Get all employees
router.get('/', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { is_active } = req.query;
    let query = 'SELECT * FROM employees WHERE 1=1';
    const params = [];

    if (is_active !== undefined) {
      query += ` AND is_active = $1`;
      params.push(is_active === 'true');
    }

    query += ' ORDER BY created_at DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /employees error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get single employee by ID
router.get('/:id', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM employees WHERE id = $1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('GET /employees/:id error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Create new employee
router.post('/', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { full_name, email, phone, address, designation, joining_date, salary } = req.body;

    if (!full_name || !phone) {
      return res.status(400).json({ error: 'Full name and phone are required' });
    }

    const { rows } = await db.query(
      `INSERT INTO employees (full_name, email, phone, address, designation, joining_date, salary)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [full_name, email || null, phone, address || null, designation || null, joining_date || null, salary || null]
    );

    // Add to history
    await db.query(
      `INSERT INTO employee_history (employee_id, history_type, description, created_by)
       VALUES ($1, 'update', 'Employee created', $2)`,
      [rows[0].id, req.user.id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /employees error:', err);
    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Update employee
router.put('/:id', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, address, designation, joining_date, salary, is_active } = req.body;

    const { rows } = await db.query(
      `UPDATE employees 
       SET full_name = COALESCE($1, full_name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           address = COALESCE($4, address),
           designation = COALESCE($5, designation),
           joining_date = COALESCE($6, joining_date),
           salary = COALESCE($7, salary),
           is_active = COALESCE($8, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [full_name, email, phone, address, designation, joining_date, salary, is_active, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Add to history
    await db.query(
      `INSERT INTO employee_history (employee_id, history_type, description, created_by)
       VALUES ($1, 'update', 'Employee details updated', $2)`,
      [id, req.user.id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /employees/:id error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Delete employee (soft delete by setting is_active to false)
router.delete('/:id', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      `UPDATE employees SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Add to history
    await db.query(
      `INSERT INTO employee_history (employee_id, history_type, description, created_by)
       VALUES ($1, 'update', 'Employee deactivated', $2)`,
      [id, req.user.id]
    );

    res.json({ message: 'Employee deactivated successfully', employee: rows[0] });
  } catch (err) {
    console.error('DELETE /employees/:id error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ============================================
// ATTENDANCE OPERATIONS
// ============================================

// Get attendance for an employee
router.get('/:id/attendance', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year } = req.query;

    let query = 'SELECT * FROM employee_attendance WHERE employee_id = $1';
    const params = [id];

    if (month && year) {
      const monthDate = `${year}-${String(month).padStart(2, '0')}-01`;
      query += ' AND attendance_month = $2';
      params.push(monthDate);
    }

    query += ' ORDER BY attendance_month DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /employees/:id/attendance error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Add/Update attendance
router.post('/:id/attendance', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { attendance_month, total_days, present_days, absent_days, leave_days, notes } = req.body;

    if (!attendance_month) {
      return res.status(400).json({ error: 'Attendance month is required' });
    }

    // Ensure month is first day of month
    const monthDate = new Date(attendance_month);
    monthDate.setDate(1);
    const monthStr = monthDate.toISOString().split('T')[0];

    const present = present_days || 0;
    const absent = absent_days || 0;
    const leave = leave_days || 0;
    const total = total_days || (present + absent + leave);

    const { rows } = await db.query(
      `INSERT INTO employee_attendance 
       (employee_id, attendance_month, total_days, present_days, absent_days, leave_days, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (employee_id, attendance_month)
       DO UPDATE SET
         total_days = EXCLUDED.total_days,
         present_days = EXCLUDED.present_days,
         absent_days = EXCLUDED.absent_days,
         leave_days = EXCLUDED.leave_days,
         notes = EXCLUDED.notes,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [id, monthStr, total, present, absent, leave, notes || null]
    );

    // Add to history
    await db.query(
      `INSERT INTO employee_history (employee_id, history_type, description, created_by)
       VALUES ($1, 'attendance', 
       CONCAT('Attendance updated for ', TO_CHAR($2::date, 'Month YYYY'), ': ', $3, ' present, ', $4, ' absent, ', $5, ' leave'), $6)`,
      [id, monthStr, present, absent, leave, req.user.id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('POST /employees/:id/attendance error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ============================================
// DAILY ATTENDANCE OPERATIONS
// ============================================

// Get daily attendance for an employee
router.get('/:id/daily-attendance', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, month, year } = req.query;

    let query = `
      SELECT da.*, u.full_name as created_by_name
      FROM daily_attendance da
      LEFT JOIN users u ON da.created_by = u.id
      WHERE da.employee_id = $1
    `;
    const params = [id];

    if (date) {
      query += ' AND da.attendance_date = $2';
      params.push(date);
    } else if (month && year) {
      query += ` AND EXTRACT(MONTH FROM da.attendance_date) = $2 AND EXTRACT(YEAR FROM da.attendance_date) = $3`;
      params.push(month, year);
    }

    query += ' ORDER BY da.attendance_date DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /employees/:id/daily-attendance error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Mark daily attendance
// FIXED VERSION: Uses ON CONFLICT (employee_id, attendance_date) with proper unique constraint
router.post('/:id/daily-attendance', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    console.log('[Daily Attendance API] Route called - Using ON CONFLICT (employee_id, attendance_date)');
    
    // Log database connection info (without password) - TEMPORARY DEBUG LOG
    try {
      const dbInfo = await db.query('SELECT current_database() as db, current_user as user');
      console.log('=== CONNECTED DB INFO (TEMPORARY DEBUG) ===');
      console.log('Database:', dbInfo.rows[0]?.db || 'unknown');
      console.log('User:', dbInfo.rows[0]?.user || 'unknown');
      
      // Check constraints on daily_attendance table
      const constraintInfo = await db.query(`
        SELECT conname, pg_get_constraintdef(oid) as constraint_def
        FROM pg_constraint
        WHERE conrelid = 'daily_attendance'::regclass
        AND contype = 'u'
        ORDER BY conname
      `);
      console.log('Unique constraints on daily_attendance:', JSON.stringify(constraintInfo.rows, null, 2));
      console.log('=== END DEBUG INFO ===');
    } catch (dbInfoErr) {
      console.log('[DB Info] Could not fetch database info:', dbInfoErr.message);
    }
    
    const employeeId = parseInt(req.params.id);
    if (isNaN(employeeId)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    const { attendance_date, status, check_in_time, check_out_time, notes } = req.body;

    if (!attendance_date || !status) {
      return res.status(400).json({ error: 'Attendance date and status are required' });
    }

    // Validate status
    const validStatuses = ['present', 'absent', 'leave', 'half_day'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: present, absent, leave, or half_day' });
    }

    // Normalize time values - convert empty strings to null
    const normalizedCheckIn = (check_in_time && check_in_time.trim() !== '') ? check_in_time : null;
    const normalizedCheckOut = (check_out_time && check_out_time.trim() !== '') ? check_out_time : null;
    const normalizedNotes = (notes && notes.trim() !== '') ? notes : null;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert or update daily attendance using ON CONFLICT
      // Use column names directly (works with any constraint name)
      const attendanceResult = await client.query(
        `INSERT INTO daily_attendance 
         (employee_id, attendance_date, status, check_in_time, check_out_time, notes, created_by, created_at, updated_at)
         VALUES ($1, $2::DATE, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (employee_id, attendance_date)
         DO UPDATE SET
           status = EXCLUDED.status,
           check_in_time = EXCLUDED.check_in_time,
           check_out_time = EXCLUDED.check_out_time,
           notes = EXCLUDED.notes,
           updated_at = NOW()
         RETURNING *`,
        [
          employeeId, 
          attendance_date, 
          status, 
          normalizedCheckIn,
          normalizedCheckOut,
          normalizedNotes,
          req.user.id
        ]
      );

      // Update monthly attendance summary
      const monthDate = new Date(attendance_date);
      monthDate.setDate(1);
      const monthStr = monthDate.toISOString().split('T')[0];

      // Count days for the month
      const monthStats = await client.query(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'present') as present_count,
           COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
           COUNT(*) FILTER (WHERE status = 'leave') as leave_count,
           COUNT(*) FILTER (WHERE status = 'half_day') as half_day_count,
           COUNT(*) as total_count
         FROM daily_attendance
         WHERE employee_id = $1 
           AND attendance_date >= $2::DATE 
           AND attendance_date < ($2::DATE + INTERVAL '1 month')`,
        [employeeId, monthStr]
      );

      const stats = monthStats.rows[0];
      const presentDays = parseInt(stats.present_count || 0) + parseInt(stats.half_day_count || 0) * 0.5;
      const absentDays = parseInt(stats.absent_count || 0);
      const leaveDays = parseInt(stats.leave_count || 0);
      const totalDays = parseInt(stats.total_count || 0);

      // Update monthly attendance
      await client.query(
        `INSERT INTO employee_attendance 
         (employee_id, attendance_month, total_days, present_days, absent_days, leave_days)
         VALUES ($1, $2::DATE, $3, $4, $5, $6)
         ON CONFLICT (employee_id, attendance_month)
         DO UPDATE SET
           total_days = EXCLUDED.total_days,
           present_days = EXCLUDED.present_days,
           absent_days = EXCLUDED.absent_days,
           leave_days = EXCLUDED.leave_days,
           updated_at = CURRENT_TIMESTAMP`,
        [employeeId, monthStr, totalDays, Math.round(presentDays), absentDays, leaveDays]
      );

      // Add to history
      const historyDescription = `Daily attendance marked: ${status} on ${new Date(attendance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      await client.query(
        `INSERT INTO employee_history (employee_id, history_type, description, created_by)
         VALUES ($1, 'attendance', $2, $3)`,
        [employeeId, historyDescription, req.user.id]
      );

      await client.query('COMMIT');
      res.status(201).json(attendanceResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('POST /employees/:id/daily-attendance error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Bulk mark attendance for multiple employees on same date
router.post('/daily-attendance/bulk', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { attendance_date, employees } = req.body; // employees: [{employee_id, status, check_in_time, check_out_time, notes}]

    if (!attendance_date || !employees || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ error: 'Attendance date and employees array are required' });
    }

    const results = [];
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      for (const emp of employees) {
        const { employee_id, status = 'present', check_in_time, check_out_time, notes } = emp;

        if (!employee_id) continue;

        // Normalize time values - convert empty strings to null
        const normalizedCheckIn = (check_in_time && check_in_time.trim() !== '') ? check_in_time : null;
        const normalizedCheckOut = (check_out_time && check_out_time.trim() !== '') ? check_out_time : null;
        const normalizedNotes = (notes && notes.trim() !== '') ? notes : null;

        // Insert or update daily attendance using ON CONFLICT
        // Use column names directly (works with any constraint name)
        const attendanceResult = await client.query(
          `INSERT INTO daily_attendance 
           (employee_id, attendance_date, status, check_in_time, check_out_time, notes, created_by, created_at, updated_at)
           VALUES ($1, $2::DATE, $3, $4, $5, $6, $7, NOW(), NOW())
           ON CONFLICT (employee_id, attendance_date)
           DO UPDATE SET
             status = EXCLUDED.status,
             check_in_time = EXCLUDED.check_in_time,
             check_out_time = EXCLUDED.check_out_time,
             notes = EXCLUDED.notes,
             updated_at = NOW()
           RETURNING *`,
          [
            parseInt(employee_id), 
            attendance_date, 
            status, 
            normalizedCheckIn,
            normalizedCheckOut,
            normalizedNotes,
            req.user.id
          ]
        );

        results.push(attendanceResult.rows[0]);

        // Update monthly summary for this employee
        const monthDate = new Date(attendance_date);
        monthDate.setDate(1);
        const monthStr = monthDate.toISOString().split('T')[0];

        const monthStats = await client.query(
          `SELECT 
             COUNT(*) FILTER (WHERE status = 'present') as present_count,
             COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
             COUNT(*) FILTER (WHERE status = 'leave') as leave_count,
             COUNT(*) FILTER (WHERE status = 'half_day') as half_day_count,
             COUNT(*) as total_count
           FROM daily_attendance
           WHERE employee_id = $1 
             AND attendance_date >= $2::DATE 
             AND attendance_date < ($2::DATE + INTERVAL '1 month')`,
          [employee_id, monthStr]
        );

        const stats = monthStats.rows[0];
        const presentDays = parseInt(stats.present_count || 0) + parseInt(stats.half_day_count || 0) * 0.5;
        const absentDays = parseInt(stats.absent_count || 0);
        const leaveDays = parseInt(stats.leave_count || 0);
        const totalDays = parseInt(stats.total_count || 0);

        await client.query(
          `INSERT INTO employee_attendance 
           (employee_id, attendance_month, total_days, present_days, absent_days, leave_days)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (employee_id, attendance_month)
           DO UPDATE SET
             total_days = EXCLUDED.total_days,
             present_days = EXCLUDED.present_days,
             absent_days = EXCLUDED.absent_days,
             leave_days = EXCLUDED.leave_days,
             updated_at = CURRENT_TIMESTAMP`,
          [employee_id, monthStr, totalDays, Math.round(presentDays), absentDays, leaveDays]
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ message: 'Bulk attendance marked successfully', results });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('POST /employees/daily-attendance/bulk error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ============================================
// PAYMENT OPERATIONS
// ============================================

// Get payments for an employee
router.get('/:id/payments', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year } = req.query;

    let query = `
      SELECT ep.*, u.full_name as created_by_name
      FROM employee_payments ep
      LEFT JOIN users u ON ep.created_by = u.id
      WHERE ep.employee_id = $1
    `;
    const params = [id];

    if (month && year) {
      const monthDate = `${year}-${String(month).padStart(2, '0')}-01`;
      query += ' AND ep.payment_month = $2';
      params.push(monthDate);
    }

    query += ' ORDER BY ep.payment_date DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /employees/:id/payments error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Add payment for an employee
router.post('/:id/payments', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_month, amount, payment_date, payment_method, notes } = req.body;

    if (!payment_month || !amount || !payment_date) {
      return res.status(400).json({ error: 'Payment month, amount, and payment date are required' });
    }

    // Ensure month is first day of month
    const monthDate = new Date(payment_month);
    monthDate.setDate(1);
    const monthStr = monthDate.toISOString().split('T')[0];

    // Insert payment
    const paymentResult = await db.query(
      `INSERT INTO employee_payments 
       (employee_id, payment_month, amount, payment_date, payment_method, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, monthStr, amount, payment_date, payment_method || null, notes || null, req.user.id]
    );

    // Add to history
    await db.query(
      `INSERT INTO employee_history (employee_id, history_type, description, amount, reference_id, created_by)
       VALUES ($1, 'payment', CONCAT('Payment of ₹', $2, ' for ', TO_CHAR($3::date, 'Month YYYY')), $2, $4, $5)`,
      [id, amount, monthStr, paymentResult.rows[0].id, req.user.id]
    );

    res.status(201).json(paymentResult.rows[0]);
  } catch (err) {
    console.error('POST /employees/:id/payments error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Delete/Undo payment for an employee
router.delete('/payments/:paymentId', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const paymentId = parseInt(req.params.paymentId);
    if (isNaN(paymentId)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Get payment details before deleting
      const paymentResult = await client.query(
        `SELECT ep.*, e.full_name as employee_name
         FROM employee_payments ep
         JOIN employees e ON ep.employee_id = e.id
         WHERE ep.id = $1`,
        [paymentId]
      );

      if (paymentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Payment not found' });
      }

      const payment = paymentResult.rows[0];
      const paymentAmount = parseFloat(payment.amount);
      const monthStr = payment.payment_month;

      // Delete payment
      await client.query(
        `DELETE FROM employee_payments WHERE id = $1`,
        [paymentId]
      );

      // Update monthly profit - add back the payment amount
      const profitResult = await client.query(
        `SELECT * FROM monthly_profit WHERE profit_month = $1::DATE`,
        [monthStr]
      );

      if (profitResult.rows.length > 0) {
        const currentProfit = profitResult.rows[0];
        const newEmployeePayments = Math.max(0, parseFloat(currentProfit.employee_payments || 0) - paymentAmount);
        const newNetProfit = parseFloat(currentProfit.gross_profit || 0) - newEmployeePayments - parseFloat(currentProfit.other_expenses || 0);

        await client.query(
          `UPDATE monthly_profit 
           SET employee_payments = $1, 
               net_profit = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE profit_month = $3::DATE`,
          [newEmployeePayments, newNetProfit, monthStr]
        );
      }

      // Add to history
      const historyDescription = `Payment of ₹${paymentAmount.toFixed(2)} for ${new Date(monthStr).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} - DELETED`;
      await client.query(
        `INSERT INTO employee_history (employee_id, history_type, description, amount, created_by)
         VALUES ($1, 'payment', $2, $3, $4)`,
        [payment.employee_id, historyDescription, -paymentAmount, req.user.id]
      );

      await client.query('COMMIT');
      res.json({ message: 'Payment deleted successfully', payment: payment });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('DELETE /employees/payments/:paymentId error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ============================================
// EMPLOYEE HISTORY
// ============================================

// Get employee history
router.get('/:id/history', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      `SELECT eh.*, u.full_name as created_by_name
       FROM employee_history eh
       LEFT JOIN users u ON eh.created_by = u.id
       WHERE eh.employee_id = $1
       ORDER BY eh.created_at DESC`,
      [id]
    );

    res.json(rows);
  } catch (err) {
    console.error('GET /employees/:id/history error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;

