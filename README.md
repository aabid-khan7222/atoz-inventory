# 🔋 A TO Z Inventory Management System

Complete inventory management system for battery business with sales, purchases, stock management, customer management, and reporting features.

## ✨ Features

- 📦 **Inventory Management** - Stock tracking, serial number management
- 💰 **Sales & Purchases** - Complete sales and purchase order system
- 👥 **Customer Management** - B2B and B2C customer profiles
- 📊 **Dashboard & Reports** - Analytics, sales reports, profit reports
- 🔔 **Notifications** - Real-time notifications for important events
- 🛡️ **Guarantee & Warranty** - Battery replacement and warranty tracking
- ⚡ **Charging Services** - Battery charging service management
- 👨‍💼 **Employee Management** - Employee attendance and payment tracking
- 📱 **Responsive Design** - Works on mobile, tablet, and desktop

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Local Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/atoz-inventory.git
cd atoz-inventory
```

2. **Setup Backend**
```bash
cd server
# Copy environment template
copy env.template .env  # Windows
# cp env.template .env   # Linux/Mac

# Edit .env file and update DATABASE_URL
# Install dependencies
npm install
```

3. **Setup Frontend**
```bash
cd client
# Copy environment template
copy env.template .env  # Windows
# cp env.template .env   # Linux/Mac

# Install dependencies
npm install
```

4. **Setup Database**
```sql
CREATE DATABASE atoz_inventory;
```

5. **Run Database Migrations**
```bash
cd server
# Run all migration files in migrations/ folder
psql "postgresql://username:password@localhost:5432/atoz_inventory" -f migrations/create_stock_table.sql
# ... run other migrations
```

6. **Start Development Servers**

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```
Backend runs on `http://localhost:4000`

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```
Frontend runs on `http://localhost:5173`

7. **Open Application**
Open browser: `http://localhost:5173`

---

## 📦 Deployment

### Deploy to Production (Shareable Link)

Detailed deployment guide: **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**

Quick steps:
1. Push code to GitHub
2. Deploy to Render.com or Railway.app
3. Setup PostgreSQL database
4. Configure environment variables
5. Get your shareable link!

**Recommended Platforms:**
- 🟢 **Render.com** (Free tier available) - Easiest option
- 🟡 **Railway.app** (Free tier available) - Good alternative
- 🔵 **Vercel** (Frontend only) + **Railway** (Backend)

---

## 🏗️ Project Structure

```
atoz-inventory/
├── client/                 # React Frontend (Vite)
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   ├── routes/         # Route configurations
│   │   └── api.js          # API client
│   ├── public/             # Static assets
│   └── dist/               # Build output
│
├── server/                 # Express Backend
│   ├── routes/             # API routes
│   ├── middleware/         # Express middleware
│   ├── migrations/         # Database migrations
│   ├── services/           # Business logic services
│   ├── scripts/            # Utility scripts
│   └── index.js            # Server entry point
│
├── DEPLOYMENT_GUIDE.md     # Detailed deployment instructions
├── QUICK_START.md          # Quick setup guide
└── README.md               # This file
```

---

## 🔧 Environment Variables

### Backend (`server/.env`)

```env
DATABASE_URL=postgresql://username:password@localhost:5432/atoz_inventory
PORT=4000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
JWT_SECRET=your-secret-key
```

### Frontend (`client/.env`)

```env
VITE_API_BASE_URL=http://localhost:4000/api
```

**For Production:**
- Backend: Set `ALLOWED_ORIGINS` to your frontend URL
- Frontend: Set `VITE_API_BASE_URL` to your backend URL

---

## 📚 API Documentation

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create product

### Inventory
- `GET /api/inventory` - Get inventory
- `POST /api/inventory/:category/add-stock` - Add stock
- `POST /api/inventory/:category/sell-stock` - Sell stock

### Sales
- `GET /api/sales` - Get sales
- `POST /api/sales` - Create sale

### Dashboard
- `GET /api/dashboard/overview` - Dashboard overview
- `GET /api/dashboard/sales-analytics` - Sales analytics

See individual route files for complete API documentation.

---

## 🗄️ Database

PostgreSQL database with the following main tables:
- `users` - User accounts
- `products` - Product catalog
- `stock` - Stock inventory
- `sales` - Sales records
- `sales_item` - Sales line items
- `purchases` - Purchase records
- `customer_profiles` - Customer information
- `notifications` - User notifications
- And more...

See `server/migrations/` for database schema.

---

## 🛠️ Development

### Running Tests
```bash
# Backend tests (if available)
cd server
npm test

# Frontend tests (if available)
cd client
npm test
```

### Building for Production
```bash
# Build frontend
cd client
npm run build

# Start production server
cd server
npm start
```

---

## 📝 Scripts

### Backend
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

---

## 🔐 Security

- JWT-based authentication
- Password hashing with bcrypt
- CORS protection
- Environment variable protection
- SQL injection protection (parameterized queries)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📄 License

ISC

---

## 👨‍💻 Author

A TO Z Inventory Management System

---

## 🆘 Support

For issues and questions:
1. Check [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for deployment help
2. Check [QUICK_START.md](./QUICK_START.md) for setup help
3. Review logs in Render/Railway dashboard
4. Check browser console for frontend errors

---

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced reporting features
- [ ] Multi-language support
- [ ] Email notifications
- [ ] SMS integration
- [ ] Barcode scanning

---

## ✅ Status

✅ **Production Ready** - Application is fully functional and ready for deployment!

---

**Made with ❤️ for A TO Z Inventory**

