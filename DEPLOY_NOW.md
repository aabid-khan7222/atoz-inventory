# 🚀 Abhi Deploy Karo - Simple Steps

## ⚡ Quick Steps (15 minutes)

### 1️⃣ Render.com Account (2 min)
- https://render.com par jao
- GitHub se sign up karo

### 2️⃣ Database Banao (2 min)
- New + → PostgreSQL
- Free plan select karo
- Connection String copy karo

### 3️⃣ Backend Deploy (5 min)
- New + → Web Service
- GitHub repo connect karo: **aabid-khan7222/atoz-inventory**
- Root Directory: `server`
- Build: `npm install`
- Start: `npm start`
- Environment Variables:
  - `NODE_ENV=production`
  - `PORT=4000`
  - `DATABASE_URL=<connection_string>`
  - `JWT_SECRET=mySecretKey123`
  - `ALLOWED_ORIGINS=https://atoz-frontend.onrender.com`
- Backend URL copy karo

### 4️⃣ Frontend Deploy (5 min)
- New + → Static Site
- GitHub repo connect karo: **aabid-khan7222/atoz-inventory**
- Root Directory: `client`
- Build: `npm install && npm run build`
- Publish: `dist`
- Environment Variable:
  - `VITE_API_BASE_URL=<backend_url>/api`
- Frontend URL copy karo (YEH AAPKA LINK HAI!)

### 5️⃣ CORS Update (1 min)
- Backend → Environment
- `ALLOWED_ORIGINS` = frontend URL

### 6️⃣ Migrations Run (Important!)
- Backend → Shell
- `cd server`
- `psql $DATABASE_URL -f migrations/create_stock_table.sql`

---

## ✅ Done!

**Shareable Link**: `https://atoz-frontend.onrender.com`

---

## 📞 Help?

**SIMPLE_DEPLOYMENT_STEPS.md** file mein detailed steps hain!

