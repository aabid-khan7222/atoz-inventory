# Data Migration Guide: Local PostgreSQL 17 → Render "atoz" Database

## Overview
Yeh script local PostgreSQL 17 database se Render "atoz" database mein **sab data copy** karega.

## Prerequisites
1. Local PostgreSQL 17 running hai
2. Render "atoz" database accessible hai
3. `.env` file mein dono database credentials hain

## Step 1: Environment Variables Setup

`server/.env` file mein ye variables add karo:

```env
# Local PostgreSQL 17 Database (Source)
LOCAL_DB_HOST=localhost
LOCAL_DB_PORT=5432
LOCAL_DB_NAME=atoz_inventory
LOCAL_DB_USER=postgres
LOCAL_DB_PASSWORD=your_local_password

# Render Database (Destination) - Already set hoga
DATABASE_URL_PROD=postgresql://user:password@host:port/database
# OR
DATABASE_URL=postgresql://user:password@host:port/database
```

**Important:** 
- `LOCAL_DB_NAME` = apne local database ka naam (pgAdmin mein jo dikh raha hai)
- `LOCAL_DB_PASSWORD` = local PostgreSQL password
- `DATABASE_URL_PROD` = Render database connection string (Render dashboard se mil jayega)

## Step 2: Run Migration Script

Terminal mein ye command run karo:

```bash
cd server
node scripts/migrate-data-local-to-render.js
```

## Step 3: Verify Migration

Migration complete hone ke baad:

1. **Render Database Check:**
   - Render dashboard → Database → "atoz" → "Connect" → pgAdmin ya psql se connect karo
   - Tables check karo, data verify karo

2. **Application Check:**
   - Production URL par jao
   - Login karo
   - Dashboard, products, purchases, sales sab check karo

## What This Script Does

1. ✅ Local database se connect karta hai
2. ✅ Render database se connect karta hai
3. ✅ Har table ka data copy karta hai (foreign key order maintain karke)
4. ✅ Existing data clear karta hai Render mein (TRUNCATE)
5. ✅ Data insert karta hai batch mein (fast)
6. ✅ Errors handle karta hai (continue karta hai agar ek table fail ho)

## Tables Migrated (in order)

1. Base tables: `product_type`, `roles`, `sales_types`, etc.
2. User tables: `users`, `customer_profiles`, `employees`
3. Product tables: `products`, `product_images`
4. Stock tables: `stock`, `stock_history`, `purchases`
5. Sales tables: `sales`, `sells`
6. Service tables: `charging_services`, `service_requests`
7. Other tables: `notifications`, `guarantee_warranty_replacements`, etc.

## Troubleshooting

### Error: "DATABASE_URL_PROD not found"
- `.env` file mein `DATABASE_URL_PROD` ya `DATABASE_URL` set karo

### Error: "Local database connection failed"
- Local PostgreSQL 17 running hai?
- `.env` mein `LOCAL_DB_*` variables sahi hain?
- Password sahi hai?

### Error: "Table does not exist"
- Table names match karte hain dono databases mein?
- Migration files run kiye hain Render database par?

### Data Missing After Migration
- Console logs check karo - koi table fail hua?
- Render database directly check karo
- Script dobara run karo (pehle data clear ho jayega)

## Important Notes

⚠️ **Warning:** Yeh script Render database ka **existing data clear** karega (TRUNCATE).  
✅ **Safe:** Local database ka data **delete nahi** hoga, sirf copy hoga.

## Support

Agar koi issue aaye:
1. Console logs share karo
2. Error message share karo
3. Database connection details verify karo
