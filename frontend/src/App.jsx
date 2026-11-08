import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import RegistrationPage from './components/RegistrationPage';
import SignupPage from './components/SignupPage';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import UserMaster from './pages/UserMaster';
import AssetMaster from './pages/AssetMaster';
import BrandMaster from './pages/BrandMaster';
import ItemMaster from './pages/ItemMaster';
import UnitMaster from './pages/UnitMaster';
import DepartmentMaster from './pages/DepartmentMaster';
import BOMMaster from './pages/BOMMaster';
import ItemTypeMaster from './pages/ItemTypeMaster';
import AccountGroupMaster from './pages/AccountGroupMaster';
import CompanyProfile from './pages/CompanyProfile';
import PaymentQR from './pages/PaymentQR';
import UserAccess from './pages/UserAccess';
import LedgerMaster from './pages/LedgerMaster';
import VoucherEntry from './pages/VoucherEntry';
import BankReconciliation from './pages/BankReconciliation';
import InwardEntry from './pages/InwardEntry';
import OutwardEntry from './pages/OutwardEntry';
import PurchaseOrder from './pages/PurchaseOrder';
import PerformaInvoice from './pages/PerformaInvoice';
import StockTransfer from './pages/StockTransfer';
import Assembly from './pages/Assembly';
import StockJournal from './pages/StockJournal';
import Subcontract from './pages/Subcontract';
import JobworkOutEntry from './pages/JobworkOutEntry';
import JobworkInEntry from './pages/JobworkInEntry';
import BrandReport from './pages/reports/BrandReport';
import ItemReport from './pages/reports/ItemReport';
import PriceReport from './pages/reports/PriceReport';
import BOMReport from './pages/reports/BOMReport';
import AccountLedgerReport from './pages/reports/AccountLedgerReport';
import StockReport from './pages/reports/StockReport';
import AssemblyReport from './pages/reports/AssemblyReport';
import StockJournalReport from './pages/reports/StockJournalReport';
import InwardReport from './pages/reports/InwardReport';
import OutwardReport from './pages/reports/OutwardReport';
import ItemwiseOutwardReport from './pages/reports/ItemwiseOutwardReport';
import PayableReport from './pages/reports/PayableReport';
import ReceivableReport from './pages/reports/ReceivableReport';
import ProfitLossReport from './pages/reports/ProfitLossReport';
import BalanceSheetReport from './pages/reports/BalanceSheetReport';
import TrialBalanceReport from './pages/reports/TrialBalanceReport';
import InvoiceWisePayableReport from './pages/reports/InvoiceWisePayableReport';
import InvoiceWiseReceivableReport from './pages/reports/InvoiceWiseReceivableReport';
import JobworkOutReport from './pages/reports/JobworkOutReport';
import JobworkInReport from './pages/reports/JobworkInReport';
import JobworkMovementReport from './pages/reports/JobworkMovementReport';
import ItemStockLedgerReport from './pages/reports/ItemStockLedgerReport';
import PendingPOReport from './pages/reports/PendingPOReport';
import NotificationLogs from './pages/NotificationLogs';
import AttendanceManager from './pages/AttendanceManager';
import ErrorBoundary from './components/common/ErrorBoundary';
function AuthApp() {
  const [currentPage, setCurrentPage] = useState('login');
  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (user) {
      navigate('/dashboard');
    }
  }, [navigate]);

  return (
    <div className="auth-container">
      {currentPage === 'login' ? (
        <LoginPage onNavigate={setCurrentPage} />
      ) : (
        <SignupPage onNavigate={setCurrentPage} />
      )}
    </div>
  );
}

function App() {
  const [isRegistered, setIsRegistered] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/registration-status`)
      .then(res => res.json())
      .then(data => {
        setIsRegistered(data.isRegistered === true);
      })
      .catch(err => {
        console.error('Failed to check registration status, falling back to local:', err);
        setIsRegistered(localStorage.getItem('isAppRegistered') === 'true');
      });
  }, []);

  if (isRegistered === null) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc',
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #0f3b66',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }}></div>
        <div style={{ color: '#64748b', fontSize: '15px', fontWeight: '500' }}>Loading configuration...</div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isRegistered) {
    return <RegistrationPage onRegisterSuccess={() => setIsRegistered(true)} />;
  }

  return (
    <Router>
      <ErrorBoundary>
        <Routes>
          {/* Auth Route */}
          <Route path="/" element={<AuthApp />} />
          
          {/* Dashboard Routes wrapped in the new Layout */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="logs" element={<NotificationLogs />} />
            <Route path="notifications" element={<NotificationLogs />} />
            <Route path="company-profile" element={<CompanyProfile />} />
            <Route path="payment-qr" element={<PaymentQR />} />
            <Route path="users" element={<UserMaster />} />
            <Route path="user-access" element={<UserAccess />} />
            <Route path="assets" element={<AssetMaster />} />
            <Route path="brands" element={<BrandMaster />} />
            <Route path="units" element={<UnitMaster />} />
            <Route path="departments" element={<DepartmentMaster />} />
            <Route path="item-types" element={<ItemTypeMaster />} />
            <Route path="items" element={<ItemMaster />} />
            <Route path="bom" element={<BOMMaster />} />
            <Route path="account-groups" element={<AccountGroupMaster />} />
            <Route path="ledgers" element={<LedgerMaster />} />
            <Route path="vouchers" element={<VoucherEntry />} />
            <Route path="bank-reconciliation" element={<BankReconciliation />} />
            <Route path="inwards" element={<InwardEntry />} />
            <Route path="purchase" element={<Navigate to="/dashboard/inwards" replace />} />
            <Route path="purchase-orders" element={<PurchaseOrder />} />
            <Route path="purchase-order" element={<Navigate to="/dashboard/purchase-orders" replace />} />
            <Route path="performa-invoices" element={<PerformaInvoice />} />
            <Route path="performa-invoice" element={<Navigate to="/dashboard/performa-invoices" replace />} />
            <Route path="outwards" element={<OutwardEntry />} />
            <Route path="sales" element={<Navigate to="/dashboard/outwards" replace />} />
            <Route path="subcontract" element={<Subcontract />} />
            <Route path="sub-contract" element={<Navigate to="/dashboard/subcontract" replace />} />
            <Route path="jobwork-outs" element={<Subcontract initialTab={1} />} />
            <Route path="jobwork-ins" element={<Subcontract initialTab={0} />} />
            <Route path="stock-transfer" element={<StockTransfer />} />
            <Route path="assembly" element={<Assembly />} />
            <Route path="stock-journal" element={<StockJournal />} />
            <Route path="reports/brands" element={<BrandReport />} />
            <Route path="reports/items" element={<ItemReport />} />
            <Route path="reports/prices" element={<PriceReport />} />
            <Route path="reports/bom" element={<BOMReport />} />
            <Route path="reports/stock" element={<StockReport />} />
            <Route path="reports/item-ledger" element={<ItemStockLedgerReport />} />
            <Route path="reports/account-ledger" element={<AccountLedgerReport />} />
            <Route path="reports/assembly" element={<AssemblyReport />} />
            <Route path="reports/stock-journal" element={<StockJournalReport />} />
            <Route path="reports/pending-po" element={<PendingPOReport />} />
            <Route path="reports/inward" element={<InwardReport />} />
            <Route path="reports/outward" element={<OutwardReport />} />
            <Route path="reports/itemwise-outward" element={<ItemwiseOutwardReport />} />
            <Route path="reports/payable" element={<PayableReport />} />
            <Route path="reports/receivable" element={<ReceivableReport />} />
            <Route path="reports/profit-loss" element={<ProfitLossReport />} />
            <Route path="reports/balance-sheet" element={<BalanceSheetReport />} />
            <Route path="reports/trial-balance" element={<TrialBalanceReport />} />
            <Route path="reports/invoice-payable" element={<InvoiceWisePayableReport />} />
            <Route path="reports/invoice-receivable" element={<InvoiceWiseReceivableReport />} />
            <Route path="reports/jobwork-out" element={<JobworkOutReport />} />
            <Route path="reports/jobwork-in" element={<JobworkInReport />} />
            <Route path="reports/jobwork-movement" element={<JobworkMovementReport />} />
            <Route path="reports/jobwork-stock" element={<Navigate to="/dashboard/reports/jobwork-movement" replace />} />
            <Route path="attendance" element={<AttendanceManager />} />
            <Route path="reports/attendance" element={<Navigate to="/dashboard/attendance" replace />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
