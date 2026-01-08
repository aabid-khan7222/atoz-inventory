# 🔧 Fix: Init Endpoint Call

## Problem
You called `/api/init` which is a **relative URL**, so it's hitting the **frontend** instead of the **backend**.

## Solution
Use the **FULL BACKEND URL** instead.

---

## ✅ Correct Code (Copy This)

Open browser console (F12) and run:

```javascript
fetch('https://atoz-backend-qq3k.onrender.com/api/init', { 
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ INIT RESPONSE:', data);
    if (data.success) {
      alert('✅ Database initialized!\nEmail: ' + data.admin.email + '\nPassword: ' + data.admin.password);
    }
  })
  .catch(err => console.error('❌ INIT ERROR:', err));
```

---

## 🔍 What Was Wrong?

**❌ Wrong (Relative URL):**
```javascript
fetch("/api/init")  // Hits: https://atoz-frontend.onrender.com/api/init
```

**✅ Correct (Full Backend URL):**
```javascript
fetch('https://atoz-backend-qq3k.onrender.com/api/init', { method: 'POST' })
// Hits: https://atoz-backend-qq3k.onrender.com/api/init
```

---

## 📋 Steps

1. **Open Frontend:** https://atoz-frontend.onrender.com
2. **Press F12** (Developer Tools)
3. **Go to Console tab**
4. **Copy the CORRECT code above** (with full backend URL)
5. **Paste and press Enter**
6. **Wait for success message**

---

## Expected Response

```json
{
  "success": true,
  "message": "Database initialized successfully",
  "admin": {
    "email": "admin@atozinventory.com",
    "password": "admin123",
    "note": "Please change password after first login"
  }
}
```

---

**Ab correct URL ke saath try karo! 🚀**

