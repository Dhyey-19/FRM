const path = require('path');
const dotenv = require('dotenv');

// The .env file is packed into the ASAR archive alongside the source code.
const envPath = path.resolve(__dirname, '../.env');

dotenv.config({ path: envPath });
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const assetRoutes = require('./routes/assetRoutes');
const brandRoutes = require('./routes/brandRoutes');
const itemRoutes = require('./routes/itemRoutes');
const unitRoutes = require('./routes/unitRoutes');
const bomRoutes = require('./routes/bomRoutes');
const accountGroupRoutes = require('./routes/accountGroupRoutes');
const ledgerRoutes = require('./routes/ledgerRoutes');
const voucherRoutes = require('./routes/voucherRoutes');
const inwardRoutes = require('./routes/inwardRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const stockTransferRoutes = require('./routes/stockTransferRoutes');
const itemTypeRoutes = require('./routes/itemTypeRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const assemblyRoutes = require('./routes/assemblyRoutes');
const stockJournalRoutes = require('./routes/stockJournalRoutes');
const outwardRoutes = require('./routes/outwardRoutes');
const companyProfileRoutes = require('./routes/companyProfileRoutes');
const jobworkOutRoutes = require('./routes/jobworkOutRoutes');
const jobworkInRoutes = require('./routes/jobworkInRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Parse JSON bodies
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global Authorization Middleware
const authMiddleware = require('./middlewares/authMiddleware');
app.use('/api', authMiddleware);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/bom', bomRoutes);
app.use('/api/account-groups', accountGroupRoutes);
app.use('/api/ledgers', ledgerRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/inwards', inwardRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/stock-transfers', stockTransferRoutes);
app.use('/api/item-types', itemTypeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/assembly', assemblyRoutes);
app.use('/api/stock-journal', stockJournalRoutes);
app.use('/api/outwards', outwardRoutes);
app.use('/api/company-profile', companyProfileRoutes);
app.use('/api/jobwork-outs', jobworkOutRoutes);
app.use('/api/jobwork-ins', jobworkInRoutes);

// Test Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running normally' });
});

// Initialize Server and Database
const startServer = async () => {
  await connectDB(); // Ensure DB connects before starting server
  // Bind strictly to localhost to prevent Windows Firewall permission popups
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    try {
      const pool = await connectDB();
      await pool.close();
      console.log('Azure SQL Database connection closed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('Error closing database connection:', err);
      process.exit(1);
    }
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { startServer, app };
