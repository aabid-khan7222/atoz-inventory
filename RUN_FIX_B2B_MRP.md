# 🔧 b2b_mrp NULL Values Fix - Instructions

## 📍 Script कहाँ Run करें:

### Option 1: Production Database पर (Recommended)

**PowerShell में ये commands run करें:**

```powershell
# Step 1: Project folder में जाओ
cd C:\Users\Aabid\OneDrive\Desktop\atoz-inventory

# Step 2: Production mode set करो और script run करो
$env:NODE_ENV="production"
node server/scripts/fix_b2b_mrp_null_values.js
```

**Important:** पहले check करो कि `server/.env` file में `DATABASE_URL_PROD` set है।

---

### Option 2: Local Database पर (Testing के लिए)

```powershell
# Step 1: Project folder में जाओ
cd C:\Users\Aabid\OneDrive\Desktop\atoz-inventory

# Step 2: Local mode में script run करो
$env:NODE_ENV="development"
node server/scripts/fix_b2b_mrp_null_values.js
```

**Important:** `server/.env` file में `DATABASE_URL_LOCAL` set होना चाहिए।

---

## ✅ Expected Output:

Script run करने के बाद आपको ऐसा output दिखेगा:

```
Fixing b2b_mrp NULL values in products table...

Before Update:
  Total Products: 123
  Products with NULL b2b_mrp: 123
  Products with b2b_mrp: 0

Updating b2b_mrp to mrp_price where b2b_mrp is NULL...
  Updated 123 products

After Update:
  Total Products: 123
  Products with NULL b2b_mrp: 0
  Products with b2b_mrp: 123
  Products where b2b_mrp = mrp_price: 123

✅ Added comment to b2b_mrp column

✅ Migration completed successfully!
```

---

## 🔍 Environment Variables Check:

अगर error आए, तो check करो:

### Production Database के लिए:
`server/.env` file में ये होना चाहिए:
```env
NODE_ENV=production
DATABASE_URL_PROD=postgresql://username:password@host:5432/database
# या
DATABASE_URL=postgresql://username:password@host:5432/database
```

### Local Database के लिए:
`server/.env` file में ये होना चाहिए:
```env
NODE_ENV=development
DATABASE_URL_LOCAL=postgresql://postgres:007222@localhost:5432/inventory_db
```

---

## 🎯 Summary:

1. **Production DB fix करने के लिए:**
   - `$env:NODE_ENV="production"` set करो
   - `node server/scripts/fix_b2b_mrp_null_values.js` run करो

2. **Local DB पर test करने के लिए:**
   - `$env:NODE_ENV="development"` set करो (या unset करो)
   - `node server/scripts/fix_b2b_mrp_null_values.js` run करो

3. **Script automatically:**
   - सभी products check करेगी जहाँ `b2b_mrp` NULL है
   - उन्हें `mrp_price` के बराबर set करेगी
   - Before/After statistics दिखाएगी

