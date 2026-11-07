import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Chip, Tabs, Tab, CircularProgress, Alert, Tooltip, Autocomplete,
  Accordion, AccordionSummary, AccordionDetails, Divider, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Checkbox,
  FormControl, InputLabel, Select, MenuItem, Snackbar, Stack
} from '@mui/material';
import {
  Assessment as ReportIcon, Business as VendorIcon, Category as ItemIcon,
  ListAlt as ListIcon, PictureAsPdf as PdfIcon, FileDownload as ExcelIcon,
  Refresh as RefreshIcon, Search as SearchIcon, ExpandMore as ExpandMoreIcon,
  HourglassEmpty as HourglassIcon, LocalShipping as ShippingIcon, CheckCircle as CheckCircleIcon,
  AttachMoney as MoneyIcon, OpenInNew as OpenInNewIcon, Warning as WarningIcon,
  Inventory as InventoryIcon, ReceiptLong as PIIcon, ShoppingCartCheckout as OrderIcon,
  Delete as DeleteIcon, Close as CloseIcon, FilterList as FilterListIcon,
  AccountTree as BOMIcon, KeyboardArrowDown as ArrowDownIcon, KeyboardArrowUp as ArrowUpIcon
} from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import BOMShortfallView from '../../components/common/BOMShortfallView';
import BOMShortfallModal from '../../components/common/BOMShortfallModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PendingPOReport = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab: 0: Vendor-wise, 1: Item-wise, 2: Flat List, 3: Fulfillment & Missing Stock
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') === 'fulfillment' ? 3 : 0;
  });

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    summary: { totalOrders: 0, totalItems: 0, totalOrderedQty: 0, totalDeliveredQty: 0, totalPendingQty: 0, totalPendingAmount: 0 },
    vendorWise: [],
    itemWise: [],
    rawRows: []
  });

  const [ledgers, setLedgers] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);

  // Filters for Tabs 0-2
  const [selectedLedgerId, setSelectedLedgerId] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active', 'pending', 'partially fulfilled', 'all'

  // Pagination for flat table
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // PDF Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  // -------------------------------------------------------------
  // TAB 3: PO FULFILLMENT & MISSING STOCK PLANNING STATES
  // -------------------------------------------------------------
  const [fulfillmentLoading, setFulfillmentLoading] = useState(false);
  const [fulfillmentData, setFulfillmentData] = useState({
    summary: {
      totalDemandItems: 0,
      shortfallItemsCount: 0,
      totalDemandQty: 0,
      totalStockInHand: 0,
      totalPipelinePIQty: 0,
      totalMissingQty: 0,
      totalMissingValue: 0
    },
    items: []
  });
  const [fulfillmentSearch, setFulfillmentSearch] = useState('');
  const [fulfillmentCategory, setFulfillmentCategory] = useState('All');
  const [fulfillmentShortfallOnly, setFulfillmentShortfallOnly] = useState(false);
  const [selectedFulfillmentKeys, setSelectedFulfillmentKeys] = useState([]);
  const [orderQuantities, setOrderQuantities] = useState({});
  const [orderRates, setOrderRates] = useState({});

  // Pagination for Tab 3
  const [fulfillmentPage, setFulfillmentPage] = useState(0);
  const [fulfillmentRowsPerPage, setFulfillmentRowsPerPage] = useState(25);

  // Proforma Invoice Creation Modal from Fulfillment
  const [piModalOpen, setPiModalOpen] = useState(false);
  const [piVendorId, setPiVendorId] = useState(null);
  const [piNo, setPiNo] = useState('');
  const [piDate, setPiDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [piDeliveryDate, setPiDeliveryDate] = useState('');
  const [piDirectStock, setPiDirectStock] = useState(false);
  const [piRemark, setPiRemark] = useState('Auto-generated from PO Shortfall Fulfillment');
  const [piSaving, setPiSaving] = useState(false);
  const [piError, setPiError] = useState('');
  const [snackbarMsg, setSnackbarMsg] = useState('');

  // BOM Shortfall Breakup states
  const [expandedBOMKeys, setExpandedBOMKeys] = useState({});
  const [extraPIItems, setExtraPIItems] = useState([]);
  const [activeBOMModal, setActiveBOMModal] = useState(null);

  const toggleExpandBOM = (key) => {
    setExpandedBOMKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Fetch Report Data for Tabs 0-2
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedLedgerId) params.append('ledgerId', selectedLedgerId);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/purchase-orders/pending-report?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (err) {
      console.error('Error fetching pending PO report:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Fulfillment Report for Tab 3
  const fetchFulfillmentReport = async () => {
    setFulfillmentLoading(true);
    try {
      const params = new URLSearchParams();
      if (fulfillmentCategory && fulfillmentCategory !== 'All') {
        params.append('category', fulfillmentCategory);
      }
      if (fulfillmentSearch.trim()) {
        params.append('search', fulfillmentSearch.trim());
      }
      if (fulfillmentShortfallOnly) {
        params.append('shortfallOnly', 'true');
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/purchase-orders/fulfillment-report?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFulfillmentData(data);

        // Pre-fill order quantities and rates for newly loaded items
        setOrderQuantities(prev => {
          const next = { ...prev };
          (data.items || []).forEach(it => {
            const key = `${it.ItemCode}___${it.SubCode || ''}`;
            if (next[key] === undefined) {
              next[key] = it.MissingQty > 0 ? it.MissingQty : 0;
            }
          });
          return next;
        });

        setOrderRates(prev => {
          const next = { ...prev };
          (data.items || []).forEach(it => {
            const key = `${it.ItemCode}___${it.SubCode || ''}`;
            if (next[key] === undefined) {
              next[key] = parseFloat(it.Costing) || 0;
            }
          });
          return next;
        });
      }
    } catch (err) {
      console.error('Error fetching PO fulfillment report:', err);
    } finally {
      setFulfillmentLoading(false);
    }
  };

  const fetchLedgers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setLedgers(data);
      }
    } catch (err) {
      console.error('Error fetching ledgers:', err);
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
    fetchLedgers();
    fetchCompanyProfile();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [selectedLedgerId, fromDate, toDate, statusFilter]);

  useEffect(() => {
    if (activeTab === 3) {
      fetchFulfillmentReport();
    }
  }, [activeTab, fulfillmentCategory, fulfillmentShortfallOnly]);

  const handleTabChange = (e, val) => {
    setActiveTab(val);
    if (val === 3) {
      setSearchParams({ tab: 'fulfillment' });
      fetchFulfillmentReport();
    } else {
      setSearchParams({});
    }
  };

  // Filter vendor-wise list
  const filteredVendors = useMemo(() => {
    if (!searchTerm.trim()) return reportData.vendorWise || [];
    const term = searchTerm.toLowerCase();
    return (reportData.vendorWise || []).filter(v => {
      const matchName = v.LedgerName && v.LedgerName.toLowerCase().includes(term);
      const matchItem = v.Items && v.Items.some(it => 
        (it.ITEMCODE && it.ITEMCODE.toLowerCase().includes(term)) ||
        (it.ItemName && it.ItemName.toLowerCase().includes(term)) ||
        (it.PONO && it.PONO.toLowerCase().includes(term))
      );
      return matchName || matchItem;
    });
  }, [reportData.vendorWise, searchTerm]);

  // Filter item-wise list
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return reportData.itemWise || [];
    const term = searchTerm.toLowerCase();
    return (reportData.itemWise || []).filter(i => {
      const matchItem = 
        (i.ItemCode && i.ItemCode.toLowerCase().includes(term)) ||
        (i.SubCode && i.SubCode.toLowerCase().includes(term)) ||
        (i.ItemName && i.ItemName.toLowerCase().includes(term));
      const matchVendor = i.Orders && i.Orders.some(o => 
        (o.LedgerName && o.LedgerName.toLowerCase().includes(term)) ||
        (o.PONO && o.PONO.toLowerCase().includes(term))
      );
      return matchItem || matchVendor;
    });
  }, [reportData.itemWise, searchTerm]);

  // Filter flat rows
  const filteredRawRows = useMemo(() => {
    if (!searchTerm.trim()) return reportData.rawRows || [];
    const term = searchTerm.toLowerCase();
    return (reportData.rawRows || []).filter(r => 
      (r.PONO && r.PONO.toLowerCase().includes(term)) ||
      (r.LedgerName && r.LedgerName.toLowerCase().includes(term)) ||
      (r.ITEMCODE && r.ITEMCODE.toLowerCase().includes(term)) ||
      (r.ItemName && r.ItemName.toLowerCase().includes(term))
    );
  }, [reportData.rawRows, searchTerm]);

  // Filter Tab 3 Fulfillment items locally by search if typed
  const filteredFulfillmentItems = useMemo(() => {
    if (!fulfillmentSearch.trim()) return fulfillmentData.items || [];
    const term = fulfillmentSearch.toLowerCase();
    return (fulfillmentData.items || []).filter(i => 
      (i.ItemCode && i.ItemCode.toLowerCase().includes(term)) ||
      (i.SubCode && i.SubCode.toLowerCase().includes(term)) ||
      (i.ItemName && i.ItemName.toLowerCase().includes(term)) ||
      (i.AssociatedPOs && i.AssociatedPOs.toLowerCase().includes(term)) ||
      (i.AssociatedPIs && i.AssociatedPIs.toLowerCase().includes(term))
    );
  }, [fulfillmentData.items, fulfillmentSearch]);

  // Toggle selection for Tab 3
  const handleToggleSelectKey = (key) => {
    setSelectedFulfillmentKeys(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const handleSelectAllFulfillment = () => {
    const allFilteredKeys = filteredFulfillmentItems.map(i => `${i.ItemCode}___${i.SubCode || ''}`);
    const isAllSelected = allFilteredKeys.length > 0 && allFilteredKeys.every(k => selectedFulfillmentKeys.includes(k));
    if (isAllSelected) {
      setSelectedFulfillmentKeys(prev => prev.filter(k => !allFilteredKeys.includes(k)));
    } else {
      setSelectedFulfillmentKeys(Array.from(new Set([...selectedFulfillmentKeys, ...allFilteredKeys])));
    }
  };

  const handleSelectAllShortfall = () => {
    const shortfallKeys = filteredFulfillmentItems
      .filter(i => i.MissingQty > 0)
      .map(i => `${i.ItemCode}___${i.SubCode || ''}`);
    setSelectedFulfillmentKeys(Array.from(new Set([...selectedFulfillmentKeys, ...shortfallKeys])));
  };

  const handleClearSelection = () => {
    setSelectedFulfillmentKeys([]);
  };

  // Open Proforma Invoice Dialog
  const handleOpenPIModal = async (singleItem = null) => {
    setPiError('');
    setPiVendorId(null);
    setPiDirectStock(false);
    setPiDate(new Date().toISOString().split('T')[0]);
    setPiDeliveryDate('');
    setPiRemark('Auto-generated from PO Shortfall Fulfillment');

    if (singleItem) {
      const key = `${singleItem.ItemCode}___${singleItem.SubCode || ''}`;
      
      // Ensure single item is stored in extraPIItems if not in fulfillmentData (e.g. child part from BOM)
      const inFulfillment = (fulfillmentData.items || []).some(
        it => `${it.ItemCode}___${it.SubCode || ''}` === key
      );
      if (!inFulfillment) {
        setExtraPIItems(prev => {
          if (!prev.some(it => `${it.ItemCode}___${it.SubCode || ''}` === key)) {
            return [...prev, singleItem];
          }
          return prev;
        });
      }

      setSelectedFulfillmentKeys([key]);
      
      const qtyVal = singleItem.MissingQty > 0 ? singleItem.MissingQty : (orderQuantities[key] || 1);
      setOrderQuantities(prev => ({
        ...prev,
        [key]: qtyVal
      }));

      if (singleItem.Costing) {
        setOrderRates(prev => ({
          ...prev,
          [key]: singleItem.Costing
        }));
      }
    }

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

    setPiModalOpen(true);
  };

  // Create Proforma Invoice
  const handleSavePIFromFulfillment = async () => {
    if (!piVendorId) {
      setPiError('Please select a Supplier / Vendor for this Proforma Invoice.');
      return;
    }
    if (!piNo.trim()) {
      setPiError('Please enter a valid Proforma Invoice number.');
      return;
    }

    const allAvailable = [...(fulfillmentData.items || []), ...extraPIItems];
    const selectedItems = allAvailable.filter(it => {
      const key = `${it.ItemCode}___${it.SubCode || ''}`;
      return selectedFulfillmentKeys.includes(key);
    });

    if (selectedItems.length === 0) {
      setPiError('Please select at least one item to include in the Proforma Invoice.');
      return;
    }

    const validDetails = [];
    for (const it of selectedItems) {
      const key = `${it.ItemCode}___${it.SubCode || ''}`;
      const qty = parseFloat(orderQuantities[key]) || 0;
      if (qty <= 0) {
        setPiError(`Order Quantity for item ${it.ItemCode} must be greater than 0.`);
        return;
      }
      const rate = parseFloat(orderRates[key]) || 0;
      validDetails.push({
        ITEMCODE: it.ItemCode,
        SUBCODE: it.SubCode || '',
        QUANTITY: qty,
        UNIT: it.Unit || 'PCS',
        RATE: rate,
        AMOUNT: qty * rate,
        REMARK: `Shortfall fulfillment for POs: ${it.AssociatedPOs || 'PO Backlog'}`
      });
    }

    setPiSaving(true);
    setPiError('');

    try {
      const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
      const username = localUser.Username || localUser.username || 'System';

      const payload = {
        PINO: piNo.trim(),
        PIDATE: piDate,
        LEDGERID: piVendorId,
        DELIVERYDATE: piDeliveryDate || null,
        STATUS: piDirectStock ? 'Completed' : 'Ordered',
        updateStockDirectly: piDirectStock,
        REMARK: piRemark,
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
        setSnackbarMsg(`Proforma Invoice ${piNo.trim()} created successfully! Pipeline and missing stock updated.`);
        setPiModalOpen(false);
        setSelectedFulfillmentKeys([]);
        fetchFulfillmentReport();
        fetchReport();
      } else {
        setPiError(data.message || 'Failed to create Proforma Invoice');
      }
    } catch (err) {
      console.error('Error creating PI from fulfillment:', err);
      setPiError('Network error while creating Proforma Invoice.');
    } finally {
      setPiSaving(false);
    }
  };

  // Generate PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const compName = companyProfile ? companyProfile.CompanyName : 'FRM ERP';
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text(compName, 14, 18);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    const tabName = activeTab === 0 ? 'Vendor-wise' : activeTab === 1 ? 'Item-wise' : activeTab === 2 ? 'Order List' : 'Stock Fulfillment & Shortfall';
    doc.text(`PENDING PURCHASE ORDERS REPORT (${tabName.toUpperCase()})`, 14, 25);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    const dateRangeStr = `Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}` +
      (fromDate || toDate ? ` | Date Filter: ${fromDate || 'Start'} to ${toDate || 'End'}` : '');
    doc.text(dateRangeStr, 14, 30);

    // Summary block on top right
    const s = reportData.summary;
    const fs = fulfillmentData.summary;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    if (activeTab === 3) {
      doc.text(`Demand: ${fs.totalDemandQty} | Stock: ${fs.totalStockInHand} | Pipeline PI: ${fs.totalPipelinePIQty} | Missing: ${fs.totalMissingQty}`, 282, 25, { align: 'right' });
    } else {
      doc.text(`Orders: ${s.totalOrders} | Pending Qty: ${s.totalPendingQty.toFixed(2)} | Backlog: Rs. ${s.totalPendingAmount.toLocaleString('en-IN')}`, 282, 25, { align: 'right' });
    }

    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 33, 282, 33);

    let startY = 37;

    if (activeTab === 0) {
      const tableColumns = ['Vendor / Party', 'PO No', 'PO Date', 'Delivery Date', 'Item Code', 'SubCode', 'Item Description', 'Ordered', 'Delivered', 'Pending', 'Unit', 'Rate', 'Pending Value', 'Status'];
      const tableRows = [];

      filteredVendors.forEach(v => {
        (v.Items || []).forEach(it => {
          tableRows.push([
            v.LedgerName,
            it.PONO,
            it.PODATE ? it.PODATE.split('T')[0] : '-',
            it.DELIVERYDATE ? it.DELIVERYDATE.split('T')[0] : '-',
            it.ITEMCODE,
            it.SUBCODE || '-',
            it.ItemName || it.ITEMCODE,
            parseFloat(it.OrderedQty || 0).toFixed(2),
            parseFloat(it.DeliveredQty || 0).toFixed(2),
            parseFloat(it.PendingQty || 0).toFixed(2),
            it.UNIT || 'PCS',
            parseFloat(it.RATE || 0).toFixed(2),
            parseFloat(it.PendingAmount || 0).toFixed(2),
            it.OrderStatus || 'Pending'
          ]);
        });
      });

      autoTable(doc, {
        head: [tableColumns],
        body: tableRows,
        startY,
        theme: 'grid',
        headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        columnStyles: {
          7: { halign: 'right' },
          8: { halign: 'right' },
          9: { halign: 'right', fontStyle: 'bold' },
          10: { halign: 'center' },
          11: { halign: 'right' },
          12: { halign: 'right', fontStyle: 'bold' }
        }
      });
    } else if (activeTab === 1) {
      const tableColumns = ['Item Code', 'SubCode', 'Item Name', 'Unit', 'Category', 'Total Ordered', 'Total Delivered', 'Total Pending Qty', 'Pending Value (Rs.)', 'Pending Orders Count'];
      const tableRows = filteredItems.map(i => [
        i.ItemCode,
        i.SubCode || '-',
        i.ItemName,
        i.Unit,
        i.ItemCategory,
        parseFloat(i.TotalOrderedQty || 0).toFixed(2),
        parseFloat(i.TotalDeliveredQty || 0).toFixed(2),
        parseFloat(i.TotalPendingQty || 0).toFixed(2),
        parseFloat(i.TotalPendingAmount || 0).toFixed(2),
        i.PendingOrdersCount || i.Orders?.length || 0
      ]);

      autoTable(doc, {
        head: [tableColumns],
        body: tableRows,
        startY,
        theme: 'grid',
        headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right', fontStyle: 'bold' },
          8: { halign: 'right', fontStyle: 'bold' },
          9: { halign: 'center' }
        }
      });
    } else if (activeTab === 2) {
      const tableColumns = ['PO No', 'PO Date', 'Delivery Date', 'Customer / Party', 'Item Code', 'SubCode', 'Item Name', 'Ordered', 'Delivered', 'Pending', 'Unit', 'Rate', 'Pending Value', 'Status'];
      const tableRows = filteredRawRows.map(r => [
        r.PONO,
        r.PODATE ? r.PODATE.split('T')[0] : '-',
        r.DELIVERYDATE ? r.DELIVERYDATE.split('T')[0] : '-',
        r.LedgerName,
        r.ITEMCODE,
        r.SUBCODE || '-',
        r.ItemName || r.ITEMCODE,
        parseFloat(r.OrderedQty || 0).toFixed(2),
        parseFloat(r.DeliveredQty || 0).toFixed(2),
        parseFloat(r.PendingQty || 0).toFixed(2),
        r.UNIT || 'PCS',
        parseFloat(r.RATE || 0).toFixed(2),
        parseFloat(r.PendingAmount || 0).toFixed(2),
        r.OrderStatus || 'Pending'
      ]);

      autoTable(doc, {
        head: [tableColumns],
        body: tableRows,
        startY,
        theme: 'grid',
        headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        columnStyles: {
          7: { halign: 'right' },
          8: { halign: 'right' },
          9: { halign: 'right', fontStyle: 'bold' },
          10: { halign: 'center' },
          11: { halign: 'right' },
          12: { halign: 'right', fontStyle: 'bold' }
        }
      });
    } else {
      // Tab 3: Fulfillment & Missing Stock Table
      const tableColumns = ['Item Code', 'SubCode', 'Item Name', 'Category', 'Unit', 'PO Demand', 'Stock in Hand', 'In-Pipeline PI', 'Missing Qty', 'Status', 'Rate', 'Shortfall Value'];
      const tableRows = filteredFulfillmentItems.map(i => [
        i.ItemCode,
        i.SubCode || '-',
        i.ItemName,
        i.Category,
        i.Unit,
        parseFloat(i.TotalPOPendingQty || 0).toFixed(2),
        parseFloat(i.StockInHand || 0).toFixed(2),
        parseFloat(i.PendingPIQty || 0).toFixed(2),
        parseFloat(i.MissingQty || 0).toFixed(2),
        i.Status,
        parseFloat(i.Costing || 0).toFixed(2),
        parseFloat(i.MissingValue || 0).toFixed(2)
      ]);

      autoTable(doc, {
        head: [tableColumns],
        body: tableRows,
        startY,
        theme: 'grid',
        headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        columnStyles: {
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right' },
          8: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
          9: { halign: 'center' },
          10: { halign: 'right' },
          11: { halign: 'right', fontStyle: 'bold' }
        }
      });
    }

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  // Generate Excel (CSV download)
  const handleExportExcel = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (activeTab === 0) {
      csvContent += 'Vendor,PO No,PO Date,Delivery Date,Item Code,SubCode,Item Name,Ordered Qty,Delivered Qty,Pending Qty,Unit,Rate,Pending Amount,Status\n';
      filteredVendors.forEach(v => {
        (v.Items || []).forEach(it => {
          const row = [
            `"${v.LedgerName || ''}"`,
            `"${it.PONO || ''}"`,
            it.PODATE ? it.PODATE.split('T')[0] : '',
            it.DELIVERYDATE ? it.DELIVERYDATE.split('T')[0] : '',
            `"${it.ITEMCODE || ''}"`,
            `"${it.SUBCODE || ''}"`,
            `"${it.ItemName || ''}"`,
            it.OrderedQty || 0,
            it.DeliveredQty || 0,
            it.PendingQty || 0,
            it.UNIT || '',
            it.RATE || 0,
            it.PendingAmount || 0,
            it.OrderStatus || ''
          ];
          csvContent += row.join(',') + '\n';
        });
      });
    } else if (activeTab === 1) {
      csvContent += 'Item Code,SubCode,Item Name,Category,Unit,Total Ordered Qty,Total Delivered Qty,Total Pending Qty,Pending Value,Orders Count\n';
      filteredItems.forEach(i => {
        const row = [
          `"${i.ItemCode || ''}"`,
          `"${i.SubCode || ''}"`,
          `"${i.ItemName || ''}"`,
          `"${i.ItemCategory || ''}"`,
          i.Unit || '',
          i.TotalOrderedQty || 0,
          i.TotalDeliveredQty || 0,
          i.TotalPendingQty || 0,
          i.TotalPendingAmount || 0,
          i.PendingOrdersCount || 0
        ];
        csvContent += row.join(',') + '\n';
      });
    } else if (activeTab === 2) {
      csvContent += 'PO No,PO Date,Delivery Date,Customer,Item Code,SubCode,Item Name,Ordered Qty,Delivered Qty,Pending Qty,Unit,Rate,Pending Amount,Status\n';
      filteredRawRows.forEach(r => {
        const row = [
          `"${r.PONO || ''}"`,
          r.PODATE ? r.PODATE.split('T')[0] : '',
          r.DELIVERYDATE ? r.DELIVERYDATE.split('T')[0] : '',
          `"${r.LedgerName || ''}"`,
          `"${r.ITEMCODE || ''}"`,
          `"${r.SUBCODE || ''}"`,
          `"${r.ItemName || ''}"`,
          r.OrderedQty || 0,
          r.DeliveredQty || 0,
          r.PendingQty || 0,
          r.UNIT || '',
          r.RATE || 0,
          r.PendingAmount || 0,
          r.OrderStatus || ''
        ];
        csvContent += row.join(',') + '\n';
      });
    } else {
      csvContent += 'Item Code,SubCode,Item Name,Category,Unit,PO Demand,Stock in Hand,Pending PI Qty,Missing Qty,Status,Costing,Estimated Shortfall Value,Associated POs,Associated PIs\n';
      filteredFulfillmentItems.forEach(i => {
        const row = [
          `"${i.ItemCode || ''}"`,
          `"${i.SubCode || ''}"`,
          `"${i.ItemName || ''}"`,
          `"${i.Category || ''}"`,
          i.Unit || '',
          i.TotalPOPendingQty || 0,
          i.StockInHand || 0,
          i.PendingPIQty || 0,
          i.MissingQty || 0,
          `"${i.Status || ''}"`,
          i.Costing || 0,
          i.MissingValue || 0,
          `"${i.AssociatedPOs || ''}"`,
          `"${i.AssociatedPIs || ''}"`
        ];
        csvContent += row.join(',') + '\n';
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const tabSuffix = activeTab === 3 ? 'Fulfillment_Shortfall' : 'Report';
    link.setAttribute('download', `Pending_PO_${tabSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Summary figures for selected items in PI modal
  const selectedItemsData = useMemo(() => {
    const combined = [...(fulfillmentData.items || []), ...extraPIItems];
    return combined.filter(it => {
      const key = `${it.ItemCode}___${it.SubCode || ''}`;
      return selectedFulfillmentKeys.includes(key);
    });
  }, [fulfillmentData.items, extraPIItems, selectedFulfillmentKeys]);

  const selectedTotalQty = useMemo(() => {
    return selectedItemsData.reduce((acc, it) => {
      const key = `${it.ItemCode}___${it.SubCode || ''}`;
      return acc + (parseFloat(orderQuantities[key]) || 0);
    }, 0);
  }, [selectedItemsData, orderQuantities]);

  const selectedTotalAmount = useMemo(() => {
    return selectedItemsData.reduce((acc, it) => {
      const key = `${it.ItemCode}___${it.SubCode || ''}`;
      const qty = parseFloat(orderQuantities[key]) || 0;
      const rate = parseFloat(orderRates[key]) || 0;
      return acc + (qty * rate);
    }, 0);
  }, [selectedItemsData, orderQuantities, orderRates]);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 3 } }}>
      {/* Title & Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e40af' }}>
            <ReportIcon fontSize="medium" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66' }}>
              Pending Purchase Orders Report
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Vendor-wise backlog, item-wise pending orders & live stock fulfillment shortfall planning
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => { fetchReport(); if (activeTab === 3) fetchFulfillmentReport(); }}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            color="success"
            startIcon={<ExcelIcon />}
            onClick={handleExportExcel}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Export Excel
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PdfIcon />}
            onClick={handleExportPDF}
            sx={{ backgroundColor: '#0F3B66', textTransform: 'none', fontWeight: 600, '&:hover': { backgroundColor: '#0c2f52' } }}
          >
            Export PDF
          </Button>
        </Box>
      </Box>

      {/* KPI Cards: Dynamic depending on tab */}
      {activeTab !== 3 ? (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #3b82f6' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Pending Orders
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e3a8a', mt: 0.5 }}>
                  {reportData.summary.totalOrders}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {reportData.summary.totalItems} pending item rows
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #6366f1' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Total Ordered
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#4338ca', mt: 0.5 }}>
                  {reportData.summary.totalOrderedQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total order units
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #10b981' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Total Delivered
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#047857', mt: 0.5 }}>
                  {reportData.summary.totalDeliveredQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Delivered via Sales
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #f59e0b' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Pending Quantity
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#b45309', mt: 0.5 }}>
                  {reportData.summary.totalPendingQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Pending fulfillment
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #ef4444' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Total Pending Value
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#991b1b', mt: 0.5 }}>
                  ₹{reportData.summary.totalPendingAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Backlog order value
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        /* Fulfillment KPI Cards for Tab 3 */
        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #3b82f6' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Demand Items
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e3a8a', mt: 0.5 }}>
                  {fulfillmentData.summary.totalDemandItems}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Items in open POs
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #ef4444' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Shortfall Items
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#dc2626', mt: 0.5 }}>
                  {fulfillmentData.summary.shortfallItemsCount}
                </Typography>
                <Typography variant="caption" color="error.main">
                  Requires procurement
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #6366f1' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  PO Demand Qty
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#4338ca', mt: 0.5 }}>
                  {fulfillmentData.summary.totalDemandQty?.toLocaleString('en-IN')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total units ordered
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #10b981' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Stock In Hand
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#047857', mt: 0.5 }}>
                  {fulfillmentData.summary.totalStockInHand?.toLocaleString('en-IN')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Warehouse stock
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #0284c7' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  In-Pipeline (PI)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#0369a1', mt: 0.5 }}>
                  {fulfillmentData.summary.totalPipelinePIQty?.toLocaleString('en-IN')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Pending vendor PIs
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', bgcolor: '#fef2f2', borderLeft: '4px solid #dc2626' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="caption" color="error.dark" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                  Total Missing Qty
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#b91c1c', mt: 0.5 }}>
                  {fulfillmentData.summary.totalMissingQty?.toLocaleString('en-IN')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  ₹{fulfillmentData.summary.totalMissingValue?.toLocaleString('en-IN')} Value
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Filter & View Card */}
      <Paper sx={{ width: '100%', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        {/* Top Bar with Tabs and Filters */}
        <Box sx={{ p: 2, bgcolor: '#ffffff', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          {activeTab !== 3 ? (
            <>
              <TextField
                size="small"
                placeholder="Search Party, Item, PO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" fontSize="small" /></InputAdornment> }}
                sx={{ width: { xs: '100%', sm: 220 } }}
              />

              <Autocomplete
                size="small"
                options={ledgers}
                getOptionLabel={(option) => option.LedgerName || ''}
                value={ledgers.find(l => l.Id === selectedLedgerId) || null}
                onChange={(e, val) => setSelectedLedgerId(val ? val.Id : null)}
                renderInput={(params) => <TextField {...params} placeholder="All Parties / Customers" size="small" />}
                sx={{ width: { xs: '100%', sm: 240 } }}
                slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
              />

              <TextField
                label="From Date"
                type="date"
                size="small"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: 'calc(50% - 8px)', sm: 140 } }}
              />

              <TextField
                label="To Date"
                type="date"
                size="small"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: 'calc(50% - 8px)', sm: 140 } }}
              />

              {(fromDate || toDate || selectedLedgerId) && (
                <Button
                  size="small"
                  onClick={() => { setFromDate(''); setToDate(''); setSelectedLedgerId(null); }}
                  sx={{ textTransform: 'none' }}
                >
                  Reset Filters
                </Button>
              )}
            </>
          ) : (
            /* Tab 3 Fulfillment Filters */
            <>
              <TextField
                size="small"
                placeholder="Search Item, Code, SubCode, PO..."
                value={fulfillmentSearch}
                onChange={(e) => setFulfillmentSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" fontSize="small" /></InputAdornment> }}
                sx={{ width: { xs: '100%', sm: 260 } }}
              />

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={fulfillmentCategory}
                  label="Category"
                  onChange={(e) => setFulfillmentCategory(e.target.value)}
                >
                  <MenuItem value="All">All Categories</MenuItem>
                  <MenuItem value="SubContract">SubContract</MenuItem>
                  <MenuItem value="Inhouse">Inhouse</MenuItem>
                  <MenuItem value="BOP">BOP</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={fulfillmentShortfallOnly}
                    onChange={(e) => setFulfillmentShortfallOnly(e.target.checked)}
                    color="error"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 600, color: fulfillmentShortfallOnly ? '#dc2626' : 'text.primary' }}>
                    Shortfall Only ({fulfillmentData.summary.shortfallItemsCount})
                  </Typography>
                }
              />

              <Button
                size="small"
                variant="outlined"
                onClick={handleSelectAllShortfall}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Select All Shortfall
              </Button>

              {selectedFulfillmentKeys.length > 0 && (
                <Button
                  size="small"
                  color="inherit"
                  onClick={handleClearSelection}
                  sx={{ textTransform: 'none' }}
                >
                  Clear ({selectedFulfillmentKeys.length})
                </Button>
              )}
            </>
          )}

          {/* Tab Selector */}
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{ ml: { sm: 'auto' }, width: { xs: '100%', sm: 'auto' }, minHeight: 38 }}
          >
            <Tab
              icon={<VendorIcon fontSize="small" />}
              iconPosition="start"
              label={`Vendor Wise (${filteredVendors.length})`}
              sx={{ textTransform: 'none', fontWeight: 600, minHeight: 38, py: 0.5 }}
            />
            <Tab
              icon={<ItemIcon fontSize="small" />}
              iconPosition="start"
              label={`Item Wise (${filteredItems.length})`}
              sx={{ textTransform: 'none', fontWeight: 600, minHeight: 38, py: 0.5 }}
            />
            <Tab
              icon={<ListIcon fontSize="small" />}
              iconPosition="start"
              label={`Order Details (${filteredRawRows.length})`}
              sx={{ textTransform: 'none', fontWeight: 600, minHeight: 38, py: 0.5 }}
            />
            <Tab
              icon={<HourglassIcon fontSize="small" />}
              iconPosition="start"
              label={`PO Fulfillment & Missing Stock (${fulfillmentData.summary.shortfallItemsCount || 0})`}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                minHeight: 38,
                py: 0.5,
                color: fulfillmentData.summary.shortfallItemsCount > 0 ? '#dc2626 !important' : 'inherit'
              }}
            />
          </Tabs>
        </Box>

        {/* Tab 0: Vendor Wise */}
        {activeTab === 0 && (
          <Box sx={{ p: 2 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={36} />
              </Box>
            ) : filteredVendors.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                <Typography variant="body1">No pending orders found for any vendor.</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filteredVendors.map((vendor, idx) => (
                  <Accordion key={vendor.LedgerId || idx} defaultExpanded={idx < 5} sx={{ border: '1px solid #e2e8f0', borderRadius: '8px !important', overflow: 'hidden', boxShadow: 'none' }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f8fafc', px: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 2, flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <VendorIcon sx={{ color: '#1e40af', fontSize: 20 }} />
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                            {vendor.LedgerName}
                          </Typography>
                          <Chip size="small" label={`${vendor.OrdersCount || (vendor.Items ? new Set(vendor.Items.map(x => x.POID)).size : 0)} Orders`} sx={{ fontWeight: 600, height: 22 }} />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#b45309' }}>
                            Pending: {vendor.TotalPendingQty?.toFixed(2)} units
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#991b1b' }}>
                            Value: ₹{vendor.TotalPendingAmount?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>PO No</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>PO Date</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Delivery Date</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Item Code</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>SubCode</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Item Name</TableCell>
                              <TableCell sx={{ fontWeight: 700 }} align="right">Ordered</TableCell>
                              <TableCell sx={{ fontWeight: 700 }} align="right">Delivered</TableCell>
                              <TableCell sx={{ fontWeight: 700 }} align="right">Pending</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
                              <TableCell sx={{ fontWeight: 700 }} align="right">Rate (₹)</TableCell>
                              <TableCell sx={{ fontWeight: 700 }} align="right">Pending Value</TableCell>
                              <TableCell sx={{ fontWeight: 700 }} align="center">Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(vendor.Items || []).map((it, itemIdx) => (
                              <TableRow hover key={itemIdx}>
                                <TableCell sx={{ fontWeight: 600, color: '#1e3a8a' }}>{it.PONO}</TableCell>
                                <TableCell>{it.PODATE ? it.PODATE.split('T')[0] : '-'}</TableCell>
                                <TableCell>{it.DELIVERYDATE ? it.DELIVERYDATE.split('T')[0] : '-'}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{it.ITEMCODE}</TableCell>
                                <TableCell>{it.SUBCODE || '-'}</TableCell>
                                <TableCell>{it.ItemName || it.ITEMCODE}</TableCell>
                                <TableCell align="right">{parseFloat(it.OrderedQty || 0).toFixed(2)}</TableCell>
                                <TableCell align="right" sx={{ color: it.DeliveredQty > 0 ? '#16a34a' : 'inherit' }}>
                                  {parseFloat(it.DeliveredQty || 0).toFixed(2)}
                                </TableCell>
                                <TableCell align="right">
                                  <Chip
                                    size="small"
                                    label={parseFloat(it.PendingQty || 0).toFixed(2)}
                                    color="warning"
                                    sx={{ fontWeight: 700, fontSize: '0.72rem', height: 20 }}
                                  />
                                </TableCell>
                                <TableCell>{it.UNIT || 'PCS'}</TableCell>
                                <TableCell align="right">₹{parseFloat(it.RATE || 0).toFixed(2)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                                  ₹{parseFloat(it.PendingAmount || 0).toFixed(2)}
                                </TableCell>
                                <TableCell align="center">
                                  <Chip
                                    size="small"
                                    label={it.OrderStatus || 'Pending'}
                                    color={it.OrderStatus === 'Completed' ? 'success' : 'info'}
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Tab 1: Item Wise */}
        {activeTab === 1 && (
          <Box sx={{ p: 2 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={36} />
              </Box>
            ) : filteredItems.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                <Typography variant="body1">No pending orders found for any item.</Typography>
              </Box>
            ) : (
              <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Item Code</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>SubCode</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Item Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Total Ordered</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Total Delivered</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Total Pending</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Pending Value</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">Active Orders</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredItems.map((item, idx) => (
                      <TableRow hover key={idx}>
                        <TableCell sx={{ fontWeight: 700, color: '#0F3B66' }}>{item.ItemCode}</TableCell>
                        <TableCell>{item.SubCode || '-'}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{item.ItemName}</TableCell>
                        <TableCell>
                          <Chip size="small" label={item.ItemCategory || 'General'} variant="outlined" sx={{ height: 20, fontSize: '0.72rem' }} />
                        </TableCell>
                        <TableCell>{item.Unit}</TableCell>
                        <TableCell align="right">{parseFloat(item.TotalOrderedQty || 0).toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ color: item.TotalDeliveredQty > 0 ? '#16a34a' : 'inherit' }}>
                          {parseFloat(item.TotalDeliveredQty || 0).toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            label={parseFloat(item.TotalPendingQty || 0).toFixed(2)}
                            color="warning"
                            sx={{ fontWeight: 700, height: 22 }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#991b1b' }}>
                          ₹{parseFloat(item.TotalPendingAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title={(item.Orders || []).map(o => `${o.PONO}: ${o.PendingQty} ${item.Unit} (${o.LedgerName})`).join(' | ')}>
                            <Chip
                              size="small"
                              label={`${item.PendingOrdersCount || item.Orders?.length || 0} POs`}
                              color="primary"
                              variant="outlined"
                              sx={{ fontWeight: 600, cursor: 'pointer', height: 22 }}
                            />
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Tab 2: Detailed Flat Table */}
        {activeTab === 2 && (
          <Box>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>PO No</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>PO Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Customer / Party</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Item Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>SubCode</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Item Description</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Ordered</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Delivered</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Pending</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Rate (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Pending Value</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRawRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((r, idx) => (
                    <TableRow hover key={r.DetailId || idx}>
                      <TableCell sx={{ fontWeight: 700, color: '#0F3B66' }}>{r.PONO}</TableCell>
                      <TableCell>{r.PODATE ? r.PODATE.split('T')[0] : '-'}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.LedgerName}</TableCell>
                      <TableCell>{r.ITEMCODE}</TableCell>
                      <TableCell>{r.SUBCODE || '-'}</TableCell>
                      <TableCell>{r.ItemName || r.ITEMCODE}</TableCell>
                      <TableCell align="right">{parseFloat(r.OrderedQty || 0).toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ color: r.DeliveredQty > 0 ? '#16a34a' : 'inherit' }}>
                        {parseFloat(r.DeliveredQty || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={parseFloat(r.PendingQty || 0).toFixed(2)}
                          color="warning"
                          sx={{ fontWeight: 700, fontSize: '0.72rem', height: 20 }}
                        />
                      </TableCell>
                      <TableCell>{r.UNIT || 'PCS'}</TableCell>
                      <TableCell align="right">₹{parseFloat(r.RATE || 0).toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                        ₹{parseFloat(r.PendingAmount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={r.OrderStatus}
                          color={r.OrderStatus === 'Completed' ? 'success' : 'info'}
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRawRows.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={13} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No records found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[25, 50, 100]}
              component="div"
              count={filteredRawRows.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            />
          </Box>
        )}

        {/* ------------------------------------------------------------- */}
        {/* Tab 3: PO Fulfillment & Missing Stock Planning (Exact User Formula) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 3 && (
          <Box sx={{ p: 2 }}>
            {/* Shortfall Formula Banner */}
            <Alert severity="info" sx={{ mb: 2, borderRadius: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                💡 Exact Fulfillment Formula: <strong>Missing Quantity = Total PO Demand - Stock in Hand - Pending Proforma Invoice Quantity</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Select any item(s) with any quantity to immediately generate a Proforma Invoice. Once created, pending PI quantity updates and covers the shortfall in real-time.
              </Typography>
            </Alert>

            {/* Selection & Multi-Action Floating Bar */}
            {selectedFulfillmentKeys.length > 0 && (
              <Paper
                elevation={3}
                sx={{
                  p: 1.5,
                  mb: 2,
                  bgcolor: '#0F3B66',
                  color: 'white',
                  borderRadius: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 1.5
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    📦 {selectedFulfillmentKeys.length} Item(s) Selected
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#93c5fd' }}>
                    Total Order Units: <strong>{selectedTotalQty.toFixed(2)}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#86efac' }}>
                    Est. Value: <strong>₹{selectedTotalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleClearSelection}
                    sx={{ color: '#cbd5e1', borderColor: '#475569', textTransform: 'none' }}
                  >
                    Deselect All
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="warning"
                    startIcon={<PIIcon />}
                    onClick={() => handleOpenPIModal()}
                    sx={{ fontWeight: 700, textTransform: 'none', px: 2 }}
                  >
                    Create Proforma Invoice for Selected ({selectedFulfillmentKeys.length})
                  </Button>
                </Box>
              </Paper>
            )}

            {fulfillmentLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress size={40} />
              </Box>
            ) : filteredFulfillmentItems.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <CheckCircleIcon sx={{ fontSize: 48, color: '#10b981', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  All Stock is Fully Covered!
                </Typography>
                <Typography variant="body2">
                  There are currently no missing stock items to fulfill open purchase orders.
                </Typography>
              </Box>
            ) : (
              <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={
                            filteredFulfillmentItems.length > 0 &&
                            filteredFulfillmentItems.every(i => selectedFulfillmentKeys.includes(`${i.ItemCode}___${i.SubCode || ''}`))
                          }
                          indeterminate={
                            filteredFulfillmentItems.some(i => selectedFulfillmentKeys.includes(`${i.ItemCode}___${i.SubCode || ''}`)) &&
                            !filteredFulfillmentItems.every(i => selectedFulfillmentKeys.includes(`${i.ItemCode}___${i.SubCode || ''}`))
                          }
                          onChange={handleSelectAllFulfillment}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Item Code & SubCode</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Item Description</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">PO Demand</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Stock in Hand</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Pending PI Qty</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Missing Qty</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">BOM Breakup</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">Status</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 120 }} align="right">Order Qty</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 100 }} align="right">Rate (₹)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Amount (₹)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredFulfillmentItems
                      .slice(fulfillmentPage * fulfillmentRowsPerPage, fulfillmentPage * fulfillmentRowsPerPage + fulfillmentRowsPerPage)
                      .map((row, idx) => {
                        const key = `${row.ItemCode}___${row.SubCode || ''}`;
                        const isSelected = selectedFulfillmentKeys.includes(key);
                        const currentOrderQty = orderQuantities[key] !== undefined ? orderQuantities[key] : (row.MissingQty > 0 ? row.MissingQty : 0);
                        const currentRate = orderRates[key] !== undefined ? orderRates[key] : (row.Costing || 0);
                        const lineAmount = (parseFloat(currentOrderQty) || 0) * (parseFloat(currentRate) || 0);

                        return (
                          <React.Fragment key={key}>
                            <TableRow
                              hover
                              selected={isSelected}
                              sx={{
                                bgcolor: isSelected ? '#f0f9ff' : row.MissingQty > 0 ? '#fffbfb' : 'inherit',
                                '&:hover': { bgcolor: isSelected ? '#e0f2fe !important' : undefined }
                              }}
                            >
                            <TableCell padding="checkbox">
                              <Checkbox
                                size="small"
                                checked={isSelected}
                                onChange={() => handleToggleSelectKey(key)}
                              />
                            </TableCell>

                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                                {row.ItemCode}
                              </Typography>
                              {row.SubCode && (
                                <Typography variant="caption" sx={{ color: 'text.secondary', bgcolor: '#f1f5f9', px: 0.8, py: 0.2, borderRadius: 1 }}>
                                  SubCode: {row.SubCode}
                                </Typography>
                              )}
                            </TableCell>

                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {row.ItemName}
                              </Typography>
                              <Tooltip title={`Associated POs: ${row.AssociatedPOs || 'None'}`}>
                                <Typography variant="caption" sx={{ color: '#2563eb', cursor: 'pointer', display: 'block' }}>
                                  {row.AssociatedPOs ? (row.AssociatedPOs.length > 30 ? row.AssociatedPOs.substring(0, 30) + '...' : row.AssociatedPOs) : '-'}
                                </Typography>
                              </Tooltip>
                            </TableCell>

                            <TableCell>
                              <Chip
                                size="small"
                                label={row.Category}
                                variant="outlined"
                                color={row.Category === 'SubContract' ? 'warning' : row.Category === 'BOP' ? 'secondary' : 'default'}
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            </TableCell>

                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {parseFloat(row.TotalPOPendingQty || 0).toFixed(2)} {row.Unit}
                              </Typography>
                            </TableCell>

                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600, color: row.StockInHand > 0 ? '#16a34a' : 'inherit' }}>
                                {parseFloat(row.StockInHand || 0).toFixed(2)} {row.Unit}
                              </Typography>
                            </TableCell>

                            <TableCell align="right">
                              <Tooltip title={row.AssociatedPIs ? `Active PIs: ${row.AssociatedPIs}` : 'No active Proforma Invoice'}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: row.PendingPIQty > 0 ? '#0284c7' : 'inherit', cursor: row.PendingPIQty > 0 ? 'pointer' : 'default' }}>
                                  {parseFloat(row.PendingPIQty || 0).toFixed(2)} {row.Unit}
                                </Typography>
                              </Tooltip>
                            </TableCell>

                            {/* Missing Quantity Highlight */}
                            <TableCell align="right">
                              {row.MissingQty > 0 ? (
                                <Chip
                                  size="small"
                                  label={`${parseFloat(row.MissingQty).toFixed(2)} ${row.Unit}`}
                                  color="error"
                                  sx={{ fontWeight: 800, fontSize: '0.75rem', height: 22 }}
                                />
                              ) : (
                                <Chip
                                  size="small"
                                  label="Covered (0)"
                                  color="success"
                                  variant="outlined"
                                  sx={{ fontWeight: 600, fontSize: '0.7rem', height: 20 }}
                                />
                              )}
                            </TableCell>

                            {/* BOM Breakup Trigger Cell */}
                            <TableCell align="center">
                              <Tooltip title={row.MissingQty > 0 ? "Inspect BOM child parts available vs shortfall to fulfill this order" : "View Bill of Materials child parts"}>
                                <Button
                                  size="small"
                                  variant={expandedBOMKeys[key] ? "contained" : "outlined"}
                                  color={row.MissingQty > 0 ? "secondary" : "inherit"}
                                  startIcon={<BOMIcon sx={{ fontSize: 15 }} />}
                                  endIcon={expandedBOMKeys[key] ? <ArrowUpIcon sx={{ fontSize: 15 }} /> : <ArrowDownIcon sx={{ fontSize: 15 }} />}
                                  onClick={() => toggleExpandBOM(key)}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.68rem',
                                    py: 0.3,
                                    px: 1,
                                    height: 24,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  BOM Breakup
                                </Button>
                              </Tooltip>
                            </TableCell>

                            {/* Status Chip */}
                            <TableCell align="center">
                              <Chip
                                size="small"
                                label={row.Status}
                                color={
                                  row.Status === 'Critical Shortfall' ? 'error' :
                                  row.Status === 'Partial Shortfall' ? 'warning' :
                                  row.Status === 'Covered via PI' ? 'info' : 'success'
                                }
                                sx={{ fontSize: '0.7rem', height: 20, fontWeight: 600 }}
                              />
                            </TableCell>

                            {/* Editable Order Qty */}
                            <TableCell align="right">
                              <TextField
                                size="small"
                                type="number"
                                value={currentOrderQty}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setOrderQuantities(prev => ({ ...prev, [key]: val }));
                                }}
                                inputProps={{ min: 0, step: 'any', style: { textAlign: 'right', fontWeight: 700, padding: '4px 8px' } }}
                                sx={{ width: 100 }}
                              />
                            </TableCell>

                            {/* Editable Rate */}
                            <TableCell align="right">
                              <TextField
                                size="small"
                                type="number"
                                value={currentRate}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setOrderRates(prev => ({ ...prev, [key]: val }));
                                }}
                                inputProps={{ min: 0, step: 'any', style: { textAlign: 'right', padding: '4px 8px' } }}
                                sx={{ width: 90 }}
                              />
                            </TableCell>

                            {/* Line Amount */}
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                                ₹{lineAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Typography>
                            </TableCell>

                            {/* Quick Action */}
                            <TableCell align="center">
                              <Tooltip title="Create PI for this item">
                                <IconButton
                                  size="small"
                                  color="warning"
                                  onClick={() => handleOpenPIModal(row)}
                                >
                                  <PIIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>

                          {/* Expandable BOM Breakup Sub-Panel */}
                          {expandedBOMKeys[key] && (
                            <TableRow sx={{ bgcolor: '#f8fafc' }}>
                              <TableCell colSpan={14} sx={{ p: 2, borderBottom: '2px solid #0F3B66' }}>
                                <Paper elevation={0} sx={{ p: 2, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #cbd5e1' }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F3B66', display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <BOMIcon fontSize="small" />
                                      BOM Component Stock & Shortfall Breakup for Finished Good: {row.ItemCode}{row.SubCode ? ` (${row.SubCode})` : ''} — Shortfall: {row.MissingQty > 0 ? row.MissingQty : row.TotalPOPendingQty} {row.Unit}
                                    </Typography>
                                    <Button
                                      size="small"
                                      variant="text"
                                      color="inherit"
                                      onClick={() => toggleExpandBOM(key)}
                                      sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
                                    >
                                      Hide Breakup ▲
                                    </Button>
                                  </Box>
                                  <BOMShortfallView
                                    parentCode={row.ItemCode}
                                    parentSubCode={row.SubCode || ''}
                                    parentName={row.ItemName}
                                    shortfallQty={row.MissingQty > 0 ? row.MissingQty : row.TotalPOPendingQty}
                                    inline={true}
                                    onOpenBOMMaster={() => navigate('/dashboard/masters/bom')}
                                    onOrderChildPart={(childItem) => handleOpenPIModal(childItem)}
                                  />
                                </Paper>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                        );
                      })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <TablePagination
              rowsPerPageOptions={[25, 50, 100]}
              component="div"
              count={filteredFulfillmentItems.length}
              rowsPerPage={fulfillmentRowsPerPage}
              page={fulfillmentPage}
              onPageChange={(e, newPage) => setFulfillmentPage(newPage)}
              onRowsPerPageChange={(e) => { setFulfillmentRowsPerPage(parseInt(e.target.value, 10)); setFulfillmentPage(0); }}
            />
          </Box>
        )}
      </Paper>

      {/* ------------------------------------------------------------- */}
      {/* DIALOG: CREATE PROFORMA INVOICE FOR SHORTFALL ITEMS */}
      {/* ------------------------------------------------------------- */}
      <Dialog
        open={piModalOpen}
        onClose={() => { if (!piSaving) setPiModalOpen(false); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#0F3B66', color: 'white', py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PIIcon />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Generate Proforma Invoice for Missing Stock
              </Typography>
              <Typography variant="caption" sx={{ color: '#93c5fd' }}>
                Order shortfall items from vendor to replenish stock and cover pending POs
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, bgcolor: '#f8fafc' }}>
          {piError && <Alert severity="error" sx={{ mb: 2 }}>{piError}</Alert>}

          <Paper sx={{ p: 2, mb: 2, border: '1px solid #e2e8f0', borderRadius: 1.5, boxShadow: 'none' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Performa Invoice No"
                  value={piNo}
                  onChange={(e) => setPiNo(e.target.value)}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Autocomplete
                  options={ledgers}
                  getOptionLabel={(option) => option.LedgerName || ''}
                  value={ledgers.find(l => l.Id === piVendorId) || null}
                  onChange={(e, val) => setPiVendorId(val ? val.Id : null)}
                  renderInput={(params) => <TextField {...params} label="Select Supplier / Vendor" size="small" required fullWidth />}
                  fullWidth
                  slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="PI Date"
                  value={piDate}
                  onChange={(e) => setPiDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Expected Delivery Date"
                  value={piDeliveryDate}
                  onChange={(e) => setPiDeliveryDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Remark"
                  value={piRemark}
                  onChange={(e) => setPiRemark(e.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={piDirectStock}
                      onChange={(e) => setPiDirectStock(e.target.checked)}
                      color="success"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 600, color: piDirectStock ? '#16a34a' : 'text.primary' }}>
                      ⚡ Update Stock Directly (mark stock received immediately into inventory)
                    </Typography>
                  }
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Selected Items Table */}
          <Paper sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: '35vh' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Item Description</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Shortfall Qty</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right" sx={{ width: 120 }}>Order Qty</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right" sx={{ width: 100 }}>Rate (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Amount (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Remove</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedItemsData.map((item) => {
                    const key = `${item.ItemCode}___${item.SubCode || ''}`;
                    const q = parseFloat(orderQuantities[key]) || 0;
                    const r = parseFloat(orderRates[key]) || 0;
                    const amt = q * r;

                    return (
                      <TableRow hover key={key}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {item.ItemCode}{item.SubCode ? ` (${item.SubCode})` : ''}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.ItemName}
                          </Typography>
                        </TableCell>

                        <TableCell align="right" sx={{ color: '#dc2626', fontWeight: 700 }}>
                          {parseFloat(item.MissingQty || 0).toFixed(2)}
                        </TableCell>

                        <TableCell align="right">
                          <TextField
                            size="small"
                            type="number"
                            value={orderQuantities[key] !== undefined ? orderQuantities[key] : item.MissingQty}
                            onChange={(e) => {
                              const val = e.target.value;
                              setOrderQuantities(prev => ({ ...prev, [key]: val }));
                            }}
                            inputProps={{ min: 0, step: 'any', style: { textAlign: 'right', fontWeight: 700 } }}
                            fullWidth
                          />
                        </TableCell>

                        <TableCell>{item.Unit || 'PCS'}</TableCell>

                        <TableCell align="right">
                          <TextField
                            size="small"
                            type="number"
                            value={orderRates[key] !== undefined ? orderRates[key] : (item.Costing || 0)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setOrderRates(prev => ({ ...prev, [key]: val }));
                            }}
                            inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                            fullWidth
                          />
                        </TableCell>

                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>

                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleToggleSelectKey(key)}
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

            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 3, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Total Selected Items: <strong>{selectedItemsData.length}</strong>
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Total Order Qty: <strong>{selectedTotalQty.toFixed(2)}</strong>
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                Total Amount: <strong>₹{selectedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </Typography>
            </Box>
          </Paper>
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setPiModalOpen(false)} color="inherit" disabled={piSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleSavePIFromFulfillment}
            disabled={piSaving || selectedItemsData.length === 0}
            startIcon={piSaving ? <CircularProgress size={16} /> : <PIIcon />}
            sx={{ fontWeight: 700, textTransform: 'none', px: 2.5 }}
          >
            {piSaving ? 'Creating Proforma Invoice...' : 'Generate Proforma Invoice'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        pdfUrl={previewUrl}
        title="Pending Purchase Orders Report"
      />

      {/* Snackbar notification */}
      <Snackbar
        open={Boolean(snackbarMsg)}
        autoHideDuration={6000}
        onClose={() => setSnackbarMsg('')}
        message={snackbarMsg}
      />
    </Box>
  );
};

export default PendingPOReport;
