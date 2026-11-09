import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Chip, CircularProgress, Alert, Tooltip, Autocomplete,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel,
  Select, MenuItem, InputAdornment, Snackbar, Stack, Divider, TableSortLabel
} from '@mui/material';
import {
  LocalShipping as ShippingIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon,
  FileDownload as ExcelIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  HourglassEmpty as HourglassIcon,
  ArrowBack as ArrowBackIcon,
  AssignmentTurnedIn as PodIcon,
  CalendarMonth as CalendarIcon,
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  Edit as EditIcon,
  FilterAlt as FilterIcon
} from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const PendingPODReport = () => {
  const navigate = useNavigate();
  const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/outwards`;

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    stats: {
      totalPending: 0,
      overdueCount: 0,
      inTransitCount: 0,
      notDispatchedCount: 0,
      totalPendingAmount: 0
    },
    courierCompanies: [],
    records: []
  });

  const [ledgers, setLedgers] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedLedgerId, setSelectedLedgerId] = useState(null);
  const [selectedCourier, setSelectedCourier] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'OVERDUE' | 'IN_TRANSIT' | 'NOT_DISPATCHED'

  // Table pagination & sorting
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortConfig, setSortConfig] = useState({ key: 'OUTWARDDATE', direction: 'asc' });

  // Quick POD Modal State
  const [podModalOpen, setPodModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [podForm, setPodForm] = useState({
    CourierCompany: '',
    AwbNo: '',
    TransportMode: 'Road',
    DateOfPod: todayStr,
    PodRemarks: ''
  });
  const [savingPod, setSavingPod] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Fetch Report Data from backend
  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/pending-pod?`;
      if (fromDate) url += `fromDate=${encodeURIComponent(fromDate)}&`;
      if (toDate) url += `toDate=${encodeURIComponent(toDate)}&`;
      if (selectedLedgerId) url += `ledgerId=${encodeURIComponent(selectedLedgerId)}&`;
      if (selectedCourier && selectedCourier !== 'ALL') url += `courierCompany=${encodeURIComponent(selectedCourier)}&`;
      if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`;

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setReportData(data);
      } else {
        console.error('Failed to fetch pending POD report:', data.message);
      }
    } catch (err) {
      console.error('Error fetching pending POD report:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Ledgers for party dropdown
  const fetchLedgers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setLedgers(data);
      }
    } catch (err) {
      console.error('Error fetching ledgers:', err);
    }
  };

  // Fetch Company Profile for PDF Letterhead
  const fetchCompanyProfile = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/company-profile`);
      const data = await res.json();
      if (res.ok) setCompanyProfile(data);
    } catch (err) {
      console.error('Error fetching company profile:', err);
    }
  };

  useEffect(() => {
    fetchReport();
    fetchLedgers();
    fetchCompanyProfile();
  }, [fromDate, toDate, selectedLedgerId, selectedCourier]);

  // Open Quick POD Modal
  const handleOpenPodModal = (row) => {
    setSelectedRow(row);
    setPodForm({
      CourierCompany: row.CourierCompany || row.DefaultTransport || '',
      AwbNo: row.AwbNo || '',
      TransportMode: row.TransportMode || 'Road',
      DateOfPod: row.DateOfPod || todayStr,
      PodRemarks: row.PodRemarks || ''
    });
    setPodModalOpen(true);
  };

  // Save Quick POD Details
  const handleSavePod = async () => {
    if (!selectedRow) return;
    setSavingPod(true);
    try {
      const res = await fetch(`${API_BASE}/${selectedRow.ID}/pod`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(podForm)
      });
      const data = await res.json();
      if (res.ok) {
        setPodModalOpen(false);
        setSnackbarMessage(
          podForm.DateOfPod
            ? `Proof of Delivery (POD) confirmed for Invoice #${selectedRow.OUTWARDNO}! Delivered on ${podForm.DateOfPod}.`
            : `Dispatch tracking details updated for Invoice #${selectedRow.OUTWARDNO}.`
        );
        fetchReport();
      } else {
        alert(data.message || 'Error updating POD details');
      }
    } catch (err) {
      console.error('Error saving POD details:', err);
      alert('Error updating POD details: ' + err.message);
    } finally {
      setSavingPod(false);
    }
  };

  // Client-side filtering by status & search
  const filteredRecords = useMemo(() => {
    let list = reportData.records || [];

    if (statusFilter === 'OVERDUE') {
      list = list.filter(r => r.IsOverdue);
    } else if (statusFilter === 'IN_TRANSIT') {
      list = list.filter(r => !r.IsOverdue && (r.AwbNo || r.CourierCompany));
    } else if (statusFilter === 'NOT_DISPATCHED') {
      list = list.filter(r => !r.AwbNo && !r.CourierCompany);
    }

    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(r => 
        (r.OUTWARDNO && String(r.OUTWARDNO).toLowerCase().includes(q)) ||
        (r.LedgerName && r.LedgerName.toLowerCase().includes(q)) ||
        (r.City && r.City.toLowerCase().includes(q)) ||
        (r.AwbNo && r.AwbNo.toLowerCase().includes(q)) ||
        (r.CourierCompany && r.CourierCompany.toLowerCase().includes(q))
      );
    }

    return list;
  }, [reportData.records, statusFilter, searchTerm]);

  // Sorting
  const sortedRecords = useMemo(() => {
    const list = [...filteredRecords];
    list.sort((a, b) => {
      let v1 = a[sortConfig.key];
      let v2 = b[sortConfig.key];

      if (sortConfig.key === 'OUTWARDNO') {
        const num1 = parseInt(v1, 10);
        const num2 = parseInt(v2, 10);
        if (!isNaN(num1) && !isNaN(num2)) {
          return sortConfig.direction === 'asc' ? num1 - num2 : num2 - num1;
        }
      }

      if (sortConfig.key === 'TOTALAMOUNT' || sortConfig.key === 'ExpectedDeliveryDays' || sortConfig.key === 'OverdueDays') {
        v1 = parseFloat(v1) || 0;
        v2 = parseFloat(v2) || 0;
        return sortConfig.direction === 'asc' ? v1 - v2 : v2 - v1;
      }

      v1 = String(v1 || '').toLowerCase();
      v2 = String(v2 || '').toLowerCase();
      return sortConfig.direction === 'asc' ? v1.localeCompare(v2) : v2.localeCompare(v1);
    });
    return list;
  }, [filteredRecords, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Helper date formatter
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—';
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (sortedRecords.length === 0) {
      alert('No records available to export.');
      return;
    }

    const excelRows = sortedRecords.map((r, i) => ({
      'Sr. No': i + 1,
      'Invoice No': r.OUTWARDNO,
      'Invoice Date': formatDateDisplay(r.OUTWARDDATE),
      'Customer / Party': r.LedgerName || '—',
      'Destination City': r.City || '—',
      'Destination State': r.State || '—',
      'Expected Delivery Days (Master)': r.ExpectedDeliveryDays || 0,
      'Expected Delivery Date': formatDateDisplay(r.ExpectedDeliveryDate),
      'Days Elapsed': r.DaysElapsed || 0,
      'Courier / Transport Company': r.CourierCompany || '—',
      'AWB No. / Tracking No.': r.AwbNo || '—',
      'Transport Mode': r.TransportMode || '—',
      'Delivery Status': r.DeliveryStatus || 'Pending POD',
      'Overdue Days': r.IsOverdue ? r.OverdueDays : 0,
      'Invoice Amount (₹)': parseFloat(r.TOTALAMOUNT) || 0,
      'Remarks': r.PodRemarks || r.REMARK || ''
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pending POD Report');
    XLSX.writeFile(wb, `Pending_POD_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to PDF
  const handleExportPDF = () => {
    if (sortedRecords.length === 0) {
      alert('No records available to export.');
      return;
    }

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const compName = companyProfile?.CompanyName || 'FACTORY FLOW ERP';
    const compGst = companyProfile?.GSTIN ? `GSTIN: ${companyProfile.GSTIN}` : '';

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 59, 102);
    doc.text(compName, 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    if (compGst) doc.text(compGst, 14, 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(180, 83, 9);
    doc.text('PENDING PROOF OF DELIVERY (POD) REPORT', 283, 15, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 283, 20, { align: 'right' });
    doc.text(`Total Pending Invoices: ${sortedRecords.length} | Overdue: ${sortedRecords.filter(r => r.IsOverdue).length}`, 283, 24, { align: 'right' });

    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 27, 283, 27);

    const tableColumns = [
      '#',
      'Invoice No',
      'Date',
      'Customer Name & City',
      'Exp. Days',
      'Exp. Date',
      'Courier Company',
      'AWB No.',
      'Mode',
      'Status',
      'Amount (₹)'
    ];

    const tableRows = sortedRecords.map((r, i) => [
      i + 1,
      r.OUTWARDNO,
      formatDateDisplay(r.OUTWARDDATE),
      `${r.LedgerName || '—'}${r.City ? ` (${r.City})` : ''}`,
      `${r.ExpectedDeliveryDays || 0}d`,
      formatDateDisplay(r.ExpectedDeliveryDate),
      r.CourierCompany || '—',
      r.AwbNo || '—',
      r.TransportMode || 'Road',
      r.DeliveryStatus,
      (parseFloat(r.TOTALAMOUNT) || 0).toLocaleString('en-IN')
    ]);

    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [15, 59, 102], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 24, fontStyle: 'bold' },
        2: { cellWidth: 20 },
        3: { cellWidth: 55 },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 22, halign: 'center' },
        6: { cellWidth: 32 },
        7: { cellWidth: 28 },
        8: { cellWidth: 20 },
        9: { cellWidth: 28 },
        10: { cellWidth: 22, halign: 'right' }
      },
      didDrawPage: (data) => {
        doc.setFontSize(7.5);
        doc.setTextColor(150);
        doc.text(
          `Page ${data.pageNumber}`,
          283,
          200,
          { align: 'right' }
        );
      }
    });

    doc.save(`Pending_POD_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <Box sx={{ pb: 6 }}>
      {/* Top Header Row */}
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/dashboard/sales')}
            sx={{ borderColor: '#cbd5e1', color: '#475569', fontWeight: 600 }}
          >
            Back to Sales
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShippingIcon sx={{ color: '#d97706', fontSize: 30 }} /> Pending Proof of Delivery (POD) Report
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={fetchReport}
            sx={{ fontWeight: 600 }}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            color="success"
            size="small"
            startIcon={<ExcelIcon />}
            onClick={handleExportExcel}
            disabled={sortedRecords.length === 0}
            sx={{ fontWeight: 600 }}
          >
            Export Excel
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<PdfIcon />}
            onClick={handleExportPDF}
            disabled={sortedRecords.length === 0}
            sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#0a2744' }, fontWeight: 600 }}
          >
            Download PDF
          </Button>
        </Box>
      </Box>

      {/* KPI Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card 
            sx={{ 
              bgcolor: statusFilter === 'ALL' ? '#eff6ff' : '#f8fafc', 
              border: statusFilter === 'ALL' ? '2px solid #3b82f6' : '1px solid #e2e8f0', 
              borderRadius: 2,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={() => setStatusFilter('ALL')}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Pending POD
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e3a8a', my: 0.5 }}>
                {reportData.stats?.totalPending || 0}
              </Typography>
              <Typography variant="body2" sx={{ color: '#3b82f6', fontSize: '0.8rem' }}>
                Undelivered sales invoices
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card 
            sx={{ 
              bgcolor: statusFilter === 'OVERDUE' ? '#fef2f2' : '#f8fafc', 
              border: statusFilter === 'OVERDUE' ? '2px solid #ef4444' : '1px solid #fecaca', 
              borderRadius: 2,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={() => setStatusFilter(prev => prev === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase' }}>
                  Overdue Deliveries
                </Typography>
                <WarningIcon sx={{ color: '#ef4444', fontSize: 18 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#991b1b', my: 0.5 }}>
                {reportData.stats?.overdueCount || 0}
              </Typography>
              <Typography variant="body2" sx={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: 600 }}>
                Exceeded expected delivery days
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card 
            sx={{ 
              bgcolor: statusFilter === 'IN_TRANSIT' ? '#f0fdf4' : '#f8fafc', 
              border: statusFilter === 'IN_TRANSIT' ? '2px solid #22c55e' : '1px solid #bbf7d0', 
              borderRadius: 2,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={() => setStatusFilter(prev => prev === 'IN_TRANSIT' ? 'ALL' : 'IN_TRANSIT')}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 700, textTransform: 'uppercase' }}>
                In Transit (On Track)
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#166534', my: 0.5 }}>
                {reportData.stats?.inTransitCount || 0}
              </Typography>
              <Typography variant="body2" sx={{ color: '#16a34a', fontSize: '0.8rem' }}>
                Dispatched with tracking info
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 700, textTransform: 'uppercase' }}>
                Pending Delivery Value
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#78350f', my: 0.5 }}>
                ₹{(reportData.stats?.totalPendingAmount || 0).toLocaleString('en-IN')}
              </Typography>
              <Typography variant="body2" sx={{ color: '#d97706', fontSize: '0.8rem' }}>
                Across {reportData.stats?.totalPending || 0} shipments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Toolbar */}
      <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search Invoice, Customer, AWB..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              options={ledgers}
              getOptionLabel={(option) => option.LedgerName ? `${option.LedgerName}${option.City ? ` (${option.City})` : ''}` : ''}
              value={ledgers.find(l => l.Id === selectedLedgerId) || null}
              onChange={(e, val) => setSelectedLedgerId(val ? val.Id : null)}
              renderInput={(params) => <TextField {...params} label="Filter Customer / Party" size="small" />}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Courier / Transporter</InputLabel>
              <Select
                value={selectedCourier}
                label="Courier / Transporter"
                onChange={(e) => setSelectedCourier(e.target.value)}
              >
                <MenuItem value="ALL">All Transporters</MenuItem>
                {(reportData.courierCompanies || []).map(c => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} sm={3} md={1.5}>
            <TextField
              label="From Date"
              type="date"
              size="small"
              fullWidth
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={6} sm={3} md={1.5}>
            <TextField
              label="To Date"
              type="date"
              size="small"
              fullWidth
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={1} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
            <Button
              size="small"
              color="inherit"
              onClick={() => {
                setSearchTerm('');
                setFromDate('');
                setToDate('');
                setSelectedLedgerId(null);
                setSelectedCourier('ALL');
                setStatusFilter('ALL');
              }}
              sx={{ fontWeight: 600, color: '#64748b' }}
            >
              Reset
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Table Paper */}
      <Paper sx={{ width: '100%', borderRadius: 2, overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <TableContainer sx={{ maxHeight: '65vh' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: '#0F3B66', color: '#fff', fontWeight: 700, fontSize: '0.8rem', py: 1.2 } }}>
                <TableCell sx={{ color: '#fff', width: 45 }}>#</TableCell>
                <TableCell sx={{ color: '#fff' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'OUTWARDNO'}
                    direction={sortConfig.key === 'OUTWARDNO' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('OUTWARDNO')}
                    sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#fff !important' } }}
                  >
                    Invoice No
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#fff' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'OUTWARDDATE'}
                    direction={sortConfig.key === 'OUTWARDDATE' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('OUTWARDDATE')}
                    sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#fff !important' } }}
                  >
                    Invoice Date
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#fff' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'LedgerName'}
                    direction={sortConfig.key === 'LedgerName' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('LedgerName')}
                    sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#fff !important' } }}
                  >
                    Party Name & Destination
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ color: '#fff' }}>
                  <Tooltip title="Expected delivery lead time configured in Party's Account Ledger Master" arrow>
                    <Box component="span" sx={{ cursor: 'help' }}>
                      Exp. Days (Master) ℹ️
                    </Box>
                  </Tooltip>
                </TableCell>
                <TableCell align="center" sx={{ color: '#fff' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'ExpectedDeliveryDate'}
                    direction={sortConfig.key === 'ExpectedDeliveryDate' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('ExpectedDeliveryDate')}
                    sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#fff !important' } }}
                  >
                    Exp. Delivery Date
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#fff' }}>Courier / Transporter</TableCell>
                <TableCell sx={{ color: '#fff' }}>AWB / LR No.</TableCell>
                <TableCell align="center" sx={{ color: '#fff' }}>Mode</TableCell>
                <TableCell align="center" sx={{ color: '#fff' }}>Delivery Status</TableCell>
                <TableCell align="right" sx={{ color: '#fff' }}>Invoice Amount (₹)</TableCell>
                <TableCell align="center" sx={{ color: '#fff' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={36} />
                    <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>
                      Loading pending POD report...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : sortedRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                    <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 44, mb: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#166534' }}>
                      All Shipments Delivered!
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      No invoices found with pending Proof of Delivery (POD) for this filter.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedRecords
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, index) => {
                    const isOverdue = row.IsOverdue;
                    const daysRemaining = row.DaysRemaining;
                    const overdueDays = row.OverdueDays;

                    return (
                      <TableRow 
                        hover 
                        key={row.ID || index} 
                        sx={{ 
                          bgcolor: isOverdue ? '#fff1f2' : (index % 2 === 1 ? '#f8fafc' : '#fff'),
                          '&:hover': { bgcolor: isOverdue ? '#ffe4e6 !important' : '#f1f5f9 !important' }
                        }}
                      >
                        <TableCell sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {page * rowsPerPage + index + 1}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                            {row.OUTWARDNO}
                          </Typography>
                          <Chip 
                            size="small" 
                            label={row.Bill !== false && row.Bill !== 0 ? 'Bill' : 'No Bill'} 
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {formatDateDisplay(row.OUTWARDDATE)}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                            {row.LedgerName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LocationIcon sx={{ fontSize: 13, color: '#94a3b8' }} />
                            {[row.City, row.State].filter(Boolean).join(', ') || 'No City Set'}
                          </Typography>
                        </TableCell>

                        {/* Expected Delivery Days (from Ledger Master) */}
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={`${row.ExpectedDeliveryDays || 0}d`}
                            color={row.ExpectedDeliveryDays > 0 ? "primary" : "default"}
                            variant={row.ExpectedDeliveryDays > 0 ? "filled" : "outlined"}
                            sx={{ fontWeight: 700, minWidth: 42, height: 22, fontSize: '0.75rem' }}
                          />
                        </TableCell>

                        {/* Expected Delivery Date */}
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: isOverdue ? '#dc2626' : '#166534' }}>
                            {formatDateDisplay(row.ExpectedDeliveryDate)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                            ({row.DaysElapsed}d elapsed)
                          </Typography>
                        </TableCell>

                        {/* Courier / Transporter */}
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {row.CourierCompany || row.DefaultTransport || '—'}
                          </Typography>
                        </TableCell>

                        {/* AWB No. */}
                        <TableCell>
                          {row.AwbNo ? (
                            <Chip
                              size="small"
                              label={row.AwbNo}
                              color="info"
                              variant="outlined"
                              sx={{ fontWeight: 600, fontSize: '0.75rem', height: 22 }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">Not entered</Typography>
                          )}
                        </TableCell>

                        {/* Transport Mode */}
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={row.TransportMode || 'Road'}
                            sx={{ bgcolor: '#f1f5f9', color: '#334155', fontWeight: 600, fontSize: '0.72rem', height: 20 }}
                          />
                        </TableCell>

                        {/* Delivery Status */}
                        <TableCell align="center">
                          {isOverdue ? (
                            <Chip
                              size="small"
                              icon={<WarningIcon sx={{ fontSize: '14px !important' }} />}
                              label={`Overdue (${overdueDays}d late)`}
                              color="error"
                              sx={{ fontWeight: 700, fontSize: '0.72rem', height: 22 }}
                            />
                          ) : daysRemaining === 0 ? (
                            <Chip
                              size="small"
                              label="Due Today"
                              color="warning"
                              sx={{ fontWeight: 700, fontSize: '0.72rem', height: 22 }}
                            />
                          ) : row.AwbNo || row.CourierCompany ? (
                            <Chip
                              size="small"
                              icon={<ShippingIcon sx={{ fontSize: '14px !important' }} />}
                              label={`In Transit (${daysRemaining}d left)`}
                              color="info"
                              variant="outlined"
                              sx={{ fontWeight: 600, fontSize: '0.72rem', height: 22 }}
                            />
                          ) : (
                            <Chip
                              size="small"
                              label="Not Dispatched"
                              sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 600, fontSize: '0.72rem', height: 22 }}
                            />
                          )}
                        </TableCell>

                        {/* Total Amount */}
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                          ₹{(parseFloat(row.TOTALAMOUNT) || 0).toLocaleString('en-IN')}
                        </TableCell>

                        {/* Actions */}
                        <TableCell align="center">
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            startIcon={<PodIcon sx={{ fontSize: 16 }} />}
                            onClick={() => handleOpenPodModal(row)}
                            sx={{ 
                              textTransform: 'none', 
                              fontWeight: 700, 
                              fontSize: '0.75rem', 
                              py: 0.4, 
                              px: 1.2,
                              boxShadow: 'none'
                            }}
                          >
                            Enter POD
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredRecords.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* QUICK POD UPDATE MODAL */}
      <Dialog 
        open={podModalOpen} 
        onClose={() => !savingPod && setPodModalOpen(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#0F3B66', color: '#fff', py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PodIcon />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Confirm Delivery / Enter POD
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, bgcolor: '#f8fafc' }}>
          {selectedRow && (
            <Box sx={{ mb: 2.5, p: 2, bgcolor: '#eff6ff', borderRadius: 2, border: '1px solid #bfdbfe' }}>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Invoice No & Date</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                    #{selectedRow.OUTWARDNO} • {formatDateDisplay(selectedRow.OUTWARDDATE)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Party / Customer</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                    {selectedRow.LedgerName}
                  </Typography>
                </Grid>
                <Grid item xs={6} sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">Expected Delivery Lead Time</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#15803d' }}>
                    {selectedRow.ExpectedDeliveryDays || 0} Days (from Ledger Master)
                  </Typography>
                </Grid>
                <Grid item xs={6} sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">Expected Delivery Date</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: selectedRow.IsOverdue ? '#dc2626' : '#15803d' }}>
                    {formatDateDisplay(selectedRow.ExpectedDeliveryDate)}
                    {selectedRow.IsOverdue && ` (${selectedRow.OverdueDays}d overdue)`}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Courier / Transport Company"
                placeholder="e.g. Blue Dart, DTDC, Navkar"
                value={podForm.CourierCompany}
                onChange={(e) => setPodForm(prev => ({ ...prev, CourierCompany: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="AWB No. / Tracking No."
                placeholder="e.g. BD12345678"
                value={podForm.AwbNo}
                onChange={(e) => setPodForm(prev => ({ ...prev, AwbNo: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Transport Mode</InputLabel>
                <Select
                  value={podForm.TransportMode}
                  label="Transport Mode"
                  onChange={(e) => setPodForm(prev => ({ ...prev, TransportMode: e.target.value }))}
                >
                  <MenuItem value="Road">Road</MenuItem>
                  <MenuItem value="Courier">Courier</MenuItem>
                  <MenuItem value="Air">Air</MenuItem>
                  <MenuItem value="Rail">Rail</MenuItem>
                  <MenuItem value="Self / Hand Delivery">Self / Hand Delivery</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155', mb: 0.5, display: 'block', fontSize: '0.8rem' }}>
                  Date of POD (Proof of Delivery) *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  value={podForm.DateOfPod}
                  onChange={(e) => setPodForm(prev => ({ ...prev, DateOfPod: e.target.value }))}
                  InputProps={{ sx: { bgcolor: '#ffffff' } }}
                  helperText="Entering Date of POD confirms delivery and clears from report"
                  required
                />
              </Box>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Remarks (Receiver Name / Notes)"
                placeholder="e.g. Received by Mr. Patel at warehouse"
                value={podForm.PodRemarks}
                onChange={(e) => setPodForm(prev => ({ ...prev, PodRemarks: e.target.value }))}
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: '#fff', borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setPodModalOpen(false)} color="inherit" disabled={savingPod}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSavePod}
            disabled={savingPod}
            startIcon={savingPod ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
            sx={{ fontWeight: 700 }}
          >
            {savingPod ? 'Saving...' : 'Confirm Delivery & Save POD'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar notification */}
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default PendingPODReport;

