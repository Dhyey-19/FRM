import React from 'react';
import { 
  Dashboard as DashboardIcon, 
  AdminPanelSettings as AdminIcon, 
  People as PeopleIcon,
  Inventory as InventoryIcon,
  BrandingWatermark as BrandIcon,
  Category as ItemIcon,
  Straighten as UnitIcon,
  AccountTree as BOMIcon,
  AccountBalanceWallet as AccountGroupIcon,
  Assessment as ReportsIcon,
  List as ListIcon,
  Receipt as TransactionIcon,
  Business as DepartmentIcon,
  Build as AssemblyIcon,
  Settings as SettingsIcon,
  AccountBalance as AccountBalanceIcon,
  QrCode2 as QrCodeIcon,
  ManageAccounts as UserAccessIcon,
  NotificationsActive as NotificationsActiveIcon,
  Assignment as POIcon
} from '@mui/icons-material';

export const MENU_STRUCTURE = [
  {
    title: 'Dashboard',
    path: '/dashboard',
    icon: <DashboardIcon />,
  },
  {
    title: 'Administration',
    id: 'admin',
    icon: <AdminIcon />,
    adminOnly: true, // Only visible to ADMIN role
    children: [
      { title: 'Company Profile', path: '/dashboard/company-profile', icon: <SettingsIcon /> },
      { title: 'Payment QR', path: '/dashboard/payment-qr', icon: <QrCodeIcon /> },
      { title: 'Alerts & Logs', path: '/dashboard/logs', icon: <NotificationsActiveIcon /> },
      { title: 'User Master', path: '/dashboard/users', icon: <PeopleIcon /> },
      { title: 'User Access', path: '/dashboard/user-access', icon: <UserAccessIcon /> },
      { title: 'Assets', path: '/dashboard/assets', icon: <InventoryIcon /> },
    ]
  },
  {
    title: 'Inventory Masters',
    id: 'inventoryMasters',
    icon: <InventoryIcon />,
    children: [
      { title: 'Series Master', path: '/dashboard/brands', icon: <BrandIcon /> },
      { title: 'Unit Master', path: '/dashboard/units', icon: <UnitIcon /> },
      { title: 'Item Type', path: '/dashboard/item-types', icon: <ItemIcon /> },
      { title: 'Item Master', path: '/dashboard/items', icon: <ItemIcon /> },
      { title: 'BOM', path: '/dashboard/bom', icon: <BOMIcon /> },
      { title: 'Departments', path: '/dashboard/departments', icon: <DepartmentIcon /> },
    ]
  },
  {
    title: 'Transactions',
    id: 'transactions',
    icon: <TransactionIcon />,
    children: [
      { title: 'Purchase Order', path: '/dashboard/purchase-orders', icon: <POIcon /> },
      { title: 'Purchase', path: '/dashboard/inwards', icon: <ListIcon /> },
      { title: 'Sales', path: '/dashboard/outwards', icon: <ListIcon /> },
      { title: 'Sub-Contract', path: '/dashboard/subcontract', icon: <ListIcon /> },
      { title: 'Stock Journal', path: '/dashboard/stock-journal', icon: <ListIcon /> },
      { title: 'Stock Transfer', path: '/dashboard/stock-transfer', icon: <ListIcon /> },
      { title: 'Assembly', path: '/dashboard/assembly', icon: <AssemblyIcon /> },
    ]
  },
  {
    title: 'Accounts & Finance',
    id: 'accounts',
    icon: <AccountGroupIcon />,
    children: [
      { title: 'Account Group', path: '/dashboard/account-groups', icon: <AccountGroupIcon /> },
      { title: 'Account Ledger', path: '/dashboard/ledgers', icon: <PeopleIcon /> },
      { title: 'Vouchers', path: '/dashboard/vouchers', icon: <TransactionIcon /> },
      { title: 'Bank Reconciliation', path: '/dashboard/bank-reconciliation', icon: <AccountBalanceIcon /> },
    ]
  },
  {
    title: 'Reports',
    id: 'reports',
    icon: <ReportsIcon />,
    groups: [
      {
        groupTitle: 'Master Lists',
        children: [
          { title: 'Series List', path: '/dashboard/reports/brands', icon: <ListIcon fontSize="small" /> },
          { title: 'Item List', path: '/dashboard/reports/items', icon: <ListIcon fontSize="small" /> },
          { title: 'Price', path: '/dashboard/reports/prices', icon: <ListIcon fontSize="small" /> },
        ]
      },
      {
        groupTitle: 'Inventory & Production',
        children: [
          { title: 'Stock', path: '/dashboard/reports/stock', icon: <ListIcon fontSize="small" /> },
          { title: 'Item Stock Ledger', path: '/dashboard/reports/item-ledger', icon: <ReportsIcon fontSize="small" /> },
          { title: 'BOM', path: '/dashboard/reports/bom', icon: <BOMIcon fontSize="small" /> },
          { title: 'Assembly', path: '/dashboard/reports/assembly', icon: <AssemblyIcon fontSize="small" /> },
          { title: 'Stock Journal', path: '/dashboard/reports/stock-journal', icon: <ReportsIcon fontSize="small" /> },
        ]
      },
      {
        groupTitle: 'Jobwork Status',
        children: [
          { title: 'Job Work Out', path: '/dashboard/reports/jobwork-out', icon: <ReportsIcon fontSize="small" /> },
          { title: 'Job Work In', path: '/dashboard/reports/jobwork-in', icon: <ReportsIcon fontSize="small" /> },
          { title: 'Job Work Movement', path: '/dashboard/reports/jobwork-movement', icon: <ReportsIcon fontSize="small" /> },
        ]
      },
      {
        groupTitle: 'Purchase & Sales Log',
        children: [
          { title: 'Pending PO Report', path: '/dashboard/reports/pending-po', icon: <ReportsIcon fontSize="small" /> },
          { title: 'Inward Log', path: '/dashboard/reports/inward', icon: <ReportsIcon fontSize="small" /> },
          { title: 'Outward Log', path: '/dashboard/reports/outward', icon: <ReportsIcon fontSize="small" /> },
          { title: 'Item-wise Sales', path: '/dashboard/reports/itemwise-outward', icon: <ReportsIcon fontSize="small" /> },
        ]
      },
      {
        groupTitle: 'Financial Statements',
        children: [
          { title: 'Account Ledger', path: '/dashboard/reports/account-ledger', icon: <ReportsIcon fontSize="small" /> },
          { title: 'Trial Balance', path: '/dashboard/reports/trial-balance', icon: <ReportsIcon fontSize="small" /> },
          { title: 'Receivable', path: '/dashboard/reports/receivable', icon: <ReportsIcon fontSize="small" /> },
          { title: 'Receivable (Due by Days)', path: '/dashboard/reports/invoice-receivable', icon: <ReportsIcon fontSize="small" /> },
          { title: 'Payable', path: '/dashboard/reports/payable', icon: <ReportsIcon fontSize="small" /> },
          { title: 'Payable (Due by Days)', path: '/dashboard/reports/invoice-payable', icon: <ReportsIcon fontSize="small" /> },
          { title: 'Profit & Loss', path: '/dashboard/reports/profit-loss', icon: <ReportsIcon fontSize="small" /> },
          { title: 'Balance Sheet', path: '/dashboard/reports/balance-sheet', icon: <ReportsIcon fontSize="small" /> },
        ]
      }
    ]
  }
];

export const getAllMenuPaths = () => {
  const paths = [];
  MENU_STRUCTURE.forEach(section => {
    if (section.path) paths.push(section.path);
    if (section.children) {
      section.children.forEach(child => paths.push(child.path));
    }
    if (section.groups) {
      section.groups.forEach(group => {
        group.children.forEach(child => paths.push(child.path));
      });
    }
  });
  return paths;
};

// Returns forms organized by module and section for User Access control
export const getAllFormSections = () => {
  const sections = [];
  MENU_STRUCTURE.forEach(sec => {
    if (sec.children) {
      sections.push({
        id: sec.id,
        title: sec.title,
        icon: sec.icon,
        adminOnly: Boolean(sec.adminOnly),
        forms: sec.children.map(c => ({
          title: c.title,
          path: c.path,
          icon: c.icon,
          adminOnly: Boolean(sec.adminOnly || c.adminOnly)
        }))
      });
    } else if (sec.groups) {
      sec.groups.forEach(g => {
        sections.push({
          id: `${sec.id}_${g.groupTitle.replace(/\s+/g, '_').toLowerCase()}`,
          title: `${sec.title} - ${g.groupTitle}`,
          icon: sec.icon,
          adminOnly: Boolean(sec.adminOnly),
          forms: g.children.map(c => ({
            title: c.title,
            path: c.path,
            icon: c.icon,
            adminOnly: Boolean(sec.adminOnly)
          }))
        });
      });
    }
  });
  return sections;
};
