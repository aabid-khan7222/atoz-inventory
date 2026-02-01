# Customer Book Service Flow (atoz-inventory) — Sirf Flow

Customer **Services** section mein jaake **Book Service** karte waqt ye flow chalta hai.

---

## Frontend

| | |
|---|---|
| **Frontend kaha call hota hai** | Customer **Dashboard** → **Services** → **CustomerServices**. **Book Service** button dabata hai → form dikhta hai. Service type, vehicle/inverter details, notes bharke **Book Service** submit dabata hai → **`handleSubmit`** run hota hai |
| **Frontend kise call karta hai** | **`CustomerServices.jsx`** → **`createServiceRequest(payload)`** (api.js) |
| **Frontend mein kya call hota hai** | **`handleSubmit`** — **payload** banata hai: `serviceType` (battery_testing / jump_start / inverter_repair / inverter_battery), `vehicleName`, `fuelType`, `vehicleNumber` (battery_testing / jump_start ke liye), `inverterVa`, `inverterVoltage` (inverter_repair ke liye), `batteryAmpereRating` (inverter_battery ke liye), `notes`. **`createServiceRequest(payload)`** call karta hai |

**Flow:** Dashboard → Services → Book Service button → form → handleSubmit → createServiceRequest

---

## API (api.js)

| | |
|---|---|
| **API kaha call hota hai** | **CustomerServices** ka **handleSubmit** API ko call karta hai |
| **API kise call karta hai** | **`api.js`** ka **`createServiceRequest`** → **`request('/service-requests', { method: 'POST', body: JSON.stringify(payload) })`** → **`fetch`** **POST /api/service-requests** → **Backend** |
| **API mein kya call hota hai** | **`request('/service-requests', { method: 'POST', body: JSON.stringify(payload) })`** — Bearer token ke sath **POST /api/service-requests** |

**Flow:** CustomerServices → createServiceRequest → request → fetch POST /api/service-requests → Backend

---

## Backend

| | |
|---|---|
| **Backend kaha call hota hai** | **Frontend** ka **fetch** **POST /api/service-requests** hit karta hai |
| **Backend kise call karta hai** | **`server/routes/serviceRequests.js`** → **`router.post('/', requireAuth, ...)`** → **DB** (`db.query`) + **createNotification** |
| **Backend mein kya call hota hai** | **POST /api/service-requests** handler: validate **serviceType** (battery_testing, jump_start, inverter_repair, inverter_battery). Per-type validation (vehicle vs inverter fields). **getCustomerContact** (req.user.id) se customer name/phone/email. **service_requests** mein **INSERT** (user_id, customer_name, customer_phone, customer_email, service_type, vehicle_name, fuel_type, vehicle_number, inverter_va, inverter_voltage, battery_ampere_rating, notes, **status = 'requested'**). **createNotification** — admins/super-admins ko "New Service Request" notify. **201** + **`{ success, service }`** return |

**Flow:** Request → auth → validate → getCustomerContact → service_requests INSERT → createNotification → 201 response

---

## DB

| | |
|---|---|
| **DB kaha call hota hai** | **Backend** (**serviceRequests.js** POST /) DB ko call karta hai |
| **DB kise call karta hai** | Koi nahi — DB last. Backend **`db.query`** se queries chalaata hai |
| **DB mein kya call hota hai** | **`users`**: **SELECT** (id, full_name, phone, email) — **getCustomerContact** ke liye. **`service_requests`**: **INSERT** (user_id, customer_name, customer_phone, customer_email, service_type, vehicle_name, fuel_type, vehicle_number, inverter_va, inverter_voltage, battery_ampere_rating, notes, status **'requested'**). **`users`** (admins **SELECT**) + **`notifications`** (**createNotification** ke through **INSERT**) — admins ko new service request ki notification |

**Flow:** Backend → users SELECT (customer) → service_requests INSERT → users SELECT (admins) → notifications INSERT

---

## Ek line flow

```
Customer (Services → Book Service → form submit)
  → Frontend (CustomerServices handleSubmit → createServiceRequest)
    → API (request → fetch POST /api/service-requests)
      → Backend (serviceRequests.js POST /)
        → DB (users, service_requests, notifications)
      ← Backend (201 + { success, service })
    ← API (response)
  ← Frontend (success message, form reset, loadHistory)
```

---

*Sirf Customer Book Service flow. Customer UI → Services → Book Service.*
