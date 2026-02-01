# Backend Multi-Shop Isolation Rules

## How Isolation is Enforced

1. **JWT Payload** (set at login): `user_id`, `shop_id`, `role_id`, `user_type`
   - shop_id is fetched from users table, NEVER from frontend

2. **verifyJWT Middleware**: Extracts token, verifies, attaches to req:
   - `req.user_id`, `req.shop_id`, `req.role_id`, `req.user_type`

3. **requireShop Middleware**: Rejects with 401 if `req.shop_id` is missing
   - No API works without shop context

4. **Query Golden Rule**: EVERY SELECT/INSERT/UPDATE/DELETE MUST use shop_id:
   - SELECT: `WHERE shop_id = $1` (with req.shop_id)
   - INSERT: `shop_id = req.shop_id` (NEVER from req.body)
   - UPDATE/DELETE: `WHERE id = $1 AND shop_id = $2`

5. **Manipulation Protection**: Even if client changes IDs, backend validates
   `shop_id = req.shop_id` — returns 0 rows (404) if record belongs to another shop.

## Route Stack

All protected routes MUST use: `verifyJWT` (or requireAuth) → `requireShop` (or requireShopId) → role middleware (if needed)

## New Endpoint

- **GET /api/shop/me** — Returns `{ shop_id, shop_name }` for header, invoice, reports. Use this in frontend for dynamic shop name.
