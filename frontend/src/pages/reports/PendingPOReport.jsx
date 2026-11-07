import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Chip, Tabs, Tab, CircularProgress, Alert, Tooltip, Autocomplete,
  Accordion, AccordionSummary, AccordionDetails, Divider, InputAdornment
} from '@mui/material';
import {
  Assessment as ReportIcon, Business as VendorIcon, Category as ItemIcon,
  ListAlt as ListIcon, PictureAsPdf as PdfIcon, FileDownload as ExcelIcon,
  Refresh as RefreshIcon, Search as SearchIcon, ExpandMore as ExpandMoreIcon,
  HourglassEmpty as HourglassIcon, LocalShipping as ShippingIcon, CheckCircle as CheckCircleIcon,
  AttachMoney as MoneyIcon, OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PendingPOReport = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0); // 0: Vendor-wise, 1: Item-wise, 2: Flat List
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    summary: { totalOrders: 0, totalItems: 0, totalOrderedQty: 0, totalDeliveredQty: 0, totalPendingQty: 0, totalPendingAmount: 0 },
    vendorWise: [],
    itemWise: [],
    rawRows: []
  });

  const [ledgers, setLedgers] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);

  // Filters
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

  // Fetch Report Data
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
    const tabName = activeTab === 0 ? 'Vendor-wise' : activeTab === 1 ? 'Item-wise' : 'Order List';
    doc.text(`PENDING PURCHASE ORDERS REPORT (${tabName.toUpperCase()})`, 14, 25);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    const dateRangeStr = `Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}` +
      (fromDate || toDate ? ` | Date Filter: ${fromDate || 'Start'} to ${toDate || 'End'}` : '');
    doc.text(dateRangeStr, 14, 30);

    // Summary block on top right
    const s = reportData.summary;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text(`Orders: ${s.totalOrders} | Pending Qty: ${s.totalPendingQty.toFixed(2)} | Backlog Value: Rs. ${s.totalPendingAmount.toLocaleString('en-IN')}`, 282, 25, { align: 'right' });

    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 33, 282, 33);

    let startY = 37;

    if (activeTab === 0) {
      // Vendor Wise Table
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
      // Item Wise Table
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
    } else {
      // Flat List
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
    }

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  // Generate Excel (CSV download compatible with Excel)
  const handleExportExcel = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (activeTab === 0) {
      // Vendor Wise
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
      // Item Wise
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
    } else {
      // Flat list
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
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pending_PO_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
              Vendor-wise & item-wise backlog and unfulfilled purchase order quantities
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchReport}
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

      {/* KPI Cards */}
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
                Total Ordered Qty
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#312e81', mt: 0.5 }}>
                {reportData.summary.totalOrderedQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Original total volume
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #10b981' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                Delivered via Sales
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#065f46', mt: 0.5 }}>
                {reportData.summary.totalDeliveredQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Dispatched so far
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #f59e0b' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                Remaining Backlog Qty
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#92400e', mt: 0.5 }}>
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

      {/* Main Filter & View Card */}
      <Paper sx={{ width: '100%', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        {/* Filters Bar */}
        <Box sx={{ p: 2, bgcolor: '#ffffff', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
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

          {/* Tab Selector */}
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
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
                          <VendorIcon sx={{ color: '#0F3B66' }} />
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                              {vendor.LedgerName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {vendor.City ? `${vendor.City} | ` : ''}
                              {vendor.GSTIN ? `GSTIN: ${vendor.GSTIN} | ` : ''}
                              {vendor.OrdersCount} Pending Order(s)
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" color="text.secondary">Pending Qty</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#d97706' }}>
                              {vendor.TotalPendingQty.toFixed(2)}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" color="text.secondary">Backlog Value</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                              ₹{vendor.TotalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </AccordionSummary>

                    <AccordionDetails sx={{ p: 0 }}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead sx={{ bgcolor: '#ffffff' }}>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }}>PO No</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }}>PO Date</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Delivery Date</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Item Code</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }}>SubCode</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Item Name</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="right">Ordered</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="right">Delivered</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="right">Pending</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Unit</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="right">Rate (₹)</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="right">Pending Value (₹)</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="center">Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {vendor.Items.map((item, itemIdx) => (
                              <TableRow hover key={item.DetailId || itemIdx}>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                                      {item.PONO}
                                    </Typography>
                                    <IconButton
                                      size="small"
                                      title="Open Order"
                                      onClick={() => navigate(`/dashboard/purchase-orders?poNo=${encodeURIComponent(item.PONO)}`)}
                                      sx={{ p: 0.2 }}
                                    >
                                      <OpenInNewIcon fontSize="inherit" color="action" />
                                    </IconButton>
                                  </Box>
                                </TableCell>
                                <TableCell>{item.PODATE ? item.PODATE.split('T')[0] : '-'}</TableCell>
                                <TableCell>{item.DELIVERYDATE ? item.DELIVERYDATE.split('T')[0] : '-'}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{item.ITEMCODE}</TableCell>
                                <TableCell>{item.SUBCODE || '-'}</TableCell>
                                <TableCell>{item.ItemName || item.ITEMCODE}</TableCell>
                                <TableCell align="right">{parseFloat(item.OrderedQty || 0).toFixed(2)}</TableCell>
                                <TableCell align="right" sx={{ color: item.DeliveredQty > 0 ? '#16a34a' : 'text.secondary', fontWeight: 600 }}>
                                  {parseFloat(item.DeliveredQty || 0).toFixed(2)}
                                </TableCell>
                                <TableCell align="right">
                                  <Chip
                                    size="small"
                                    label={parseFloat(item.PendingQty || 0).toFixed(2)}
                                    color="warning"
                                    sx={{ fontWeight: 700, fontSize: '0.75rem', height: 22 }}
                                  />
                                </TableCell>
                                <TableCell>{item.UNIT || 'PCS'}</TableCell>
                                <TableCell align="right">₹{parseFloat(item.RATE || 0).toFixed(2)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                                  ₹{parseFloat(item.PendingAmount || 0).toFixed(2)}
                                </TableCell>
                                <TableCell align="center">
                                  <Chip
                                    size="small"
                                    label={item.OrderStatus}
                                    color={item.OrderStatus === 'Completed' ? 'success' : 'info'}
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
                <Typography variant="body1">No pending items found.</Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: 'none' }}>
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
                      <TableCell sx={{ fontWeight: 700 }} align="right">Total Pending Qty</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Backlog Value (₹)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">Pending Orders</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredItems.map((item, idx) => (
                      <TableRow hover key={`${item.ItemCode}-${item.SubCode}-${idx}`}>
                        <TableCell sx={{ fontWeight: 700, color: '#0F3B66' }}>{item.ItemCode}</TableCell>
                        <TableCell>{item.SubCode || '-'}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{item.ItemName}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={item.ItemCategory || 'Inhouse'}
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        </TableCell>
                        <TableCell>{item.Unit || 'PCS'}</TableCell>
                        <TableCell align="right">{item.TotalOrderedQty.toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ color: item.TotalDeliveredQty > 0 ? '#16a34a' : 'inherit', fontWeight: 600 }}>
                          {item.TotalDeliveredQty.toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            label={item.TotalPendingQty.toFixed(2)}
                            color="warning"
                            sx={{ fontWeight: 700, fontSize: '0.75rem', height: 22 }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                          ₹{item.TotalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip
                            title={
                              <Box sx={{ p: 0.5 }}>
                                {item.Orders && item.Orders.map((o, oi) => (
                                  <Typography key={oi} variant="caption" display="block">
                                    • {o.PONO}: {o.LedgerName} ({o.PendingQty} {o.UNIT})
                                  </Typography>
                                ))}
                              </Box>
                            }
                          >
                            <Chip
                              size="small"
                              label={`${item.PendingOrdersCount} order(s)`}
                              color="info"
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
      </Paper>

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        pdfUrl={previewUrl}
        title="Pending Purchase Orders Report"
      />
    </Box>
  );
};

export default PendingPOReport;
