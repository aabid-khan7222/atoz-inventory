# Stock Table Fix Summary

## Problem
When adding stock from the "Add Stock" section:
- ✅ Data was successfully saved to `purchases` table
- ✅ Data appeared in the Purchases section of the UI
- ❌ Data was NOT appearing in the "Current Stock" section
- ❌ Data was NOT being saved to the `stock` table

## Root Cause
The stock insert logic in `add-stock-with-serials` endpoint was:
1. Wrapped in multiple try-catch blocks with fallback methods
2. If all methods failed, errors were caught and logged but the transaction continued
3. The transaction would commit even if stock insert failed
4. This meant purchases were saved but stock wasn't

## Solution

### 1. Fixed Stock Insert Logic (`server/routes/inventory.js`)
- **Simplified the insert method**: Instead of trying multiple ON CONFLICT approaches, we now:
  1. Check which serial numbers already exist in stock table
  2. Insert only new serial numbers
  3. Update existing serial numbers with latest purchase info
- **Improved error handling**: If stock insert fails, the entire transaction is aborted (no more silent failures)
- **Better logging**: More detailed error messages to help diagnose issues

### 2. Created Backfill Script (`server/scripts/backfill_purchases_to_stock.js`)
- Migrates existing purchases data into stock table
- Finds products by SKU and creates corresponding stock entries
- Skips records that already exist in stock table
- Updates existing records with latest purchase info

## How to Use

### For New Stock Additions
The fix is automatic - when you add stock now, it will:
1. Save to `purchases` table ✅
2. Save to `stock` table ✅
3. Appear in Purchases section ✅
4. Appear in Current Stock section ✅

### For Existing Purchases (Backfill)
Run the backfill script to migrate existing purchases to stock table:

```bash
cd server
node scripts/backfill_purchases_to_stock.js
```

This will:
- Read all purchases from `purchases` table
- Find corresponding products by SKU
- Create stock entries for each purchase
- Skip duplicates (already in stock table)
- Update existing stock records with purchase info

## Testing

After applying the fix:
1. Add a new stock item through "Add Stock" section
2. Check that it appears in:
   - Purchases section ✅
   - Current Stock section ✅
3. Verify in database:
   - `purchases` table has the record ✅
   - `stock` table has the record with `status = 'available'` ✅

## Technical Details

### Stock Table Query (Current Stock Section)
The Current Stock section queries:
```sql
SELECT 
  p.id, p.sku, p.name,
  COALESCE(stock_counts.available_qty, 0) as qty,
  ...
FROM products p
LEFT JOIN (
  SELECT product_id, COUNT(*) as available_qty
  FROM stock
  WHERE status = 'available'
  GROUP BY product_id
) stock_counts ON p.id = stock_counts.product_id
WHERE p.product_type_id = $1
```

This counts available items from the `stock` table, so stock entries must exist for items to show up.

### Stock Insert Logic
The new logic:
1. Checks existing serials: `SELECT serial_number FROM stock WHERE product_id = $1 AND serial_number = ANY($2::text[]) AND status = 'available'`
2. Inserts new serials: Only inserts serials that don't already exist
3. Updates existing serials: Updates purchase_date and purchased_from for existing records
4. Fails transaction if any error occurs: No more silent failures

## Files Changed
- `server/routes/inventory.js` - Fixed stock insert logic and error handling
- `server/scripts/backfill_purchases_to_stock.js` - New migration script

## Notes
- Water products (product_type_id = 4) use `products.qty` directly, not stock table
- Stock table tracks individual items with serial numbers
- Each stock entry represents one physical item
- When items are sold, they are deleted from stock table (not just marked as sold)

