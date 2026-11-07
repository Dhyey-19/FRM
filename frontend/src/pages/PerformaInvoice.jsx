import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import {
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Autocomplete, Grid, Divider, Chip, Tooltip, ToggleButtonGroup, ToggleButton,
  FormControlLabel, Checkbox, LinearProgress
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Delete as DeleteIcon,
  Visibility as ViewIcon, Close as CloseIcon, Print as PrintIcon,
  ReceiptLong as PIIcon, CheckCircle as CheckCircleIcon, HourglassEmpty as HourglassIcon,
  Refresh as RefreshIcon, Inventory as StockIcon, DoneAll as DoneAllIcon,
  LocalShipping as ShippingIcon
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import PdfPreviewModal from '../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const emptyRow = {
  ITEMCODE: '',
  SUBCODE: '',
  QUANTITY: '',
  UNIT: '',
  RATE: '',
  AMOUNT: '',
  REMARK: ''
};

const PerformaInvoice = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParamPiNo = searchParams.get('piNo');
  const filterParamPoId = searchParams.get('poId');
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [customerPOs, setCustomerPOs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'ordered', 'partial', 'completed'
  const todayDate = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [editingId, setEditingId] = useState(null);

  const [piNo, setPiNo] = useState('');
  const [piDate, setPiDate] = useState(todayDate);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [ledgerId, setLedgerId] = useState(null);
  const [customerPoId, setCustomerPoId] = useState(null);
  const [customerPoNo, setCustomerPoNo] = useState('');
  const [status, setStatus] = useState('Ordered');
  const [updateStockDirectly, setUpdateStockDirectly] = useState(false);
  const [remark, setRemark] = useState('');
  const [gridRows, setGridRows] = useState([{ ...emptyRow }]);

  // View Modal State
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);

  // PDF Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  // Delete Confirm State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);

  // Direct Stock Receive Confirm State
  const [directReceiveDialogOpen, setDirectReceiveDialogOpen] = useState(false);
  const [invoiceToReceive, setInvoiceToReceive] = useState(null);
  const [receivingStock, setReceivingStock] = useState(false);

  const [companyProfile, setCompanyProfile] = useState(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/performa-invoices`;
      const params = [];
      if (filterParamPiNo) params.push(`piNo=${encodeURIComponent(filterParamPiNo)}`);
      if (filterParamPoId) params.push(`customerPoId=${encodeURIComponent(filterParamPoId)}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setInvoices(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching performa invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedgers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const allowedGroups = ['sundry creditors', 'vendor', 'party', 'supplier', 'sundry debtors'];
          setLedgers(data.filter(l => {
            if (!l.AccountGroupName) return true;
            const gn = l.AccountGroupName.trim().toLowerCase();
            return allowedGroups.some(g => gn.includes(g));
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching ledgers:', err);
    }
  };

  const fetchItems = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setItems(data);
      }
    } catch (err) {
      console.error('Error fetching items:', err);
    }
  };

  const fetchCustomerPOs = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/purchase-orders`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setCustomerPOs(data);
      }
    } catch (err) {
      console.error('Error fetching customer POs:', err);
    }
  };

  const fetchCompanyProfile = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/company-profile`);
      if (res.ok) {
        const data = await res.json();
        if (data) setCompanyProfile(data);
      }
    } catch (err) {
      console.error('Error fetching company profile:', err);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchLedgers();
    fetchItems();
    fetchCustomerPOs();
    fetchCompanyProfile();
  }, [filterParamPiNo, filterParamPoId]);

  const calculateRowAmount = (row) => {
    const qty = parseFloat(row.QUANTITY) || 0;
    const rate = parseFloat(row.RATE) || 0;
    const total = qty * rate;
    return total > 0 ? total.toFixed(2) : '';
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...gridRows];
    newRows[index][field] = value;
    if (['QUANTITY', 'RATE'].includes(field)) {
      newRows[index].AMOUNT = calculateRowAmount(newRows[index]);
    }
    setGridRows(newRows);
  };

  const handleItemSelect = (index, item) => {
    const newRows = [...gridRows];
    newRows[index].ITEMCODE = item ? item.ItemCode : '';
    newRows[index].SUBCODE = item ? (item.SubCode || '') : '';
    newRows[index].UNIT = item ? (item.Unit || 'PCS') : '';
    newRows[index].RATE = item && item.Costing ? String(item.Costing) : (item && item.MRP ? String(item.MRP) : '');
    newRows[index].AMOUNT = calculateRowAmount(newRows[index]);
    setGridRows(newRows);
  };

  const addGridRow = () => {
    setGridRows([...gridRows, { ...emptyRow }]);
  };

  const removeGridRow = (index) => {
    if (gridRows.length > 1) {
      const newRows = [...gridRows];
      newRows.splice(index, 1);
      setGridRows(newRows);
    }
  };

  const handleOpenNewDialog = async () => {
    setDialogError('');
    setEditingId(null);
    setPiDate(todayDate);
    setDeliveryDate('');
    setLedgerId(null);
    setCustomerPoId(null);
    setCustomerPoNo('');
    setStatus('Ordered');
    setUpdateStockDirectly(false);
    setRemark('');
    setGridRows([{ ...emptyRow }]);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/performa-invoices/next-no`);
      if (res.ok) {
        const data = await res.json();
        setPiNo(data.nextNo || 'PI-1');
      } else {
        setPiNo('PI-1');
      }
    } catch {
      setPiNo('PI-1');
    }

    setOpenDialog(true);
  };

  const handleEditInvoice = (inv) => {
    setDialogError('');
    setEditingId(inv.ID);
    setPiNo(inv.PINO || '');
    setPiDate(inv.PIDATE ? inv.PIDATE.split('T')[0] : todayDate);
    setDeliveryDate(inv.DELIVERYDATE ? inv.DELIVERYDATE.split('T')[0] : '');
    setLedgerId(inv.LEDGERID);
    setCustomerPoId(inv.CUSTOMERPOID || null);
    setCustomerPoNo(inv.CUSTOMERPONO || '');
    setStatus(inv.STATUS || 'Ordered');
    setUpdateStockDirectly(false);
    setRemark(inv.REMARK || '');

    if (inv.Details && inv.Details.length > 0) {
      setGridRows(inv.Details.map(d => ({
        ID: d.ID,
        ITEMCODE: d.ITEMCODE || '',
        SUBCODE: d.SUBCODE || '',
        QUANTITY: String(d.QUANTITY || ''),
        UNIT: d.UNIT || '',
        RATE: String(d.RATE || ''),
        AMOUNT: String(d.AMOUNT || ''),
        REMARK: d.REMARK || ''
      })));
    } else {
      setGridRows([{ ...emptyRow }]);
    }

    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setDialogError('');
  };

  const handleSaveInvoice = async (printAfter = false) => {
    if (!piNo.trim()) {
      setDialogError('Please enter a valid Performa Invoice number.');
      return;
    }
    if (!ledgerId) {
      setDialogError('Please select a Vendor / Supplier.');
      return;
    }

    const validRows = gridRows.filter(r => r.ITEMCODE && parseFloat(r.QUANTITY) > 0);
    if (validRows.length === 0) {
      setDialogError('Please add at least one line item with valid Item Code and Quantity > 0.');
      return;
    }

    const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
    const username = localUser.Username || localUser.username || 'System';

    const payload = {
      PINO: piNo.trim(),
      PIDATE: piDate,
      LEDGERID: ledgerId,
      CUSTOMERPOID: customerPoId || null,
      CUSTOMERPONO: customerPoNo || null,
      DELIVERYDATE: deliveryDate || null,
      STATUS: status || 'Ordered',
      updateStockDirectly: updateStockDirectly,
      REMARK: remark || null,
      CREATEDBY: username,
      UPDATEDBY: username,
      Details: validRows.map(r => ({
        ID: r.ID || undefined,
        ITEMCODE: r.ITEMCODE,
        SUBCODE: r.SUBCODE || '',
        QUANTITY: parseFloat(r.QUANTITY) || 0,
        UNIT: r.UNIT || 'PCS',
        RATE: parseFloat(r.RATE) || 0,
        AMOUNT: parseFloat(r.AMOUNT) || ((parseFloat(r.QUANTITY) || 0) * (parseFloat(r.RATE) || 0)),
        REMARK: r.REMARK || null
      }))
    };

    try {
      const url = editingId
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/performa-invoices/${editingId}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/performa-invoices`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setDialogError(data.message || 'Error saving Performa Invoice');
        return;
      }

      setOpenDialog(false);
      await fetchInvoices();

      if (printAfter) {
        const ledgerObj = ledgers.find(l => l.Id === ledgerId) || {};
        generatePDF({ ...payload, ID: editingId || data.id, Details: payload.Details }, ledgerObj);
      }
    } catch (err) {
      console.error('Error saving performa invoice:', err);
      setDialogError(err.message || 'Server connection error');
    }
  };

  // Direct receive stock for an invoice
  const handleDirectReceiveStock = async () => {
    if (!invoiceToReceive) return;
    setReceivingStock(true);
    try {
      const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
      const username = localUser.Username || localUser.username || 'System';

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/performa-invoices/${invoiceToReceive.ID}/receive-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to update stock');
      } else {
        setDirectReceiveDialogOpen(false);
        setInvoiceToReceive(null);
        await fetchInvoices();
      }
    } catch (err) {
      console.error('Error receiving stock:', err);
      alert('Error updating stock');
    } finally {
      setReceivingStock(false);
    }
  };

  // Delete Action
  const openDeleteModal = (inv) => {
    setInvoiceToDelete(inv);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/performa-invoices/${invoiceToDelete.ID}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to delete Performa Invoice');
      } else {
        setDeleteConfirmOpen(false);
        setInvoiceToDelete(null);
        await fetchInvoices();
      }
    } catch (err) {
      console.error('Error deleting performa invoice:', err);
      alert('Error deleting Performa Invoice');
    }
  };

  // PDF Generation
  const generatePDF = (inv, ledgerObj) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const compName = companyProfile ? companyProfile.CompanyName : 'FRM Precision Manufacturing';

    // Company Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text(compName, 14, 18);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90);
    let compY = 23;
    if (companyProfile) {
      const addr = [companyProfile.Address1, companyProfile.Address2].filter(Boolean).join(', ');
      const cityLine = [companyProfile.City, companyProfile.StateName, companyProfile.Pincode].filter(Boolean).join(', ');
      if (addr) { doc.text(addr, 14, compY); compY += 4; }
      if (cityLine) { doc.text(cityLine, 14, compY); compY += 4; }
      if (companyProfile.GSTIN) { doc.text(`GSTIN: ${companyProfile.GSTIN}`, 14, compY); compY += 4; }
    }

    // Title & Doc Info
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('PERFORMA INVOICE / PURCHASE ORDER', 196, 18, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);
    doc.text(`PI No: ${inv.PINO}`, 196, 24, { align: 'right' });
    const formattedDate = inv.PIDATE ? new Date(inv.PIDATE).toLocaleDateString('en-GB') : '-';
    doc.text(`Date: ${formattedDate}`, 196, 28, { align: 'right' });
    if (inv.DELIVERYDATE) {
      doc.text(`Delivery Date: ${new Date(inv.DELIVERYDATE).toLocaleDateString('en-GB')}`, 196, 32, { align: 'right' });
    }
    if (inv.CUSTOMERPONO) {
      doc.text(`Ref Customer PO: ${inv.CUSTOMERPONO}`, 196, 36, { align: 'right' });
    }

    const dividerY = Math.max(compY + 2, 40);
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, dividerY, 196, dividerY);

    // Vendor / Supplier Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('SUPPLIER / VENDOR DETAILS', 14, dividerY + 6);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text(ledgerObj?.LedgerName || inv.LedgerName || 'N/A', 14, dividerY + 11);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    let vY = dividerY + 15;
    if (ledgerObj?.Address) { doc.text(ledgerObj.Address, 14, vY); vY += 4; }
    const loc = [ledgerObj?.City, ledgerObj?.State].filter(Boolean).join(', ');
    if (loc) { doc.text(loc, 14, vY); vY += 4; }
    if (ledgerObj?.GSTIN) { doc.text(`GSTIN: ${ledgerObj.GSTIN}`, 14, vY); vY += 4; }
    if (ledgerObj?.MobileNo) { doc.text(`Phone: ${ledgerObj.MobileNo}`, 14, vY); vY += 4; }

    // Items Table
    const tableData = (inv.Details || []).map((row, i) => {
      const it = items.find(x => x.ItemCode === row.ITEMCODE && (x.SubCode || '') === (row.SUBCODE || ''));
      const desc = it ? `${row.ITEMCODE}${row.SUBCODE ? ` (${row.SUBCODE})` : ''} - ${it.ItemName}` : `${row.ITEMCODE}${row.SUBCODE ? ` (${row.SUBCODE})` : ''}`;
      const qty = parseFloat(row.QUANTITY) || 0;
      const rate = parseFloat(row.RATE) || 0;
      const amt = parseFloat(row.AMOUNT) || (qty * rate);

      return [
        i + 1,
        desc,
        qty.toFixed(2),
        row.UNIT || 'PCS',
        rate > 0 ? rate.toFixed(2) : '-',
        amt > 0 ? amt.toFixed(2) : '-'
      ];
    });

    autoTable(doc, {
      startY: Math.max(vY + 4, dividerY + 30),
      head: [['#', 'Item Description', 'Qty', 'Unit', 'Rate (Rs.)', 'Amount (Rs.)']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 59, 102], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 80 },
        2: { halign: 'right', cellWidth: 25 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'right', cellWidth: 25 },
        5: { halign: 'right', cellWidth: 30 }
      }
    });

    const finalY = doc.lastAutoTable.finalY + 6;
    const totalQty = (inv.Details || []).reduce((s, r) => s + (parseFloat(r.QUANTITY) || 0), 0);
    const totalAmt = parseFloat(inv.TOTALAMOUNT) || (inv.Details || []).reduce((s, r) => s + (parseFloat(r.AMOUNT) || 0), 0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 59, 102);
    doc.text(`Total Ordered Qty: ${totalQty.toFixed(2)}`, 140, finalY, { align: 'right' });
    doc.text(`Grand Total Amount: Rs. ${totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 196, finalY + 5, { align: 'right' });

    if (inv.REMARK) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 59, 102);
      doc.text('Remarks / Terms:', 14, finalY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70);
      doc.text(inv.REMARK, 14, finalY + 4);
    }

    const pageHeight = doc.internal.pageSize.height;
    doc.setDrawColor(180);
    doc.line(14, pageHeight - 25, 70, pageHeight - 25);
    doc.text('Prepared By', 42, pageHeight - 20, { align: 'center' });

    doc.line(140, pageHeight - 25, 196, pageHeight - 25);
    doc.text('Authorized Signatory', 168, pageHeight - 20, { align: 'center' });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || (
        (inv.PINO && inv.PINO.toLowerCase().includes(term)) ||
        (inv.LedgerName && inv.LedgerName.toLowerCase().includes(term)) ||
        (inv.CUSTOMERPONO && inv.CUSTOMERPONO.toLowerCase().includes(term)) ||
        (inv.REMARK && inv.REMARK.toLowerCase().includes(term))
      );

      let matchesDate = true;
      if (fromDate) matchesDate = matchesDate && inv.PIDATE && inv.PIDATE.split('T')[0] >= fromDate;
      if (toDate) matchesDate = matchesDate && inv.PIDATE && inv.PIDATE.split('T')[0] <= toDate;

      let matchesStatus = true;
      const st = (inv.STATUS || '').toLowerCase();
      if (statusFilter === 'ordered') matchesStatus = st === 'ordered';
      else if (statusFilter === 'partial') matchesStatus = st === 'partially received';
      else if (statusFilter === 'completed') matchesStatus = st === 'completed';

      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [invoices, searchTerm, fromDate, toDate, statusFilter]);

  const liveTotalQty = gridRows.reduce((sum, r) => sum + (parseFloat(r.QUANTITY) || 0), 0);
  const liveTotalAmount = gridRows.reduce((sum, r) => sum + (parseFloat(r.AMOUNT) || 0), 0);

  // Summary Metrics
  const totalCount = invoices.length;
  const activeCount = invoices.filter(i => ['ordered', 'partially received'].includes((i.STATUS || '').toLowerCase())).length;
  const completedCount = invoices.filter(i => (i.STATUS || '').toLowerCase() === 'completed').length;
  const totalValue = invoices.reduce((s, i) => s + (parseFloat(i.TOTALAMOUNT) || 0), 0);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 3 } }}>
      {/* Title & Top Action Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e40af' }}>
            <PIIcon />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66' }}>
              Performa Invoices (Supplier Orders)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Procure missing and required stock items from vendors with automated Purchase/Inward tracking
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchInvoices}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenNewDialog}
            disabled={!hasAddPermission()}
            sx={{ backgroundColor: '#0F3B66', textTransform: 'none', fontWeight: 600, '&:hover': { backgroundColor: '#0c2f52' } }}
          >
            New Performa Invoice
          </Button>
        </Box>
      </Box>

      {/* Summary KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
              Total Performa Invoices
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mt: 0.5 }}>
              {totalCount}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
              Active / In-Transit
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#d97706', mt: 0.5 }}>
              {activeCount}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
              Fully Received
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#16a34a', mt: 0.5 }}>
              {completedCount}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
              Total Order Value
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mt: 0.5 }}>
              ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Main Table Card */}
      <Paper sx={{ width: '100%', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 2 }, py: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1.5, bgcolor: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
          <TextField
            size="small"
            placeholder="Search PI No, Vendor, Customer PO..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" fontSize="small" /></InputAdornment> }}
            sx={{ width: { xs: '100%', sm: 260 } }}
          />

          <TextField
            label="From Date"
            type="date"
            size="small"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: 'calc(50% - 8px)', sm: 145 } }}
          />

          <TextField
            label="To Date"
            type="date"
            size="small"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: 'calc(50% - 8px)', sm: 145 } }}
          />

          {(fromDate || toDate) && (
            <Button size="small" onClick={() => { setFromDate(''); setToDate(''); }} sx={{ textTransform: 'none' }}>
              Clear Dates
            </Button>
          )}

          <ToggleButtonGroup
            value={statusFilter}
            exclusive
            onChange={(e, next) => { if (next) setStatusFilter(next); }}
            size="small"
            sx={{ ml: { sm: 'auto' }, width: { xs: '100%', sm: 'auto' }, bgcolor: '#f8fafc' }}
          >
            <ToggleButton value="all" sx={{ textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem', fontWeight: 600 }}>
              All ({invoices.length})
            </ToggleButton>
            <ToggleButton value="ordered" sx={{ textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem', fontWeight: 600 }}>
              <HourglassIcon fontSize="small" sx={{ mr: 0.5, color: '#f59e0b' }} /> Ordered
            </ToggleButton>
            <ToggleButton value="partial" sx={{ textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem', fontWeight: 600 }}>
              Partial
            </ToggleButton>
            <ToggleButton value="completed" sx={{ textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem', fontWeight: 600 }}>
              <CheckCircleIcon fontSize="small" sx={{ mr: 0.5, color: '#16a34a' }} /> Completed
            </ToggleButton>
          </ToggleButtonGroup>
        </Toolbar>

        {filterParamPiNo && (
          <Alert
            severity="info"
            action={
              <Button color="inherit" size="small" onClick={() => { setSearchParams({}); fetchInvoices(); }}>
                Show All Invoices
              </Button>
            }
            sx={{ mx: 2, mt: 1.5 }}
          >
            Filtering by Performa Invoice <strong>{filterParamPiNo}</strong>.
          </Alert>
        )}

        {/* Invoices Table */}
        <TableContainer>
          <Table size="small" sx={{ minWidth: 950 }}>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>PI Number</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>PI Date</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Vendor / Supplier</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Customer PO Ref</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }} align="right">Items</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }} align="right">Ordered Qty</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }} align="right">Received Qty</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }} align="right">Pending Qty</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }} align="right">Amount</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }} align="center">Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInvoices.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((inv) => {
                const isCompleted = (inv.STATUS || '').toLowerCase() === 'completed';
                const isPartial = (inv.STATUS || '').toLowerCase() === 'partially received';
                const statusColor = isCompleted ? 'success' : isPartial ? 'info' : 'warning';
                const ordQty = parseFloat(inv.OrderQtySum ?? inv.TOTALQTY) || 0;
                const recQty = parseFloat(inv.ReceivedQtySum) || 0;
                const pendQty = parseFloat(inv.PendingQtySum ?? (ordQty - recQty)) || 0;

                return (
                  <TableRow hover key={inv.ID} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                        {inv.PINO}
                      </Typography>
                    </TableCell>
                    <TableCell>{inv.PIDATE ? inv.PIDATE.split('T')[0] : '-'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {inv.LedgerName || 'N/A'}
                      </Typography>
                      {inv.City && (
                        <Typography variant="caption" color="text.secondary">
                          {inv.City}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {inv.CUSTOMERPONO ? (
                        <Chip
                          size="small"
                          label={`PO: ${inv.CUSTOMERPONO}`}
                          variant="outlined"
                          color="primary"
                          sx={{ fontWeight: 600, fontSize: '0.72rem', height: 22 }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{inv.TotalItems ?? (inv.Details ? inv.Details.length : 0)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{ordQty.toFixed(2)}</TableCell>
                    <TableCell align="right" sx={{ color: recQty > 0 ? '#16a34a' : 'text.secondary', fontWeight: 600 }}>
                      {recQty.toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        label={pendQty.toFixed(2)}
                        color={pendQty <= 0 ? 'default' : 'warning'}
                        variant={pendQty <= 0 ? 'outlined' : 'filled'}
                        sx={{ fontWeight: 700, fontSize: '0.75rem', height: 22 }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      ₹{parseFloat(inv.TOTALAMOUNT || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={inv.STATUS || 'Ordered'}
                        color={statusColor}
                        sx={{ fontWeight: 600, fontSize: '0.75rem', height: 22 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => { setViewInvoice(inv); setViewDialogOpen(true); }}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Print Performa Invoice">
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => {
                            const ledgerObj = ledgers.find(l => l.Id === inv.LEDGERID) || {};
                            generatePDF(inv, ledgerObj);
                          }}
                        >
                          <PrintIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {pendQty > 0 && (
                        <Tooltip title="Directly Receive All Stock">
                          <IconButton
                            size="small"
                            sx={{ color: '#16a34a' }}
                            onClick={() => { setInvoiceToReceive(inv); setDirectReceiveDialogOpen(true); }}
                          >
                            <DoneAllIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Edit">
                        <span>
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={!hasEditPermission() || isCompleted}
                            onClick={() => handleEditInvoice(inv)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={!hasDeletePermission() || recQty > 0}
                            onClick={() => openDeleteModal(inv)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredInvoices.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No Performa Invoices found matching your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredInvoices.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        />
      </Paper>

      {/* Add / Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={(e, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: '#0F3B66', color: 'white', py: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {editingId ? `Edit Performa Invoice (${piNo})` : 'New Performa Invoice'}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5, backgroundColor: '#f8fafc' }}>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}

          {/* Header Section */}
          <Paper sx={{ p: 2, mb: 2, border: '1px solid #e2e8f0', borderRadius: 1.5, boxShadow: 'none' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="PI Number"
                  value={piNo}
                  onChange={(e) => setPiNo(e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="PI Date"
                  value={piDate}
                  onChange={(e) => setPiDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Autocomplete
                  options={ledgers}
                  getOptionLabel={(option) => option.LedgerName || ''}
                  value={ledgers.find(l => l.Id === ledgerId) || null}
                  onChange={(e, val) => setLedgerId(val ? val.Id : null)}
                  renderInput={(params) => <TextField {...params} label="Vendor / Supplier" size="small" required fullWidth />}
                  fullWidth
                  slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Expected Delivery Date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  options={customerPOs}
                  getOptionLabel={(option) => option ? `${option.PONO} - ${option.LedgerName || ''}` : ''}
                  value={customerPOs.find(p => p.ID === customerPoId || p.PONO === customerPoNo) || null}
                  onChange={(e, val) => {
                    setCustomerPoId(val ? val.ID : null);
                    setCustomerPoNo(val ? val.PONO : '');
                  }}
                  renderInput={(params) => <TextField {...params} label="Customer PO Reference (Optional)" size="small" fullWidth />}
                  fullWidth
                  slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={8}>
                <TextField
                  fullWidth
                  size="small"
                  label="Remarks / Delivery Instructions"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="e.g. Urgent shipment, payment terms, transporter details"
                />
              </Grid>

              {!editingId && (
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={updateStockDirectly}
                        onChange={(e) => setUpdateStockDirectly(e.target.checked)}
                        color="success"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontWeight: 600, color: updateStockDirectly ? '#16a34a' : 'text.primary' }}>
                        ⚡ Directly update stock upon creating order (auto-inward stock to inventory)
                      </Typography>
                    }
                  />
                </Grid>
              )}
            </Grid>
          </Paper>

          {/* Detail Line Items Grid */}
          <Paper sx={{ p: 2, mb: 2, border: '1px solid #e2e8f0', borderRadius: 1.5, boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                Performa Order Line Items
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addGridRow}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Add Item
              </Button>
            </Box>

            <TableContainer sx={{ maxHeight: '35vh' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, width: '40%' }}>Item (Code / SubCode / Name)</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: '15%' }} align="right">Order Qty</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: '12%' }}>Unit</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: '14%' }} align="right">Rate (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: '14%' }} align="right">Amount (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: '5%' }} align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gridRows.map((row, idx) => {
                    const selectedItem = items.find(
                      it => it.ItemCode === row.ITEMCODE && (it.SubCode || '') === (row.SUBCODE || '')
                    );

                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <Autocomplete
                            size="small"
                            options={items}
                            getOptionLabel={(option) => {
                              if (!option) return '';
                              const sub = option.SubCode ? ` (${option.SubCode})` : '';
                              return `${option.ItemCode}${sub} - ${option.ItemName}`;
                            }}
                            value={selectedItem || null}
                            onChange={(e, val) => handleItemSelect(idx, val)}
                            renderInput={(params) => <TextField {...params} placeholder="Select Item" size="small" fullWidth />}
                            fullWidth
                            slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small"
                            type="number"
                            value={row.QUANTITY}
                            onChange={(e) => handleRowChange(idx, 'QUANTITY', e.target.value)}
                            inputProps={{ min: 0, step: 'any', style: { textAlign: 'right', fontWeight: 600 } }}
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={row.UNIT}
                            onChange={(e) => handleRowChange(idx, 'UNIT', e.target.value)}
                            fullWidth
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small"
                            type="number"
                            value={row.RATE}
                            onChange={(e) => handleRowChange(idx, 'RATE', e.target.value)}
                            inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                            fullWidth
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small"
                            value={row.AMOUNT}
                            InputProps={{ readOnly: true }}
                            inputProps={{ style: { textAlign: 'right', fontWeight: 600 } }}
                            fullWidth
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="error"
                            disabled={gridRows.length <= 1}
                            onClick={() => removeGridRow(idx)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Totals Summary */}
            <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Total Items: <strong>{gridRows.filter(r => r.ITEMCODE).length}</strong>
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Total Quantity: <strong>{liveTotalQty.toFixed(2)}</strong>
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                Total Amount: <strong>₹{liveTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </Typography>
            </Box>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={handleCloseDialog} color="inherit">
            Cancel
          </Button>
          <Button
            variant="outlined"
            onClick={() => handleSaveInvoice(true)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Save & Print
          </Button>
          <Button
            variant="contained"
            onClick={() => handleSaveInvoice(false)}
            sx={{ backgroundColor: '#0F3B66', textTransform: 'none', fontWeight: 600, '&:hover': { backgroundColor: '#0c2f52' } }}
          >
            {editingId ? 'Update Performa Invoice' : 'Save Performa Invoice'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Modal */}
      {viewInvoice && (
        <Dialog
          open={viewDialogOpen}
          onClose={() => setViewDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ backgroundColor: '#0F3B66', color: 'white', py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Performa Invoice: {viewInvoice.PINO}
            </Typography>
            <IconButton size="small" onClick={() => setViewDialogOpen(false)} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 2.5, backgroundColor: '#f8fafc' }}>
            <Paper sx={{ p: 2, mb: 2, border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">Vendor / Supplier</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{viewInvoice.LedgerName}</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">PI Date</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {viewInvoice.PIDATE ? viewInvoice.PIDATE.split('T')[0] : '-'}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">Customer PO Ref</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {viewInvoice.CUSTOMERPONO || '-'}
                  </Typography>
                </Grid>
              </Grid>

              {/* Progress Bar */}
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #e2e8f0' }}>
                {(() => {
                  const oQty = parseFloat(viewInvoice.OrderQtySum ?? viewInvoice.TOTALQTY) || 0;
                  const rQty = parseFloat(viewInvoice.ReceivedQtySum) || 0;
                  const pQty = parseFloat(viewInvoice.PendingQtySum ?? (oQty - rQty)) || 0;
                  const percent = oQty > 0 ? Math.min(100, Math.round((rQty / oQty) * 100)) : 0;

                  return (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          Receiving Progress: {percent}% Received in Purchase/Inward
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Received: {rQty} / Ordered: {oQty} | Pending: <strong>{pQty}</strong>
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={percent}
                        sx={{ height: 8, borderRadius: 4, bgcolor: '#e2e8f0' }}
                        color={percent >= 100 ? 'success' : percent > 0 ? 'info' : 'warning'}
                      />
                    </Box>
                  );
                })()}
              </Box>
            </Paper>

            <TableContainer component={Paper} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Ordered</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Received</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Pending</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Rate</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(viewInvoice.Details || []).map((d, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {d.ITEMCODE}{d.SUBCODE ? ` (${d.SUBCODE})` : ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {d.ItemName || ''}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{parseFloat(d.QUANTITY || 0).toFixed(2)} {d.UNIT}</TableCell>
                      <TableCell align="right" sx={{ color: '#16a34a', fontWeight: 600 }}>{parseFloat(d.RECEIVEDQTY || 0).toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ color: parseFloat(d.PENDINGQTY || 0) > 0 ? '#d97706' : 'text.secondary', fontWeight: 700 }}>
                        {parseFloat(d.PENDINGQTY || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="right">₹{parseFloat(d.RATE || 0).toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>₹{parseFloat(d.AMOUNT || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions sx={{ p: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
            {parseFloat(viewInvoice.PendingQtySum || 0) > 0 && (
              <Button
                variant="contained"
                color="success"
                startIcon={<DoneAllIcon />}
                onClick={() => {
                  setViewDialogOpen(false);
                  setInvoiceToReceive(viewInvoice);
                  setDirectReceiveDialogOpen(true);
                }}
                sx={{ textTransform: 'none', fontWeight: 600, mr: 'auto' }}
              >
                Receive Remaining Stock Directly
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={() => {
                const ledgerObj = ledgers.find(l => l.Id === viewInvoice.LEDGERID) || {};
                generatePDF(viewInvoice, ledgerObj);
              }}
              sx={{ textTransform: 'none' }}
            >
              Print
            </Button>
            <Button onClick={() => setViewDialogOpen(false)} color="inherit">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Direct Receive Stock Confirmation Dialog */}
      <Dialog
        open={directReceiveDialogOpen}
        onClose={() => setDirectReceiveDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, color: '#0F3B66' }}>
          Receive Stock Directly
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Are you sure you want to directly receive the remaining pending items from Performa Invoice <strong>{invoiceToReceive?.PINO}</strong>?
          </Typography>
          <Typography variant="caption" color="text.secondary">
            This will immediately increase current inventory stock in Item Master by the pending quantities and mark this Performa Invoice as Completed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDirectReceiveDialogOpen(false)} color="inherit" disabled={receivingStock}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleDirectReceiveStock}
            disabled={receivingStock}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {receivingStock ? 'Updating Stock...' : 'Confirm & Receive'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Performa Invoice"
        message={`Are you sure you want to delete Performa Invoice "${invoiceToDelete?.PINO}"? This action cannot be undone.`}
      />

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl('');
        }}
        pdfUrl={previewUrl}
        title="Performa Invoice Document"
      />
    </Box>
  );
};

export default PerformaInvoice;

