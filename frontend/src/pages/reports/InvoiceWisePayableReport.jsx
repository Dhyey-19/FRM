import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Divider, Paper, TextField } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { PictureAsPdf, Visibility, TableView, Share } from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const InvoiceWisePayableReport = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState(null);

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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers/invoice-wise-payable`);
      if (!response.ok) throw new Error('Failed to fetch invoice-wise payable report');
      const data = await response.json();
      // DataGrid requires 'id' on each row. We map RowId to id.
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
    }).format(val);
    return isPDF ? formatted.replace('₹', 'Rs.') : formatted;
  };

  const handlePayClick = (row) => {
    setSelectedLedger(row);
    setPaymentModalOpen(true);
  };

  const columns = [
    { field: 'vendorName', headerName: 'Vendor Name', flex: 1.5, minWidth: 200 },
    { field: 'inwardNo', headerName: 'Invoice No', flex: 1, minWidth: 110 },
    { 
      field: 'inwardDate', 
      headerName: 'Invoice Date', 
      flex: 1,
      minWidth: 120,
      valueFormatter: (value) => {
        if (!value) return '';
        return new Date(value).toLocaleDateString();
      }
    },
    { 
      field: 'invoiceAmount', 
      headerName: 'Invoice Amount', 
      flex: 1.2,
      minWidth: 140,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value) => value ? formatCurrency(value) : formatCurrency(0)
    },
    { field: 'creditDays', headerName: 'Credit Days', flex: 0.8, minWidth: 100, type: 'number', align: 'center', headerAlign: 'center' },
    { 
      field: 'dueDate', 
      headerName: 'Due Date', 
      flex: 1,
      minWidth: 120,
      valueFormatter: (value) => {
        if (!value) return '';
        return new Date(value).toLocaleDateString();
      }
    },
    { 
      field: 'dueDays', 
      headerName: 'Days Left/Overdue', 
      flex: 1.5,
      minWidth: 160,
      renderCell: (params) => {
        const days = params.value;
        if (params.row.status === 'Paid') {
          return <span style={{ color: 'text.secondary', fontStyle: 'italic' }}>Paid</span>;
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
      headerName: 'Outstanding Amount', 
      flex: 1.2,
      minWidth: 160,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value) => value ? formatCurrency(value) : formatCurrency(0)
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1,
      minWidth: 130,
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
            px: 1.5, py: 0.2, borderRadius: 10, fontWeight: 'bold', fontSize: '0.75rem',
            color: color, bgcolor: bgcolor, display: 'inline-block'
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
        const hasPaymentDetails = params.row.UPI || (params.row.BankName && params.row.AccountNo);
        if (hasPaymentDetails && params.row.status !== 'Paid') {
          return (
            <Button 
              variant="contained" 
              color="success" 
              size="small" 
              onClick={() => handlePayClick(params.row)}
            >
              Pay
            </Button>
          );
        }
        return null;
      }
    }
  ];

  const handleExportPDF = (action = 'download') => {
    const doc = new jsPDF('landscape');
    
    // Add Company Header
    doc.setFontSize(20);
    doc.setTextColor(15, 59, 102); // Primary color
    doc.text(localUser.companyName || 'FactoryFlow', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Invoice-wise Payables Report', 14, 30);
    
    // Add date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 36);
    
    // Line separator
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 283, 40); // Landscape a4 is 297mm wide

    const filteredReportData = reportData.filter(row => {
      if (!row.inwardDate) return true;
      const rowDate = new Date(row.inwardDate);
              rowDate.setHours(0,0,0,0);
              const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
              const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;
              
              const isAfterFrom = start ? rowDate.getTime() >= start : true;
              const isBeforeTo = end ? rowDate.getTime() <= end : true;
              return isAfterFrom && isBeforeTo;
    });

    const tableData = filteredReportData.map(row => [
      row.vendorName,
      row.inwardNo,
      new Date(row.inwardDate).toLocaleDateString(),
      formatCurrency(row.invoiceAmount, true),
      row.creditDays,
      new Date(row.dueDate).toLocaleDateString(),
      row.status === 'Paid' ? 'Paid' : (row.dueDays < 0 ? `Overdue by ${Math.abs(row.dueDays)} days` : (row.dueDays === 0 ? 'Due Today' : `${row.dueDays} days left`)),
      formatCurrency(row.outstandingAmount, true),
      row.status
    ]);
    
    autoTable(doc, {
      head: [['Vendor Name', 'Invoice No', 'Invoice Date', 'Invoice Amount', 'Credit Days', 'Due Date', 'Due Days Left', 'Outstanding', 'Status']],
      body: tableData,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 249] },
      margin: { top: 45 }
    });

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const reportName = 'InvoiceWisePayableReport';
      
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
      doc.save('invoice_wise_payables.pdf');
    }
  };

  const handleExportExcel = () => {
    const filteredReportData = reportData.filter(row => {
      if (!row.inwardDate) return true;
      const rowDate = new Date(row.inwardDate);
              rowDate.setHours(0,0,0,0);
              const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
              const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;
              
              const isAfterFrom = start ? rowDate.getTime() >= start : true;
              const isBeforeTo = end ? rowDate.getTime() <= end : true;
              return isAfterFrom && isBeforeTo;
    });

    const exportData = filteredReportData.map(row => ({
      'Vendor Name': row.vendorName,
      'Invoice No': row.inwardNo,
      'Invoice Date': new Date(row.inwardDate).toLocaleDateString(),
      'Invoice Amount': row.invoiceAmount,
      'Credit Days': row.creditDays,
      'Due Date': new Date(row.dueDate).toLocaleDateString(),
      'Days Left/Overdue': row.status === 'Paid' ? 'Paid' : row.dueDays,
      'Outstanding Amount': row.outstandingAmount,
      'Status': row.status
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoice-wise Payables');
    XLSX.writeFile(workbook, 'invoice_wise_payables.xlsx');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Invoice-wise Payables
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ width: 250 }}>
            <DatePicker
              portalId="root"
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update) => setDateRange(update)}
              isClearable={true}
              customInput={<TextField size="small" label="Date Range" InputLabelProps={{ shrink: true }} fullWidth />}
              dateFormat="dd/MM/yyyy"
            />
          </Box>
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

      <Box sx={{ flexGrow: 1, height: 500, width: '100%' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={reportData.filter(row => {
              if (!row.inwardDate) return true;
              const rowDate = new Date(row.inwardDate);
              rowDate.setHours(0,0,0,0);
              const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
              const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;
              
              const isAfterFrom = start ? rowDate.getTime() >= start : true;
              const isBeforeTo = end ? rowDate.getTime() <= end : true;
              return isAfterFrom && isBeforeTo;
            })}
            columns={columns}
            rowHeight={40}
            columnHeaderHeight={35}
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
            
            <Box sx={{ mt: 4, p: 2, bgcolor: '#fff3e0', borderRadius: 1, border: '1px solid #ffe0b2' }}>
              <Typography variant="body2" color="error.dark" align="center" fontWeight="bold">
                Invoice Outstanding Balance: ₹ {Math.abs(selectedLedger?.outstandingAmount || 0).toLocaleString('en-IN')}
              </Typography>
            </Box>
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
        title="Invoice Wise Payable Preview" 
      />
    </Box>
  );
};

export default InvoiceWisePayableReport;
