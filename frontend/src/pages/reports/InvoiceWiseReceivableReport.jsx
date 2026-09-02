import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
  TextField,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip
} from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { 
  PictureAsPdf, 
  Visibility, 
  TableView, 
  Share,
  ReceiptLong,
  Receipt,
  MoneyOff
} from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const InvoiceWiseReceivableReport = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('combined'); // 'combined', 'with_bill', 'without_bill'

  const getFirstDayOfMonth = () => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  };

  const getLastDayOfMonth = () => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  };

  const [dateRange, setDateRange] = useState([getFirstDayOfMonth(), getLastDayOfMonth()]);
  const [startDate, endDate] = dateRange;

  const fetchReportData = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers/invoice-wise-receivable`);
      if (!response.ok) throw new Error('Failed to fetch invoice-wise receivable report');
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

  // KPI Calculations
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

  // Filter rows by date and viewMode
  const filteredReportData = useMemo(() => {
    return reportData.filter(row => {
      // Date filter
      if (row.outwardDate) {
        const rowDate = new Date(row.outwardDate);
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

      return true;
    });
  }, [reportData, startDate, endDate, viewMode]);

  const columns = [
    { field: 'partyName', headerName: 'Party Name', flex: 1.5, minWidth: 180 },
    { field: 'outwardNo', headerName: 'Invoice No', flex: 1, minWidth: 110 },
    { 
      field: 'bill', 
      headerName: 'Bill Type', 
      width: 120,
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
      field: 'outwardDate', 
      headerName: 'Invoice Date', 
      flex: 1,
      minWidth: 110,
      valueFormatter: (value) => {
        if (!value) return '';
        return new Date(value).toLocaleDateString('en-GB');
      }
    },
    { 
      field: 'invoiceAmount', 
      headerName: 'Invoice Amount', 
      flex: 1.2,
      minWidth: 130,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value) => formatCurrency(value)
    },
    { field: 'creditDays', headerName: 'Credit Days', width: 100, type: 'number', align: 'center', headerAlign: 'center' },
    { 
      field: 'dueDate', 
      headerName: 'Due Date', 
      flex: 1,
      minWidth: 110,
      valueFormatter: (value) => {
        if (!value) return '';
        return new Date(value).toLocaleDateString('en-GB');
      }
    },
    { 
      field: 'dueDays', 
      headerName: 'Days Left/Overdue', 
      flex: 1.4,
      minWidth: 150,
      renderCell: (params) => {
        const days = params.value;
        if (params.row.status === 'Received') {
          return <span style={{ color: '#64748b', fontStyle: 'italic' }}>Received</span>;
        }
        if (days < 0) {
          return <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>Overdue by {Math.abs(days)} days</span>;
        } else if (days === 0) {
          return <span style={{ color: '#f57c00', fontWeight: 'bold' }}>Due Today</span>;
        } else {
          return <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>{days} days left</span>;
        }
      }
    },
    { 
      field: 'outstandingAmount', 
      headerName: 'Outstanding (₹)', 
      flex: 1.2,
      minWidth: 140,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => {
        const row = params.row;
        const val = viewMode === 'with_bill' ? row.outstandingWithBill :
                    viewMode === 'without_bill' ? row.outstandingWithoutBill :
                    row.outstandingAmount;
        return (
          <Typography variant="body2" sx={{ fontWeight: 700, color: val > 0 ? '#166534' : '#64748b' }}>
            {formatCurrency(val)}
          </Typography>
        );
      }
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => {
        const val = params.value;
        let color = '#757575';
        let bgcolor = '#f5f5f5';
        if (val === 'Received') {
          color = '#2e7d32'; bgcolor = '#e8f5e9';
        } else if (val === 'Partially Received') {
          color = '#f57c00'; bgcolor = '#fff3e0';
        } else if (val === 'Pending') {
          color = '#c62828'; bgcolor = '#ffebee';
        }
        return (
          <Box sx={{ 
            px: 1.5, py: 0.2, borderRadius: 10, fontWeight: 'bold', fontSize: '0.75rem',
            color: color, bgcolor: bgcolor, display: 'inline-block'
          }}>
            {val}
          </Box>
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
    const viewTitle = viewMode === 'with_bill' ? 'Outward Receivable Report (With Bill)' :
                      viewMode === 'without_bill' ? 'Outward Receivable Report (Without Bill)' :
                      'Outward Receivable Report (Combined)';
    doc.text(viewTitle, 14, 26);
    
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, 14, 32);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 35, 283, 35); 

    const tableData = filteredReportData.map(row => [
      row.partyName,
      row.outwardNo,
      row.bill ? 'With Bill' : 'Without Bill',
      new Date(row.outwardDate).toLocaleDateString('en-GB'),
      formatCurrency(row.invoiceAmount, true),
      row.creditDays,
      new Date(row.dueDate).toLocaleDateString('en-GB'),
      row.status === 'Received' ? 'Received' : (row.dueDays < 0 ? `Overdue by ${Math.abs(row.dueDays)} days` : (row.dueDays === 0 ? 'Due Today' : `${row.dueDays} days left`)),
      formatCurrency(viewMode === 'with_bill' ? row.outstandingWithBill : (viewMode === 'without_bill' ? row.outstandingWithoutBill : row.outstandingAmount), true),
      row.status
    ]);
    
    autoTable(doc, {
      head: [['Party Name', 'Invoice No', 'Bill Type', 'Invoice Date', 'Invoice Amount', 'Credit Days', 'Due Date', 'Due Days Left', 'Outstanding', 'Status']],
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
      const reportName = `OutwardReceivableReport_${viewMode}`;
      
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
      doc.save(`outward_receivable_report_${viewMode}.pdf`);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredReportData.map(row => ({
      'Party Name': row.partyName,
      'Invoice No': row.outwardNo,
      'Bill Type': row.bill ? 'With Bill' : 'Without Bill',
      'Invoice Date': new Date(row.outwardDate).toLocaleDateString('en-GB'),
      'Invoice Amount (Rs.)': parseFloat(row.invoiceAmount || 0).toFixed(2),
      'Credit Days': row.creditDays,
      'Due Date': new Date(row.dueDate).toLocaleDateString('en-GB'),
      'Days Left/Overdue': row.dueDays,
      'Outstanding Amount (Rs.)': parseFloat(viewMode === 'with_bill' ? row.outstandingWithBill : (viewMode === 'without_bill' ? row.outstandingWithoutBill : row.outstandingAmount) || 0).toFixed(2),
      'Status': row.status
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Outward Receivable');
    XLSX.writeFile(workbook, `outward_receivable_report_${viewMode}.xlsx`);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Outward Receivable Report
        </Typography>
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

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
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

      {/* Toolbar & Filters */}
      <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ width: { xs: '100%', sm: 240 } }}>
          <DatePicker
            portalId="root"
            selectsRange={true}
            startDate={startDate}
            endDate={endDate}
            onChange={(update) => setDateRange(update)}
            isClearable={true}
            customInput={<TextField size="small" label="Invoice Date Range" InputLabelProps={{ shrink: true }} fullWidth />}
            dateFormat="dd/MM/yyyy"
          />
        </Box>

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
    
      <PdfPreviewModal 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        pdfUrl={previewUrl} 
        title="Outward Receivable Report Preview" 
      />
    </Box>
  );
};

export default InvoiceWiseReceivableReport;
