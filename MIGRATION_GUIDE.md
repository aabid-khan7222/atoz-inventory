# Database Migration Guide: Unified Product Table

This guide explains the migration from separate product tables to a unified product table structure.

## Overview

The database has been restructured from:
- `bike_batteries`
- `car_truck_tractor_batteries`
- `hups_inverter_batteries` / `ups_inverter_batteries`
- `product` (old table)

To:
- `product_type` (new table with 3 types)
- `product` (new unified table)

## Product Types

1. **ID 1** - Car/Truck/Tractor batteries (`car_truck_tractor_batteries`)
2. **ID 2** - Bike batteries (`bike_batteries`)
3. **ID 3** - HUPS & Inverter batteries (`hups_inverter_batteries`)

## Migration Steps

### 1. Backup Your Database

**IMPORTANT:** Always backup your database before running the migration!

```bash
# Example PostgreSQL backup command
pg_dump -U your_username -d your_database_name > backup_before_migration.sql
```

### 2. Run the Migration Script

```bash
cd server
node scripts/migrateToUnifiedProductTable.js
```

The migration script will:
1. Fetch all existing data from old tables
2. Create `product_type` table with 3 product types
3. Create new unified `product` table
4. Migrate all products in the correct order:
   - Car/Truck/Tractor batteries first (product_type_id = 1)
   - Bike batteries second (product_type_id = 2)
   - HUPS/Inverter batteries third (product_type_id = 3)
5. Delete old tables

### 3. Verify Migration

After migration, verify that:
- All products were migrated successfully
- Product counts match
- No data was lost

You can check with:
```sql
SELECT product_type_id, COUNT(*) FROM product GROUP BY product_type_id;
```

## New Table Structure

### product_type Table

```sql
CREATE TABLE product_type (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### product Table

```sql
CREATE TABLE product (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(100) UNIQUE NOT NULL,
  series VARCHAR(100),
  category VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  qty INTEGER DEFAULT 0,
  selling_price DECIMAL(10, 2) NOT NULL,
  mrp_price DECIMAL(10, 2),
  discount DECIMAL(10, 2) DEFAULT 0,
  ah_va VARCHAR(20),
  warranty VARCHAR(50),
  order_index INTEGER,
  product_type_id INTEGER NOT NULL REFERENCES product_type(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Changes

The API maintains backward compatibility. All endpoints continue to work with the `category` parameter, which is now mapped to `product_type_id` internally.

### Product Endpoints

- `GET /api/products` - Get all products (ordered by product_type_id, then order_index)
- `GET /api/products?category=car-truck-tractor` - Get products by category
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (requires category)
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Category Mapping

- `car-truck-tractor` → product_type_id = 1
- `bike` → product_type_id = 2
- `ups-inverter` or `hups-inverter` → product_type_id = 3

## Rollback

If you need to rollback, restore from your backup:

```bash
# Restore from backup
psql -U your_username -d your_database_name < backup_before_migration.sql
```

## Notes

- The migration preserves all product data including order_index
- Products are ordered by product_type_id first, then by order_index
- The old `product` table (if it existed) is also migrated
- All foreign key relationships are maintained

