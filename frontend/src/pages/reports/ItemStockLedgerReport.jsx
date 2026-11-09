import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Box, Typography, Button, Paper, CircularProgress, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, InputAdornment, Autocomplete,
  Card, CardContent, Grid, Chip, Divider, Tooltip,
  IconButton, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { 
  PictureAsPdf, Visibility, TableView, Share, 
  Inventory, ArrowBack, Search, CalendarToday,
  SwapHoriz, FilterList, TrendingUp, TrendingDown,
  AccountBalance, Refresh, Warehouse, Factory
} from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ensureNumericWorksheet } from '../../utils/excelHelper';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const ItemStockLedgerReport = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};

  // PDF Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // Item List & Selection State
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemsLoading, setItemsLoading] = useState(true);

  // Date Range State (default to All Time [null, null] to show full statement on select)
  const getFirstDayOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  };
  const getLastDayOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  };

  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;

  // Filter States
  const [scope, setScope] = useState('all'); // 'all' or 'stock'
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchText, setSearchText] = useState('');

  // Ledger Data State
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // 1. Fetch Items on Mount
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setItemsLoading(true);
      const res = await fetch(`${baseUrl}/items`);
      if (!res.ok) throw new Error('Failed to fetch items');
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error('Error fetching items:', err);
      setErrorMsg('Failed to load items master.');
    } finally {
      setItemsLoading(false);
    }
  };

  // 2. Check for itemCode in URL query or state
  useEffect(() => {
    if (items.length > 0 && !selectedItem) {
      const searchParams = new URLSearchParams(location.search);
      const queryItemCode = searchParams.get('itemCode') || location.state?.itemCode;
      const querySubCode = searchParams.get('subCode') || location.state?.subCode || '';
      if (queryItemCode) {
        const found = items.find(i => 
          String(i.ItemCode).toLowerCase() === String(queryItemCode).toLowerCase() &&
          String(i.SubCode || '').toLowerCase() === String(querySubCode).toLowerCase()
        );
        if (found) {
          setSelectedItem(found);
          // If came from query link, allow All Time view by default
          if (searchParams.get('allTime') === 'true') {
            setDateRange([null, null]);
          }
        }
      }
    }
  }, [items, location]);

  // 3. Fetch Ledger Data when selectedItem, date range, or scope changes
  useEffect(() => {
    if (selectedItem) {
      fetchLedger();
    } else {
      setLedgerData(null);
    }
  }, [selectedItem, startDate, endDate, scope]);

  const fetchLedger = async () => {
    if (!selectedItem) return;
    try {
      setLedgerLoading(true);
      setErrorMsg('');

      const formatDate = (date) => {
        if (!date) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      let url = `${baseUrl}/items/stock-ledger?itemCode=${encodeURIComponent(selectedItem.ItemCode)}&subCode=${encodeURIComponent(selectedItem.SubCode || '')}&scope=${scope}`;
      if (startDate) url += `&startDate=${formatDate(startDate)}`;
      if (endDate) url += `&endDate=${formatDate(endDate)}`;

      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to fetch stock ledger data');
      }

      const result = await res.json();
      setLedgerData(result);
    } catch (err) {
      console.error('Error fetching ledger statement:', err);
      setErrorMsg(err.message || 'Server error loading ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  // Quick Date Presets
  const applyPreset = (preset) => {
    const today = new Date();
    if (preset === 'today') {
      setDateRange([today, today]);
    } else if (preset === 'thisMonth') {
      setDateRange([getFirstDayOfMonth(), getLastDayOfMonth()]);
    } else if (preset === 'lastMonth') {
      const prevMonthFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevMonthLast = new Date(today.getFullYear(), today.getMonth(), 0);
      setDateRange([prevMonthFirst, prevMonthLast]);
    } else if (preset === 'fy') {
      // Indian Financial Year: April 1 to March 31
      const currentYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      const fyStart = new Date(currentYear, 3, 1);
      const fyEnd = new Date(currentYear + 1, 2, 31);
      setDateRange([fyStart, fyEnd]);
    } else if (preset === 'all') {
      setDateRange([null, null]);
    }
  };

  // Filtered transactions for display
  const filteredTransactions = useMemo(() => {
    if (!ledgerData?.transactions) return [];
    return ledgerData.transactions.filter(tx => {
      // Type Filter
      if (typeFilter !== 'All') {
        if (typeFilter === 'Inward' && tx.category !== 'Inward') return false;
        if (typeFilter === 'Outward' && tx.category !== 'Outward') return false;
        if (typeFilter === 'Jobwork Out' && tx.type !== 'Jobwork Out') return false;
        if (typeFilter === 'Jobwork In' && !tx.type.startsWith('Jobwork In')) return false;
        if (typeFilter === 'Stock Transfer' && tx.category !== 'Stock Transfer') return false;
        if (typeFilter === 'Stock Journal' && tx.category !== 'Stock Journal') return false;
        if (typeFilter === 'Assembly' && tx.category !== 'Assembly') return false;
      }

      // Search Query Filter
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const matchDoc = (tx.docNo || '').toLowerCase().includes(q);
        const matchParty = (tx.partyName || '').toLowerCase().includes(q);
        const matchPart = (tx.particulars || '').toLowerCase().includes(q);
        const matchRem = (tx.remark || '').toLowerCase().includes(q);
        const matchProc = (tx.process || '').toLowerCase().includes(q);
        if (!matchDoc && !matchParty && !matchPart && !matchRem && !matchProc) return false;
      }

      return true;
    });
  }, [ledgerData, typeFilter, searchText]);

  // Recalculate summary totals based on filtered view if filtered
  const displaySummary = useMemo(() => {
    if (!ledgerData?.summary) return { openingStock: 0, totalIn: 0, totalOut: 0, netMovement: 0, closingStock: 0 };
    if (typeFilter === 'All' && !searchText.trim()) {
      return ledgerData.summary;
    }
    let tIn = 0;
    let tOut = 0;
    filteredTransactions.forEach(t => {
      if (t.direction === 'IN') tIn += Number(t.effectiveQty || 0);
      else tOut += Number(t.effectiveQty || 0);
    });
    return {
      ...ledgerData.summary,
      totalIn: Number(tIn.toFixed(3)),
      totalOut: Number(tOut.toFixed(3)),
      netMovement: Number((tIn - tOut).toFixed(3)),
      closingStock: Number((ledgerData.summary.openingStock + tIn - tOut).toFixed(3))
    };
  }, [ledgerData, typeFilter, searchText, filteredTransactions]);

  // Helper for chip colors by transaction type
  const getTypeChip = (type, category) => {
    if (category === 'Inward') {
      return <Chip label="Inward" size="small" sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '0.72rem' }} />;
    }
    if (category === 'Outward') {
      return <Chip label="Outward" size="small" sx={{ bgcolor: '#fee2e2', color: '#b91c1c', fontWeight: 700, fontSize: '0.72rem' }} />;
    }
    if (type === 'Jobwork Out') {
      return <Chip label="Jobwork Out" size="small" sx={{ bgcolor: '#ffedd5', color: '#c2410c', fontWeight: 700, fontSize: '0.72rem' }} />;
    }
    if (type.startsWith('Jobwork In')) {
      return <Chip label={type} size="small" sx={{ bgcolor: '#ccfbf1', color: '#0f766e', fontWeight: 700, fontSize: '0.72rem' }} />;
    }
    if (category === 'Stock Transfer') {
      return <Chip label={type} size="small" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: '0.72rem' }} />;
    }
    if (category === 'Stock Journal') {
      return <Chip label={type} size="small" sx={{ bgcolor: '#f3e8ff', color: '#7e22ce', fontWeight: 700, fontSize: '0.72rem' }} />;
    }
    if (category === 'Assembly') {
      return <Chip label={type} size="small" sx={{ bgcolor: '#ede9fe', color: '#4338ca', fontWeight: 700, fontSize: '0.72rem' }} />;
    }
    return <Chip label={type} size="small" sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600, fontSize: '0.72rem' }} />;
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!selectedItem || !ledgerData) return;

    const exportRows = [];

    // Header Metadata
    exportRows.push({ 'Date': 'ITEM STOCK LEDGER STATEMENT', 'Doc / Voucher No': '', 'Type': '', 'Bill': '', 'Particulars / Route': '', 'In Qty (+)': '', 'Out Qty (-)': '', 'Unit': '', 'Rate (Rs.)': '', 'Amount (Rs.)': '', 'Balance Stock': '', 'Remarks': '' });
    exportRows.push({ 'Date': `Item: [${selectedItem.ItemCode}] ${selectedItem.ItemName}`, 'Doc / Voucher No': `Unit: ${selectedItem.Unit}`, 'Type': `Type: ${selectedItem.ItemType || '-'}`, 'Bill': `Series: ${selectedItem.Series || '-'}`, 'Particulars / Route': '', 'In Qty (+)': '', 'Out Qty (-)': '', 'Unit': '', 'Rate (Rs.)': '', 'Amount (Rs.)': '', 'Balance Stock': '', 'Remarks': '' });
    exportRows.push({ 'Date': `Period: ${startDate ? startDate.toLocaleDateString('en-GB') : 'Initial'} to ${endDate ? endDate.toLocaleDateString('en-GB') : 'Latest'}`, 'Doc / Voucher No': '', 'Type': '', 'Bill': '', 'Particulars / Route': '', 'In Qty (+)': '', 'Out Qty (-)': '', 'Unit': '', 'Rate (Rs.)': '', 'Amount (Rs.)': '', 'Balance Stock': '', 'Remarks': '' });
    exportRows.push({});

    // Opening Stock
    exportRows.push({
      'Date': 'OPENING STOCK',
      'Doc / Voucher No': '',
      'Type': 'Opening',
      'Bill': '',
      'Particulars / Route': 'Initial / Period Balance',
      'In Qty (+)': null,
      'Out Qty (-)': null,
      'Unit': selectedItem.Unit || '',
      'Rate (Rs.)': null,
      'Amount (Rs.)': null,
      'Balance Stock': Number(ledgerData?.summary?.openingStock ?? 0),
      'Remarks': ''
    });

    // Transactions
    filteredTransactions.forEach(tx => {
      exportRows.push({
        'Date': tx.date ? new Date(tx.date).toLocaleDateString('en-GB') : '-',
        'Doc / Voucher No': tx.docNo || '-',
        'Type': tx.type,
        'Bill': tx.bill ? 'With Bill' : 'Without Bill',
        'Particulars / Route': tx.particulars || '-',
        'In Qty (+)': tx.direction === 'IN' ? (Number(tx.effectiveQty) || 0) : null,
        'Out Qty (-)': tx.direction === 'OUT' ? (Number(tx.effectiveQty) || 0) : null,
        'Unit': tx.unit || selectedItem.Unit,
        'Rate (Rs.)': tx.rate ? Number(tx.rate.toFixed(2)) : null,
        'Amount (Rs.)': tx.amount ? Number(tx.amount.toFixed(2)) : null,
        'Balance Stock': Number(tx.runningStock) || 0,
        'Remarks': tx.remark || ''
      });
    });

    // Summary Totals
    exportRows.push({});
    exportRows.push({
      'Date': 'PERIOD TOTALS',
      'Doc / Voucher No': '',
      'Type': '',
      'Bill': '',
      'Particulars / Route': `Total In: ${displaySummary.totalIn} | Total Out: ${displaySummary.totalOut} | Net Movement: ${displaySummary.netMovement}`,
      'In Qty (+)': Number(displaySummary.totalIn) || 0,
      'Out Qty (-)': Number(displaySummary.totalOut) || 0,
      'Unit': selectedItem.Unit || '',
      'Rate (Rs.)': null,
      'Amount (Rs.)': null,
      'Balance Stock': null,
      'Remarks': ''
    });

    exportRows.push({
      'Date': 'CLOSING BALANCE STOCK',
      'Doc / Voucher No': '',
      'Type': '',
      'Bill': '',
      'Particulars / Route': '',
      'In Qty (+)': null,
      'Out Qty (-)': null,
      'Unit': selectedItem.Unit || '',
      'Rate (Rs.)': null,
      'Amount (Rs.)': null,
      'Balance Stock': Number(displaySummary.closingStock) || 0,
      'Remarks': ''
    });

    // Closing Stock Bifurcation (Main Stock & Department Position)
    if (ledgerData.stockBifurcation) {
      exportRows.push({});
      exportRows.push({
        'Date': 'CLOSING STOCK BIFURCATION (MAIN STORE & DEPARTMENT POSITIONS)',
        'Doc / Voucher No': '',
        'Type': '',
        'Bill': '',
        'Particulars / Route': '',
        'In Qty (+)': null,
        'Out Qty (-)': null,
        'Unit': '',
        'Rate (Rs.)': null,
        'Amount (Rs.)': null,
        'Balance Stock': null,
        'Remarks': ''
      });

      exportRows.push({
        'Date': 'Main Stock (Central Store)',
        'Doc / Voucher No': '',
        'Type': 'Godown Stock',
        'Bill': '',
        'Particulars / Route': 'Central Finished Goods / Raw Store Godown',
        'In Qty (+)': null,
        'Out Qty (-)': null,
        'Unit': selectedItem.Unit || '',
        'Rate (Rs.)': null,
        'Amount (Rs.)': null,
        'Balance Stock': Number(ledgerData.stockBifurcation.mainStock.qty) || 0,
        'Remarks': 'ItemMaster Closing Stock'
      });

      (ledgerData.stockBifurcation.departmentStocks || []).forEach(d => {
        exportRows.push({
          'Date': `Dept: ${d.deptName}`,
          'Doc / Voucher No': '',
          'Type': 'Department Stock (WIP)',
          'Bill': '',
          'Particulars / Route': `In-process stock in ${d.deptName}${d.weight > 0 ? ` (Weight: ${d.weight} KG)` : ''}`,
          'In Qty (+)': null,
          'Out Qty (-)': null,
          'Unit': selectedItem.Unit || '',
          'Rate (Rs.)': null,
          'Amount (Rs.)': null,
          'Balance Stock': Number(d.qty) || 0,
          'Remarks': d.weight > 0 ? `Weight: ${d.weight} KG` : ''
        });
      });

      exportRows.push({
        'Date': 'TOTAL IN DEPARTMENTS (WIP)',
        'Doc / Voucher No': '',
        'Type': 'Total WIP',
        'Bill': '',
        'Particulars / Route': 'Sum of in-process department positions',
        'In Qty (+)': null,
        'Out Qty (-)': null,
        'Unit': selectedItem.Unit || '',
        'Rate (Rs.)': null,
        'Amount (Rs.)': null,
        'Balance Stock': Number(ledgerData.stockBifurcation.totalDepartmentStock) || 0,
        'Remarks': ledgerData.stockBifurcation.totalDepartmentWeight > 0 ? `Total Wt: ${ledgerData.stockBifurcation.totalDepartmentWeight} KG` : ''
      });

      exportRows.push({
        'Date': 'TOTAL COMPANY STOCK POSITION',
        'Doc / Voucher No': '',
        'Type': 'Grand Total',
        'Bill': '',
        'Particulars / Route': 'Main Store Stock + All Department WIP Positions',
        'In Qty (+)': null,
        'Out Qty (-)': null,
        'Unit': selectedItem.Unit || '',
        'Rate (Rs.)': null,
        'Amount (Rs.)': null,
        'Balance Stock': Number(ledgerData.stockBifurcation.totalCompanyStock) || 0,
        'Remarks': 'Enterprise Total'
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    ensureNumericWorksheet(worksheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Ledger');

    const cleanCode = selectedItem.ItemCode.replace(/[^a-zA-Z0-9_-]/g, '');
    XLSX.writeFile(workbook, `StockLedger_${cleanCode}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export / Preview PDF
  const handleExportPDF = async (action = 'preview') => {
    if (!selectedItem || !ledgerData) return;

    // Fetch company profile for banner header
    let compProfile = null;
    try {
      const pRes = await fetch(`${baseUrl}/company-profile`);
      if (pRes.ok) compProfile = await pRes.json();
    } catch (e) {
      console.warn('Could not fetch company profile for PDF header', e);
    }

    const doc = new jsPDF('landscape');
    const compName = compProfile?.CompanyName || localUser?.companyName || 'FRM ERP';
    const address = [compProfile?.Address1, compProfile?.Address2, compProfile?.City, compProfile?.StateName].filter(Boolean).join(', ');
    const gstNo = compProfile?.GSTIN ? `GSTIN: ${compProfile.GSTIN}` : '';

    // Header Banner
    doc.setFillColor(15, 59, 102);
    doc.rect(0, 0, 297, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(compName, 14, 11);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${address} ${gstNo ? ' | ' + gstNo : ''}`, 14, 18);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ITEM STOCK LEDGER', 283, 15, { align: 'right' });

    // Item Info Sub-header
    doc.setTextColor(15, 59, 102);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Item: [${selectedItem.ItemCode}] ${selectedItem.ItemName}`, 14, 32);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const dateText = `Period: ${startDate ? startDate.toLocaleDateString('en-GB') : 'Initial'} to ${endDate ? endDate.toLocaleDateString('en-GB') : 'Latest'} | Unit: ${selectedItem.Unit || '-'} | Series: ${selectedItem.Series || '-'} | Type: ${selectedItem.ItemType || '-'}`;
    doc.text(dateText, 14, 38);

    // KPI Badges on the right of sub-header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text(`Opening: ${ledgerData?.summary?.openingStock ?? 0}`, 160, 32);
    doc.setTextColor(22, 163, 74);
    doc.text(`Total In: +${displaySummary.totalIn}`, 200, 32);
    doc.setTextColor(220, 38, 38);
    doc.text(`Total Out: -${displaySummary.totalOut}`, 235, 32);
    doc.setTextColor(15, 59, 102);
    doc.text(`Closing: ${displaySummary.closingStock}`, 283, 32, { align: 'right' });

    // Table Data
    const tableColumn = ["Date", "Doc No", "Type", "Particulars / Route", "Bill", "In Qty (+)", "Out Qty (-)", "Unit", "Rate", "Amount", "Balance"];
    const tableRows = [];

    // Opening Stock Row
    tableRows.push([
      { content: 'OPENING STOCK', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 59, 102] } },
      { content: '', styles: { fillColor: [241, 245, 249] } },
      { content: '', styles: { fillColor: [241, 245, 249] } },
      { content: selectedItem.Unit || '', styles: { fillColor: [241, 245, 249] } },
      { content: '', styles: { fillColor: [241, 245, 249] } },
      { content: '', styles: { fillColor: [241, 245, 249] } },
      { content: `${ledgerData?.summary?.openingStock ?? 0}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249], textColor: [15, 59, 102] } }
    ]);

    // Rows
    filteredTransactions.forEach(tx => {
      tableRows.push([
        tx.date ? new Date(tx.date).toLocaleDateString('en-GB') : '-',
        tx.docNo || '-',
        tx.type,
        tx.particulars || '-',
        tx.bill ? 'Bill' : 'Cash',
        tx.direction === 'IN' ? `+${tx.effectiveQty}` : '',
        tx.direction === 'OUT' ? `-${tx.effectiveQty}` : '',
        tx.unit || selectedItem.Unit,
        tx.rate > 0 ? tx.rate.toFixed(2) : '-',
        tx.amount > 0 ? tx.amount.toFixed(2) : '-',
        `${tx.runningStock}`
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      foot: [
        [
          { content: 'TOTALS', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [226, 232, 240], textColor: [15, 59, 102] } },
          { content: `+${displaySummary.totalIn}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [226, 232, 240], textColor: [22, 163, 74] } },
          { content: `-${displaySummary.totalOut}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [226, 232, 240], textColor: [220, 38, 38] } },
          { content: selectedItem.Unit || '', styles: { fillColor: [226, 232, 240] } },
          { content: '', styles: { fillColor: [226, 232, 240] } },
          { content: '', styles: { fillColor: [226, 232, 240] } },
          { content: `${displaySummary.closingStock}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [226, 232, 240], textColor: [15, 59, 102] } }
        ],
        [
          { content: 'CLOSING BALANCE STOCK', colSpan: 10, styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 59, 102], textColor: [255, 255, 255] } },
          { content: `${displaySummary.closingStock} ${selectedItem.Unit || ''}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 59, 102], textColor: [255, 255, 255] } }
        ]
      ],
      startY: 44,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.8 },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 18 },
        2: { cellWidth: 32 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 20, halign: 'right', textColor: [22, 163, 74] },
        6: { cellWidth: 20, halign: 'right', textColor: [220, 38, 38] },
        7: { cellWidth: 14, halign: 'center' },
        8: { cellWidth: 18, halign: 'right' },
        9: { cellWidth: 20, halign: 'right' },
        10: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
      },
      margin: { top: 44, left: 14, right: 14 }
    });

    // Closing Stock Bifurcation Table in PDF
    if (ledgerData.stockBifurcation) {
      let finalY = (doc.lastAutoTable?.finalY || 160) + 7;
      if (finalY > 155) {
        doc.addPage();
        finalY = 18;
      }

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 59, 102);
      doc.text('CLOSING STOCK BIFURCATION & DEPARTMENT-WISE STOCK POSITION', 14, finalY);

      const bifCols = ["Location / Department", "Classification", "Stock Qty", "Unit", "Weight (KG)", "Remarks"];
      const bifRows = [];

      bifRows.push([
        'Main Stock (Central Store)',
        'Central Finished Goods / Raw Store',
        `${ledgerData.stockBifurcation.mainStock.qty}`,
        selectedItem.Unit || '',
        '-',
        'Central Available Stock'
      ]);

      (ledgerData.stockBifurcation.departmentStocks || []).forEach(d => {
        bifRows.push([
          `Dept: ${d.deptName}`,
          'In-Process / Shop Floor (WIP)',
          `${d.qty}`,
          selectedItem.Unit || '',
          d.weight > 0 ? `${d.weight} KG` : '-',
          d.qty !== 0 ? 'Active Floor Stock' : 'Zero Balance'
        ]);
      });

      bifRows.push([
        { content: 'TOTAL IN DEPARTMENTS (WIP)', styles: { fontStyle: 'bold', fillColor: [254, 243, 199], textColor: [180, 83, 9] } },
        { content: 'All Production Shop Floors', styles: { fillColor: [254, 243, 199] } },
        { content: `${ledgerData.stockBifurcation.totalDepartmentStock}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [254, 243, 199], textColor: [180, 83, 9] } },
        { content: selectedItem.Unit || '', styles: { fillColor: [254, 243, 199] } },
        { content: ledgerData.stockBifurcation.totalDepartmentWeight > 0 ? `${ledgerData.stockBifurcation.totalDepartmentWeight} KG` : '-', styles: { fillColor: [254, 243, 199], halign: 'right' } },
        { content: 'Total In-process WIP', styles: { fillColor: [254, 243, 199] } }
      ]);

      bifRows.push([
        { content: 'TOTAL ENTERPRISE STOCK', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [15, 59, 102], textColor: [255, 255, 255] } },
        { content: `${ledgerData.stockBifurcation.totalCompanyStock} ${selectedItem.Unit || ''}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [15, 59, 102], textColor: [248, 138, 1] } },
        { content: selectedItem.Unit || '', styles: { fillColor: [15, 59, 102], textColor: [255, 255, 255] } },
        { content: '-', styles: { fillColor: [15, 59, 102], textColor: [255, 255, 255] } },
        { content: 'Main Store + All Departments', styles: { fillColor: [15, 59, 102], textColor: [255, 255, 255] } }
      ]);

      autoTable(doc, {
        head: [bifCols],
        body: bifRows,
        startY: finalY + 3,
        theme: 'grid',
        styles: { fontSize: 7.2, cellPadding: 1.5 },
        headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 65 },
          2: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
          3: { cellWidth: 16, halign: 'center' },
          4: { cellWidth: 28, halign: 'right' },
          5: { cellWidth: 'auto' }
        },
        margin: { left: 14, right: 14 }
      });
    }

    const cleanCode = selectedItem.ItemCode.replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `Item_Stock_Ledger_${cleanCode}.pdf`;

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const reportName = 'ItemStockLedger';
      fetch(`${baseUrl}/auth/share-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, reportName })
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to share PDF');
        return res.json();
      })
      .then(data => alert(data.message || 'PDF saved and highlighted in explorer'))
      .catch(err => alert('Error sharing PDF: ' + err.message));
    } else if (action === 'preview') {
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPreviewTitle(`Item Stock Ledger Preview - [${selectedItem.ItemCode}] ${selectedItem.ItemName}`);
      setPreviewUrl(blobUrl);
      setPreviewOpen(true);
    } else {
      doc.save(fileName);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 1. Header Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Inventory sx={{ fontSize: 34, color: '#0F3B66' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F3B66', lineHeight: 1.2 }}>
              Item Stock Ledger
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Complete date-wise movement statement (Inward, Outward, Jobwork, Transfers & Adjustments)
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button 
            variant="outlined" 
            startIcon={<TableView />} 
            onClick={handleExportExcel} 
            sx={{ color: '#107c41', borderColor: '#107c41', fontWeight: 600, '&:hover': { bgcolor: 'rgba(16,124,65,0.06)' } }} 
            disabled={!selectedItem || !ledgerData}
          >
            Export Excel
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<Visibility />} 
            onClick={() => handleExportPDF('preview')} 
            sx={{ color: '#0F3B66', borderColor: '#0F3B66', fontWeight: 600, '&:hover': { bgcolor: 'rgba(15,59,102,0.06)' } }} 
            disabled={!selectedItem || !ledgerData}
          >
            Preview PDF
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<PictureAsPdf />} 
            onClick={() => handleExportPDF('download')} 
            sx={{ color: '#d32f2f', borderColor: '#d32f2f', fontWeight: 600, '&:hover': { bgcolor: 'rgba(211,47,47,0.06)' } }} 
            disabled={!selectedItem || !ledgerData}
          >
            Export PDF
          </Button>
          <Button 
            variant="contained" 
            startIcon={<Share />} 
            onClick={() => handleExportPDF('share')} 
            sx={{ bgcolor: '#F88A01', fontWeight: 700, '&:hover': { bgcolor: '#e07d00' } }} 
            disabled={!selectedItem || !ledgerData}
          >
            Share
          </Button>
        </Box>
      </Box>

      {/* 2. Selector Toolbar & Filters */}
      <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        <Grid container spacing={2} alignItems="center">
          {/* Item Selector (Expanded for Full Readability) */}
          <Grid item xs={12} md={7} lg={6}>
            <Autocomplete
              fullWidth
              options={items}
              loading={itemsLoading}
              getOptionLabel={(option) => {
                if (!option) return '';
                if (typeof option === 'string') return option;
                return `[${option.ItemCode || ''}${option.SubCode ? ` / ${option.SubCode}` : ''}]  ${option.ItemName || ''}`;
              }}
              value={selectedItem}
              onChange={(e, val) => setSelectedItem(val)}
              isOptionEqualToValue={(option, value) => option?.ItemCode === value?.ItemCode && (option?.SubCode || '') === (value?.SubCode || '')}
              slotProps={{
                popper: {
                  sx: {
                    minWidth: { xs: '100%', sm: 550, md: 650 },
                    maxWidth: '95vw',
                    width: 'fit-content',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                    borderRadius: 2,
                    zIndex: 1300
                  }
                }
              }}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                return (
                  <Box 
                    component="li" 
                    key={key || option.ItemCode}
                    {...otherProps} 
                    sx={{ 
                      py: 1.2, 
                      px: 2, 
                      borderBottom: '1px solid #f1f5f9', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      gap: 2,
                      '&:hover': { bgcolor: '#f0f9ff' }
                    }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.3 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#0F3B66', fontSize: '0.9rem' }}>
                          [{option.ItemCode}]
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>
                          {option.ItemName}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        {option.ItemType && (
                          <Chip 
                            label={option.ItemType} 
                            size="small" 
                            sx={{ fontSize: '0.68rem', height: 18, bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600 }} 
                          />
                        )}
                        {option.Series && (
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem' }}>
                            Series: <strong>{option.Series}</strong>
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem' }}>
                          Unit: <strong>{option.Unit || 'PCS'}</strong>
                        </Typography>
                      </Box>
                    </Box>
                    <Chip 
                      label={`Stock: ${option.ClosingStock || 0}`} 
                      size="small" 
                      sx={{ 
                        fontWeight: 800, 
                        fontSize: '0.75rem',
                        height: 24,
                        px: 0.5,
                        flexShrink: 0,
                        bgcolor: (option.ClosingStock || 0) >= 0 ? '#e0f2fe' : '#fee2e2',
                        color: (option.ClosingStock || 0) >= 0 ? '#0369a1' : '#b91c1c'
                      }} 
                    />
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  fullWidth
                  label="Select Item *" 
                  size="small" 
                  placeholder="Type item code or item name to search..."
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.92rem',
                      fontWeight: 600,
                      color: '#0F3B66',
                      minHeight: 40
                    }
                  }}
                />
              )}
            />
          </Grid>

          {/* Date Range Picker */}
          <Grid item xs={12} sm={6} md={5} lg={2}>
            <DatePicker
              portalId="root"
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update) => setDateRange(update)}
              isClearable={true}
              dateFormat="dd/MM/yyyy"
              customInput={
                <TextField 
                  label="Statement Date Range" 
                  size="small" 
                  InputLabelProps={{ shrink: true }} 
                  fullWidth 
                  placeholder={(!startDate && !endDate) ? "All Time (Full History)" : "DD/MM/YYYY - DD/MM/YYYY"}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarToday fontSize="small" sx={{ color: '#64748b' }} />
                      </InputAdornment>
                    )
                  }}
                />
              }
            />
          </Grid>

          {/* Scope Selector */}
          <Grid item xs={6} sm={3} md={6} lg={2}>
            <FormControl fullWidth size="small">
              <InputLabel shrink>Movement Scope</InputLabel>
              <Select
                value={scope}
                label="Movement Scope"
                onChange={(e) => setScope(e.target.value)}
              >
                <MenuItem value="all">All Movements</MenuItem>
                <MenuItem value="stock">Central Stock Only</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Type Filter */}
          <Grid item xs={6} sm={3} md={6} lg={2}>
            <FormControl fullWidth size="small">
              <InputLabel shrink>Transaction Filter</InputLabel>
              <Select
                value={typeFilter}
                label="Transaction Filter"
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <MenuItem value="All">All Types (All Transactions)</MenuItem>
                <MenuItem value="Inward">Inward Only</MenuItem>
                <MenuItem value="Outward">Outward Only</MenuItem>
                <MenuItem value="Jobwork Out">Job Work Out Only</MenuItem>
                <MenuItem value="Jobwork In">Job Work In Only</MenuItem>
                <MenuItem value="Stock Transfer">Stock Transfer Only</MenuItem>
                <MenuItem value="Stock Journal">Stock Journal Only</MenuItem>
                <MenuItem value="Assembly">Assembly Only</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Date Presets Row */}
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, pt: 1.5, borderTop: '1px dashed #e2e8f0', alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mr: 0.5 }}>
            Quick Range:
          </Typography>
          <Button 
            size="small" 
            variant={(!startDate && !endDate) ? "contained" : "outlined"} 
            onClick={() => applyPreset('all')} 
            sx={{ 
              fontSize: '0.75rem', 
              py: 0.2, 
              px: 1.2, 
              fontWeight: 700,
              bgcolor: (!startDate && !endDate) ? '#0F3B66' : 'transparent',
              color: (!startDate && !endDate) ? '#ffffff' : '#0F3B66',
              borderColor: '#0F3B66'
            }}
          >
            All Time
          </Button>
          <Button size="small" variant="text" onClick={() => applyPreset('today')} sx={{ fontSize: '0.75rem', py: 0.2, px: 1 }}>
            Today
          </Button>
          <Button size="small" variant="text" onClick={() => applyPreset('thisMonth')} sx={{ fontSize: '0.75rem', py: 0.2, px: 1 }}>
            This Month
          </Button>
          <Button size="small" variant="text" onClick={() => applyPreset('lastMonth')} sx={{ fontSize: '0.75rem', py: 0.2, px: 1 }}>
            Last Month
          </Button>
          <Button size="small" variant="text" onClick={() => applyPreset('fy')} sx={{ fontSize: '0.75rem', py: 0.2, px: 1 }}>
            Current FY
          </Button>

          {/* Search box within results */}
          <Box sx={{ ml: { xs: 0, sm: 'auto' }, width: { xs: '100%', sm: 260 } }}>
            <TextField
              size="small"
              placeholder="Search voucher, party, remarks..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: '#94a3b8' }} />
                  </InputAdornment>
                ),
                sx: { height: 32, fontSize: '0.82rem' }
              }}
            />
          </Box>
        </Box>
      </Paper>

      {/* 3. Item Summary KPI Cards */}
      {selectedItem && ledgerData && (
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          {/* Card 1: Selected Item Details */}
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: '#ffffff', borderColor: '#cbd5e1', height: '100%' }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Item Details
                  </Typography>
                  <Chip label={selectedItem.Unit || 'PCS'} size="small" sx={{ fontWeight: 800, fontSize: '0.7rem', height: 20, bgcolor: '#f1f5f9' }} />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0F3B66', mt: 0.5, lineHeight: 1.2 }}>
                  {selectedItem.ItemName}
                </Typography>
                <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.5 }}>
                  Code: <strong>{selectedItem.ItemCode}</strong> • Series: <strong>{selectedItem.Series || '-'}</strong>
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 2: Opening Stock */}
          <Grid item xs={12} sm={6} md={2.25}>
            <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: '#f8fafc', borderColor: '#e2e8f0', height: '100%' }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Opening Stock
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b', mt: 0.5 }}>
                  {ledgerData?.summary?.openingStock ?? 0}
                  <Typography component="span" variant="caption" sx={{ ml: 0.8, color: '#64748b' }}>
                    {selectedItem.Unit}
                  </Typography>
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  As of {startDate ? startDate.toLocaleDateString('en-GB') : 'Initial'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 3: Total Inward / Receipts (+) */}
          <Grid item xs={12} sm={6} md={2.25}>
            <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: '#f0fdf4', borderColor: '#bbf7d0', height: '100%' }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TrendingUp sx={{ fontSize: 18, color: '#16a34a' }} />
                  <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Total In (+)
                  </Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#15803d', mt: 0.5 }}>
                  +{displaySummary.totalIn}
                  <Typography component="span" variant="caption" sx={{ ml: 0.8, color: '#16a34a' }}>
                    {selectedItem.Unit}
                  </Typography>
                </Typography>
                <Typography variant="caption" sx={{ color: '#166534' }}>
                  Inward, Job In, Production
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 4: Total Outward / Issues (-) */}
          <Grid item xs={12} sm={6} md={2.25}>
            <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: '#fef2f2', borderColor: '#fecaca', height: '100%' }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TrendingDown sx={{ fontSize: 18, color: '#dc2626' }} />
                  <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Total Out (-)
                  </Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#b91c1c', mt: 0.5 }}>
                  -{displaySummary.totalOut}
                  <Typography component="span" variant="caption" sx={{ ml: 0.8, color: '#dc2626' }}>
                    {selectedItem.Unit}
                  </Typography>
                </Typography>
                <Typography variant="caption" sx={{ color: '#991b1b' }}>
                  Outward, Job Out, Consumption
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 5: Closing Stock Balance */}
          <Grid item xs={12} sm={6} md={2.25}>
            <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: '#eff6ff', borderColor: '#bfdbfe', height: '100%', boxShadow: '0 2px 6px rgba(15,59,102,0.08)' }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Closing Stock
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, color: displaySummary.closingStock >= 0 ? '#0F3B66' : '#dc2626', mt: 0.5 }}>
                  {displaySummary.closingStock}
                  <Typography component="span" variant="caption" sx={{ ml: 0.8, color: '#1e40af' }}>
                    {selectedItem.Unit}
                  </Typography>
                </Typography>
                <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 600 }}>
                  Net: {displaySummary.netMovement >= 0 ? `+${displaySummary.netMovement}` : displaySummary.netMovement}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* 3.1. Closing Stock Bifurcation (Main Stock & Department Position) */}
      {selectedItem && ledgerData?.stockBifurcation && (
        <Paper
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: 2,
            border: '1px solid #cbd5e1',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountBalance sx={{ color: '#0F3B66', fontSize: 22 }} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F3B66', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Closing Stock Bifurcation (Main Store & Department Positions)
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Live breakdown of stock available in Central Godown vs Work-In-Progress across factory shop floors
                </Typography>
              </Box>
            </Box>
          </Box>

          <Grid container spacing={1.5}>
            {/* Main Stock (Central Store) */}
            <Grid item xs={12} sm={6} md={3} lg={2.4}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: '#ffffff',
                  border: '2px solid #0F3B66',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 6px rgba(15,59,102,0.06)'
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="caption" sx={{ color: '#0F3B66', fontWeight: 800, textTransform: 'uppercase' }}>
                      Main Stock (Store)
                    </Typography>
                    <Chip label="Central Godown" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem', display: 'block', mt: 0.3 }}>
                    Available Finished / Raw
                  </Typography>
                </Box>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: (ledgerData.stockBifurcation.mainStock.qty >= 0) ? '#0F3B66' : '#dc2626' }}>
                    {ledgerData.stockBifurcation.mainStock.qty}
                    <Typography component="span" variant="caption" sx={{ ml: 0.6, color: '#64748b', fontWeight: 700 }}>
                      {selectedItem.Unit}
                    </Typography>
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* Department Positions */}
            {(ledgerData.stockBifurcation.departmentStocks || []).map(dept => {
              const hasStock = dept.pcs !== 0 || dept.weight !== 0;
              return (
                <Grid item xs={6} sm={4} md={2.5} lg={2.4} key={dept.deptId}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: hasStock ? '#ffffff' : '#f8fafc',
                      border: hasStock ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: hasStock ? '0 2px 5px rgba(2,132,199,0.08)' : 'none'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography variant="caption" sx={{ color: hasStock ? '#0369a1' : '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                        {dept.deptName}
                      </Typography>
                      {hasStock && (
                        <Chip label="WIP" size="small" sx={{ height: 16, fontSize: '0.62rem', bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 800 }} />
                      )}
                    </Box>
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: hasStock ? (dept.qty >= 0 ? '#0284c7' : '#dc2626') : '#94a3b8' }}>
                        {dept.qty}
                        <Typography component="span" variant="caption" sx={{ ml: 0.5, color: '#64748b', fontWeight: 600 }}>
                          {selectedItem.Unit}
                        </Typography>
                      </Typography>
                      {dept.weight > 0 && !ledgerData.stockBifurcation.isWeightBased && (
                        <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontSize: '0.7rem', mt: 0.2 }}>
                          Weight: <strong>{dept.weight} KG</strong>
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>
              );
            })}

            {/* Total In Departments (WIP) */}
            <Grid item xs={12} sm={6} md={3} lg={2.4}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: '#ffffff',
                  border: '1.5px solid #F88A01',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 6px rgba(248,138,1,0.08)'
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="caption" sx={{ color: '#c2410c', fontWeight: 800, textTransform: 'uppercase' }}>
                      Total in Depts
                    </Typography>
                    <Chip label="WIP Total" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#ffedd5', color: '#c2410c', fontWeight: 700 }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem', display: 'block', mt: 0.3 }}>
                    Across all shop floors
                  </Typography>
                </Box>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: '#c2410c' }}>
                    {ledgerData.stockBifurcation.totalDepartmentStock}
                    <Typography component="span" variant="caption" sx={{ ml: 0.6, color: '#64748b', fontWeight: 700 }}>
                      {selectedItem.Unit}
                    </Typography>
                  </Typography>
                  {ledgerData.stockBifurcation.totalDepartmentWeight > 0 && !ledgerData.stockBifurcation.isWeightBased && (
                    <Typography variant="caption" sx={{ display: 'block', color: '#c2410c', fontSize: '0.7rem', mt: 0.2 }}>
                      Total Weight: <strong>{ledgerData.stockBifurcation.totalDepartmentWeight} KG</strong>
                    </Typography>
                  )}
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* 4. Ledger Table or Empty/Loading State */}
      <Box sx={{ flexGrow: 1, width: '100%', overflowY: 'auto' }}>
        {ledgerLoading || (selectedItem && !ledgerData && !errorMsg) ? (
          <Paper sx={{ p: 6, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRadius: 2 }}>
            <CircularProgress size={40} sx={{ color: '#0F3B66', mb: 2 }} />
            <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600 }}>
              Calculating date-wise stock transactions...
            </Typography>
          </Paper>
        ) : !selectedItem ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2, border: '2px dashed #cbd5e1', bgcolor: '#f8fafc' }}>
            <Inventory sx={{ fontSize: 56, color: '#94a3b8', mb: 1.5 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66' }}>
              Select an Item to Generate Stock Ledger
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 480, mx: 'auto', mt: 1 }}>
              Choose an item from the search box above to view all its chronological transactions: inward, outward, jobwork out, jobwork in, stock transfers, and stock journal adjustments.
            </Typography>
          </Paper>
        ) : errorMsg ? (
          <Paper sx={{ p: 4, textAlign: 'center', color: 'error.main', borderRadius: 2, bgcolor: '#fef2f2' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Error</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>{errorMsg}</Typography>
            <Button 
              variant="outlined" 
              sx={{ color: '#0F3B66', borderColor: '#0F3B66', fontWeight: 700 }} 
              onClick={fetchLedger}
            >
              Retry
            </Button>
          </Paper>
        ) : !ledgerData ? null : (
          <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': { backgroundColor: '#0F3B66', color: '#ffffff', fontWeight: 700, fontSize: '0.82rem', py: 1.2 } }}>
                  <TableCell sx={{ minWidth: 95 }}>Date</TableCell>
                  <TableCell sx={{ minWidth: 90 }}>Doc No</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Type</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>Particulars / Party / Route</TableCell>
                  <TableCell sx={{ minWidth: 80 }} align="center">Bill</TableCell>
                  <TableCell sx={{ minWidth: 100 }} align="right">In Qty (+)</TableCell>
                  <TableCell sx={{ minWidth: 100 }} align="right">Out Qty (-)</TableCell>
                  <TableCell sx={{ minWidth: 70 }} align="center">Unit</TableCell>
                  <TableCell sx={{ minWidth: 85 }} align="right">Rate (₹)</TableCell>
                  <TableCell sx={{ minWidth: 95 }} align="right">Amount (₹)</TableCell>
                  <TableCell sx={{ minWidth: 110, backgroundColor: '#092542 !important' }} align="right">Balance Stock</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Remarks / Process</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {/* 1. Opening Stock Row */}
                <TableRow sx={{ backgroundColor: '#f1f5f9', fontWeight: 700 }}>
                  <TableCell sx={{ fontWeight: 700, color: '#0F3B66' }}>
                    {startDate ? startDate.toLocaleDateString('en-GB') : 'Initial'}
                  </TableCell>
                  <TableCell sx={{ color: '#64748b' }}>-</TableCell>
                  <TableCell>
                    <Chip label="OPENING STOCK" size="small" sx={{ bgcolor: '#0F3B66', color: 'white', fontWeight: 700, fontSize: '0.7rem' }} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#334155' }}>
                    Opening Balance Stock
                  </TableCell>
                  <TableCell align="center">-</TableCell>
                  <TableCell align="right">-</TableCell>
                  <TableCell align="right">-</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>{selectedItem?.Unit || 'PCS'}</TableCell>
                  <TableCell align="right">-</TableCell>
                  <TableCell align="right">-</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0F3B66', fontSize: '0.9rem', backgroundColor: '#e2e8f0' }}>
                    {ledgerData?.summary?.openingStock ?? 0}
                  </TableCell>
                  <TableCell sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                    Stock prior to period start
                  </TableCell>
                </TableRow>

                {/* 2. Transaction Rows */}
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600, mb: 1 }}>
                        No stock movement transactions found for [{selectedItem.ItemCode}] in this date range.
                      </Typography>
                      {(startDate || endDate) && (
                        <Button 
                          size="small" 
                          variant="outlined" 
                          startIcon={<Refresh />}
                          onClick={() => setDateRange([null, null])}
                          sx={{ color: '#0F3B66', borderColor: '#0F3B66', fontWeight: 700, mt: 0.5 }}
                        >
                          Show All-Time Full Statement
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((row) => (
                    <TableRow 
                      key={row.id} 
                      hover
                      sx={{ 
                        '&:nth-of-type(even)': { bgcolor: '#fafafa' },
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>
                          {row.date ? new Date(row.date).toLocaleDateString('en-GB') : '-'}
                        </Typography>
                        {row.entryTime && (
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem', display: 'block', fontWeight: 500 }}>
                            {row.entryTime}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#0F3B66' }}>
                        {row.docNo || '-'}
                      </TableCell>
                      <TableCell>
                        {getTypeChip(row.type, row.category)}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.82rem' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.82rem' }}>
                          {row.particulars || row.partyName || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          size="small" 
                          label={row.bill ? 'Bill' : 'Cash'} 
                          variant="outlined"
                          sx={{ 
                            fontSize: '0.68rem', 
                            height: 18, 
                            fontWeight: 600,
                            borderColor: row.bill ? '#94a3b8' : '#f59e0b',
                            color: row.bill ? '#475569' : '#d97706'
                          }} 
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#16a34a' }}>
                        {row.direction === 'IN' ? `+${row.effectiveQty}` : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#dc2626' }}>
                        {row.direction === 'OUT' ? `-${row.effectiveQty}` : '-'}
                      </TableCell>
                      <TableCell align="center" sx={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {row.unit || selectedItem.Unit}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.82rem' }}>
                        {row.rate > 0 ? row.rate.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.82rem', fontWeight: 500 }}>
                        {row.amount > 0 ? row.amount.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell 
                        align="right" 
                        sx={{ 
                          fontWeight: 800, 
                          fontSize: '0.85rem',
                          color: row.runningStock >= 0 ? '#0F3B66' : '#dc2626',
                          backgroundColor: '#f8fafc'
                        }}
                      >
                        {row.runningStock}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.78rem', color: '#64748b', maxWidth: 220 }}>
                        {row.remark || row.process || '-'}
                        {row.createdBy && (
                          <Typography variant="caption" sx={{ display: 'block', color: '#94a3b8', fontSize: '0.68rem' }}>
                            By: {row.createdBy}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}

                {/* 3. Totals Row */}
                <TableRow sx={{ backgroundColor: '#e2e8f0', fontWeight: 'bold' }}>
                  <TableCell colSpan={5} align="right" sx={{ fontWeight: 'bold', color: '#0F3B66', fontSize: '0.85rem' }}>
                    PERIOD TOTALS
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#16a34a', fontSize: '0.88rem' }}>
                    +{displaySummary.totalIn}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#dc2626', fontSize: '0.88rem' }}>
                    -{displaySummary.totalOut}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>{selectedItem.Unit}</TableCell>
                  <TableCell align="right">-</TableCell>
                  <TableCell align="right">-</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: '#0F3B66' }}>
                    {displaySummary.netMovement >= 0 ? `+${displaySummary.netMovement}` : displaySummary.netMovement}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                    Net Period Movement
                  </TableCell>
                </TableRow>

                {/* 4. Closing Balance Row */}
                <TableRow sx={{ backgroundColor: '#0F3B66', color: '#ffffff' }}>
                  <TableCell colSpan={5} align="right" sx={{ fontWeight: 800, color: '#ffffff', fontSize: '0.92rem' }}>
                    CLOSING BALANCE STOCK
                  </TableCell>
                  <TableCell colSpan={5} sx={{ color: '#ffffff', fontSize: '0.8rem' }}>
                    (Opening: {ledgerData?.summary?.openingStock ?? 0} + In: {displaySummary.totalIn} - Out: {displaySummary.totalOut})
                  </TableCell>
                  <TableCell 
                    align="right" 
                    sx={{ 
                      fontWeight: 900, 
                      color: '#F88A01', 
                      fontSize: '1rem',
                      backgroundColor: '#092542'
                    }}
                  >
                    {displaySummary.closingStock} {selectedItem?.Unit || 'PCS'}
                  </TableCell>
                  <TableCell sx={{ color: '#cbd5e1', fontSize: '0.75rem' }}>
                    As of {endDate ? endDate.toLocaleDateString('en-GB') : 'Latest'}
                  </TableCell>
                </TableRow>

                {/* 5. Closing Stock Bifurcation Row */}
                {ledgerData?.stockBifurcation && (
                  <TableRow sx={{ backgroundColor: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                    <TableCell colSpan={3} sx={{ py: 1.5, verticalAlign: 'middle' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Warehouse sx={{ fontSize: 20, color: '#0F3B66' }} />
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 800, color: '#0F3B66', display: 'block', textTransform: 'uppercase', lineHeight: 1.2 }}>
                            Closing Stock Bifurcation
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem' }}>
                            Main Store vs Department WIP Position
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell colSpan={9} sx={{ py: 1.5 }}>
                      <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Chip 
                          label={`Main Stock: ${ledgerData.stockBifurcation.mainStock.qty} ${selectedItem?.Unit || ''}`}
                          size="small"
                          sx={{ 
                            fontWeight: 800, 
                            fontSize: '0.78rem',
                            bgcolor: ledgerData.stockBifurcation.mainStock.qty >= 0 ? '#e0f2fe' : '#fee2e2',
                            color: ledgerData.stockBifurcation.mainStock.qty >= 0 ? '#0369a1' : '#b91c1c',
                            border: '1px solid',
                            borderColor: ledgerData.stockBifurcation.mainStock.qty >= 0 ? '#bae6fd' : '#fecaca'
                          }}
                        />
                        {(ledgerData.stockBifurcation.departmentStocks || []).map(d => (
                          <Chip 
                            key={d.deptId}
                            label={`${d.deptName}: ${d.qty} ${selectedItem?.Unit || ''}${d.weight > 0 && !ledgerData.stockBifurcation.isWeightBased ? ` (${d.weight} kg)` : ''}`}
                            size="small"
                            variant={d.qty !== 0 ? 'filled' : 'outlined'}
                            sx={{ 
                              fontWeight: 700, 
                              fontSize: '0.74rem',
                              bgcolor: d.qty > 0 ? '#f0fdf4' : d.qty < 0 ? '#fef2f2' : '#f8fafc',
                              color: d.qty > 0 ? '#15803d' : d.qty < 0 ? '#b91c1c' : '#94a3b8',
                              borderColor: '#e2e8f0'
                            }}
                          />
                        ))}
                        <Chip 
                          label={`Total in Depts: ${ledgerData.stockBifurcation.totalDepartmentStock} ${selectedItem?.Unit || ''}`}
                          size="small"
                          sx={{ fontWeight: 800, fontSize: '0.78rem', bgcolor: '#ffedd5', color: '#c2410c' }}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* PDF Preview Modal */}
      <PdfPreviewModal 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        pdfUrl={previewUrl} 
        title={previewTitle} 
      />
    </Box>
  );
};

// Robust React Error Boundary to prevent blank white screens
class ReportErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ItemStockLedgerReport ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
          <Paper sx={{ p: 4, maxWidth: 600, textAlign: 'center', borderRadius: 2, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
            <Typography variant="h6" sx={{ color: '#b91c1c', fontWeight: 800, mb: 1 }}>
              Failed to display Item Stock Ledger
            </Typography>
            <Typography variant="body2" sx={{ color: '#7f1d1d', mb: 2 }}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </Typography>
            <Button 
              variant="contained" 
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              sx={{ bgcolor: '#0F3B66', fontWeight: 700 }}
            >
              Reload Page
            </Button>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default function SafeItemStockLedgerReport() {
  return (
    <ReportErrorBoundary>
      <ItemStockLedgerReport />
    </ReportErrorBoundary>
  );
}
