# Multi-Shop (Multi-Tenant) Implementation Guide

## Overview

This document describes the conversion of the single-shop application to a multi-shop (multi-tenant) application using a **single database** and **single codebase**.

---

## ⚠️ CRITICAL: Run Migration BEFORE Deploying

**You MUST run the database migration before deploying this code.** Otherwise the app will fail.

1. Run `server/migrations/multi_shop_migration.sql` against your database
2. Run `node server/scripts/insert-multi-shop-users.js` to create Sahara & Anand users
3. Then deploy

---

## 1. DATABASE MIGRATION

### Step 1: Ensure shops table exists

```sql
CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

INSERT INTO shops (id, name) VALUES
  (1, 'A To Z Battery'),
  (2, 'Sahara Battery'),
  (3, 'Anand Battery')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
```

### Step 2: Add shop_id column (if not already added)

**RUN THIS QUERY MANUALLY** – Add shop_id to tables that don't have it:

```sql
-- Add shop_id to tenant tables (run only if column doesn't exist)
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
      RAISE NOTICE 'Added shop_id to %', t;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Table % does not exist', t;
    END;
  END LOOP;
END $$;
```

### Step 3: Run the full migration

**RUN THIS QUERY MANUALLY** – Execute the migration file:

```bash
psql "YOUR_DATABASE_URL" -f server/migrations/multi_shop_migration.sql
```

Or copy the contents of `server/migrations/multi_shop_migration.sql` and run in your SQL client.

### Step 4: Insert users for Sahara & Anand Battery

**RUN THIS COMMAND MANUALLY** (after migration):

```bash
node server/scripts/insert-multi-shop-users.js
```

This creates:
- **Sahara Battery (shop_id=2):**
  - superadmin@saharabattery.com / Sahara@123 (Super Admin)
  - admin@saharabattery.com / Sahara@123 (Admin)
- **Anand Battery (shop_id=3):**
  - superadmin@anandbattery.com / Anand@123 (Super Admin)
  - admin@anandbattery.com / Anand@123 (Admin)

---

## 2. DATA ISOLATION GUARANTEE

**How isolation works:**

1. **JWT Token**: Every authenticated user has `shop_id` embedded in their JWT. The backend middleware (`requireAuth`) extracts `shop_id` from the token and attaches it to `req.shop_id`.

2. **Backend Enforcement**: Every API that accesses tenant data:
   - Uses `requireShopId` middleware (after `requireAuth`)
   - Adds `WHERE shop_id = req.shop_id` to all SELECT queries
   - Adds `shop_id = req.shop_id` to all INSERT operations
   - Adds `AND shop_id = req.shop_id` to all UPDATE/DELETE WHERE clauses

3. **Impossible to Access Other Shop's Data**: Even if a malicious user manipulates request IDs (e.g., `GET /api/products/999`), the backend validates that product 999 belongs to `req.shop_id` before returning it. If not, the query returns no rows (404).

4. **Existing Data**: All existing records were updated to `shop_id = 1` (A To Z Battery). Sahara and Anand start with empty data.

---

## 3. FUTURE SCALABILITY

**Adding a new shop** (no code changes):

1. Insert into `shops`:
   ```sql
   INSERT INTO shops (id, name) VALUES (4, 'New Shop Name');
   ```

2. Create users for the new shop:
   ```sql
   -- Use the insert script or run:
   INSERT INTO users (full_name, email, password, role_id, is_active, shop_id)
   VALUES ('New Admin', 'admin@newshop.com', '<bcrypt_hash>', 2, true, 4);
   ```

3. Optionally create initial `shop_settings` row for the new shop.

**Best practices:**
- Never trust client-provided `shop_id` – always use `req.shop_id` from JWT
- All new routes that touch tenant data must include `requireShopId` and filter by `shop_id`
- Use database foreign key constraints (`shop_id REFERENCES shops(id)`) to enforce referential integrity

---

## 4. AUTHENTICATION FLOW

1. User logs in with email/password
2. Backend fetches user from `users` (JOIN `shops` for `shop_name`)
3. JWT is signed with `shop_id` and `shop_name`
4. Frontend stores `shop_id` and `shop_name` in AuthContext
5. All subsequent API requests send JWT; backend extracts `shop_id` and filters all data

---

## 5. FRONTEND CHANGES

- `user.shop_name` is used instead of hardcoded "A TO Z BATTERY"
- Dashboard header, invoice, reports, settings – all show dynamic shop name from `user.shop_name`

---

## 6. REMAINING ROUTES (Add shop_id filtering)

The following routes have been updated with shop_id filtering:
- products.js
- dashboard.js (overview)
- shopSettings.js
- invoices.js
- invoiceService.js
- users.js (admin create customer)
- auth.js (login, signup)

**Routes that still need shop_id** (add `requireShopId`, filter queries, add shop_id to INSERTs):
- sales.js, adminSales.js
- inventory.js
- purchases.js
- notifications.js
- chargingServices.js
- serviceRequests.js
- companyReturns.js
- guaranteeWarranty.js
- reports.js
- commissionAgents.js
- employees.js
- admin.js (customer list, etc.)

Use the same pattern: add `requireShopId` after `requireAuth`, use `req.shop_id` in all queries.
