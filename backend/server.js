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
const paymentQrRoutes = require('./routes/paymentQrRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const performaInvoiceRoutes = require('./routes/performaInvoiceRoutes');
const einvoiceRoutes = require('./routes/einvoiceRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const systemRoutes = require('./routes/systemRoutes');

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
app.use('/api/payment-qr', paymentQrRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/performa-invoices', performaInvoiceRoutes);
app.use('/api/einvoice', einvoiceRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/system', systemRoutes);

// Test Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running normally' });
});

// Serve static frontend files (PWA build) from public or frontend/dist
const fs = require('fs');
const https = require('https');
const candidateDistPaths = [
  path.resolve(__dirname, '../public'),
  path.resolve(__dirname, '../frontend/dist'),
  path.resolve(__dirname, 'public')
];
let frontendDistPath = null;
for (const p of candidateDistPaths) {
  if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
    frontendDistPath = p;
    break;
  }
}

if (frontendDistPath) {
  app.use(express.static(frontendDistPath));
  // Single-page application route fallback (Express 5 compatible)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(frontendDistPath, 'index.html'));
    }
    next();
  });
}

// Initialize Server and Database
const startServer = async () => {
  await connectDB(); // Ensure DB connects before starting server
  
  // 1. Bind HTTP (supports TCP port and cPanel Passenger pipe/socket on GoDaddy)
  const isPipeOrSocket = process.env.PORT && isNaN(Number(process.env.PORT));
  let httpServer;
  if (isPipeOrSocket) {
    httpServer = app.listen(process.env.PORT, () => {
      console.log(`[Server] Listening on Passenger pipe/socket: ${process.env.PORT}`);
    });
  } else {
    const listenPort = Number(PORT) || 5000;
    httpServer = app.listen(listenPort, '0.0.0.0', () => {
      console.log('\n=====================================================================');
      console.log('           FRM (Factory Resource Manager) SERVER IS RUNNING          ');
      console.log('=====================================================================');
      console.log(`  This Server PC:                 http://localhost:${listenPort}`);

      try {
        const os = require('os');
        const nets = os.networkInterfaces();
        for (const name of Object.keys(nets)) {
          for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
              const isTailscale = name.toLowerCase().includes('tailscale') || net.address.startsWith('100.');
              const label = isTailscale ? 'Mobile Remote (Tailscale):   ' : 'Other Laptops & Mobile (Wi-Fi):';
              console.log(`  ${label}   http://${net.address}:${listenPort}`);
            }
          }
        }
      } catch (e) {}

      console.log('=====================================================================\n');
    });
  }
  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server] Warning: Port ${PORT} is already in use by another running instance.`);
    } else {
      console.error('[Server] HTTP error:', err.message);
    }
  });

  // 2. If SSL certificates exist, also launch HTTPS on HTTPS_PORT (5443) for PWA mobile installation
  const certDir = path.resolve(__dirname, 'certs');
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    try {
      const credentials = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
      const httpsPort = process.env.HTTPS_PORT || 5443;
      const httpsServer = https.createServer(credentials, app);
      httpsServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[Server] Notice: HTTPS Port ${httpsPort} is already bound by another instance.`);
        } else {
          console.error('[Server] HTTPS error:', err.message);
        }
      });
      httpsServer.listen(httpsPort, '0.0.0.0', () => {
        console.log(`[Server] Secure HTTPS running on https://0.0.0.0:${httpsPort} (PWA Install Ready)`);
      });
    } catch (err) {
      console.warn('[Server] Could not start HTTPS listener:', err.message);
    }
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    try {
      const pool = await connectDB();
      await pool.close();
      console.log('Local Database connection closed successfully.');
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
