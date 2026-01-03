# AtoZ Inventory Application - पूरी Technical Details

## 📋 Application Overview (एप्लिकेशन अवलोकन)

यह एक **Full-Stack Inventory Management System** है जो बैटरी और charging services के लिए बनाया गया है। यह application **Exide Care** के लिए बनाया गया है।

---

## 🏗️ Architecture (आर्किटेक्चर)

यह application **Client-Server Architecture** पर आधारित है:
- **Frontend**: React.js (Client-side)
- **Backend**: Node.js + Express.js (Server-side)
- **Database**: PostgreSQL (Relational Database)

---

## 💻 Programming Languages (प्रोग्रामिंग भाषाएं)

### Frontend Languages:
1. **JavaScript (ES6+)** - मुख्य programming language
2. **JSX** - React के लिए markup syntax
3. **CSS** - Styling के लिए

### Backend Languages:
1. **JavaScript (Node.js)** - Server-side programming
2. **SQL** - Database queries के लिए

### Scripting Languages:
- **JavaScript** (Node.js environment में)
- **SQL** (Database migrations और queries के लिए)

---

## 🎨 Frontend Technologies (फ्रंटएंड टेक्नोलॉजी)

### Core Framework:
- **React.js v19.2.0** - मुख्य UI framework
- **React DOM v19.2.0** - DOM manipulation के लिए

### Build Tool & Development:
- **Vite v7.2.4** - Build tool और development server
  - Fast HMR (Hot Module Replacement)
  - Modern build system
- **@vitejs/plugin-react v5.1.1** - React support के लिए Vite plugin

### Routing:
- **React Router DOM v7.9.6** - Client-side routing के लिए
  - BrowserRouter
  - Protected Routes (Auth, Admin, Super Admin, Customer)

### UI Libraries & Components:
- **SweetAlert2 v11.26.17** - Beautiful alerts और notifications
- **Recharts v3.5.1** - Charts और graphs के लिए (Dashboard analytics)

### PDF & Printing:
- **jsPDF v3.0.4** - PDF generation के लिए
- **jspdf-autotable v5.0.2** - PDF में tables बनाने के लिए
- **react-to-print v3.2.0** - React components को print करने के लिए

### Additional Libraries:
- **html2canvas** - HTML को image में convert करने के लिए (PDF generation में use होता है)

### Code Quality:
- **ESLint v9.39.1** - Code linting
- **@eslint/js** - ESLint configuration
- **eslint-plugin-react-hooks** - React hooks के लिए linting rules
- **eslint-plugin-react-refresh** - Fast Refresh support

### Type Definitions:
- **@types/react v19.2.5** - TypeScript definitions
- **@types/react-dom v19.2.3** - TypeScript definitions

---

## ⚙️ Backend Technologies (बैकएंड टेक्नोलॉजी)

### Core Framework:
- **Node.js** - JavaScript runtime environment
- **Express.js v5.1.0** - Web application framework
  - RESTful API endpoints
  - Middleware support
  - Route handling

### Database:
- **PostgreSQL** - Relational database management system
- **pg v8.16.3** (node-postgres) - PostgreSQL client for Node.js
  - Connection pooling
  - SQL query execution

### Authentication & Security:
- **jsonwebtoken v9.0.2** - JWT tokens के लिए
- **bcrypt v6.0.0** - Password hashing के लिए
- **cors v2.8.5** - Cross-Origin Resource Sharing

### Environment Configuration:
- **dotenv v17.2.3** - Environment variables management
  - `.env` file से configuration load करता है

### PDF Generation (Server-side):
- **Puppeteer v24.33.0** - Headless Chrome browser automation
  - Invoice PDF generation के लिए use होता है

### Development Tools:
- **nodemon v3.1.11** - Development में automatic server restart

---

## 🗄️ Database (डेटाबेस)

### Database Type:
- **PostgreSQL** - Open-source relational database

### Database Connection:
- Connection string `DATABASE_URL` environment variable से load होता है
- Connection pooling use होता है (performance के लिए)

### Main Database Tables (मुख्य टेबल्स):
1. **users** - User accounts और authentication
2. **products** - Product information
3. **stock** - Inventory stock management
4. **stock_history** - Stock movement history
5. **sales** - Sales transactions
6. **sales_item** - Individual sale items
7. **purchases** - Purchase records
8. **customer_profiles** - Customer information
9. **invoices** - Invoice records
10. **guarantee_warranty** - Warranty और guarantee tracking
11. **battery_replacements** - Battery replacement history
12. **charging_services** - Charging service records
13. **service_requests** - Service request management
14. **company_returns** - Company return records
15. **commission_agents** - Commission agent information
16. **notifications** - System notifications
17. **sales_types_lookup** - Sales type definitions

---

## 🌐 API Structure (API संरचना)

### API Base URL:
- Development: `http://localhost:4000/api`
- Production: Environment variable से configure होता है (`VITE_API_BASE_URL`)

### API Endpoints (मुख्य Endpoints):

#### Authentication (`/api/auth`):
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Current user info

#### Products (`/api/products`):
- `GET /api/products` - Get all products
- `POST /api/products` - Create product

#### Inventory (`/api/inventory`):
- `GET /api/inventory` - Get all inventory
- `GET /api/inventory/:category` - Get category inventory
- `POST /api/inventory/:category/add-stock` - Add stock
- `POST /api/inventory/:category/reduce-stock` - Reduce stock
- `POST /api/inventory/:category/add-stock-with-serials` - Add stock with serial numbers
- `GET /api/inventory/:category/:productId/available-serials` - Get available serials
- `POST /api/inventory/:category/sell-stock` - Sell stock
- `GET /api/inventory/history/ledger` - Stock history
- `GET /api/inventory/stock` - Get stock table
- `GET /api/inventory/sold-batteries` - Get sold batteries
- `GET /api/inventory/customer-history/:customerId` - Customer history

#### Sales (`/api/sales`):
- `POST /api/sales` - Create sale
- `GET /api/sales` - Get sales (paginated)
- `GET /api/sales/:saleId` - Get sale by ID

#### Admin Sales (`/api/admin-sales`):
- `POST /api/admin-sales/sell-stock` - Admin sell stock
- `GET /api/admin-sales/sales-items` - Get sales items

#### Purchases (`/api/purchases`):
- `GET /api/purchases` - Get purchases (with filters)
- `GET /api/purchases/stats` - Get purchase statistics

#### Dashboard (`/api/dashboard`):
- `GET /api/dashboard/overview` - Dashboard overview
- `GET /api/dashboard/sales-analytics` - Sales analytics
- `GET /api/dashboard/inventory-insights` - Inventory insights
- `GET /api/dashboard/services` - Service management
- `GET /api/dashboard/recent-transactions` - Recent transactions
- `GET /api/dashboard/financial` - Financial overview
- `GET /api/dashboard/sales-detail` - Detailed sales

#### Invoices (`/api/invoices`):
- `GET /api/invoices/:invoiceNumber` - Get invoice
- `GET /api/invoices/:invoiceNumber/pdf` - Get invoice PDF

#### Guarantee & Warranty (`/api/guarantee-warranty`):
- `GET /api/guarantee-warranty/battery-status/:serialNumber` - Battery status
- `GET /api/guarantee-warranty/history` - Replacement history
- `GET /api/guarantee-warranty/history/:customerId` - Customer replacement history
- `GET /api/guarantee-warranty/history-all` - All replacement history
- `GET /api/guarantee-warranty/warranty-slabs` - Warranty slabs
- `POST /api/guarantee-warranty/replace` - Create replacement
- `POST /api/guarantee-warranty/check-expiring-guarantees` - Check expiring guarantees

#### Charging Services (`/api/charging-services`):
- `GET /api/charging-services` - Get all charging services
- `GET /api/charging-services/my-services` - Get user's services
- `GET /api/charging-services/:id` - Get service by ID
- `POST /api/charging-services` - Create service
- `PUT /api/charging-services/:id` - Update service
- `PATCH /api/charging-services/:id/status` - Update status
- `DELETE /api/charging-services/:id` - Delete service
- `GET /api/charging-services/stats/overview` - Service statistics

#### Service Requests (`/api/service-requests`):
- `POST /api/service-requests` - Create service request
- `GET /api/service-requests` - Get all service requests (admin)
- `GET /api/service-requests/my` - Get user's service requests
- `PATCH /api/service-requests/:id/status` - Update status

#### Company Returns (`/api/company-returns`):
- `GET /api/company-returns` - Get all returns
- `GET /api/company-returns/:id` - Get return by ID
- `POST /api/company-returns` - Create return
- `PUT /api/company-returns/:id` - Update return
- `GET /api/company-returns/sold-serial-numbers` - Get sold serial numbers
- `GET /api/company-returns/sale-by-serial/:serialNumber` - Get sale by serial

#### Commission Agents (`/api/commission-agents`):
- `GET /api/commission-agents` - Get all agents
- `GET /api/commission-agents/:id` - Get agent by ID
- `POST /api/commission-agents` - Create agent
- `PUT /api/commission-agents/:id` - Update agent
- `GET /api/commission-agents/:id/commission-history` - Get commission history

#### Reports (`/api/reports`):
- `GET /api/reports/sales/category` - Category sales report
- `GET /api/reports/sales/product` - Product sales report
- `GET /api/reports/sales/series` - Series sales report
- `GET /api/reports/sales/customer` - Customer sales report
- `GET /api/reports/sales/customer/b2b` - B2B customer sales
- `GET /api/reports/sales/customer/b2c` - B2C customer sales
- `GET /api/reports/profit/overall` - Profit report
- `GET /api/reports/commission/agent` - Agent commission report
- `GET /api/reports/commission/details` - Commission details
- `GET /api/reports/charging/services` - Charging services report
- `GET /api/reports/charging/customer` - Charging customer report
- `GET /api/reports/summary` - Summary report
- `GET /api/reports/customer/sales/category` - Customer category sales
- `GET /api/reports/customer/sales/product` - Customer product sales
- `GET /api/reports/customer/sales/series` - Customer series sales
- `GET /api/reports/customer/charging/services` - Customer charging services
- `GET /api/reports/customer/summary` - Customer summary
- `GET /api/reports/customer/services` - Customer service requests

#### Notifications (`/api/notifications`):
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `GET /api/notifications/unread-count` - Unread count

#### Admin (`/api/admin`):
- `GET /api/admin/customers` - Get customers
- `GET /api/admin/customers/:id` - Get customer by ID

#### Users (`/api/users`):
- `PUT /api/users/profile` - Update user profile

#### Health Check:
- `GET /api/health` - Server health check

---

## 🔐 Authentication & Authorization (प्रमाणीकरण)

### Authentication Method:
- **JWT (JSON Web Tokens)** - Token-based authentication
- **bcrypt** - Password hashing

### User Roles:
1. **Super Admin (role_id: 1)** - Full system access
2. **Admin (role_id: 2)** - Administrative access
3. **Customer (role_id: 3+)** - Customer access

### Protected Routes:
- **AuthRoute** - सभी authenticated users के लिए
- **AdminRoute** - Admin और Super Admin के लिए
- **SuperAdminRoute** - केवल Super Admin के लिए
- **CustomerRoute** - Customers के लिए

---

## 🎯 Frontend Features (फ्रंटएंड फीचर्स)

### Context API (State Management):
- **AuthContext** - Authentication state
- **LanguageContext** - Multi-language support (Hindi, English, Urdu, Marathi)
- **ThemeContext** - Theme management
- **CartContext** - Shopping cart management

### Pages:
- **SuperAdminDashboardPage** - Super admin dashboard
- **AdminDashboardPage** - Admin dashboard
- **CustomerDashboardPage** - Customer dashboard
- **Login** - Login page
- **ProfilePage** - User profile
- **SettingsPage** - Settings page
- **Invoice** - Invoice display और printing

### Components:
- 57+ components (36 JSX files, 20 CSS files)
- Organized by functionality:
  - Authentication
  - Dashboard
  - Inventory management
  - Sales
  - Purchases
  - Reports
  - Charging services
  - Guarantee/Warranty
  - Company returns
  - Commission agents
  - Notifications

---

## 🖥️ Server Configuration (सर्वर कॉन्फ़िगरेशन)

### Server Port:
- **Default**: Port 4000
- Environment variable `PORT` से configure होता है

### CORS Configuration:
- **Origin**: `http://localhost:5173` (Vite dev server)
- **Credentials**: Enabled

### Scheduled Tasks:
- **Daily Guarantee Check**: हर 24 घंटे में expiring guarantees check करता है
- Automatic notifications generate करता है

---

## 🚀 Localhost Setup (लोकलहोस्ट सेटअप)

### Frontend (Client):
```bash
cd client
npm install
npm run dev
```
- **Port**: 5173 (Vite default)
- **URL**: `http://localhost:5173`

### Backend (Server):
```bash
cd server
npm install
npm run dev  # Development mode (nodemon)
# या
npm start    # Production mode
```
- **Port**: 4000 (default)
- **URL**: `http://localhost:4000`

### Environment Variables Required:
#### Server (.env):
```
DATABASE_URL=postgresql://user:password@localhost:5432/database_name
PORT=4000
JWT_SECRET=your_jwt_secret_key
```

#### Client (.env):
```
VITE_API_BASE_URL=http://localhost:4000/api
```

---

## 📦 Package Managers

- **npm** - Node Package Manager
- **package-lock.json** - Dependency locking

---

## 🔧 Development Tools

### Frontend:
- **Vite** - Fast build tool और dev server
- **ESLint** - Code quality
- **React DevTools** - Browser extension (recommended)

### Backend:
- **nodemon** - Auto-restart on file changes
- **PostgreSQL** - Database server

---

## 📁 Project Structure (प्रोजेक्ट संरचना)

```
atoz-inventory/
├── client/                 # Frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # Context providers
│   │   ├── pages/         # Page components
│   │   ├── routes/        # Route configurations
│   │   ├── translations/  # Multi-language support
│   │   ├── utils/         # Utility functions
│   │   ├── api.js         # API functions
│   │   ├── App.jsx        # Main app component
│   │   └── main.jsx       # Entry point
│   ├── public/            # Static assets
│   ├── dist/              # Build output
│   ├── package.json       # Dependencies
│   └── vite.config.js     # Vite configuration
│
├── server/                 # Backend application
│   ├── routes/            # API route handlers
│   ├── middleware/        # Express middleware
│   ├── services/          # Business logic services
│   ├── migrations/        # Database migrations
│   ├── scripts/           # Utility scripts
│   ├── db.js              # Database connection
│   └── index.js           # Server entry point
│
└── Documentation files     # Various MD files
```

---

## 🌍 Multi-language Support (बहुभाषी सपोर्ट)

### Supported Languages:
1. **English (en.json)**
2. **Hindi (hi.json)**
3. **Urdu (ur.json)**
4. **Marathi (mr.json)**

### Implementation:
- **LanguageContext** - Language switching
- JSON translation files
- Dynamic language loading

---

## 📊 Key Features (मुख्य फीचर्स)

1. **Inventory Management** - Stock tracking और management
2. **Sales Management** - Sales transactions और invoicing
3. **Purchase Management** - Purchase records
4. **Customer Management** - Customer profiles और history
5. **Guarantee & Warranty** - Warranty tracking और replacements
6. **Charging Services** - Battery charging service management
7. **Service Requests** - Service request management
8. **Company Returns** - Return to company management
9. **Commission Agents** - Commission agent management
10. **Reports & Analytics** - Comprehensive reporting system
11. **Notifications** - System notifications
12. **Invoice Generation** - PDF invoice generation
13. **Dashboard** - Analytics और overview

---

## 🔄 API Communication

### Request Format:
- **Method**: RESTful (GET, POST, PUT, PATCH, DELETE)
- **Content-Type**: `application/json`
- **Authentication**: Bearer token (JWT) in Authorization header

### Response Format:
- **Success**: JSON data
- **Error**: JSON error object with message

---

## 📝 Summary (सारांश)

### Tech Stack Summary:
- **Frontend Framework**: React.js 19.2.0
- **Build Tool**: Vite 7.2.4
- **Backend Framework**: Express.js 5.1.0
- **Runtime**: Node.js
- **Database**: PostgreSQL
- **Database Client**: pg (node-postgres) 8.16.3
- **Authentication**: JWT + bcrypt
- **PDF Generation**: Puppeteer (server), jsPDF (client)
- **Charts**: Recharts
- **Routing**: React Router DOM 7.9.6

### Development Environment:
- **Frontend Port**: 5173
- **Backend Port**: 4000
- **Database**: PostgreSQL (port 5432 default)

### Key Libraries:
- **Frontend**: React, React Router, Vite, SweetAlert2, Recharts, jsPDF
- **Backend**: Express, PostgreSQL, JWT, bcrypt, Puppeteer, CORS

---

## 📌 Important Notes (महत्वपूर्ण नोट्स)

1. **Environment Variables**: `.env` files required for both client और server
2. **Database**: PostgreSQL database setup required
3. **Ports**: Frontend (5173) और Backend (4000) दोनों run होने चाहिए
4. **CORS**: Backend में frontend origin configured है
5. **Authentication**: JWT tokens use होते हैं
6. **Scheduled Tasks**: Server में daily guarantee check task है

---

**यह document आपके application की complete technical details provide करता है।**

