# Clean Sahara & Anand data (shop 2 & 3)

**Goal:** Sahara Battery and Anand Battery should show **no data** (empty). A To Z Battery (shop 1) must **not** be changed.

## Step 1: Run the cleanup SQL on production

Run the script **once** on your **production** PostgreSQL database (e.g. from Render Dashboard → PostgreSQL → Connect → run the SQL):

**File:** `server/migrations/clean_shop_2_and_3_data.sql`

- Deletes all rows where `shop_id IN (2, 3)` from: stock_history, stock, sales_item, battery_replacements, company_returns, purchase_items (by purchase_id), purchases, notifications, charging_services, service_requests, daily_attendance, employee_payments, employee_history, employees, commission_agents, products, shop_settings.
- **Does NOT** delete from `users` — Sahara and Anand admin/superadmin accounts stay so they can log in.

After this, Sahara and Anand will have empty products, sales, purchases, services, reports, etc.

## Step 2: Backend (already done)

Dashboard and other routes now filter by `req.shop_id`, so each shop only sees its own data. No code change needed from you.

## Result

- **A TO Z BATTERY** — data unchanged.
- **SAHARA BATTERY** — empty (no products, sales, purchases, services, etc.).
- **ANAND BATTERY** — empty.
- Each shop’s data is separate; no overlapping.
