import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import {
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Alert,
  Autocomplete, Grid, Divider, MenuItem, Select, FormControl, InputLabel, Chip,
  LinearProgress, Tooltip, ToggleButtonGroup, ToggleButton,
  FormControlLabel, Checkbox
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Delete as DeleteIcon,
  Visibility as ViewIcon, Close as CloseIcon, Print as PrintIcon,
  Assignment as OrderIcon, CheckCircle as CheckCircleIcon, HourglassEmpty as HourglassIcon,
  LocalShipping as ShippingIcon, Refresh as RefreshIcon, FlashOn as FlashOnIcon,
  ReceiptLong as PIIcon, DoneAll as DoneAllIcon
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

const PurchaseOrder = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParamPoNo = searchParams.get('poNo');

  const [orders, setOrders] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'pending', 'completed'
  const todayDate = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [editingId, setEditingId] = useState(null);

  const [poNo, setPoNo] = useState('');
  const [poDate, setPoDate] = useState(todayDate);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [ledgerId, setLedgerId] = useState(null);
  const [remark, setRemark] = useState('');
  const [gridRows, setGridRows] = useState([{ ...emptyRow }]);

  // View Modal State
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);

  // PDF Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  // Delete Confirm State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);

  const [companyProfile, setCompanyProfile] = useState(null);

  // Stock Availability & Shortage States
  const [stockAvailability, setStockAvailability] = useState([]);
  const [shortageModalOpen, setShortageModalOpen] = useState(false);
  const [shortageVendorId, setShortageVendorId] = useState(null);
  const [shortageRows, setShortageRows] = useState([]);
  const [shortagePiNo, setShortagePiNo] = useState('');
  const [shortageDeliveryDate, setShortageDeliveryDate] = useState('');
  const [shortageDirectStock, setShortageDirectStock] = useState(false);
  const [shortageError, setShortageError] = useState('');
  const [savingShortagePI, setSavingShortagePI] = useState(false);
  const [shortageSuccessMsg, setShortageSuccessMsg] = useState('');

  // Dedicated PO Fulfillment & Missing Stock Modal
  const [poFulfillmentModalOpen, setPoFulfillmentModalOpen] = useState(false);
  const [poFulfillmentLoading, setPoFulfillmentLoading] = useState(false);
  const [poFulfillmentData, setPoFulfillmentData] = useState({ poId: null, poNo: '', items: [] });
  const [poFulfillmentSelectedKeys, setPoFulfillmentSelectedKeys] = useState([]);
  const [poFulfillmentOrderQtys, setPoFulfillmentOrderQtys] = useState({});
  const [poFulfillmentRates, setPoFulfillmentRates] = useState({});
  const [poFulfillmentVendorId, setPoFulfillmentVendorId] = useState(null);
  const [poFulfillmentPiNo, setPoFulfillmentPiNo] = useState('');
  const [poFulfillmentDeliveryDate, setPoFulfillmentDeliveryDate] = useState('');
  const [poFulfillmentDirectStock, setPoFulfillmentDirectStock] = useState(false);
  const [poFulfillmentSavingPI, setPoFulfillmentSavingPI] = useState(false);
  const [poFulfillmentError, setPoFulfillmentError] = useState('');
  const [poFulfillmentSuccessMsg, setPoFulfillmentSuccessMsg] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/purchase-orders`;
      if (filterParamPoNo) {
        url += `?poNo=${encodeURIComponent(filterParamPoNo)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching purchase orders:', err);
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
          const allowedGroups = ['sundry debtors', 'sundry creditors', 'party', 'customer', 'vendor'];
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

  const fetchStockAvailability = async (excludeId) => {
    try {
      let url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/purchase-orders/stock-availability`;
      if (excludeId) {
        url += `?excludePoId=${excludeId}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStockAvailability(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching stock availability:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchLedgers();
    fetchItems();
    fetchCompanyProfile();
    fetchStockAvailability();
  }, [filterParamPoNo]);

  // Map of stock availability by ItemCode__SubCode
  const stockMap = useMemo(() => {
    const map = {};
    for (const s of stockAvailability) {
      const key = `${s.ItemCode}__${(s.SubCode || '').trim()}`;
      map[key] = {
        CurrentStock: parseFloat(s.CurrentStock) || 0,
        CommittedQty: parseFloat(s.CommittedQty) || 0,
        PendingPIQty: parseFloat(s.PendingPIQty) || 0,
        AvailableStock: parseFloat(s.AvailableStock) || 0,
        ItemName: s.ItemName || '',
        Unit: s.Unit || ''
      };
    }
    return map;
  }, [stockAvailability]);

  // Compute live missing / shortage items for current gridRows (User Formula: Demand - CurrentStock - PendingPIQty)
  const shortageAnalysis = useMemo(() => {
    const missing = [];
    gridRows.forEach(r => {
      if (!r.ITEMCODE) return;
      const qty = parseFloat(r.QUANTITY) || 0;
      if (qty <= 0) return;
      const key = `${r.ITEMCODE}__${(r.SUBCODE || '').trim()}`;
      const stock = stockMap[key] || { CurrentStock: 0, CommittedQty: 0, PendingPIQty: 0, AvailableStock: 0 };
      const demand = (stock.CommittedQty || 0) + qty;
      const shortage = Math.max(0, demand - (stock.CurrentStock || 0) - (stock.PendingPIQty || 0));

      if (shortage > 0) {
        const it = items.find(x => x.ItemCode === r.ITEMCODE && (x.SubCode || '') === (r.SUBCODE || ''));
        const rate = parseFloat(r.RATE) || (it?.Costing ? parseFloat(it.Costing) : 0);
        missing.push({
          ITEMCODE: r.ITEMCODE,
          SUBCODE: r.SUBCODE || '',
          ItemName: it?.ItemName || stock.ItemName || '',
          currentStock: stock.CurrentStock,
          committedQty: stock.CommittedQty,
          pendingPIQty: stock.PendingPIQty,
          availableStock: stock.AvailableStock,
          orderQty: qty,
          shortageQty: shortage,
          requiredQty: shortage, // user can edit this to any number of quantity
          unit: r.UNIT || it?.Unit || 'PCS',
          rate: rate,
          amount: (shortage * rate).toFixed(2)
        });
      }
    });
    return missing;
  }, [gridRows, stockMap, items]);

  // Open PO Fulfillment Modal for a specific PO (User Request)
  const openPOFulfillmentModal = async (poId, poNumber) => {
    setPoFulfillmentModalOpen(true);
    setPoFulfillmentLoading(true);
    setPoFulfillmentError('');
    setPoFulfillmentSuccessMsg('');
    setPoFulfillmentVendorId(null);
    setPoFulfillmentDirectStock(false);
    setPoFulfillmentDeliveryDate('');
    setPoFulfillmentData({ poId, poNo: poNumber, items: [] });

    // Fetch next PI number
    try {
      const piRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/performa-invoices/next-no`);
      if (piRes.ok) {
        const piData = await piRes.json();
        setPoFulfillmentPiNo(piData.nextNo || 'PI-1');
      } else {
        setPoFulfillmentPiNo('PI-1');
      }
    } catch {
      setPoFulfillmentPiNo('PI-1');
    }

    // Fetch fulfillment report for this PO
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/purchase-orders/fulfillment-report?poId=${poId}`);
      if (res.ok) {
        const data = await res.json();
        const itemsList = data.items || [];
        setPoFulfillmentData({ poId, poNo: poNumber, items: itemsList });

        const selected = [];
        const qtys = {};
        const rates = {};
        itemsList.forEach(it => {
          const key = `${it.ItemCode}___${it.SubCode || ''}`;
          if (it.MissingQty > 0) {
            selected.push(key);
            qtys[key] = it.MissingQty;
          } else {
            qtys[key] = it.TotalPOPendingQty || 0;
          }
          rates[key] = parseFloat(it.Costing) || 0;
        });

        if (selected.length === 0 && itemsList.length > 0) {
          itemsList.forEach(it => {
            selected.push(`${it.ItemCode}___${it.SubCode || ''}`);
          });
        }

        setPoFulfillmentSelectedKeys(selected);
        setPoFulfillmentOrderQtys(qtys);
        setPoFulfillmentRates(rates);
      }
    } catch (err) {
      console.error('Error fetching PO fulfillment:', err);
      setPoFulfillmentError('Could not fetch stock fulfillment for this PO');
    } finally {
      setPoFulfillmentLoading(false);
    }
  };

  // Generate Proforma Invoice from PO Fulfillment Modal
  const handleSavePOFulfillmentPI = async () => {
    if (!poFulfillmentVendorId) {
      setPoFulfillmentError('Please select a Supplier / Vendor for this Proforma Invoice.');
      return;
    }
    if (!poFulfillmentPiNo.trim()) {
      setPoFulfillmentError('Please enter a valid Proforma Invoice number.');
      return;
    }

    const selectedItems = (poFulfillmentData.items || []).filter(it => {
      const key = `${it.ItemCode}___${it.SubCode || ''}`;
      return poFulfillmentSelectedKeys.includes(key);
    });

    if (selectedItems.length === 0) {
      setPoFulfillmentError('Please select at least one item.');
      return;
    }

    const validDetails = [];
    for (const it of selectedItems) {
      const key = `${it.ItemCode}___${it.SubCode || ''}`;
      const qty = parseFloat(poFulfillmentOrderQtys[key]) || 0;
      if (qty <= 0) {
        setPoFulfillmentError(`Quantity for item ${it.ItemCode} must be greater than 0.`);
        return;
      }
      const rate = parseFloat(poFulfillmentRates[key]) || 0;
      validDetails.push({
        ITEMCODE: it.ItemCode,
        SUBCODE: it.SubCode || '',
        QUANTITY: qty,
        UNIT: it.Unit || 'PCS',
        RATE: rate,
        AMOUNT: qty * rate,
        REMARK: `Shortfall fulfillment for Customer PO ${poFulfillmentData.poNo}`
      });
    }

    setPoFulfillmentSavingPI(true);
    setPoFulfillmentError('');

    try {
      const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
      const username = localUser.Username || localUser.username || 'System';

      const payload = {
        PINO: poFulfillmentPiNo.trim(),
        PIDATE: todayDate,
        LEDGERID: poFulfillmentVendorId,
        CUSTOMERPOID: poFulfillmentData.poId || null,
        CUSTOMERPONO: poFulfillmentData.poNo || null,
        DELIVERYDATE: poFulfillmentDeliveryDate || null,
        STATUS: poFulfillmentDirectStock ? 'Completed' : 'Ordered',
        updateStockDirectly: poFulfillmentDirectStock,
        REMARK: `Created from Customer PO ${poFulfillmentData.poNo} for shortfall fulfillment`,
        CREATEDBY: username,
        UPDATEDBY: username,
        Details: validDetails
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/performa-invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setPoFulfillmentSuccessMsg(`Proforma Invoice ${poFulfillmentPiNo.trim()} created successfully! Stock & PI pipeline updated.`);

        // Re-fetch this PO's fulfillment to show updated missing quantity in real-time!
        const refetchRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/purchase-orders/fulfillment-report?poId=${poFulfillmentData.poId}`);
        if (refetchRes.ok) {
          const refetchData = await refetchRes.json();
          setPoFulfillmentData(prev => ({ ...prev, items: refetchData.items || [] }));
        }

        fetchOrders();
      } else {
        setPoFulfillmentError(data.message || 'Failed to create Proforma Invoice');
      }
    } catch (err) {
      console.error('Error creating Proforma Invoice:', err);
      setPoFulfillmentError('Network error while creating Proforma Invoice.');
    } finally {
      setPoFulfillmentSavingPI(false);
    }
  };

  // Handlers for Shortage Performa Invoice Modal
  const handleOpenShortageModal = async () => {
    setShortageError('');
    setShortageSuccessMsg('');
    setShortageVendorId(null);
    setShortageDeliveryDate(deliveryDate || '');
    setShortageDirectStock(false);
    setShortageRows(shortageAnalysis.map(item => ({ ...item })));

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/performa-invoices/next-no`);
      if (res.ok) {
        const data = await res.json();
        setShortagePiNo(data.nextNo || 'PI-1');
      } else {
        setShortagePiNo('PI-1');
      }
    } catch {
      setShortagePiNo('PI-1');
    }

    setShortageModalOpen(true);
  };

  const handleShortageRowChange = (index, field, value) => {
    const updated = [...shortageRows];
    updated[index][field] = value;
    if (field === 'requiredQty' || field === 'rate') {
      const q = parseFloat(updated[index].requiredQty) || 0;
      const r = parseFloat(updated[index].rate) || 0;
      updated[index].amount = (q * r).toFixed(2);
    }
    setShortageRows(updated);
  };

  const handleSaveShortagePI = async () => {
    if (!shortageVendorId) {
      setShortageError('Please select a Supplier / Vendor for this Performa Invoice.');
      return;
    }
    if (!shortagePiNo.trim()) {
      setShortageError('Please enter a valid Performa Invoice number.');
      return;
    }
    const validRows = shortageRows.filter(r => r.ITEMCODE && parseFloat(r.requiredQty) > 0);
    if (validRows.length === 0) {
      setShortageError('Please ensure at least one item has Required Quantity > 0.');
      return;
    }

    setSavingShortagePI(true);
    setShortageError('');

    try {
      const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
      const username = localUser.Username || localUser.username || 'System';

      const payload = {
        PINO: shortagePiNo.trim(),
        PIDATE: todayDate,
        LEDGERID: shortageVendorId,
        CUSTOMERPOID: editingId || null,
        CUSTOMERPONO: poNo || null,
        DELIVERYDATE: shortageDeliveryDate || null,
        STATUS: shortageDirectStock ? 'Completed' : 'Ordered',
        updateStockDirectly: shortageDirectStock,
        REMARK: `Created from Customer PO ${poNo} for shortage fulfillment`,
        CREATEDBY: username,
        UPDATEDBY: username,
        Details: validRows.map(r => ({
          ITEMCODE: r.ITEMCODE,
          SUBCODE: r.SUBCODE || '',
          QUANTITY: parseFloat(r.requiredQty) || 0,
          UNIT: r.unit || 'PCS',
          RATE: parseFloat(r.rate) || 0,
          AMOUNT: parseFloat(r.amount) || ((parseFloat(r.requiredQty) || 0) * (parseFloat(r.rate) || 0))
        }))
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/performa-invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setShortageError(data.message || 'Failed to create Performa Invoice');
        return;
      }

      setShortageModalOpen(false);
      setShortageSuccessMsg(`Performa Invoice ${shortagePiNo} created successfully! ${shortageDirectStock ? 'Stock has been directly updated in inventory.' : 'Items ordered from supplier.'}`);
      await fetchStockAvailability(editingId);
      await fetchOrders();
    } catch (err) {
      console.error('Error creating PI from shortage:', err);
      setShortageError(err.message || 'Server error creating Performa Invoice');
    } finally {
      setSavingShortagePI(false);
    }
  };

  // Handle row calculations
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
    newRows[index].RATE = item && item.MRP ? String(item.MRP) : (item && item.Costing ? String(item.Costing) : '');
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

  // Open dialog for new PO
  const handleOpenNewDialog = async () => {
    setDialogError('');
    setShortageSuccessMsg('');
    setEditingId(null);
    setPoDate(todayDate);
    setDeliveryDate('');
    setLedgerId(null);
    setRemark('');
    setGridRows([{ ...emptyRow }]);

    fetchStockAvailability();

    // Fetch next PO Number
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/purchase-orders/next-no`);
      if (res.ok) {
        const data = await res.json();
        setPoNo(data.nextNo || 'PO-1');
      } else {
        setPoNo('PO-1');
      }
    } catch {
      setPoNo('PO-1');
    }

    setOpenDialog(true);
  };

  // Open dialog for editing PO
  const handleEditOrder = (order) => {
    setDialogError('');
    setShortageSuccessMsg('');
    setEditingId(order.ID);
    setPoNo(order.PONO || '');
    setPoDate(order.PODATE ? order.PODATE.split('T')[0] : todayDate);
    setDeliveryDate(order.DELIVERYDATE ? order.DELIVERYDATE.split('T')[0] : '');
    setLedgerId(order.LEDGERID);
    setRemark(order.REMARK || '');

    fetchStockAvailability(order.ID);

    if (order.Details && order.Details.length > 0) {
      setGridRows(order.Details.map(d => ({
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

  const handleSaveOrder = async (printAfter = false) => {
    if (!poNo.trim()) {
      setDialogError('Please enter a valid Purchase Order number.');
      return;
    }
    if (!ledgerId) {
      setDialogError('Please select an Account Ledger / Customer.');
      return;
    }

    const validRows = gridRows.filter(r => r.ITEMCODE && parseFloat(r.QUANTITY) > 0);
    if (validRows.length === 0) {
      setDialogError('Please add at least one valid line item with Item Code and Quantity > 0.');
      return;
    }

    const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
    const username = localUser.Username || localUser.username || 'System';

    const payload = {
      PONO: poNo.trim(),
      PODATE: poDate,
      LEDGERID: ledgerId,
      DELIVERYDATE: deliveryDate || null,
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
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/purchase-orders/${editingId}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/purchase-orders`;
      
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        if (printAfter) {
          const ledgerObj = ledgers.find(l => l.Id === ledgerId) || {};
          generatePDF({ ...payload, ID: editingId || data.id }, ledgerObj);
        }
        const savedPoId = editingId || data.id;
        const savedPoNo = poNo.trim();
        handleCloseDialog();
        fetchOrders();

        // Automatically open the Stock Fulfillment & Missing Items modal for this PO!
        openPOFulfillmentModal(savedPoId, savedPoNo);
      } else {
        setDialogError(data.message || 'Failed to save purchase order');
      }
    } catch (err) {
      console.error('Error saving purchase order:', err);
      setDialogError('Network error while saving purchase order');
    }
  };

  const openDeleteModal = (order) => {
    setOrderToDelete(order);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!orderToDelete) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/purchase-orders/${orderToDelete.ID}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        setDeleteConfirmOpen(false);
        setOrderToDelete(null);
        fetchOrders();
      } else {
        alert(data.message || 'Failed to delete purchase order');
      }
    } catch (err) {
      console.error('Error deleting purchase order:', err);
      alert('Network error while deleting purchase order');
    }
  };

  // Generate Professional PDF
  const generatePDF = (order, ledgerObj) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const compName = companyProfile ? companyProfile.CompanyName : 'FRM ERP';
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text(compName, 14, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);

    let currentHeaderY = 25;
    if (companyProfile) {
      const addr = [companyProfile.Address1, companyProfile.Address2].filter(Boolean).join(', ');
      const cityDetails = [companyProfile.City, companyProfile.StateName, companyProfile.Pincode].filter(Boolean).join(', ');
      if (addr) { doc.text(addr, 14, currentHeaderY); currentHeaderY += 4; }
      if (cityDetails) { doc.text(cityDetails, 14, currentHeaderY); currentHeaderY += 4; }
      const taxDetails = [];
      if (companyProfile.GSTIN) taxDetails.push(`GSTIN: ${companyProfile.GSTIN}`);
      if (companyProfile.MobileNo) taxDetails.push(`Phone: ${companyProfile.MobileNo}`);
      if (taxDetails.length > 0) { doc.text(taxDetails.join(' | '), 14, currentHeaderY); currentHeaderY += 4; }
    } else {
      doc.text('Factory Site Address, City, State, ZIP', 14, 25);
      doc.text('GSTIN: 27AAAAA0000A1Z5 | Phone: +91 9876543210', 14, 29);
      currentHeaderY = 33;
    }

    // Title on Right
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('PURCHASE ORDER', 196, 20, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    doc.text(`PO No: ${order.PONO}`, 196, 25, { align: 'right' });
    const orderDateFormatted = order.PODATE ? new Date(order.PODATE).toLocaleDateString('en-GB') : '-';
    doc.text(`Date: ${orderDateFormatted}`, 196, 29, { align: 'right' });
    if (order.DELIVERYDATE) {
      const deliveryFormatted = new Date(order.DELIVERYDATE).toLocaleDateString('en-GB');
      doc.text(`Expected Delivery: ${deliveryFormatted}`, 196, 33, { align: 'right' });
    }

    const dividerY = Math.max(currentHeaderY + 2, 38);
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, dividerY, 196, dividerY);

    // Vendor / Customer Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('PARTY / CUSTOMER DETAILS', 14, dividerY + 6);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(ledgerObj?.LedgerName || order.LedgerName || 'Customer / Vendor', 14, dividerY + 11);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70);
    let partyY = dividerY + 15;
    if (ledgerObj?.City || order.City) {
      doc.text(`City / State: ${ledgerObj?.City || order.City || ''}`, 14, partyY);
      partyY += 4;
    }
    if (ledgerObj?.GSTIN || order.GSTIN) {
      doc.text(`GSTIN: ${ledgerObj?.GSTIN || order.GSTIN || ''}`, 14, partyY);
      partyY += 4;
    }

    // Table
    const tableStartY = partyY + 4;
    const tableColumns = ['#', 'Item Code', 'SubCode', 'Item Description', 'Qty', 'Unit', 'Rate', 'Amount'];
    const details = order.Details || [];
    const tableRows = details.map((d, idx) => [
      idx + 1,
      d.ITEMCODE || '',
      d.SUBCODE || '-',
      d.ItemName || d.ITEMCODE || '',
      parseFloat(d.QUANTITY || 0).toFixed(2),
      d.UNIT || 'PCS',
      parseFloat(d.RATE || 0).toFixed(2),
      parseFloat(d.AMOUNT || 0).toFixed(2)
    ]);

    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: tableStartY,
      theme: 'grid',
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 2 },
      columnStyles: {
        0: { width: 10, halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'center' },
        6: { halign: 'right' },
        7: { halign: 'right' }
      }
    });

    const finalY = doc.lastAutoTable.finalY + 8;
    const totalQty = details.reduce((sum, d) => sum + (parseFloat(d.QUANTITY) || 0), 0);
    const totalAmount = details.reduce((sum, d) => sum + (parseFloat(d.AMOUNT) || 0), 0);

    // Totals block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 59, 102);
    doc.text(`Total Ordered Qty: ${totalQty.toFixed(2)}`, 140, finalY, { align: 'right' });
    doc.text(`Total Amount: Rs. ${totalAmount.toFixed(2)}`, 196, finalY, { align: 'right' });

    if (order.REMARK) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(80);
      doc.text(`Remarks: ${order.REMARK}`, 14, finalY + 8);
    }

    const pageHeight = doc.internal.pageSize.height;
    doc.line(14, pageHeight - 25, 70, pageHeight - 25);
    doc.text('Prepared By', 42, pageHeight - 20, { align: 'center' });

    doc.line(140, pageHeight - 25, 196, pageHeight - 25);
    doc.text('Authorized Signatory', 168, pageHeight - 20, { align: 'center' });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (filterParamPoNo) {
        return String(o.PONO || '').trim().toLowerCase() === filterParamPoNo.trim().toLowerCase();
      }
      const matchesSearch = 
        (o.PONO && o.PONO.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.LedgerName && o.LedgerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.REMARK && o.REMARK.toLowerCase().includes(searchTerm.toLowerCase()));

      const orderDateStr = o.PODATE ? o.PODATE.split('T')[0] : '';
      let matchesDate = true;
      if (fromDate && orderDateStr < fromDate) matchesDate = false;
      if (toDate && orderDateStr > toDate) matchesDate = false;

      let matchesStatus = true;
      const st = String(o.STATUS || '').toLowerCase();
      if (statusFilter === 'active') {
        matchesStatus = st === 'pending' || st === 'partially fulfilled';
      } else if (statusFilter === 'pending') {
        matchesStatus = st === 'pending';
      } else if (statusFilter === 'completed') {
        matchesStatus = st === 'completed';
      }

      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [orders, filterParamPoNo, searchTerm, fromDate, toDate, statusFilter]);

  // Totals for live grid
  const liveTotalQty = gridRows.reduce((sum, r) => sum + (parseFloat(r.QUANTITY) || 0), 0);
  const liveTotalAmount = gridRows.reduce((sum, r) => sum + (parseFloat(r.AMOUNT) || 0), 0);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 3 } }}>
      {/* Title & Top Action Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e40af' }}>
            <OrderIcon />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66' }}>
              Purchase Orders
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Record and manage purchase orders from customers with automated Sales deductions
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchOrders}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<HourglassIcon />}
            onClick={() => navigate('/dashboard/reports/pending-po?tab=fulfillment')}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Fulfillment Planning
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenNewDialog}
            disabled={!hasAddPermission()}
            sx={{ backgroundColor: '#0F3B66', textTransform: 'none', fontWeight: 600, '&:hover': { backgroundColor: '#0c2f52' } }}
          >
            New Purchase Order
          </Button>
        </Box>
      </Box>

      {/* Main Table Card */}
      <Paper sx={{ width: '100%', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 2 }, py: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1.5, bgcolor: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
          <TextField
            size="small"
            placeholder="Search PO No, Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" fontSize="small" /></InputAdornment> }}
            sx={{ width: { xs: '100%', sm: 220 } }}
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
              All ({orders.length})
            </ToggleButton>
            <ToggleButton value="active" sx={{ textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem', fontWeight: 600 }}>
              <HourglassIcon fontSize="small" sx={{ mr: 0.5, color: '#f59e0b' }} /> Active
            </ToggleButton>
            <ToggleButton value="pending" sx={{ textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem', fontWeight: 600 }}>
              Pending
            </ToggleButton>
            <ToggleButton value="completed" sx={{ textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem', fontWeight: 600 }}>
              <CheckCircleIcon fontSize="small" sx={{ mr: 0.5, color: '#16a34a' }} /> Completed
            </ToggleButton>
          </ToggleButtonGroup>
        </Toolbar>

        {filterParamPoNo && (
          <Alert
            severity="info"
            action={
              <Button color="inherit" size="small" onClick={() => { setSearchParams({}); fetchOrders(); }}>
                Show All Orders
              </Button>
            }
            sx={{ mx: 2, mt: 1.5 }}
          >
            Viewing single Purchase Order <strong>{filterParamPoNo}</strong>.
          </Alert>
        )}

        {/* Orders Table */}
        <TableContainer>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>PO Number</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>PO Date</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Delivery Date</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Customer / Party</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }} align="right">Items</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }} align="right">Ordered Qty</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }} align="right">Delivered Qty</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }} align="right">Pending Qty</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }} align="right">Amount</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }} align="center">Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((order) => {
                const isCompleted = order.STATUS === 'Completed';
                const isPartial = order.STATUS === 'Partially Fulfilled';
                const statusColor = isCompleted ? 'success' : isPartial ? 'info' : 'warning';
                const ordQty = parseFloat(order.OrderQtySum ?? order.TOTALQTY) || 0;
                const delQty = parseFloat(order.DeliveredQtySum) || 0;
                const pendQty = parseFloat(order.PendingQtySum ?? (ordQty - delQty)) || 0;

                return (
                  <TableRow hover key={order.ID} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                        {order.PONO}
                      </Typography>
                    </TableCell>
                    <TableCell>{order.PODATE ? order.PODATE.split('T')[0] : '-'}</TableCell>
                    <TableCell>{order.DELIVERYDATE ? order.DELIVERYDATE.split('T')[0] : '-'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {order.LedgerName || 'N/A'}
                      </Typography>
                      {order.City && (
                        <Typography variant="caption" color="text.secondary">
                          {order.City}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{order.TotalItems ?? (order.Details ? order.Details.length : 0)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{ordQty.toFixed(2)}</TableCell>
                    <TableCell align="right" sx={{ color: delQty > 0 ? '#16a34a' : 'text.secondary', fontWeight: 600 }}>
                      {delQty.toFixed(2)}
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
                      ₹{parseFloat(order.TOTALAMOUNT || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={order.STATUS || 'Pending'}
                        color={statusColor}
                        sx={{ fontWeight: 600, fontSize: '0.75rem', height: 22 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => { setViewOrder(order); setViewDialogOpen(true); }}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Stock Shortfall & Fulfillment Analysis">
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => openPOFulfillmentModal(order.ID, order.PONO)}
                        >
                          <HourglassIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Print PO">
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => {
                            const ledgerObj = ledgers.find(l => l.Id === order.LEDGERID) || {};
                            generatePDF(order, ledgerObj);
                          }}
                        >
                          <PrintIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit PO">
                        <span>
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={!hasEditPermission()}
                            onClick={() => handleEditOrder(order)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete PO">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={!hasDeletePermission()}
                            onClick={() => openDeleteModal(order)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredOrders.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No purchase orders found matching the criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredOrders.length}
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
            {editingId ? `Edit Purchase Order (${poNo})` : 'New Purchase Order'}
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
                  label="PO Number"
                  value={poNo}
                  onChange={(e) => setPoNo(e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="PO Date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  required
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
              <Grid item xs={12} sm={6} md={3}>
                <Autocomplete
                  options={ledgers}
                  getOptionLabel={(option) => option.LedgerName || ''}
                  value={ledgers.find(l => l.Id === ledgerId) || null}
                  onChange={(e, val) => setLedgerId(val ? val.Id : null)}
                  renderInput={(params) => <TextField {...params} label="Customer / Party" size="small" required fullWidth />}
                  fullWidth
                  slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Remarks / Terms"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="e.g. Delivery terms, payment condition, reference details"
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Detail Line Items Grid */}
          <Paper sx={{ p: 2, mb: 2, border: '1px solid #e2e8f0', borderRadius: 1.5, boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                Order Line Items
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addGridRow}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Add Line Item
              </Button>
            </Box>

            {shortageSuccessMsg && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setShortageSuccessMsg('')}>
                {shortageSuccessMsg}
              </Alert>
            )}

            {shortageAnalysis.length > 0 && (
              <Alert
                severity="warning"
                variant="outlined"
                icon={<HourglassIcon sx={{ color: '#d97706' }} />}
                action={
                  <Button
                    variant="contained"
                    color="warning"
                    size="small"
                    startIcon={<FlashOnIcon />}
                    onClick={handleOpenShortageModal}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)' }}
                  >
                    ⚡ Create Performa Invoice ({shortageAnalysis.length} Missing)
                  </Button>
                }
                sx={{ mb: 2, bgcolor: '#fffbeb', borderColor: '#fde68a', alignItems: 'center' }}
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#92400e' }}>
                    Stock Shortage: {shortageAnalysis.length} item(s) cannot be fulfilled from current stock!
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#b45309' }}>
                    Considering current stock and existing active customer PO commitments, you need to order missing quantities.
                  </Typography>
                </Box>
              </Alert>
            )}

            <TableContainer sx={{ maxHeight: '35vh' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, width: '32%' }}>Item (Code / SubCode / Name)</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: '10%' }} align="right">Quantity</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: '22%' }} align="center">Stock & Shortage</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: '8%' }}>Unit</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: '12%' }} align="right">Rate (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: '12%' }} align="right">Amount (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: '4%' }} align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gridRows.map((row, idx) => {
                    const selectedItem = items.find(
                      it => it.ItemCode === row.ITEMCODE && (it.SubCode || '') === (row.SUBCODE || '')
                    );

                    const key = `${row.ITEMCODE}__${(row.SUBCODE || '').trim()}`;
                    const stock = stockMap[key] || { CurrentStock: 0, CommittedQty: 0, AvailableStock: 0 };
                    const qty = parseFloat(row.QUANTITY) || 0;
                    const demand = (stock.CommittedQty || 0) + qty;
                    const shortage = Math.max(0, demand - (stock.CurrentStock || 0));
                    const isShortage = shortage > 0 && qty > 0;

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
                            inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                            fullWidth
                          />
                        </TableCell>
                        <TableCell align="center">
                          {row.ITEMCODE ? (
                            <Tooltip
                              title={
                                <Box sx={{ p: 0.5 }}>
                                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                                    In-Hand Physical Stock: {stock.CurrentStock} {row.UNIT || ''}
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block' }}>
                                    Other Pending POs: {stock.CommittedQty} {row.UNIT || ''}
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block', color: stock.AvailableStock >= qty ? '#4ade80' : '#f87171' }}>
                                    Net Available: {stock.AvailableStock} {row.UNIT || ''}
                                  </Typography>
                                  {isShortage && (
                                    <Typography variant="caption" sx={{ display: 'block', color: '#fca5a5', fontWeight: 700, mt: 0.5 }}>
                                      ⚠️ Shortage: {shortage.toFixed(2)} {row.UNIT || ''}
                                    </Typography>
                                  )}
                                </Box>
                              }
                              arrow
                            >
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                {isShortage ? (
                                  <Chip
                                    size="small"
                                    color="error"
                                    label={`Missing: ${shortage.toFixed(2)}`}
                                    sx={{ fontWeight: 700, fontSize: '0.72rem', height: 22 }}
                                  />
                                ) : qty > 0 ? (
                                  <Chip
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                    label={`In Stock (${stock.AvailableStock})`}
                                    sx={{ fontWeight: 600, fontSize: '0.72rem', height: 22 }}
                                  />
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    Stock: {stock.CurrentStock}
                                  </Typography>
                                )}
                              </Box>
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="text.secondary">-</Typography>
                          )}
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
                Total Ordered Qty: <strong>{liveTotalQty.toFixed(2)}</strong>
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
            onClick={() => handleSaveOrder(true)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Save & Print
          </Button>
          <Button
            variant="contained"
            onClick={() => handleSaveOrder(false)}
            sx={{ backgroundColor: '#0F3B66', textTransform: 'none', fontWeight: 600, '&:hover': { backgroundColor: '#0c2f52' } }}
          >
            {editingId ? 'Update Order' : 'Save Order'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Order Modal */}
      {viewOrder && (
        <Dialog
          open={viewDialogOpen}
          onClose={() => setViewDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ backgroundColor: '#0F3B66', color: 'white', py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Order Details: {viewOrder.PONO}
            </Typography>
            <IconButton size="small" onClick={() => setViewDialogOpen(false)} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 2.5, backgroundColor: '#f8fafc' }}>
            <Paper sx={{ p: 2, mb: 2, border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">Customer / Party</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{viewOrder.LedgerName}</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">PO Date</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {viewOrder.PODATE ? viewOrder.PODATE.split('T')[0] : '-'}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">Expected Delivery</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {viewOrder.DELIVERYDATE ? viewOrder.DELIVERYDATE.split('T')[0] : '-'}
                  </Typography>
                </Grid>
              </Grid>

              {/* Progress Bar */}
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #e2e8f0' }}>
                {(() => {
                  const oQty = parseFloat(viewOrder.OrderQtySum ?? viewOrder.TOTALQTY) || 0;
                  const dQty = parseFloat(viewOrder.DeliveredQtySum) || 0;
                  const pQty = parseFloat(viewOrder.PendingQtySum ?? (oQty - dQty)) || 0;
                  const percent = oQty > 0 ? Math.min(100, Math.round((dQty / oQty) * 100)) : 0;

                  return (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          Fulfillment Progress: {percent}% Delivered
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Delivered: {dQty} / Ordered: {oQty} | Pending: <strong>{pQty}</strong>
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

            {/* Line items in view */}
            <TableContainer component={Paper} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Item Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>SubCode</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Ordered</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Delivered</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Pending</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Rate (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Amount (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(viewOrder.Details || []).map((d, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ fontWeight: 600 }}>{d.ITEMCODE}</TableCell>
                      <TableCell>{d.SUBCODE || '-'}</TableCell>
                      <TableCell>{d.ItemName || d.ITEMCODE}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{d.QUANTITY}</TableCell>
                      <TableCell align="right" sx={{ color: (d.DELIVEREDQTY || 0) > 0 ? '#16a34a' : 'inherit', fontWeight: 600 }}>
                        {d.DELIVEREDQTY || 0}
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={d.PENDINGQTY ?? (d.QUANTITY - (d.DELIVEREDQTY || 0))}
                          color={(d.PENDINGQTY || 0) <= 0 ? 'default' : 'warning'}
                          sx={{ height: 20, fontSize: '0.72rem', fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>{d.UNIT || 'PCS'}</TableCell>
                      <TableCell align="right">₹{parseFloat(d.RATE || 0).toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>₹{parseFloat(d.AMOUNT || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => {
                const ledgerObj = ledgers.find(l => l.Id === viewOrder.LEDGERID) || {};
                generatePDF(viewOrder, ledgerObj);
              }}
              sx={{ backgroundColor: '#0F3B66', textTransform: 'none', fontWeight: 600 }}
            >
              Print PO
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemName={`Purchase Order ${orderToDelete?.PONO || ''}`}
      />

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        pdfUrl={previewUrl}
        title="Purchase Order PDF"
      />

      {/* PO Fulfillment & Missing Stock Analysis Modal */}
      <Dialog
        open={poFulfillmentModalOpen}
        onClose={() => { if (!poFulfillmentSavingPI) setPoFulfillmentModalOpen(false); }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: '#0F3B66', color: 'white', py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <HourglassIcon sx={{ color: '#f59e0b', fontSize: 28 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Stock Fulfillment & Missing Items Analysis — PO #{poFulfillmentData.poNo}
                </Typography>
                <Typography variant="caption" sx={{ color: '#93c5fd' }}>
                  Missing Qty = Total PO Demand - Stock in Hand - Pending Proforma Invoice Quantity
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setPoFulfillmentModalOpen(false)} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, backgroundColor: '#f8fafc' }}>
          {poFulfillmentSuccessMsg && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setPoFulfillmentSuccessMsg('')}>
              {poFulfillmentSuccessMsg}
            </Alert>
          )}

          {poFulfillmentError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {poFulfillmentError}
            </Alert>
          )}

          {/* Shortfall Alert */}
          {poFulfillmentData.items.some(i => i.MissingQty > 0) ? (
            <Alert severity="warning" variant="outlined" sx={{ mb: 2, bgcolor: '#fffbeb', borderColor: '#fde68a' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#92400e' }}>
                ⚠️ Missing Stock Detected for PO #{poFulfillmentData.poNo}!
              </Typography>
              <Typography variant="body2" sx={{ color: '#b45309' }}>
                {poFulfillmentData.items.filter(i => i.MissingQty > 0).length} item(s) are missing in inventory to fulfill this order.
                Select the items below, adjust order quantities as needed, and click <strong>Generate Proforma Invoice</strong> to place a vendor order.
              </Typography>
            </Alert>
          ) : (
            <Alert severity="success" variant="outlined" sx={{ mb: 2, bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#166534' }}>
                ✅ All Items Fully Covered!
              </Typography>
              <Typography variant="body2" sx={{ color: '#15803d' }}>
                Stock in hand and existing Proforma Invoices are sufficient to fulfill this purchase order. You can still order additional stock below if desired.
              </Typography>
            </Alert>
          )}

          {/* Supplier & PI Details Paper */}
          <Paper sx={{ p: 2, mb: 2, border: '1px solid #e2e8f0', borderRadius: 1.5, boxShadow: 'none' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Performa Invoice No"
                  value={poFulfillmentPiNo}
                  onChange={(e) => setPoFulfillmentPiNo(e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  options={ledgers}
                  getOptionLabel={(option) => option.LedgerName || ''}
                  value={ledgers.find(l => l.Id === poFulfillmentVendorId) || null}
                  onChange={(e, val) => setPoFulfillmentVendorId(val ? val.Id : null)}
                  renderInput={(params) => <TextField {...params} label="Select Supplier / Vendor" size="small" required fullWidth />}
                  fullWidth
                  slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Expected Delivery Date"
                  value={poFulfillmentDeliveryDate}
                  onChange={(e) => setPoFulfillmentDeliveryDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={poFulfillmentDirectStock}
                      onChange={(e) => setPoFulfillmentDirectStock(e.target.checked)}
                      color="success"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 600, color: poFulfillmentDirectStock ? '#16a34a' : 'text.primary' }}>
                      ⚡ Update Stock Directly (mark received immediately into inventory)
                    </Typography>
                  }
                  sx={{ mt: 0.5 }}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Items Table */}
          <Paper sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: '42vh' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={
                          poFulfillmentData.items.length > 0 &&
                          poFulfillmentData.items.every(i => poFulfillmentSelectedKeys.includes(`${i.ItemCode}___${i.SubCode || ''}`))
                        }
                        indeterminate={
                          poFulfillmentData.items.some(i => poFulfillmentSelectedKeys.includes(`${i.ItemCode}___${i.SubCode || ''}`)) &&
                          !poFulfillmentData.items.every(i => poFulfillmentSelectedKeys.includes(`${i.ItemCode}___${i.SubCode || ''}`))
                        }
                        onChange={() => {
                          const allKeys = poFulfillmentData.items.map(i => `${i.ItemCode}___${i.SubCode || ''}`);
                          const isAll = allKeys.length > 0 && allKeys.every(k => poFulfillmentSelectedKeys.includes(k));
                          if (isAll) {
                            setPoFulfillmentSelectedKeys([]);
                          } else {
                            setPoFulfillmentSelectedKeys(allKeys);
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Item Description</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">PO Demand</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Stock in Hand</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Pending PI</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Missing Qty</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 120 }} align="right">Order Qty</TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 90 }} align="right">Rate (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Amount (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {poFulfillmentLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                        <CircularProgress size={30} />
                      </TableCell>
                    </TableRow>
                  ) : poFulfillmentData.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No items found for this purchase order.
                      </TableCell>
                    </TableRow>
                  ) : (
                    poFulfillmentData.items.map((row) => {
                      const key = `${row.ItemCode}___${row.SubCode || ''}`;
                      const isSelected = poFulfillmentSelectedKeys.includes(key);
                      const q = poFulfillmentOrderQtys[key] !== undefined ? poFulfillmentOrderQtys[key] : (row.MissingQty > 0 ? row.MissingQty : 0);
                      const r = poFulfillmentRates[key] !== undefined ? poFulfillmentRates[key] : (row.Costing || 0);
                      const lineAmt = (parseFloat(q) || 0) * (parseFloat(r) || 0);

                      return (
                        <TableRow
                          hover
                          key={key}
                          selected={isSelected}
                          sx={{
                            bgcolor: isSelected ? '#f0f9ff' : row.MissingQty > 0 ? '#fffbfb' : 'inherit'
                          }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={isSelected}
                              onChange={() => {
                                setPoFulfillmentSelectedKeys(prev => 
                                  prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
                                );
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {row.ItemCode}{row.SubCode ? ` (${row.SubCode})` : ''}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.ItemName}
                            </Typography>
                          </TableCell>

                          <TableCell align="right">
                            {parseFloat(row.TotalPOPendingQty || 0).toFixed(2)} {row.Unit}
                          </TableCell>

                          <TableCell align="right" sx={{ color: row.StockInHand > 0 ? '#16a34a' : 'inherit' }}>
                            {parseFloat(row.StockInHand || 0).toFixed(2)} {row.Unit}
                          </TableCell>

                          <TableCell align="right" sx={{ color: row.PendingPIQty > 0 ? '#0284c7' : 'inherit' }}>
                            {parseFloat(row.PendingPIQty || 0).toFixed(2)} {row.Unit}
                          </TableCell>

                          <TableCell align="right">
                            {row.MissingQty > 0 ? (
                              <Chip
                                size="small"
                                label={`${parseFloat(row.MissingQty).toFixed(2)} ${row.Unit}`}
                                color="error"
                                sx={{ fontWeight: 800, height: 22 }}
                              />
                            ) : (
                              <Chip
                                size="small"
                                label="Covered (0)"
                                color="success"
                                variant="outlined"
                                sx={{ fontWeight: 600, height: 20 }}
                              />
                            )}
                          </TableCell>

                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={row.Status}
                              color={row.Status === 'Critical Shortfall' ? 'error' : row.Status === 'Partial Shortfall' ? 'warning' : 'success'}
                              sx={{ fontSize: '0.7rem', height: 20, fontWeight: 600 }}
                            />
                          </TableCell>

                          <TableCell align="right">
                            <TextField
                              size="small"
                              type="number"
                              value={q}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPoFulfillmentOrderQtys(prev => ({ ...prev, [key]: val }));
                              }}
                              inputProps={{ min: 0, step: 'any', style: { textAlign: 'right', fontWeight: 700 } }}
                              fullWidth
                            />
                          </TableCell>

                          <TableCell align="right">
                            <TextField
                              size="small"
                              type="number"
                              value={r}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPoFulfillmentRates(prev => ({ ...prev, [key]: val }));
                              }}
                              inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                              fullWidth
                            />
                          </TableCell>

                          <TableCell align="right" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                            ₹{lineAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 3, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Selected Items: <strong>{poFulfillmentSelectedKeys.length}</strong>
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Total Order Qty: <strong>
                  {poFulfillmentData.items
                    .filter(i => poFulfillmentSelectedKeys.includes(`${i.ItemCode}___${i.SubCode || ''}`))
                    .reduce((acc, i) => acc + (parseFloat(poFulfillmentOrderQtys[`${i.ItemCode}___${i.SubCode || ''}`]) || 0), 0)
                    .toFixed(2)}
                </strong>
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                Total Amount: <strong>
                  ₹{poFulfillmentData.items
                    .filter(i => poFulfillmentSelectedKeys.includes(`${i.ItemCode}___${i.SubCode || ''}`))
                    .reduce((acc, i) => {
                      const key = `${i.ItemCode}___${i.SubCode || ''}`;
                      const q = parseFloat(poFulfillmentOrderQtys[key]) || 0;
                      const r = parseFloat(poFulfillmentRates[key]) || 0;
                      return acc + (q * r);
                    }, 0)
                    .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </Typography>
            </Box>
          </Paper>
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setPoFulfillmentModalOpen(false);
              navigate('/dashboard/reports/pending-po?tab=fulfillment');
            }}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Open Full Fulfillment Planning Report
          </Button>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={() => setPoFulfillmentModalOpen(false)}
              color="inherit"
              disabled={poFulfillmentSavingPI}
            >
              Done / Close
            </Button>
            <Button
              variant="contained"
              color="warning"
              onClick={handleSavePOFulfillmentPI}
              disabled={poFulfillmentSavingPI || poFulfillmentSelectedKeys.length === 0}
              startIcon={poFulfillmentSavingPI ? <CircularProgress size={16} /> : <PIIcon />}
              sx={{ fontWeight: 700, textTransform: 'none', px: 2.5 }}
            >
              {poFulfillmentSavingPI ? 'Generating PI...' : `Generate Proforma Invoice (${poFulfillmentSelectedKeys.length})`}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PurchaseOrder;

