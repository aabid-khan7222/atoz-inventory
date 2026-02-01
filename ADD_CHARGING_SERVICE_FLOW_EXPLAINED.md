# Add Charging Service Flow (atoz-inventory) — Sirf Flow

Admin ya Super Admin **Charging Services** section mein **+ New Service** dabake naya charging service create karte waqt ye flow chalta hai.

---

## Frontend

| | |
|---|---|
| **Frontend kaha call hota hai** | User **Admin / Super Admin** dashboard → **Charging** section → **ChargingServices**. **+ New Service** dabata hai → form dikhta hai. Customer select (ya manual name/mobile/email), battery serial, vehicle, battery brand/SKU/Ah, condition, service price, expected completion (date + time), notes bharke **submit** dabata hai → **`handleSubmit`** run hota hai |
| **Frontend kise call karta hai** | **`ChargingServices.jsx`** → **`createChargingService(submitData)`** (api.js) |
| **Frontend mein kya call hota hai** | **`handleSubmit`** — **submitData** banata hai: `batterySerialNumber`, `customerName`, `customerEmail`, `customerMobileNumber`, `vehicleNumber`, `batteryBrand`, `batterySku`, `batteryAmpereRating`, `batteryCondition`, `servicePrice`, `expectedCompletionTime` (formatted date + timeOfDay), `notes`, `customerId` (agar existing customer select kiya). **`createChargingService(submitData)`** call karta hai |

**Flow:** Dashboard → Charging Services → + New Service → form → handleSubmit → createChargingService

---

## API (api.js)

| | |
|---|---|
| **API kaha call hota hai** | **ChargingServices** ka **handleSubmit** API ko call karta hai |
| **API kise call karta hai** | **`api.js`** ka **`createChargingService`** → **`request('/charging-services', { method: 'POST', body: JSON.stringify(serviceData) })`** → **`fetch`** **POST /api/charging-services** → **Backend** |
| **API mein kya call hota hai** | **`request('/charging-services', { method: 'POST', body: JSON.stringify(serviceData) })`** — Bearer token ke sath **POST /api/charging-services** |

**Flow:** ChargingServices → createChargingService → request → fetch POST /api/charging-services → Backend

---

## Backend

| | |
|---|---|
| **Backend kaha call hota hai** | **Frontend** ka **fetch** **POST /api/charging-services** hit karta hai |
| **Backend kise call karta hai** | **`server/routes/chargingServices.js`** → **`router.post('/', requireAuth, requireSuperAdminOrAdmin, ...)`** → **DB** (`client.query` transaction ke andar) |
| **Backend mein kya call hota hai** | **POST /api/charging-services** handler: validate (batterySerialNumber, customerName, customerMobileNumber, batteryCondition, servicePrice, expectedCompletionTime). **customerId** diya hai to **users** se verify; nahi to **findOrCreateCustomer** (email/mobile/name). Optional **charging_services** columns check (customer_email, battery_brand). **charging_services** mein **INSERT**. Transaction **COMMIT** → **201** + **`{ success, service, customer, message }`** |

**Flow:** Request → auth + requireSuperAdminOrAdmin → validate → customer resolve (existing / findOrCreate) → charging_services INSERT → COMMIT → 201 response

---

## DB

| | |
|---|---|
| **DB kaha call hota hai** | **Backend** (**chargingServices.js** POST /) **transaction** ke andar DB ko call karta hai |
| **DB kise call karta hai** | Koi nahi — DB last. Backend **`client.query`** se queries chalaata hai |
| **DB mein kya call hota hai** | **`users`**: **SELECT** (existing customer verify) ya **findOrCreateCustomer** — **SELECT** by email/phone, phir **INSERT** (new user) + **`customer_profiles`** **INSERT** agar zarurat ho. **`information_schema`**: **charging_services** columns (customer_email, battery_brand) check. **`charging_services`**: **INSERT** (battery_serial_number, customer_name, customer_mobile_number, vehicle_number, battery_sku, battery_ampere_rating, battery_condition, service_price, expected_completion_time, notes, created_by; optional: customer_email, battery_brand) |

**Flow:** Backend transaction → users (± customer_profiles) → charging_services INSERT

---

## Ek line flow

```
Admin/Super Admin (Charging Services → + New Service → form submit)
  → Frontend (ChargingServices handleSubmit → createChargingService)
    → API (request → fetch POST /api/charging-services)
      → Backend (chargingServices.js POST /)
        → DB (users, customer_profiles, charging_services)
      ← Backend (201 + { success, service, customer })
    ← API (response)
  ← Frontend (form close, reset, loadServices, loadStats)
```

---

*Sirf Add Charging Service flow. Admin/Super Admin → Charging Services → + New Service.*
