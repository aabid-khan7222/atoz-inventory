# Restore Products Data Guide

## Current Situation

The `products` table is currently **empty** because:
1. We dropped the old separate tables (`bike_batteries`, `car_truck_tractor_batteries`, etc.)
2. We dropped the old `product` table (singular)
3. Created new `products` table (plural) but no data was migrated

## Solutions to Restore Products

### Option 1: Restore from Database Backup (RECOMMENDED)

If you have a database backup from before the migration:

```bash
# Restore from backup
psql -U your_username -d inventory_db < your_backup_file.sql
```

Then run the migration script again:
```bash
cd server
node scripts/migrateToUnifiedProductTable.js
```

### Option 2: Add Products via Admin Interface

1. Login as Admin/Super Admin
2. Go to Products section
3. Add products one by one using the "Add Product" form
4. Products will be automatically ordered by type and order_index

### Option 3: Insert Products via SQL Script

1. Create a SQL file with your product data
2. Use the format below
3. Run it in your database

Example SQL:
```sql
INSERT INTO products (sku, series, category, name, qty, selling_price, mrp_price, discount, discount_percent, ah_va, warranty, order_index, product_type_id) VALUES
('EPIQ-001', 'EXIDE EPIQ', 'car-truck-tractor', 'EPIQ Battery 12V 100Ah', 10, 9000, 10000, 1000, 10.00, '100Ah', '2 Years', 1, 1),
('EPIQ-002', 'EXIDE EPIQ', 'car-truck-tractor', 'EPIQ Battery 12V 120Ah', 8, 11000, 12000, 1000, 8.33, '120Ah', '2 Years', 2, 1),
-- Add more products here
-- Bike batteries (product_type_id = 2)
('XPLORE-001', 'EXIDE XPLORE', 'bike', 'XPLORE Battery 12V 7Ah', 15, 2500, 2800, 300, '7Ah', '1 Year', 1, 2),
-- HUPS/Inverter batteries (product_type_id = 3)
('HUPS-001', 'HUPS Series', 'ups-inverter', 'HUPS Battery 12V 100Ah', 5, 8000, 9000, 1000, '100Ah', '2 Years', 1, 3);
```

### Option 4: Use the Insert Script Template

1. Edit `server/scripts/insertSampleProducts.js`
2. Add your product data to the `products` array
3. Run: `node scripts/insertSampleProducts.js`

## Product Type IDs

- **1** = Car/Truck/Tractor batteries
- **2** = Bike batteries
- **3** = HUPS/Inverter batteries

## Product Ordering

Products are automatically ordered by:
1. `product_type_id` (1 → 2 → 3)
2. `order_index` (within each type)

So:
- All Car/Truck/Tractor batteries come first
- Then Bike batteries
- Then HUPS/Inverter batteries

## Important Notes

- Make sure `product_type` table has the 3 types (it should already exist)
- SKU must be unique
- `selling_price` is required
- `product_type_id` must be 1, 2, or 3

## Quick Check

To verify products were inserted:
```sql
SELECT product_type_id, COUNT(*) as count 
FROM products 
GROUP BY product_type_id 
ORDER BY product_type_id;
```

This should show:
- Type 1: X products (Car/Truck/Tractor)
- Type 2: Y products (Bike)
- Type 3: Z products (HUPS/Inverter)

