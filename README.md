# FRM-BBP

A modern, offline-first manufacturing ERP and operations management platform built with React 19, Vite, Express, and local SQLite (`sql.js`).

---

## Features

- **Dashboard & Operations**: Real-time KPI metrics, stock valuation, turnover, receivables, payables, and liquid assets.
- **Inventory & Masters**: Series, Units, Item Types, Items, Bill of Materials (BOM), and Departments.
- **Manufacturing Workflows**: Inward Entries, Outward Deliveries, Job Work In/Out, Assembly, Stock Journal, and Stock Transfers.
- **Accounts & Finance**: Account Groups, Ledgers, Vouchers (Cash/Bank), and Bank Reconciliation.
- **Reporting Engine**: Comprehensive PDF & Excel exportable reports (Stock Valuation, Item Stock Ledger, Trial Balance, P&L, Balance Sheet, Ageing Receivables/Payables).
- **Branded Payment QR Standees**: Generate, customize, scan, and export high-resolution UPI payment standees (Google Pay, PhonePe, Paytm, BHIM).
- **Granular User Access Control**: Dynamic menu and form visibility toggles per user with real-time drawer synchronization.
- **Progressive Web App (PWA)**: Installable on Windows, macOS, Android, and iOS with local SSL and offline service workers.

---

## Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) (v9 or higher)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Dhyey-19/FRM.git
cd FRM
npm install
```
> **Note**: Running `npm install` automatically initializes a clean local database file (`backend/database/factoryflow.db`) with the complete schema and default system configuration via the `postinstall` hook.

### 2. Configure Environment (Optional)
Copy `.env.example` to `.env` if custom ports or paths are needed:
```bash
copy .env.example .env
```
Default ports:
- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000` (HTTPS: `https://localhost:5443`)

### 3. Start the Application
You can launch the app with either of the following:

**Option A (Using npm):**
```bash
npm start
```
*This starts both the Vite frontend and the Express backend concurrently.*

**Option B (One-Click Launcher for Windows):**
Double-click `RUN_SERVER.bat` in the project root.

---

## Default Login Credentials

A default administrator account is automatically seeded upon first database initialization:

- **Username**: `admin`
- **Password**: `admin123`
- **Role**: `ADMIN` (Full Access)

> You can create additional operators, managers, and accountants under **Administration > User Master**, and customize their drawer access under **Administration > User Access**.

---

## Database Schema & Initialization

The software operates on an embedded, zero-configuration SQLite database (`backend/database/factoryflow.db`) powered by WebAssembly (`sql.js`).

- **Database Schema**: Maintained in [`backend/database/schema.sql`](backend/database/schema.sql).
- **Manual Database Reset**: To recreate a clean database at any time, run:
  ```bash
  npm run db:init
  ```

---

## Project Structure

```
FRM/
├── backend/
│   ├── config/          # Database connection & sql.js wrapper
│   ├── controllers/     # API controllers (auth, items, transactions, payment QR, users)
│   ├── database/        # schema.sql, init-db.js, migrations
│   ├── routes/          # Express API route definitions
│   └── server.js        # Express HTTP & HTTPS server entry point
├── frontend/
│   ├── public/          # PWA icons, manifest.json, sw.js
│   ├── src/
│   │   ├── assets/      # App branding & SVG icons
│   │   ├── components/  # Layout, Sidebar, Auth, Dialogs
│   │   ├── config/      # Menu definitions & versioning
│   │   ├── pages/       # Dashboard, Masters, Entries, Reports, Payment QR, User Access
│   │   └── App.jsx      # React router & core navigation
│   └── vite.config.js   # Vite build configuration
├── scripts/             # Versioning, publish, and SSL cert generators
├── RUN_SERVER.bat       # One-click Windows runner
└── package.json         # Root scripts & workspaces definition
```

---

## License
Proprietary / Private - FRM-BBP.
