# Run Daily Attendance Unique Constraint Migration for Production

## Migration Purpose
This migration adds a unique constraint on `(employee_id, attendance_date)` to the `daily_attendance` table to fix the ON CONFLICT error when marking daily attendance.

## How to Run in Production (Render Database)

### Option 1: Using Render Database Console (Recommended)

1. Go to your Render dashboard: https://dashboard.render.com
2. Navigate to your PostgreSQL database service
3. Click on "Connect" or "Info" tab
4. Find "PSQL" or "Database Console" option
5. Click to open the database console
6. Copy and paste the following SQL:

```sql
DO $$ 
BEGIN
  -- Check if unique constraint already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'daily_attendance_employee_id_attendance_date_key'
    AND conrelid = 'daily_attendance'::regclass
  ) THEN
    -- Add unique constraint if it doesn't exist
    ALTER TABLE daily_attendance 
    ADD CONSTRAINT daily_attendance_employee_id_attendance_date_key 
    UNIQUE (employee_id, attendance_date);
    
    RAISE NOTICE 'Added unique constraint on (employee_id, attendance_date)';
  ELSE
    RAISE NOTICE 'Unique constraint already exists';
  END IF;
END $$;
```

7. Execute the SQL
8. You should see a success message

### Option 2: Using psql Command Line (If you have access)

```bash
# Connect to your Render database
psql "your-production-database-url"

# Then run the SQL from the file:
\i server/migrations/add_unique_constraint_daily_attendance.sql
```

## Verification

After running the migration, verify it worked by running:

```sql
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'daily_attendance'::regclass 
AND conname = 'daily_attendance_employee_id_attendance_date_key';
```

You should see one row with `contype = 'u'` (unique constraint).

## What This Fixes

- Fixes error: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
- Allows daily attendance to be marked properly, including "half day" status
- Prevents duplicate attendance records for the same employee on the same date
