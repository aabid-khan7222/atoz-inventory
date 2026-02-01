# Login Flow (atoz-inventory) — Sirf Flow

---

## Frontend

| | |
|---|---|
| **Frontend kaha call hota hai** | User `/login` pe jaata hai → form submit → **`Login.jsx`** ka **`handleSubmit`** run hota hai |
| **Frontend kise call karta hai** | **`Login.jsx`** → **`AuthContext`** ka **`login(email, password)`** |
| **Frontend mein kya call hota hai** | **`login(email, password)`** — AuthContext se, form se email/password pass hota hai |

**Flow:** User Login click → `handleSubmit` → `useAuth().login(email, password)` (AuthContext)

---

## API (api.js)

| | |
|---|---|
| **API kaha call hota hai** | **AuthContext** ka **`login`** API ko call karta hai |
| **API kise call karta hai** | **`api.js`** ka **`login`** → **`request("/auth/login", ...)`** → **`fetch`** se **Backend** (**POST /api/auth/login**) |
| **API mein kya call hota hai** | **`request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })`** — ye `fetch` karta hai backend pe |

**Flow:** AuthContext `login` → `api.js` `login` → `request` → `fetch` → Backend

---

## Backend

| | |
|---|---|
| **Backend kaha call hota hai** | **Frontend** ka **`fetch`** (**POST /api/auth/login**) backend route ko hit karta hai |
| **Backend kise call karta hai** | **`server/routes/auth.js`** → **`router.post("/login", ...)`** → **DB** (`db.query` — users, roles, customer_profiles) |
| **Backend mein kya call hota hai** | **`POST /api/auth/login`** handler — email/password validate, user fetch, password check, JWT banake **`{ user, token }`** response |

**Flow:** Request aata hai → `auth.js` login route → DB query → user verify → JWT + user return

---

## DB

| | |
|---|---|
| **DB kaha call hota hai** | **Backend** (**auth.js** login handler) DB ko call karta hai |
| **DB kise call karta hai** | Koi nahi — DB last hai. Backend **`db.query`** se DB mein query chalaata hai |
| **DB mein kya call hota hai** | **`users`** (+ **`roles`** JOIN) — `WHERE LOWER(email) = $1`. Baad mein optional **`customer_profiles`** fetch |

**Flow:** Backend `db.query` → users table (email se user) → password backend pe check (DB se sirf read)

---

## Ek line flow

```
User (Login click) → Frontend (Login.jsx → AuthContext login)
  → API (api.js request → fetch POST /api/auth/login)
    → Backend (auth.js POST /login)
      → DB (users + roles)
    ← Backend (user + JWT)
  ← API (response)
← Frontend (user/token store, redirect)
```

---

*Sirf login flow. Koi extra detail nahi.*
