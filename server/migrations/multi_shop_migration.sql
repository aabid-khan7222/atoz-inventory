-- ============================================================
-- MULTI-SHOP (MULTI-TENANT) MIGRATION
-- Run this AFTER adding shop_id column to all tenant tables.
-- 
-- Prerequisites:
--   1. shops table exists: shops(id, name)
--   2. shops has records: (1, 'A To Z Battery'), (2, 'Sahara Battery'), (3, 'Anand Battery')
--   3. shop_id column has been added to all tenant tables
--
-- This migration:
--   1. Updates all existing records to shop_id = 1 (A To Z Battery)
--   2. Sets shop_id NOT NULL
--   3. Adds foreign key references to shops(id)
-- ============================================================

-- Ensure shops table and seed data exist
-- (Add shop_id to tables if not present - user may have already added)
DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'users', 'products', 'stock', 'sales_id', 'sales_item', 'purchases',
    'notifications', 'charging_services', 'service_requests', 'company_returns',
    'battery_replacements', 'stock_history', 'employees', 'commission_agents',
    'daily_attendance', 'customer_profiles', 'shop_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS shop_id INTEGER', t);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

INSERT INTO shops (id, name) VALUES
  (1, 'A To Z Battery'),
  (2, 'Sahara Battery'),
  (3, 'Anand Battery')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================
-- Step 1: Update all NULL shop_id to 1 (existing data belongs to A To Z Battery)
-- ============================================================

DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'users', 'products', 'stock', 'sales_id', 'sales_item', 'purchases',
    'notifications', 'charging_services', 'service_requests', 'company_returns',
    'battery_replacements', 'stock_history', 'employees', 'commission_agents',
    'daily_attendance', 'customer_profiles', 'shop_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables
  LOOP
    BEGIN
      EXECUTE format('UPDATE %I SET shop_id = 1 WHERE shop_id IS NULL', t);
      RAISE NOTICE 'Updated shop_id in %', t;
    EXCEPTION WHEN undefined_column THEN
      RAISE NOTICE 'Column shop_id does not exist in % - skipping (add it first)', t;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Table % does not exist - skipping', t;
    END;
  END LOOP;
END $$;

-- ============================================================
-- Step 2: Set shop_id NOT NULL (only for tables that have the column)
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name = 'shop_id'
  )
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN shop_id SET DEFAULT 1',
        r.table_name
      );
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN shop_id SET NOT NULL',
        r.table_name
      );
      RAISE NOTICE 'Set shop_id NOT NULL in %', r.table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on %.shop_id: %', r.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- Step 3: Add foreign key constraint shop_id -> shops(id)
-- ============================================================

DO $$
DECLARE
  r RECORD;
  constraint_name TEXT;
BEGIN
  FOR r IN (
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name = 'shop_id'
  )
  LOOP
    constraint_name := 'fk_' || r.table_name || '_shop_id';
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (shop_id) REFERENCES shops(id)',
        r.table_name,
        constraint_name
      );
      RAISE NOTICE 'Added FK % on %', constraint_name, r.table_name;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'Constraint % already exists on %', constraint_name, r.table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add FK on %.shop_id: %', r.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- shop_settings: drop single-row constraint if exists, add unique on shop_id
DO $$
BEGIN
  ALTER TABLE shop_settings DROP CONSTRAINT IF EXISTS single_row;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- shop_settings: ensure unique on shop_id for ON CONFLICT (shop_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shop_settings_shop_id_key'
  ) THEN
    ALTER TABLE shop_settings ADD CONSTRAINT shop_settings_shop_id_key UNIQUE (shop_id);
  END IF;
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'shop_settings.shop_id does not exist - add it first';
END $$;

-- Create index on shop_id for performance (common filter)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name = 'shop_id'
  )
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%I_shop_id ON %I(shop_id)',
        r.table_name,
        r.table_name
      );
      RAISE NOTICE 'Created index on %.shop_id', r.table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not create index on %.shop_id: %', r.table_name, SQLERRM;
    END;
  END LOOP;
END $$;
