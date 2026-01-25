-- ============================================================
-- TEST QUERY: daily_attendance INSERT with ON CONFLICT
-- ============================================================
-- Use this to test the query manually in pgAdmin/SQL client
-- Replace the values with actual test data
-- ============================================================

-- Test INSERT (new record)
INSERT INTO daily_attendance 
(employee_id, attendance_date, status, check_in_time, check_out_time, notes, created_by, created_at, updated_at)
VALUES 
(2, '2026-01-23'::DATE, 'half_day', '09:15'::TIME, '01:45'::TIME, 'Test notes', 1, NOW(), NOW())
ON CONFLICT ON CONSTRAINT daily_attendance_employee_date_unique
DO UPDATE SET
  status = EXCLUDED.status,
  check_in_time = EXCLUDED.check_in_time,
  check_out_time = EXCLUDED.check_out_time,
  notes = EXCLUDED.notes,
  updated_at = NOW()
RETURNING *;

-- ============================================================
-- To test UPDATE (existing record), run the same query again
-- It should update the existing record instead of inserting
-- ============================================================
