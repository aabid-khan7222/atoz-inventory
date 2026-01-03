# Sales Types Explanation

## Where are the Two IDs?

The two IDs you requested are stored in the **`sales_types`** lookup table:

### Sales Types Table
| ID | Type Name | Description |
|---|---|---|
| **1** | `retail` | Retail customers (normal customers) |
| **2** | `wholesale` | Wholesale/B2B customers |

## How It Works

1. **`sales_types` table** - Contains the two reference IDs (1 and 2)
   - This table is **NOT empty** - it has 2 rows
   - These are lookup/reference values

2. **`sales_id` table** - Stores actual sales transactions
   - This table is **empty** until you make a sale
   - Each sale record has a `sales_type_id` column that references:
     - `1` for retail sales
     - `2` for wholesale/B2B sales

3. **`sales_item` table** - Stores individual batteries sold
   - Also has `sales_type_id` column referencing the same IDs

## Viewing the IDs

You can view the sales types in several ways:

### Option 1: Database Query
```sql
SELECT * FROM sales_types ORDER BY id;
```

### Option 2: API Endpoint
```
GET /api/sales-types
```

### Option 3: Check Script
```bash
cd server
node scripts/check_sales_types.js
```

## When Sales Are Made

When you create a sale:
- If it's a **retail** sale → `sales_type_id = 1` is stored
- If it's a **wholesale/B2B** sale → `sales_type_id = 2` is stored

The `sales_id` table will populate with records that reference these IDs.

## Summary

✅ **`sales_types` table** = Has the 2 IDs (1 and 2) - **NOT EMPTY**  
⏳ **`sales_id` table** = Empty until sales are made - **This is correct!**

The IDs exist and are ready to use. The `sales_id` table will fill up as you make sales.

