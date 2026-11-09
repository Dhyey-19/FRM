import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  CircularProgress, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Grid, 
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Card,
  CardContent,
  Tooltip,
  IconButton
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
  ViewWeek,
  Payment as PaymentIcon,
  ArrowBack,
  Schedule
} from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ensureNumericWorksheet } from '../../utils/excelHelper';

const PayableReport = () => {
  const navigate = useNavigate();
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [payables, setPayables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [viewMode, setViewMode] = useState('combined'); // 'combined', 'with_bill', 'without_bill', 'all_columns'

  const fetchPayables = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers/payable`);
      if (!response.ok) throw new Error('Failed to fetch payable report');
      const data = await response.json();
      setPayables(data.map(item => ({ ...item, id: item.RowId })));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayables();
  }, []);

  const handlePayClick = (row) => {
    setSelectedLedger(row);
    setPaymentModalOpen(true);
  };

  // Summary KPI Calculations
  const summaryKPIs = useMemo(() => {
    let totalCombined = 0;
    let totalWithBill = 0;
    let totalWithoutBill = 0;

    payables.forEach(row => {
      totalCombined += parseFloat(row.PayableCombined) || 0;
      totalWithBill += parseFloat(row.PayableWithBill) || 0;
      totalWithoutBill += parseFloat(row.PayableWithoutBill) || 0;
    });

    return { totalCombined, totalWithBill, totalWithoutBill };
  }, [payables]);

  // Filter rows based on viewMode
  const filteredRows = useMemo(() => {
    if (viewMode === 'with_bill') {
      return payables.filter(r => Math.abs(parseFloat(r.PayableWithBill) || 0) > 0.001);
    } else if (viewMode === 'without_bill') {
      return payables.filter(r => Math.abs(parseFloat(r.PayableWithoutBill) || 0) > 0.001);
    } else if (viewMode === 'combined') {
      return payables.filter(r => (parseFloat(r.PayableCombined) || 0) > 0);
    }
    // all_columns
    return payables;
  }, [payables, viewMode]);

  // Dynamic Columns
  const columns = useMemo(() => {
    const actionColumn = { 
      field: 'action', 
      headerName: 'Actions', 
      width: 160, 
      sortable: false,
      renderCell: (params) => {
        const hasPaymentDetails = params.row.UPI || (params.row.BankName && params.row.AccountNo);
        return (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {hasPaymentDetails && (
              <Button 
                variant="contained" 
                color="success" 
                size="small" 
                onClick={() => handlePayClick(params.row)}
                sx={{ textTransform: 'none', px: 1, py: 0.2, fontSize: '0.75rem', borderRadius: 1.5 }}
              >
                Pay
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              color="primary"
              onClick={() => navigate('/dashboard/reports/account-ledger', { state: { ledgerId: params.row.RowId } })}
              sx={{ textTransform: 'none', px: 1, py: 0.2, fontSize: '0.75rem', borderRadius: 1.5 }}
            >
              Ledger
            </Button>
          </Box>
        );
      }
    };

    if (viewMode === 'with_bill') {
      return [
        { field: 'RowId', headerName: 'Ledger ID', width: 90 },
        { field: 'VendorName', headerName: 'Vendor Name', flex: 1 },
        { field: 'MobileNo', headerName: 'Mobile No', width: 130, valueGetter: (val, row) => row.MobileNo || '-' },
        { 
          field: 'PayableWithBill', 
          headerName: 'With Bill Payable (₹)', 
          width: 200, 
          type: 'number',
          renderCell: (params) => {
            const val = parseFloat(params.value || 0);
            return (
              <Typography variant="body2" sx={{ fontWeight: 700, color: val < 0 ? '#166534' : '#0F3B66' }}>
                ₹ {val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {val < 0 && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>(Dr)</span>}
              </Typography>
            );
          }
        },
        actionColumn
      ];
    } else if (viewMode === 'without_bill') {
      return [
        { field: 'RowId', headerName: 'Ledger ID', width: 90 },
        { field: 'VendorName', headerName: 'Vendor Name', flex: 1 },
        { field: 'MobileNo', headerName: 'Mobile No', width: 130, valueGetter: (val, row) => row.MobileNo || '-' },
        { 
          field: 'PayableWithoutBill', 
          headerName: 'Without Bill Payable (₹)', 
          width: 210, 
          type: 'number',
          renderCell: (params) => {
            const val = parseFloat(params.value || 0);
            return (
              <Typography variant="body2" sx={{ fontWeight: 700, color: val < 0 ? '#166534' : '#b45309' }}>
                ₹ {val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {val < 0 && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>(Dr)</span>}
              </Typography>
            );
          }
        },
        actionColumn
      ];
    } else if (viewMode === 'all_columns') {
      return [
        { field: 'RowId', headerName: 'Ledger ID', width: 90 },
        { field: 'VendorName', headerName: 'Vendor Name', flex: 1 },
        { field: 'MobileNo', headerName: 'Mobile No', width: 130, valueGetter: (val, row) => row.MobileNo || '-' },
        { 
          field: 'PayableWithBill', 
          headerName: 'With Bill (₹)', 
          width: 140, 
          type: 'number',
          renderCell: (params) => {
            const val = parseFloat(params.value || 0);
            return (
              <Typography variant="body2" sx={{ fontWeight: 600, color: val < 0 ? '#166534' : '#0F3B66' }}>
                ₹ {val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {val < 0 && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>(Dr)</span>}
              </Typography>
            );
          }
        },
        { 
          field: 'PayableWithoutBill', 
          headerName: 'Without Bill (₹)', 
          width: 140, 
          type: 'number',
          renderCell: (params) => {
            const val = parseFloat(params.value || 0);
            return (
              <Typography variant="body2" sx={{ fontWeight: 600, color: val < 0 ? '#166534' : '#b45309' }}>
                ₹ {val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {val < 0 && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>(Dr)</span>}
              </Typography>
            );
          }
        },
        { 
          field: 'PayableCombined', 
          headerName: 'Combined Total (₹)', 
          width: 170, 
          type: 'number',
          renderCell: (params) => (
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#b91c1c' }}>
              ₹ {parseFloat(params.value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          )
        },
        actionColumn
      ];
    }

    // Default 'combined'
    return [
      { field: 'RowId', headerName: 'Ledger ID', width: 90 },
      { field: 'VendorName', headerName: 'Vendor Name', flex: 1 },
      { field: 'MobileNo', headerName: 'Mobile No', width: 130, valueGetter: (val, row) => row.MobileNo || '-' },
      { 
        field: 'PayableCombined', 
        headerName: 'Combined Payable (₹)', 
        width: 190, 
        type: 'number',
        renderCell: (params) => (
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#b91c1c' }}>
            ₹ {parseFloat(params.value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Typography>
        )
      },
      actionColumn
    ];
  }, [viewMode, navigate]);

  const handleExportPDF = (action = 'download') => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FRM', 14, 18);
    
    doc.setFontSize(13);
    doc.setTextColor(60);
    const viewTitle = viewMode === 'with_bill' ? 'Payable Report (With Bill)' :
                      viewMode === 'without_bill' ? 'Payable Report (Without Bill)' :
                      viewMode === 'all_columns' ? 'Payable Report (All Columns Breakdown)' :
                      'Payable Report (Combined)';
    doc.text(viewTitle, 14, 26);
    
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, 14, 32);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 35, 196, 35); 

    let head = [];
    let tableData = [];

    if (viewMode === 'with_bill') {
      head = [['ID', 'Vendor Name', 'Mobile No', 'With Bill Payable (Rs.)']];
      tableData = filteredRows.map(r => [
        r.RowId,
        r.VendorName,
        r.MobileNo || '-',
        parseFloat(r.PayableWithBill || 0).toFixed(2)
      ]);
      tableData.push(['', 'TOTAL', '', summaryKPIs.totalWithBill.toFixed(2)]);
    } else if (viewMode === 'without_bill') {
      head = [['ID', 'Vendor Name', 'Mobile No', 'Without Bill Payable (Rs.)']];
      tableData = filteredRows.map(r => [
        r.RowId,
        r.VendorName,
        r.MobileNo || '-',
        parseFloat(r.PayableWithoutBill || 0).toFixed(2)
      ]);
      tableData.push(['', 'TOTAL', '', summaryKPIs.totalWithoutBill.toFixed(2)]);
    } else if (viewMode === 'all_columns') {
      head = [['ID', 'Vendor Name', 'Mobile No', 'With Bill (Rs.)', 'Without Bill (Rs.)', 'Combined Total (Rs.)']];
      tableData = filteredRows.map(r => [
        r.RowId,
        r.VendorName,
        r.MobileNo || '-',
        parseFloat(r.PayableWithBill || 0).toFixed(2),
        parseFloat(r.PayableWithoutBill || 0).toFixed(2),
        parseFloat(r.PayableCombined || 0).toFixed(2)
      ]);
      tableData.push([
        '', 
        'TOTAL', 
        '', 
        summaryKPIs.totalWithBill.toFixed(2), 
        summaryKPIs.totalWithoutBill.toFixed(2), 
        summaryKPIs.totalCombined.toFixed(2)
      ]);
    } else {
      head = [['ID', 'Vendor Name', 'Mobile No', 'Combined Payable (Rs.)']];
      tableData = filteredRows.map(r => [
        r.RowId,
        r.VendorName,
        r.MobileNo || '-',
        parseFloat(r.PayableCombined || 0).toFixed(2)
      ]);
      tableData.push(['', 'TOTAL', '', summaryKPIs.totalCombined.toFixed(2)]);
    }
    
    autoTable(doc, {
      head: head,
      body: tableData,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, halign: 'left' },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const reportName = `PayableReport_${viewMode}`;
      
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
      doc.save(`payable_report_${viewMode}.pdf`);
    }
  };

  const handleExportExcel = () => {
    let exportData = [];

    if (viewMode === 'with_bill') {
      exportData = filteredRows.map(row => ({
        'Ledger ID': row.RowId,
        'Vendor Name': row.VendorName,
        'Mobile No': row.MobileNo || '-',
        'With Bill Payable (Rs.)': Number(parseFloat(row.PayableWithBill || 0).toFixed(2))
      }));
    } else if (viewMode === 'without_bill') {
      exportData = filteredRows.map(row => ({
        'Ledger ID': row.RowId,
        'Vendor Name': row.VendorName,
        'Mobile No': row.MobileNo || '-',
        'Without Bill Payable (Rs.)': Number(parseFloat(row.PayableWithoutBill || 0).toFixed(2))
      }));
    } else if (viewMode === 'all_columns') {
      exportData = filteredRows.map(row => ({
        'Ledger ID': row.RowId,
        'Vendor Name': row.VendorName,
        'Mobile No': row.MobileNo || '-',
        'With Bill Payable (Rs.)': Number(parseFloat(row.PayableWithBill || 0).toFixed(2)),
        'Without Bill Payable (Rs.)': Number(parseFloat(row.PayableWithoutBill || 0).toFixed(2)),
        'Combined Payable (Rs.)': Number(parseFloat(row.PayableCombined || 0).toFixed(2))
      }));
    } else {
      exportData = filteredRows.map(row => ({
        'Ledger ID': row.RowId,
        'Vendor Name': row.VendorName,
        'Mobile No': row.MobileNo || '-',
        'Combined Payable (Rs.)': Number(parseFloat(row.PayableCombined || 0).toFixed(2))
      }));
    }
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    ensureNumericWorksheet(worksheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payable');
    XLSX.writeFile(workbook, `payable_report_${viewMode}.xlsx`);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Payable Report
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button 
            variant="contained" 
            startIcon={<Schedule />}
            onClick={() => navigate('/dashboard/reports/invoice-payable')}
            sx={{ bgcolor: '#0F3B66', color: '#fff', '&:hover': { bgcolor: '#092542' }, fontWeight: 600 }}
          >
            Due by Days (Aging)
          </Button>
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
                🧾 WITH BILL PAYABLE
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
                📋 WITHOUT BILL PAYABLE
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#78350f', mt: 0.5 }}>
                ₹ {summaryKPIs.totalWithoutBill.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                🌐 COMBINED NET PAYABLE
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#991b1b', mt: 0.5 }}>
                ₹ {summaryKPIs.totalCombined.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" sx={{ color: '#991b1b', fontSize: '0.7rem', display: 'block', mt: 0.25 }}>
                ✓ With Bill + Without Bill = Combined Total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Toolbar & View Filter */}
      <Paper sx={{ p: 1.5, mb: 2, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
          Showing {filteredRows.length} {filteredRows.length === 1 ? 'Vendor' : 'Vendors'}
        </Typography>

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, nextMode) => { if (nextMode) setViewMode(nextMode); }}
          size="small"
        >
          <ToggleButton value="combined" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5 }}>
            <Tooltip title="Combined payable per vendor">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ReceiptLong fontSize="small" /> Combined
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="with_bill" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5 }}>
            <Tooltip title="Only With Bill (Official) payable">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Receipt fontSize="small" color="primary" /> With Bill
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="without_bill" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5 }}>
            <Tooltip title="Only Without Bill (Cash) payable">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <MoneyOff fontSize="small" color="warning" /> Without Bill
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="all_columns" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5 }}>
            <Tooltip title="View With-Bill, Without-Bill, and Combined in separate columns side by side">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ViewWeek fontSize="small" color="secondary" /> All Columns
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
            rows={filteredRows}
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
          Payment Details - {selectedLedger?.VendorName}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ p: 2 }}>
            <Grid container spacing={3}>
              {selectedLedger?.UPI && (
                <Grid item xs={12} sm={selectedLedger?.BankName ? 6 : 12} sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">UPI Payment</Typography>
                  <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: 'white', display: 'inline-block' }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${selectedLedger.UPI}&pn=${selectedLedger.VendorName}`)}`} 
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
                Outstanding Summary
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="textSecondary">🧾 With Bill (Official):</Typography>
                <Typography variant="body2" fontWeight="bold" color="#0F3B66">
                  ₹ {parseFloat(selectedLedger?.PayableWithBill || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="textSecondary">📋 Without Bill (Cash):</Typography>
                <Typography variant="body2" fontWeight="bold" color="#b45309">
                  ₹ {parseFloat(selectedLedger?.PayableWithoutBill || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight="bold" color="error.main">🌐 Combined Total Payable:</Typography>
                <Typography variant="body2" fontWeight="800" color="error.main">
                  ₹ {parseFloat(selectedLedger?.PayableCombined || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        title="Payable Report Preview" 
      />
    </Box>
  );
};

export default PayableReport;
