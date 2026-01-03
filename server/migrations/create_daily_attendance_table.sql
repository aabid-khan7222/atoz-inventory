-- Create daily_attendance table for tracking daily attendance
CREATE TABLE IF NOT EXISTS daily_attendance (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'present', -- 'present', 'absent', 'leave', 'half_day'
    check_in_time TIME,
    check_out_time TIME,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, attendance_date)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_daily_attendance_employee_id ON daily_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_date ON daily_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_employee_date ON daily_attendance(employee_id, attendance_date);

