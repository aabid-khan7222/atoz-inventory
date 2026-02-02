-- Fix shop_id for daily_attendance, employee_attendance, employee_history, employee_payments
-- Add shop_id column if missing, then backfill from employees.shop_id
-- Run in production DB to fix existing NULL shop_id

-- Step 1: Add shop_id column if not exists (multi_shop only has daily_attendance; others may lack it)
DO $$
BEGIN
  -- daily_attendance - usually has shop_id from multi_shop_migration
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_attendance' AND column_name = 'shop_id') THEN
    ALTER TABLE daily_attendance ADD COLUMN shop_id INTEGER;
    RAISE NOTICE 'Added shop_id to daily_attendance';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employee_attendance' AND column_name = 'shop_id') THEN
    ALTER TABLE employee_attendance ADD COLUMN shop_id INTEGER;
    RAISE NOTICE 'Added shop_id to employee_attendance';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employee_history' AND column_name = 'shop_id') THEN
    ALTER TABLE employee_history ADD COLUMN shop_id INTEGER;
    RAISE NOTICE 'Added shop_id to employee_history';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employee_payments' AND column_name = 'shop_id') THEN
    ALTER TABLE employee_payments ADD COLUMN shop_id INTEGER;
    RAISE NOTICE 'Added shop_id to employee_payments';
  END IF;
END $$;

-- Step 2: Backfill shop_id from employees table (all shops: A to Z, Sahara, Anand)
UPDATE daily_attendance da
SET shop_id = e.shop_id
FROM employees e
WHERE da.employee_id = e.id
  AND (da.shop_id IS NULL OR da.shop_id != e.shop_id);

UPDATE employee_attendance ea
SET shop_id = e.shop_id
FROM employees e
WHERE ea.employee_id = e.id
  AND (ea.shop_id IS NULL OR ea.shop_id != e.shop_id);

UPDATE employee_history eh
SET shop_id = e.shop_id
FROM employees e
WHERE eh.employee_id = e.id
  AND (eh.shop_id IS NULL OR eh.shop_id != e.shop_id);

UPDATE employee_payments ep
SET shop_id = e.shop_id
FROM employees e
WHERE ep.employee_id = e.id
  AND (ep.shop_id IS NULL OR ep.shop_id != e.shop_id);

-- Step 3: Set DEFAULT and NOT NULL (optional - uncomment if you want strict enforcement)
-- ALTER TABLE daily_attendance ALTER COLUMN shop_id SET DEFAULT 1;
-- ALTER TABLE daily_attendance ALTER COLUMN shop_id SET NOT NULL;
-- (repeat for other tables)
