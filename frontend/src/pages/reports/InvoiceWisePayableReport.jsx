import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Grid, 
  Divider, 
  Paper, 
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Card,
  CardContent,
  Chip,
  Tooltip,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { 
  PictureAsPdf, 
  Visibility, 
  TableView, 
  Share,
  ReceiptLong,
  Receipt,
  MoneyOff,
  ArrowBack,
  AccessTime,
  Payment as PaymentIcon
} from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export const getAgingBucketInfo = (dueDays) => {
  if (dueDays >= 0) {
    return {
      bucket: 'not_due',
      label: 'Not Due / Current',
      shortLabel: 'Not Due',
      color: '#15803d',
      bg: '#f0fdf4',
      border: '#bbf7d0'
    };
  } else if (dueDays >= -30) {
    return {
      bucket: '1_30',
      label: '1 - 30 Days Overdue',
      shortLabel: '1-30 Days',
      color: '#b45309',
      bg: '#fffbeb',
      border: '#fde68a'
    };
  } else if (dueDays >= -60) {
    return {
      bucket: '31_60',
      label: '31 - 60 Days Overdue',
      shortLabel: '31-60 Days',
      color: '#c2410c',
      bg: '#fff7ed',
      border: '#fed7aa'
    };
  } else if (dueDays >= -90) {
    return {
      bucket: '61_90',
      label: '61 - 90 Days Overdue',
      shortLabel: '61-90 Days',
      color: '#b91c1c',
      bg: '#fef2f2',
      border: '#fecaca'
    };
  } else {
    return {
      bucket: 'above_90',
      label: '90+ Days Overdue',
      shortLabel: '90+ Days',
      color: '#881337',
      bg: '#fff1f2',
      border: '#fecdd3'
    };
  }
};

const InvoiceWisePayableReport = () => {
  const navigate = useNavigate();
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [viewMode, setViewMode] = useState('combined'); // 'combined', 'with_bill', 'without_bill'

  // Default to null dates so all pending dues and overdue invoices are immediately visible
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;

  const [agingFilter, setAgingFilter] = useState('all'); // 'all', 'not_due', '1_30', '31_60', '61_90', 'above_90', 'overdue_only'
  const [onlyOutstanding, setOnlyOutstanding] = useState(true);

  const fetchReportData = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers/invoice-wise-payable`);
      if (!response.ok) throw new Error('Failed to fetch invoice-wise payable report');
      const data = await response.json();
      setReportData(data.map(item => ({ ...item, id: item.RowId })));
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const formatCurrency = (val, isPDF = false) => {
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
    return isPDF ? formatted.replace('₹', 'Rs.') : formatted;
  };

  const handlePayClick = (row) => {
    setSelectedLedger(row);
    setPaymentModalOpen(true);
  };

  // Primary KPI Calculations based on viewMode
  const summaryKPIs = useMemo(() => {
    let totalWithBill = 0;
    let totalWithoutBill = 0;
    let totalCombined = 0;

    reportData.forEach(row => {
      if (row.bill) {
        totalWithBill += parseFloat(row.outstandingWithBill || 0);
      } else {
        totalWithoutBill += parseFloat(row.outstandingWithoutBill || 0);
      }
      totalCombined += parseFloat(row.outstandingAmount || 0);
    });

    return { totalWithBill, totalWithoutBill, totalCombined };
  }, [reportData]);

  // Aging KPIs calculation (based on positive outstanding amounts)
  const agingKPIs = useMemo(() => {
    const buckets = {
      not_due: { total: 0, count: 0 },
      '1_30': { total: 0, count: 0 },
      '31_60': { total: 0, count: 0 },
      '61_90': { total: 0, count: 0 },
      above_90: { total: 0, count: 0 },
      totalOverdue: { total: 0, count: 0 }
    };

    reportData.forEach(row => {
      // Date filter
      if (row.inwardDate) {
        const rowDate = new Date(row.inwardDate);
        rowDate.setHours(0, 0, 0, 0);
        const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
        const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;
        if (start && rowDate.getTime() < start) return;
        if (end && rowDate.getTime() > end) return;
      }

      // Bill type filter
      if (viewMode === 'with_bill' && !row.bill) return;
      if (viewMode === 'without_bill' && row.bill) return;

      const outstanding = viewMode === 'with_bill' ? parseFloat(row.outstandingWithBill || 0) :
                          viewMode === 'without_bill' ? parseFloat(row.outstandingWithoutBill || 0) :
                          parseFloat(row.outstandingAmount || 0);

      if (outstanding > 0) {
        if (row.dueDays >= 0) {
          buckets.not_due.total += outstanding;
          buckets.not_due.count += 1;
        } else {
          buckets.totalOverdue.total += outstanding;
          buckets.totalOverdue.count += 1;

          if (row.dueDays >= -30) {
            buckets['1_30'].total += outstanding;
            buckets['1_30'].count += 1;
          } else if (row.dueDays >= -60) {
            buckets['31_60'].total += outstanding;
            buckets['31_60'].count += 1;
          } else if (row.dueDays >= -90) {
            buckets['61_90'].total += outstanding;
            buckets['61_90'].count += 1;
          } else {
            buckets.above_90.total += outstanding;
            buckets.above_90.count += 1;
          }
        }
      }
    });

    return buckets;
  }, [reportData, startDate, endDate, viewMode]);

  // Filter rows by date, viewMode, onlyOutstanding, and agingFilter
  const filteredReportData = useMemo(() => {
    return reportData.filter(row => {
      // Date filter
      if (row.inwardDate) {
        const rowDate = new Date(row.inwardDate);
        rowDate.setHours(0,0,0,0);
        const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
        const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;
        const isAfterFrom = start ? rowDate.getTime() >= start : true;
        const isBeforeTo = end ? rowDate.getTime() <= end : true;
        if (!isAfterFrom || !isBeforeTo) return false;
      }

      // Bill type filter
      if (viewMode === 'with_bill' && !row.bill) return false;
      if (viewMode === 'without_bill' && row.bill) return false;

      // Outstanding only filter
      const outstanding = viewMode === 'with_bill' ? parseFloat(row.outstandingWithBill || 0) :
                          viewMode === 'without_bill' ? parseFloat(row.outstandingWithoutBill || 0) :
                          parseFloat(row.outstandingAmount || 0);
      if (onlyOutstanding && outstanding <= 0) return false;

      // Aging filter
      if (agingFilter === 'not_due' && row.dueDays < 0) return false;
      if (agingFilter === '1_30' && (row.dueDays >= 0 || row.dueDays < -30)) return false;
      if (agingFilter === '31_60' && (row.dueDays >= -30 || row.dueDays < -60)) return false;
      if (agingFilter === '61_90' && (row.dueDays >= -60 || row.dueDays < -90)) return false;
      if (agingFilter === 'above_90' && row.dueDays >= -90) return false;
      if (agingFilter === 'overdue_only' && row.dueDays >= 0) return false;

      return true;
    });
  }, [reportData, startDate, endDate, viewMode, onlyOutstanding, agingFilter]);

  const columns = [
    { field: 'vendorName', headerName: 'Vendor Name', flex: 1.5, minWidth: 180 },
    { field: 'inwardNo', headerName: 'Invoice No', flex: 1, minWidth: 110 },
    { 
      field: 'bill', 
      headerName: 'Bill Type', 
      width: 110,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'With Bill' : 'Without Bill'}
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.7rem',
            height: 22,
            bgcolor: params.value ? '#eff6ff' : '#fffbeb',
            color: params.value ? '#1d4ed8' : '#b45309',
            border: `1px solid ${params.value ? '#bfdbfe' : '#fde68a'}`
          }}
        />
      )
    },
    { 
      field: 'inwardDate', 
      headerName: 'Invoice Date', 
      flex: 1,
      minWidth: 105,
      valueFormatter: (value) => {
        if (!value) return '';
        return new Date(value).toLocaleDateString('en-GB');
      }
    },
    { 
      field: 'invoiceAmount', 
      headerName: 'Invoice Amount', 
      flex: 1.1,
      minWidth: 120,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value) => formatCurrency(value)
    },
    { field: 'creditDays', headerName: 'Credit Days', width: 95, type: 'number', align: 'center', headerAlign: 'center' },
    { 
      field: 'dueDate', 
      headerName: 'Due Date', 
      flex: 1,
      minWidth: 105,
      valueFormatter: (value) => {
        if (!value) return '';
        return new Date(value).toLocaleDateString('en-GB');
      }
    },
    { 
      field: 'dueDays', 
      headerName: 'Days Left/Overdue', 
      flex: 1.3,
      minWidth: 145,
      renderCell: (params) => {
        const days = params.value;
        if (params.row.status === 'Paid') {
          return <span style={{ color: '#64748b', fontStyle: 'italic' }}>Paid</span>;
        }
        if (days < 0) {
          return <span style={{ color: '#dc2626', fontWeight: 'bold' }}>Overdue by {Math.abs(days)} days</span>;
        } else if (days === 0) {
          return <span style={{ color: '#ea580c', fontWeight: 'bold' }}>Due Today</span>;
        } else {
          return <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{days} days left</span>;
        }
      }
    },
    { 
      field: 'agingBucket', 
      headerName: 'Aging Category', 
      width: 145,
      valueGetter: (value, row) => getAgingBucketInfo(row.dueDays).shortLabel,
      renderCell: (params) => {
        const info = getAgingBucketInfo(params.row.dueDays);
        return (
          <Chip
            label={info.label}
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: '0.7rem',
              height: 22,
              bgcolor: info.bg,
              color: info.color,
              border: `1px solid ${info.border}`
            }}
          />
        );
      }
    },
    { 
      field: 'outstandingAmount', 
      headerName: 'Outstanding (₹)', 
      flex: 1.2,
      minWidth: 130,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => {
        const row = params.row;
        const val = viewMode === 'with_bill' ? row.outstandingWithBill :
                    viewMode === 'without_bill' ? row.outstandingWithoutBill :
                    row.outstandingAmount;
        return (
          <Typography variant="body2" sx={{ fontWeight: 700, color: val > 0 ? '#dc2626' : '#64748b' }}>
            {formatCurrency(val)}
          </Typography>
        );
      }
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 125,
      renderCell: (params) => {
        const val = params.value;
        let color = '#757575';
        let bgcolor = '#f5f5f5';
        if (val === 'Paid') {
          color = '#2e7d32'; bgcolor = '#e8f5e9';
        } else if (val === 'Partially Paid') {
          color = '#f57c00'; bgcolor = '#fff3e0';
        } else if (val === 'Pending') {
          color = '#c62828'; bgcolor = '#ffebee';
        }
        return (
          <Box sx={{ 
            color, 
            bgcolor, 
            px: 1, 
            py: 0.25, 
            borderRadius: 1, 
            fontSize: '0.75rem', 
            fontWeight: 'bold',
            display: 'inline-block',
            textAlign: 'center'
          }}>
            {val}
          </Box>
        );
      }
    },
    {
      field: 'action',
      headerName: 'Action',
      width: 100,
      sortable: false,
      renderCell: (params) => {
        const row = params.row;
        const isActionable = row.UPI || row.BankName;
        return (
          <Button
            variant="contained"
            size="small"
            color="primary"
            disabled={!isActionable || row.status === 'Paid'}
            onClick={() => handlePayClick(row)}
            sx={{ 
              textTransform: 'none', 
              fontSize: '0.75rem',
              py: 0.25,
              px: 1,
              borderRadius: 1.5,
              boxShadow: 'none'
            }}
          >
            Pay Now
          </Button>
        );
      }
    }
  ];

  const handleExportPDF = (action = 'download') => {
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(18);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FactoryFlow', 14, 18);
    
    doc.setFontSize(13);
    doc.setTextColor(60);
    const viewTitle = viewMode === 'with_bill' ? 'Inward Payable Report (With Bill) - Due by Days' :
                      viewMode === 'without_bill' ? 'Inward Payable Report (Without Bill) - Due by Days' :
                      'Inward Payable Report (Combined) - Due by Days';
    doc.text(viewTitle, 14, 26);
    
    doc.setFontSize(9);
    doc.setTextColor(120);
    const filterInfo = agingFilter !== 'all' ? ` | Filter: ${agingFilter}` : '';
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}${filterInfo}`, 14, 32);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 35, 283, 35); 

    const tableData = filteredReportData.map(row => [
      row.vendorName,
      row.inwardNo,
      row.bill ? 'With Bill' : 'Without Bill',
      new Date(row.inwardDate).toLocaleDateString('en-GB'),
      formatCurrency(row.invoiceAmount, true),
      row.creditDays,
      new Date(row.dueDate).toLocaleDateString('en-GB'),
      row.status === 'Paid' ? 'Paid' : (row.dueDays < 0 ? `Overdue by ${Math.abs(row.dueDays)} days` : (row.dueDays === 0 ? 'Due Today' : `${row.dueDays} days left`)),
      getAgingBucketInfo(row.dueDays).shortLabel,
      formatCurrency(viewMode === 'with_bill' ? row.outstandingWithBill : (viewMode === 'without_bill' ? row.outstandingWithoutBill : row.outstandingAmount), true),
      row.status
    ]);
    
    autoTable(doc, {
      head: [['Vendor Name', 'Invoice No', 'Bill Type', 'Invoice Date', 'Invoice Amount', 'Credit Days', 'Due Date', 'Due Days Left', 'Aging', 'Outstanding', 'Status']],
      body: tableData,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 40 }
    });

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const reportName = `InwardPayableReport_Aging_${viewMode}`;
      
      fetch(`${baseUrl}/auth/share-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, reportName })
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to share PDF');
        return res.json();
      })
      .then(data => {
        alert(data.message || 'PDF saved and highlighted in explorer');
      })
      .catch(err => {
        console.error('Error sharing PDF:', err);
        alert('Error sharing PDF: ' + err.message);
      });
    } else if (action === 'preview') {
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPreviewUrl(blobUrl);
      setPreviewOpen(true);
    } else {
      doc.save(`inward_payable_aging_report_${viewMode}.pdf`);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredReportData.map(row => ({
      'Vendor Name': row.vendorName,
      'Invoice No': row.inwardNo,
      'Bill Type': row.bill ? 'With Bill' : 'Without Bill',
      'Invoice Date': new Date(row.inwardDate).toLocaleDateString('en-GB'),
      'Invoice Amount (Rs.)': parseFloat(row.invoiceAmount || 0).toFixed(2),
      'Credit Days': row.creditDays,
      'Due Date': new Date(row.dueDate).toLocaleDateString('en-GB'),
      'Days Left/Overdue': row.dueDays,
      'Aging Category': getAgingBucketInfo(row.dueDays).label,
      'Outstanding Amount (Rs.)': parseFloat(viewMode === 'with_bill' ? row.outstandingWithBill : (viewMode === 'without_bill' ? row.outstandingWithoutBill : row.outstandingAmount) || 0).toFixed(2),
      'Status': row.status
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payable Aging');
    XLSX.writeFile(workbook, `inward_payable_aging_${viewMode}.xlsx`);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button 
            variant="outlined" 
            startIcon={<ArrowBack />}
            onClick={() => navigate('/dashboard/reports/payable')}
            sx={{ color: '#0F3B66', borderColor: '#cbd5e1', fontWeight: 600 }}
          >
            Vendor Summary
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Payable Outstanding (Due by Days)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button 
            variant="outlined" 
            startIcon={<TableView />}
            onClick={handleExportExcel}
            sx={{ color: '#107c41', borderColor: '#107c41' }}
          >
            Export Excel
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<Visibility />}
            onClick={() => handleExportPDF('preview')}
            sx={{ color: '#0F3B66', borderColor: '#0F3B66' }}
          >
            Preview PDF
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<PictureAsPdf />}
            onClick={() => handleExportPDF('download')}
            sx={{ color: '#d32f2f', borderColor: '#d32f2f' }}
          >
            Export PDF
          </Button>
          <Button 
            variant="contained" 
            startIcon={<Share />}
            onClick={() => handleExportPDF('share')}
            sx={{ bgcolor: 'secondary.main' }}
          >
            Share
          </Button>
        </Box>
      </Box>

      {/* Primary KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                🧾 WITH BILL OUTSTANDING
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e3a8a', mt: 0.5 }}>
                ₹ {summaryKPIs.totalWithBill.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                📋 WITHOUT BILL OUTSTANDING
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#78350f', mt: 0.5 }}>
                ₹ {summaryKPIs.totalWithoutBill.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                🌐 COMBINED NET OUTSTANDING
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#14532d', mt: 0.5 }}>
                ₹ {summaryKPIs.totalCombined.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Aging Due by Days Interactive Breakdown Cards */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTime fontSize="small" /> AGING BREAKDOWN (DUE BY DAYS) — Click any card to filter
          </Typography>
          {agingFilter !== 'all' && (
            <Button 
              size="small" 
              onClick={() => setAgingFilter('all')} 
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', py: 0.2 }}
            >
              Reset Aging Filter (Show All)
            </Button>
          )}
        </Box>
        <Grid container spacing={1.5}>
          {[
            { id: 'not_due', title: 'NOT DUE (CURRENT)', data: agingKPIs.not_due, color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
            { id: '1_30', title: '1 - 30 DAYS OVERDUE', data: agingKPIs['1_30'], color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
            { id: '31_60', title: '31 - 60 DAYS OVERDUE', data: agingKPIs['31_60'], color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
            { id: '61_90', title: '61 - 90 DAYS OVERDUE', data: agingKPIs['61_90'], color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
            { id: 'above_90', title: '90+ DAYS OVERDUE', data: agingKPIs.above_90, color: '#881337', bg: '#fff1f2', border: '#fecdd3' }
          ].map(b => {
            const isSelected = agingFilter === b.id;
            return (
              <Grid item xs={12} sm={6} md={2.4} key={b.id}>
                <Card 
                  onClick={() => setAgingFilter(prev => prev === b.id ? 'all' : b.id)}
                  sx={{ 
                    bgcolor: b.bg, 
                    border: `2px solid ${isSelected ? b.color : b.border}`, 
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? `0 0 0 3px ${b.border}` : 'none',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }
                  }}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: b.color, fontSize: '0.7rem' }}>
                        {b.title}
                      </Typography>
                      {isSelected && (
                        <Chip label="Filtered" size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: b.color, color: '#fff' }} />
                      )}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: b.color, mt: 0.5, fontSize: '1.05rem' }}>
                      ₹ {b.data.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>
                      {b.data.count} {b.data.count === 1 ? 'Invoice' : 'Invoices'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Toolbar & Filters */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        {/* Date Filter with Clear Dates */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 230 }}>
            <DatePicker
              portalId="root"
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update) => setDateRange(update)}
              isClearable={true}
              placeholderText="All Dates"
              customInput={<TextField size="small" label="Invoice Date Range" InputLabelProps={{ shrink: true }} fullWidth placeholder="All Dates" />}
              dateFormat="dd/MM/yyyy"
            />
          </Box>
          {(startDate || endDate) && (
            <Button size="small" onClick={() => setDateRange([null, null])} sx={{ textTransform: 'none' }}>
              Clear Dates
            </Button>
          )}
        </Box>

        {/* Aging Buckets Filter Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>Aging:</Typography>
          <ToggleButtonGroup
            value={agingFilter}
            exclusive
            onChange={(e, val) => { if (val) setAgingFilter(val); }}
            size="small"
          >
            <ToggleButton value="all" sx={{ fontWeight: 600, textTransform: 'none', px: 1.2, py: 0.4, fontSize: '0.75rem' }}>
              All
            </ToggleButton>
            <ToggleButton value="not_due" sx={{ fontWeight: 600, textTransform: 'none', px: 1.2, py: 0.4, fontSize: '0.75rem', color: '#15803d' }}>
              Not Due
            </ToggleButton>
            <ToggleButton value="1_30" sx={{ fontWeight: 600, textTransform: 'none', px: 1.2, py: 0.4, fontSize: '0.75rem', color: '#b45309' }}>
              1-30d
            </ToggleButton>
            <ToggleButton value="31_60" sx={{ fontWeight: 600, textTransform: 'none', px: 1.2, py: 0.4, fontSize: '0.75rem', color: '#c2410c' }}>
              31-60d
            </ToggleButton>
            <ToggleButton value="61_90" sx={{ fontWeight: 600, textTransform: 'none', px: 1.2, py: 0.4, fontSize: '0.75rem', color: '#b91c1c' }}>
              61-90d
            </ToggleButton>
            <ToggleButton value="above_90" sx={{ fontWeight: 600, textTransform: 'none', px: 1.2, py: 0.4, fontSize: '0.75rem', color: '#881337' }}>
              90+d
            </ToggleButton>
            <ToggleButton value="overdue_only" sx={{ fontWeight: 600, textTransform: 'none', px: 1.2, py: 0.4, fontSize: '0.75rem', color: '#b91c1c' }}>
              Overdue ({agingKPIs.totalOverdue.count})
            </ToggleButton>
          </ToggleButtonGroup>

          <FormControlLabel
            control={
              <Checkbox 
                checked={onlyOutstanding} 
                onChange={(e) => setOnlyOutstanding(e.target.checked)} 
                size="small" 
              />
            }
            label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Pending Only</Typography>}
            sx={{ ml: 1, mr: 0 }}
          />
        </Box>

        {/* Bill Type Filter */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, nextMode) => { if (nextMode) setViewMode(nextMode); }}
          size="small"
        >
          <ToggleButton value="combined" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5 }}>
            <Tooltip title="Show all invoices with combined outstanding">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ReceiptLong fontSize="small" /> Combined
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="with_bill" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5 }}>
            <Tooltip title="Show only With Bill (Official) invoices">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Receipt fontSize="small" color="primary" /> With Bill
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="without_bill" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5 }}>
            <Tooltip title="Show only Without Bill (Cash) invoices">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <MoneyOff fontSize="small" color="warning" /> Without Bill
              </Box>
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {/* DataGrid */}
      <Box sx={{ flexGrow: 1, height: 480, width: '100%' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={filteredReportData}
            columns={columns}
            rowHeight={32}
            columnHeaderHeight={34}
            showColumnVerticalBorder={true}
            showCellVerticalBorder={true}
            getRowClassName={(params) =>
              params.indexRelativeToCurrentPage % 2 === 0 ? 'even-row' : 'odd-row'
            }
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
              },
            }}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            disableRowSelectionOnClick
            sx={{ 
              border: '1px solid #e0e0e0',
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: '#0F3B66',
              },
              '& .MuiDataGrid-columnHeader': {
                backgroundColor: '#0F3B66',
                color: '#ffffff',
              },
              '& .MuiDataGrid-columnHeaderTitle': {
                fontWeight: 'bold',
                color: '#ffffff',
              },
              '& .MuiDataGrid-columnHeader svg': {
                color: '#ffffff !important',
              },
              '& .MuiDataGrid-columnHeader .MuiIconButton-root': {
                backgroundColor: 'transparent !important',
              },
              '& .MuiDataGrid-menuIcon': {
                visibility: 'visible',
                width: 'auto',
                opacity: 1,
              },
              '& .even-row': {
                backgroundColor: '#fafbfc',
              },
              '& .odd-row': {
                backgroundColor: '#ffffff',
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: 'rgba(15, 59, 102, 0.04)',
              },
            }}
          />
        )}
      </Box>

      {/* Payment Details Modal */}
      <Dialog open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0F3B66', color: 'white', fontWeight: 'bold' }}>
          Payment Details - {selectedLedger?.vendorName}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ p: 2 }}>
            <Grid container spacing={3}>
              {selectedLedger?.UPI && (
                <Grid item xs={12} sm={selectedLedger?.BankName ? 6 : 12} sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">UPI Payment</Typography>
                  <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: 'white', display: 'inline-block' }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${selectedLedger.UPI}&pn=${selectedLedger.vendorName}`)}`} 
                      alt="UPI QR Code" 
                      style={{ width: 150, height: 150 }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>UPI ID: {selectedLedger.UPI}</Typography>
                </Grid>
              )}
              
              {selectedLedger?.BankName && selectedLedger?.UPI && (
                <Grid item xs={12} sm={1} sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'center' }}>
                  <Divider orientation="vertical" />
                </Grid>
              )}

              {selectedLedger?.BankName && (
                <Grid item xs={12} sm={selectedLedger?.UPI ? 5 : 12} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">Bank Transfer</Typography>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8f9fa' }}>
                    <Typography variant="body2" color="textSecondary">Bank Name</Typography>
                    <Typography variant="body1" fontWeight="500" gutterBottom>{selectedLedger.BankName}</Typography>
                    
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>Account Number</Typography>
                    <Typography variant="body1" fontWeight="500" gutterBottom>{selectedLedger.AccountNo}</Typography>
                    
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>IFSC Code</Typography>
                    <Typography variant="body1" fontWeight="500">{selectedLedger.IFSC}</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
            
            <Paper sx={{ mt: 3, p: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
                Invoice Outstanding
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="textSecondary">Invoice No / Type:</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {selectedLedger?.inwardNo} ({selectedLedger?.bill ? 'With Bill' : 'Without Bill'})
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="textSecondary">Invoice Amount:</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {formatCurrency(selectedLedger?.invoiceAmount)}
                </Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight="bold" color="error.main">Outstanding Amount:</Typography>
                <Typography variant="body2" fontWeight="800" color="error.main">
                  {formatCurrency(selectedLedger?.outstandingAmount)}
                </Typography>
              </Box>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentModalOpen(false)} variant="contained" color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    
      <PdfPreviewModal 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        pdfUrl={previewUrl} 
        title="Payable Outstanding Report Preview" 
      />
    </Box>
  );
};

export default InvoiceWisePayableReport;
