# 🚀 Quick Start Guide

## Localhost Development Setup (5 minutes)

### Step 1: Environment Variables Setup

**Backend** (`server` folder mein):
```bash
cd server
copy env.template .env
# Ya Windows PowerShell mein:
Copy-Item env.template .env
```

**Frontend** (`client` folder mein):
```bash
cd client
copy env.template .env
# Ya Windows PowerShell mein:
Copy-Item env.template .env
```

### Step 2: Database Setup

1. PostgreSQL install karo (agar nahi hai)
2. Database create karo:
```sql
CREATE DATABASE atoz_inventory;
```

3. `server/.env` file mein `DATABASE_URL` update karo:
```
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/atoz_inventory
```

### Step 3: Install Dependencies

**Terminal 1 - Backend**:
```bash
cd server
npm install
```

**Terminal 2 - Frontend**:
```bash
cd client
npm install
```

### Step 4: Run Application

**Terminal 1 - Backend**:
```bash
cd server
npm run dev
```
Backend `http://localhost:4000` par chalega

**Terminal 2 - Frontend**:
```bash
cd client
npm run dev
```
Frontend `http://localhost:5173` par chalega

### Step 5: Open Application

Browser mein jao: `http://localhost:5173`

---

## Production Deployment (15 minutes)

### Option A: Render.com (Easiest)

1. **GitHub par code push karo**:
```bash
git init
git add .
git commit -m "Ready for deployment"
git remote add origin https://github.com/YOUR_USERNAME/atoz-inventory.git
git push -u origin main
```

2. **Render.com par jao**: https://render.com
3. **DEPLOYMENT_GUIDE.md** file follow karo (detailed steps)

### Option B: Railway.app

1. **Railway.app par jao**: https://railway.app
2. GitHub repository connect karo
3. PostgreSQL database add karo
4. Backend aur Frontend services deploy karo
4. **DEPLOYMENT_GUIDE.md** file follow karo

---

## ✅ Checklist

### Localhost Setup
- [ ] Backend `.env` file create ho gaya
- [ ] Frontend `.env` file create ho gaya
- [ ] PostgreSQL database create ho gaya
- [ ] Dependencies install ho gayi
- [ ] Backend running hai (port 4000)
- [ ] Frontend running hai (port 5173)
- [ ] Application browser mein open ho rahi hai

### Production Deployment
- [ ] Code GitHub par push ho gaya
- [ ] PostgreSQL database create ho gaya (Render/Railway par)
- [ ] Backend deployed hai
- [ ] Frontend deployed hai
- [ ] Environment variables set ki hain
- [ ] CORS properly configured hai
- [ ] Application test kar li hai
- [ ] Shareable link ready hai

---

## 🆘 Common Issues

### Port Already in Use
```bash
# Windows mein port kill karo
netstat -ano | findstr :4000
taskkill /PID <PID_NUMBER> /F
```

### Database Connection Error
- PostgreSQL service running hai ya nahi check karo
- `DATABASE_URL` sahi hai ya nahi verify karo
- Database create ho gaya hai ya nahi check karo

### CORS Error
- Backend `.env` mein `ALLOWED_ORIGINS` sahi frontend URL hai ya nahi check karo

### Module Not Found
```bash
# Dependencies reinstall karo
cd server && npm install
cd ../client && npm install
```

---

## 📞 Need Help?

1. **DEPLOYMENT_GUIDE.md** file check karo (detailed guide)
2. Render/Railway logs check karo
3. Browser console check karo (F12)
4. Network tab check karo (API calls)

---

## 🎉 Success!

Agar sab kuch sahi se setup ho gaya hai, to:
- **Localhost**: `http://localhost:5173` par application chalegi
- **Production**: Aapka shareable link ready hai!

