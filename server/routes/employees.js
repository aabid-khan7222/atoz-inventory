const express = require('express');
const db = require('../db');
const { requireAuth, requireShopId, requireAdmin, requireSuperAdminOrAdmin } = require('../middleware/auth');

const router = express.Router();

// ============================================
// EMPLOYEE CRUD OPERATIONS
// ============================================

// Get all employees (shop-scoped)
router.get('/', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { is_active } = req.query;
    let query = 'SELECT * FROM employees WHERE shop_id = $1';
    const params = [req.shop_id];

    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND is_active = $${params.length}`;
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
router.get('/:id', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM employees WHERE id = $1 AND shop_id = $2', [id, req.shop_id]);

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
router.post('/', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { full_name, email, phone, address, designation, joining_date, salary } = req.body;

    if (!full_name || !phone) {
      return res.status(400).json({ error: 'Full name and phone are required' });
    }

    const { rows } = await db.query(
      `INSERT INTO employees (full_name, email, phone, address, designation, joining_date, salary, shop_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [full_name, email || null, phone, address || null, designation || null, joining_date || null, salary || null, req.shop_id]
    );

    await db.query(
      `INSERT INTO employee_history (employee_id, history_type, description, created_by)
       VALUES ($1, 'update', 'Employee created', $2)`,
      [rows[0].id, req.user_id ?? req.user?.id]
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
router.put('/:id', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
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
       WHERE id = $9 AND shop_id = $10
       RETURNING *`,
      [full_name, email, phone, address, designation, joining_date, salary, is_active, id, req.shop_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Add to history
    await db.query(
      `INSERT INTO employee_history (employee_id, history_type, description, created_by)
       VALUES ($1, 'update', 'Employee details updated', $2)`,
      [id, req.user_id ?? req.user?.id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /employees/:id error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Deactivate employee (soft delete by setting is_active to false)
router.delete('/:id', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    const { rows } = await db.query(
      `UPDATE employees SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1::INTEGER AND shop_id = $2 RETURNING *`,
      [id, req.shop_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Add to history
    try {
      await db.query(
        `INSERT INTO employee_history (employee_id, history_type, description, created_by)
         VALUES ($1::INTEGER, 'update', 'Employee deactivated', $2::INTEGER)`,
        [id, req.user_id ?? req.user?.id]
      );
    } catch (historyErr) {
      console.error('Failed to add deactivation history (non-critical):', historyErr.message);
    }

    res.json({ message: 'Employee deactivated successfully', employee: rows[0] });
  } catch (err) {
    console.error('DELETE /employees/:id error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Activate employee (set is_active to true)
router.patch('/:id/activate', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    const { rows } = await db.query(
      `UPDATE employees SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1::INTEGER AND shop_id = $2 RETURNING *`,
      [id, req.shop_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Add to history
    try {
      await db.query(
        `INSERT INTO employee_history (employee_id, history_type, description, created_by)
         VALUES ($1::INTEGER, 'update', 'Employee activated', $2::INTEGER)`,
        [id, req.user_id ?? req.user?.id]
      );
    } catch (historyErr) {
      console.error('Failed to add activation history (non-critical):', historyErr.message);
    }

    res.json({ message: 'Employee activated successfully', employee: rows[0] });
  } catch (err) {
    console.error('PATCH /employees/:id/activate error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Permanently delete employee and all related data
router.delete('/:id/permanent', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    const employeeCheck = await client.query(
      `SELECT id, full_name FROM employees WHERE id = $1::INTEGER AND shop_id = $2`,
      [id, req.shop_id]
    );

    if (employeeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Delete all related data (CASCADE will handle most, but we'll be explicit)
    // Delete employee history
    await client.query(`DELETE FROM employee_history WHERE employee_id = $1::INTEGER`, [id]);
    
    // Delete employee payments
    await client.query(`DELETE FROM employee_payments WHERE employee_id = $1::INTEGER`, [id]);
    
    // Delete employee attendance (monthly)
    await client.query(`DELETE FROM employee_attendance WHERE employee_id = $1::INTEGER`, [id]);
    
    // Delete daily attendance
    await client.query(`DELETE FROM daily_attendance WHERE employee_id = $1::INTEGER`, [id]);
    
    await client.query(`DELETE FROM employees WHERE id = $1::INTEGER AND shop_id = $2`, [id, req.shop_id]);

    await client.query('COMMIT');
    res.json({ message: 'Employee and all related data deleted permanently', employee: employeeCheck.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DELETE /employees/:id/permanent error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    client.release();
  }
});

// ============================================
// ATTENDANCE OPERATIONS
// ============================================

// Get attendance for an employee (validate employee belongs to shop)
router.get('/:id/attendance', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year } = req.query;

    const empCheck = await db.query('SELECT id FROM employees WHERE id = $1 AND shop_id = $2', [id, req.shop_id]);
    if (!empCheck.rows.length) return res.status(404).json({ error: 'Employee not found' });

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
router.post('/:id/attendance', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }
    const empCheck = await db.query('SELECT id FROM employees WHERE id = $1 AND shop_id = $2', [id, req.shop_id]);
    if (!empCheck.rows.length) return res.status(404).json({ error: 'Employee not found' });
    const { attendance_month, total_days, present_days, half_days, absent_days, leave_days, notes } = req.body;

    if (!attendance_month) {
      return res.status(400).json({ error: 'Attendance month is required' });
    }

    // Ensure month is first day of month
    const monthDate = new Date(attendance_month);
    monthDate.setDate(1);
    const monthStr = monthDate.toISOString().split('T')[0];

    // Convert to integers to avoid string concatenation issues
    // Use Number() and ensure no NaN values
    const present = Number(present_days) || 0;
    const half = Number(half_days) || 0;
    const absent = Number(absent_days) || 0;
    const leave = Number(leave_days) || 0;
    const totalDaysValue = Number(total_days);
    const total = (!isNaN(totalDaysValue) && totalDaysValue > 0) ? totalDaysValue : (present + half + absent + leave);
    
    // Ensure all values are valid integers (not NaN)
    const finalTotal = Math.max(0, Math.floor(total));
    const finalPresent = Math.max(0, Math.floor(present));
    const finalHalf = Math.max(0, Math.floor(half));
    const finalAbsent = Math.max(0, Math.floor(absent));
    const finalLeave = Math.max(0, Math.floor(leave));

    // Use check-then-insert/update pattern to avoid ON CONFLICT constraint issues
    const existingAttendance = await db.query(
      `SELECT id FROM employee_attendance 
       WHERE employee_id = $1 AND attendance_month = $2::DATE`,
      [id, monthStr]
    );

    let rows;
    if (existingAttendance.rows.length > 0) {
      // Update existing record
      const result = await db.query(
        `UPDATE employee_attendance 
         SET 
           total_days = $1::INTEGER,
           present_days = $2::INTEGER,
           half_days = $3::INTEGER,
           absent_days = $4::INTEGER,
           leave_days = $5::INTEGER,
           notes = $6,
           updated_at = CURRENT_TIMESTAMP
         WHERE employee_id = $7::INTEGER AND attendance_month = $8::DATE
         RETURNING *`,
        [finalTotal, finalPresent, finalHalf, finalAbsent, finalLeave, notes || null, id, monthStr]
      );
      rows = result;
    } else {
      // Insert new record
      const result = await db.query(
        `INSERT INTO employee_attendance 
         (employee_id, attendance_month, total_days, present_days, half_days, absent_days, leave_days, notes)
         VALUES ($1::INTEGER, $2::DATE, $3::INTEGER, $4::INTEGER, $5::INTEGER, $6::INTEGER, $7::INTEGER, $8)
         RETURNING *`,
        [id, monthStr, finalTotal, finalPresent, finalHalf, finalAbsent, finalLeave, notes || null]
      );
      rows = result;
    }

    // Add to history - build description in JS to avoid PostgreSQL parameter type inference issues
    // Wrap in try-catch so history failure doesn't break the main response
    try {
      const monthFormatted = new Date(monthStr + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const historyDesc = `Attendance updated for ${monthFormatted}: ${finalPresent} present, ${finalHalf} half day, ${finalAbsent} absent, ${finalLeave} leave`;
      await db.query(
        `INSERT INTO employee_history (employee_id, history_type, description, created_by)
         VALUES ($1::INTEGER, 'update', $2, $3::INTEGER)`,
        [id, historyDesc, req.user_id ?? req.user?.id]
      );
    } catch (historyErr) {
      console.error('Failed to add attendance history (non-critical):', historyErr.message);
      // Don't throw - history is optional, main attendance save is what matters
    }

    // Always send response even if history insert failed
    res.json(rows.rows[0]);
  } catch (err) {
    console.error('POST /employees/:id/attendance error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ============================================
// DAILY ATTENDANCE OPERATIONS
// ============================================

// Get daily attendance for an employee
router.get('/:id/daily-attendance', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const empCheck = await db.query('SELECT id FROM employees WHERE id = $1 AND shop_id = $2', [id, req.shop_id]);
    if (!empCheck.rows.length) return res.status(404).json({ error: 'Employee not found' });
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
router.post('/:id/daily-attendance', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    console.log('[Daily Attendance API] Route called - Using ON CONFLICT (employee_id, attendance_date)');
    
    // TEMPORARY DEBUG LOG - Remove after fixing
    try {
      const dbInfo = await db.query('SELECT current_database() as db, current_user as user, current_schema() as schema');
      console.log('=== CONNECTED DB INFO (TEMPORARY DEBUG) ===');
      console.log('Database:', dbInfo.rows[0]?.db || 'unknown');
      console.log('User:', dbInfo.rows[0]?.user || 'unknown');
      console.log('Schema:', dbInfo.rows[0]?.schema || 'unknown');
      
      // Check if table exists
      const tableExists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = current_schema()
          AND table_name = 'daily_attendance'
        ) as exists
      `);
      console.log('Table daily_attendance exists:', tableExists.rows[0]?.exists);
      
      // Check constraints on daily_attendance table
      const constraintInfo = await db.query(`
        SELECT 
          conname, 
          pg_get_constraintdef(oid) as constraint_def,
          conkey as column_indexes
        FROM pg_constraint
        WHERE conrelid = 'daily_attendance'::regclass
        AND contype = 'u'
        ORDER BY conname
      `);
      console.log('Unique constraints on daily_attendance:', JSON.stringify(constraintInfo.rows, null, 2));
      
      
    

      
      
      // Check which columns are in the constraints
      if (constraintInfo.rows.length > 0) {
        const columnInfo = await db.query(`
          SELECT 
            c.conname,
            array_agg(a.attname ORDER BY a.attnum) as columns
          FROM pg_constraint c
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
          WHERE c.conrelid = 'daily_attendance'::regclass
          AND c.contype = 'u'
          GROUP BY c.conname
        `);
        console.log('Constraint columns:', JSON.stringify(columnInfo.rows, null, 2));
      }
      console.log('=== END DEBUG INFO ===');
    } catch (dbInfoErr) {
      console.log('[DB Info] Could not fetch database info:', dbInfoErr.message);
    }
    
    const employeeId = parseInt(req.params.id);
    if (isNaN(employeeId)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }
    const empCheck = await db.query('SELECT id FROM employees WHERE id = $1 AND shop_id = $2', [employeeId, req.shop_id]);
    if (!empCheck.rows.length) return res.status(404).json({ error: 'Employee not found' });

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
      console.log('[Daily Attendance] Attempting INSERT with:', {
        employeeId,
        attendance_date,
        status,
        check_in_time: normalizedCheckIn,
        check_out_time: normalizedCheckOut
      });
      
      // Use explicit constraint name - more reliable than column names
      const attendanceResult = await client.query(
        `INSERT INTO daily_attendance 
         (employee_id, attendance_date, status, check_in_time, check_out_time, notes, created_by, created_at, updated_at)
         VALUES ($1, $2::DATE, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT ON CONSTRAINT daily_attendance_employee_date_unique
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
          req.user_id ?? req.user?.id
        ]
      );
      
      console.log('[Daily Attendance] INSERT successful, rows affected:', attendanceResult.rows.length);

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
      const presentDays = parseInt(stats.present_count || 0);
      const halfDays = parseInt(stats.half_day_count || 0);
      const absentDays = parseInt(stats.absent_count || 0);
      const leaveDays = parseInt(stats.leave_count || 0);
      const totalDays = parseInt(stats.total_count || 0);

      // Update monthly attendance
      // Use check-then-insert/update pattern to avoid ON CONFLICT constraint issues
      const existingMonthly = await client.query(
        `SELECT id FROM employee_attendance 
         WHERE employee_id = $1 AND attendance_month = $2::DATE`,
        [employeeId, monthStr]
      );
      
      if (existingMonthly.rows.length > 0) {
        await client.query(
          `UPDATE employee_attendance 
           SET 
             total_days = $1,
             present_days = $2,
             half_days = $3,
             absent_days = $4,
             leave_days = $5,
             updated_at = CURRENT_TIMESTAMP
           WHERE employee_id = $6 AND attendance_month = $7::DATE`,
          [totalDays, presentDays, halfDays, absentDays, leaveDays, employeeId, monthStr]
        );
      } else {
        await client.query(
          `INSERT INTO employee_attendance 
           (employee_id, attendance_month, total_days, present_days, half_days, absent_days, leave_days)
           VALUES ($1, $2::DATE, $3, $4, $5, $6, $7)`,
          [employeeId, monthStr, totalDays, presentDays, halfDays, absentDays, leaveDays]
        );
      }

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
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);
    console.error('Error detail:', err.detail);
    console.error('Error hint:', err.hint);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Bulk mark attendance for multiple employees on same date
router.post('/daily-attendance/bulk', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { attendance_date, employees } = req.body;

    if (!attendance_date || !employees || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ error: 'Attendance date and employees array are required' });
    }
    // Validate all employee IDs belong to this shop
    const empIds = [...new Set(employees.map(e => e.employee_id).filter(Boolean))];
    if (empIds.length > 0) {
      const validEmps = await db.query('SELECT id FROM employees WHERE id = ANY($1::int[]) AND shop_id = $2', [empIds, req.shop_id]);
      const validSet = new Set(validEmps.rows.map(r => r.id));
      const invalid = empIds.filter(id => !validSet.has(parseInt(id)));
      if (invalid.length) return res.status(404).json({ error: `Employee(s) not found: ${invalid.join(', ')}` });
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
        // Use explicit constraint name - more reliable than column names
        const attendanceResult = await client.query(
          `INSERT INTO daily_attendance 
           (employee_id, attendance_date, status, check_in_time, check_out_time, notes, created_by, created_at, updated_at)
           VALUES ($1, $2::DATE, $3, $4, $5, $6, $7, NOW(), NOW())
           ON CONFLICT ON CONSTRAINT daily_attendance_employee_date_unique
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
            req.user_id ?? req.user?.id
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
        const presentDays = parseInt(stats.present_count || 0);
        const halfDays = parseInt(stats.half_day_count || 0);
        const absentDays = parseInt(stats.absent_count || 0);
        const leaveDays = parseInt(stats.leave_count || 0);
        const totalDays = parseInt(stats.total_count || 0);

        // Use check-then-insert/update pattern to avoid ON CONFLICT constraint issues
        const existingMonthly = await client.query(
          `SELECT id FROM employee_attendance 
           WHERE employee_id = $1 AND attendance_month = $2::DATE`,
          [employee_id, monthStr]
        );
        
        if (existingMonthly.rows.length > 0) {
          await client.query(
            `UPDATE employee_attendance 
             SET 
               total_days = $1,
               present_days = $2,
               half_days = $3,
               absent_days = $4,
               leave_days = $5,
               updated_at = CURRENT_TIMESTAMP
             WHERE employee_id = $6 AND attendance_month = $7::DATE`,
            [totalDays, presentDays, halfDays, absentDays, leaveDays, employee_id, monthStr]
          );
        } else {
          await client.query(
            `INSERT INTO employee_attendance 
             (employee_id, attendance_month, total_days, present_days, half_days, absent_days, leave_days)
             VALUES ($1, $2::DATE, $3, $4, $5, $6, $7)`,
            [employee_id, monthStr, totalDays, presentDays, halfDays, absentDays, leaveDays]
          );
        }
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
router.get('/:id/payments', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const empCheck = await db.query('SELECT id FROM employees WHERE id = $1 AND shop_id = $2', [id, req.shop_id]);
    if (!empCheck.rows.length) return res.status(404).json({ error: 'Employee not found' });
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
router.post('/:id/payments', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
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

    // Convert amount to number and validate
    const paymentAmount = Number(amount) || 0;
    if (paymentAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    const employeeId = parseInt(id, 10);
    if (isNaN(employeeId)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }
    const empCheck = await db.query('SELECT id FROM employees WHERE id = $1 AND shop_id = $2', [employeeId, req.shop_id]);
    if (!empCheck.rows.length) return res.status(404).json({ error: 'Employee not found' });

    // Insert payment with explicit type casts
    const paymentResult = await db.query(
      `INSERT INTO employee_payments 
       (employee_id, payment_month, amount, payment_date, payment_method, notes, created_by)
       VALUES ($1::INTEGER, $2::DATE, $3::DECIMAL, $4::DATE, $5, $6, $7::INTEGER)
       RETURNING *`,
      [employeeId, monthStr, paymentAmount, payment_date, payment_method || null, notes || null, req.user_id ?? req.user?.id]
    );

    // Add to history - build description in JS to avoid PostgreSQL parameter type inference issues
    try {
      const monthFormatted = new Date(monthStr + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const historyDesc = `Payment of ₹${paymentAmount} for ${monthFormatted}`;
      await db.query(
        `INSERT INTO employee_history (employee_id, history_type, description, amount, reference_id, created_by)
         VALUES ($1::INTEGER, $2, $3, $4::DECIMAL, $5::INTEGER, $6::INTEGER)`,
        [employeeId, 'payment', historyDesc, paymentAmount, paymentResult.rows[0].id, req.user_id ?? req.user?.id]
      );
    } catch (historyErr) {
      console.error('Failed to add payment history (non-critical):', historyErr.message);
      // Don't throw - history is optional, main payment save is what matters
    }

    res.status(201).json(paymentResult.rows[0]);
  } catch (err) {
    console.error('POST /employees/:id/payments error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Delete/Undo payment for an employee
router.delete('/payments/:paymentId', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
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
         WHERE ep.id = $1 AND e.shop_id = $2`,
        [paymentId, req.shop_id]
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
        [payment.employee_id, historyDescription, -paymentAmount, req.user_id ?? req.user?.id]
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
router.get('/:id/history', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const empCheck = await db.query('SELECT id FROM employees WHERE id = $1 AND shop_id = $2', [id, req.shop_id]);
    if (!empCheck.rows.length) return res.status(404).json({ error: 'Employee not found' });

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

