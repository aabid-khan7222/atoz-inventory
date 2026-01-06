# ✅ Deployment Checklist

Use this checklist to ensure everything is set up correctly before and after deployment.

## 📋 Pre-Deployment Checklist

### Code Preparation
- [ ] All code changes committed to Git
- [ ] Code pushed to GitHub repository
- [ ] No sensitive data (passwords, API keys) in code
- [ ] `.env` files are in `.gitignore`
- [ ] `README.md` updated (if needed)

### Local Testing
- [ ] Application runs on localhost without errors
- [ ] All features tested locally
- [ ] Database migrations tested
- [ ] API endpoints working correctly
- [ ] Frontend connects to backend successfully

### Environment Variables Prepared
- [ ] Backend environment variables list ready:
  - [ ] `DATABASE_URL` (will get from Render/Railway)
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=4000`
  - [ ] `JWT_SECRET` (random secure string)
  - [ ] `ALLOWED_ORIGINS` (frontend URL - set after frontend deploy)

- [ ] Frontend environment variables list ready:
  - [ ] `VITE_API_BASE_URL` (backend URL - set after backend deploy)

---

## 🚀 Deployment Steps Checklist

### Step 1: Database Setup
- [ ] PostgreSQL database created on Render/Railway
- [ ] Database connection string copied
- [ ] Database name noted

### Step 2: Backend Deployment
- [ ] Backend service created on Render/Railway
- [ ] GitHub repository connected
- [ ] Root directory set to `server`
- [ ] Build command: `npm install`
- [ ] Start command: `npm start`
- [ ] Environment variables added:
  - [ ] `DATABASE_URL`
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=4000`
  - [ ] `JWT_SECRET`
- [ ] Backend deployed successfully
- [ ] Backend URL copied (e.g., `https://atoz-inventory-backend.onrender.com`)

### Step 3: Database Migrations
- [ ] Database migrations run successfully
- [ ] All tables created
- [ ] Initial data inserted (if needed)
- [ ] Database connection verified

### Step 4: Frontend Deployment
- [ ] Frontend service created on Render/Railway
- [ ] GitHub repository connected
- [ ] Root directory set to `client`
- [ ] Build command: `npm install && npm run build`
- [ ] Publish directory: `dist`
- [ ] Environment variables added:
  - [ ] `VITE_API_BASE_URL` (backend URL + `/api`)
- [ ] Frontend deployed successfully
- [ ] Frontend URL copied (e.g., `https://atoz-inventory-frontend.onrender.com`)

### Step 5: CORS Configuration
- [ ] Backend `ALLOWED_ORIGINS` updated with frontend URL
- [ ] Backend redeployed (if needed)
- [ ] CORS errors resolved

---

## ✅ Post-Deployment Testing Checklist

### Basic Functionality
- [ ] Frontend URL opens in browser
- [ ] No console errors in browser
- [ ] Login page loads correctly
- [ ] Can login successfully
- [ ] Dashboard loads correctly

### API Connectivity
- [ ] API calls working (check Network tab)
- [ ] No CORS errors
- [ ] Data loads correctly
- [ ] Forms submit successfully

### Features Testing
- [ ] Products page loads
- [ ] Inventory page loads
- [ ] Sales page works
- [ ] Reports page works
- [ ] All major features functional

### Mobile Testing
- [ ] Application works on mobile browser
- [ ] Responsive design correct
- [ ] Touch interactions work

---

## 🔄 Future Updates Checklist

### Before Making Changes
- [ ] Changes tested on localhost
- [ ] No breaking changes
- [ ] Database migrations prepared (if needed)

### Deploying Updates
- [ ] Code committed to Git
- [ ] Code pushed to GitHub
- [ ] Automatic deployment triggered (or manual)
- [ ] Deployment successful
- [ ] Application tested after update

---

## 🐛 Troubleshooting Checklist

### If Application Not Working

**Backend Issues:**
- [ ] Backend service running? (Check Render/Railway dashboard)
- [ ] Backend logs checked? (Any errors?)
- [ ] Database connection working? (Check `DATABASE_URL`)
- [ ] Environment variables correct?
- [ ] Port configured correctly?

**Frontend Issues:**
- [ ] Frontend service running? (Check Render/Railway dashboard)
- [ ] Frontend build successful? (Check build logs)
- [ ] `VITE_API_BASE_URL` correct? (Should point to backend)
- [ ] Browser console checked? (Any errors?)
- [ ] Network requests working? (Check Network tab)

**Database Issues:**
- [ ] Database service running?
- [ ] Migrations run successfully?
- [ ] Connection string correct?
- [ ] Database accessible?

**CORS Issues:**
- [ ] `ALLOWED_ORIGINS` includes frontend URL?
- [ ] URLs match exactly (https vs http)?
- [ ] Backend redeployed after CORS change?

---

## 📱 Shareable Link Checklist

- [ ] Frontend URL works
- [ ] Can share link with others
- [ ] Link accessible on mobile
- [ ] Link accessible on laptop/desktop
- [ ] Application loads correctly for others
- [ ] All features work for others

---

## 🎉 Success Criteria

Your deployment is successful when:
- ✅ Frontend URL opens without errors
- ✅ Can login and use all features
- ✅ Database operations work correctly
- ✅ Application works on mobile and desktop
- ✅ Can share link with others
- ✅ Future updates deploy automatically

---

## 📞 Need Help?

1. Check **DEPLOYMENT_GUIDE.md** for detailed instructions
2. Check **QUICK_START.md** for quick setup
3. Review Render/Railway logs
4. Check browser console for errors
5. Verify environment variables

---

**Last Updated**: Deployment setup complete! 🚀

