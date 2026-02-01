# Create Account Flow (atoz-inventory) — Sirf Flow

Koi bhi user **Login** page se **Create New Account** karke naya account banata hai. Ye flow sirf **signup** (account creation) ka hai.

---

## Frontend

| | |
|---|---|
| **Frontend kaha call hota hai** | User **Login** page pe jaata hai → **Create New Account** link dabata hai → **`/signup`** → **Signup** component. Form bharke (name, mobile, email, state, city, pincode, address, has GST, GST/company agar GST hai, password, confirm password) **Create Account** dabata hai → **`handleSubmit`** run hota hai |
| **Frontend kise call karta hai** | **`Signup.jsx`** → **`createSignup(formData)`** (api.js) |
| **Frontend mein kya call hota hai** | **`handleSubmit`** — **validateForm** (required fields, email format, password match, GST fields agar has_gst). **formData** = full_name, mobile_number, email, state, city, city_pincode, address, has_gst, gst_number, company_name, company_address, password, confirm_password. **`createSignup(formData)`** call karta hai. Success pe **Swal** + **navigate('/login')** |

**Flow:** Login page → Create New Account → /signup → Signup form → handleSubmit → createSignup

---

## API (api.js)

| | |
|---|---|
| **API kaha call hota hai** | **Signup** ka **handleSubmit** API ko call karta hai |
| **API kise call karta hai** | **`api.js`** ka **`createSignup`** → **`request("/auth/signup/create", { method: "POST", body: JSON.stringify(signupData) })`** → **`fetch`** **POST /api/auth/signup/create** → **Backend** |
| **API mein kya call hota hai** | **`request("/auth/signup/create", { method: "POST", body: JSON.stringify(signupData) })`** — signup public hai, **Bearer token nahi** bhejta. Sirf **Content-Type: application/json** + body |

**Flow:** Signup → createSignup → request → fetch POST /api/auth/signup/create → Backend

---

## Backend

| | |
|---|---|
| **Backend kaha call hota hai** | **Frontend** ka **fetch** **POST /api/auth/signup/create** hit karta hai |
| **Backend kise call karta hai** | **`server/routes/auth.js`** → **`router.post("/signup/create", ...)`** → **DB** (`db.query`, transaction **client**) |
| **Backend mein kya call hota hai** | **POST /api/auth/signup/create** handler: validate (required fields, email format, password match, min 6 chars, GST fields agar has_gst). **users** mein email check — agar **pehle se hai** → **400 "Email already registered"**. **roles** se **customer** **role_id** lo. **bcrypt** se password **hash**. Transaction **BEGIN** → **users** **INSERT** (full_name, email, phone, password hash, role_id, is_active, state, city, address) → **customer_profiles** **INSERT** (user_id, full_name, email, phone, state, city, address, pincode, is_business_customer, company_name, gst_number, company_address) **ON CONFLICT DO UPDATE** → **COMMIT** → **201** + **`{ success, message, user }`** |

**Flow:** Request → validate → existing-user check → roles → bcrypt → transaction → users INSERT → customer_profiles INSERT → COMMIT → 201 response

---

## DB

| | |
|---|---|
| **DB kaha call hota hai** | **Backend** (**auth.js** signup/create handler) DB ko call karta hai |
| **DB kise call karta hai** | Koi nahi — DB last. Backend **`db.query`** / transaction **client** se queries chalaata hai |
| **DB mein kya call hota hai** | **`users`**: **SELECT** (LOWER(email) = $1) — existing check. **`roles`**: **SELECT** (role_name = 'customer') → **role_id**. **`users`**: **INSERT** (full_name, email, phone, **hashed password**, role_id, is_active, state, city, address). **`information_schema`**: **customer_profiles** me **pincode** column hai ya nahi. **`customer_profiles`**: **INSERT** (user_id, full_name, email, phone, state, city, address, pincode, is_business_customer, company_name, gst_number, company_address) **ON CONFLICT (user_id) DO UPDATE** |

**Flow:** Backend → users SELECT → roles SELECT → users INSERT → customer_profiles INSERT

---

## Ek line flow

```
User (Login page → Create New Account → /signup → form submit)
  → Frontend (Signup handleSubmit → createSignup)
    → API (request → fetch POST /api/auth/signup/create, no token)
      → Backend (auth.js POST /signup/create)
        → DB (users, roles, customer_profiles)
      ← Backend (201 + { success, message, user })
    ← API (response)
  ← Frontend (Swal success → navigate /login)
```

---

*Sirf Create Account flow. Login page → Create New Account → Signup → account ban gaya, phir user login page pe jaake login karta hai.*
