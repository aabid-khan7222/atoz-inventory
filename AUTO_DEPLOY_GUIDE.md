# 🚀 Auto-Deploy Guide

## Option 1: Use Auto-Push Script (Recommended)

### Windows (PowerShell):
```powershell
# Simple push with default message
.\auto-push.ps1

# Push with custom message
.\auto-push.ps1 "Your commit message here"
```

### Linux/Mac:
```bash
# Make script executable (first time only)
chmod +x auto-push.sh

# Simple push with default message
./auto-push.sh

# Push with custom message
./auto-push.sh "Your commit message here"
```

### Using npm script:
```bash
npm run push "Your commit message"
```

---

## Option 2: Enable Render Auto-Deploy (Best Solution)

### Steps:
1. Go to https://dashboard.render.com
2. Click on **"atoz-inventory-frontend"** service
3. Go to **Settings** tab
4. Scroll to **"Auto-Deploy"** section
5. Make sure **"Auto-Deploy"** is **ENABLED**
6. Select **"Yes"** for "Auto-Deploy from GitHub"

### How it works:
- ✅ Every time you push to `main` branch → Render automatically deploys
- ✅ No manual deploy needed
- ✅ Just push your code and wait 2-3 minutes

---

## Option 3: Git Hook (Advanced)

Create `.git/hooks/post-commit`:
```bash
#!/bin/bash
git push origin HEAD:main
```

Make it executable:
```bash
chmod +x .git/hooks/post-commit
```

**Note:** This will auto-push after every commit (use with caution!)

---

## Quick Workflow:

1. **Make changes** in your code
2. **Run auto-push script:**
   ```powershell
   .\auto-push.ps1 "Update dashboard styles"
   ```
3. **Wait 2-3 minutes** for Render to auto-deploy
4. **Refresh** your production URL

---

## Troubleshooting:

### If auto-deploy is not working:
1. Check Render dashboard → Service → Settings → Auto-Deploy is enabled
2. Check GitHub repository is connected to Render
3. Check branch name matches (should be `main`)
4. Check Render logs for errors

### If push fails:
- Make sure you're authenticated with GitHub
- Check internet connection
- Verify you have write access to the repository

