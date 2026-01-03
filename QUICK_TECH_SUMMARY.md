# Quick Tech Stack Summary - AtoZ Inventory

## 🎯 Quick Overview

| Category | Technology |
|----------|-----------|
| **Frontend Framework** | React.js v19.2.0 |
| **Build Tool** | Vite v7.2.4 |
| **Backend Framework** | Express.js v5.1.0 |
| **Runtime** | Node.js |
| **Database** | PostgreSQL |
| **Database Client** | pg (node-postgres) v8.16.3 |
| **Authentication** | JWT (jsonwebtoken) + bcrypt |
| **Routing** | React Router DOM v7.9.6 |

---

## 💻 Programming Languages

- **JavaScript (ES6+)** - Frontend और Backend दोनों
- **JSX** - React components
- **SQL** - Database queries
- **CSS** - Styling

---

## 📦 Key Libraries

### Frontend:
- React, React DOM
- React Router DOM
- Vite
- SweetAlert2 (alerts)
- Recharts (charts)
- jsPDF + jspdf-autotable (PDF)
- react-to-print

### Backend:
- Express.js
- PostgreSQL (pg)
- JWT (jsonwebtoken)
- bcrypt (password hashing)
- Puppeteer (PDF generation)
- CORS
- dotenv

---

## 🌐 Ports & URLs

- **Frontend**: `http://localhost:5173` (Vite dev server)
- **Backend API**: `http://localhost:4000` (Express server)
- **Database**: PostgreSQL (default port 5432)

---

## 🚀 Run Commands

### Frontend:
```bash
cd client
npm install
npm run dev
```

### Backend:
```bash
cd server
npm install
npm run dev  # Development (nodemon)
npm start    # Production
```

---

## 🔐 Authentication

- **Method**: JWT Tokens
- **Password Hashing**: bcrypt
- **Roles**: Super Admin (1), Admin (2), Customer (3+)

---

## 📊 Main Features

1. Inventory Management
2. Sales & Invoicing
3. Purchase Management
4. Customer Management
5. Guarantee/Warranty Tracking
6. Charging Services
7. Service Requests
8. Company Returns
9. Commission Agents
10. Reports & Analytics
11. Notifications
12. Multi-language Support (EN, HI, UR, MR)

---

## 🗄️ Database

- **Type**: PostgreSQL (Relational Database)
- **Connection**: Connection pooling via `pg` library
- **Tables**: 17+ main tables (users, products, stock, sales, etc.)

---

## 📡 API

- **Base URL**: `http://localhost:4000/api`
- **Type**: RESTful API
- **Format**: JSON
- **Auth**: Bearer Token (JWT)

---

**Detailed information के लिए `APPLICATION_TECH_STACK_DETAILS.md` देखें।**

