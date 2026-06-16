import { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Divider } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { PictureAsPdf, Visibility, TableView, Share } from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const PayableReport = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [payables, setPayables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState(null);

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

  const columns = [
    { field: 'RowId', headerName: 'Ledger ID', width: 100 },
    { field: 'VendorName', headerName: 'Vendor Name', flex: 1 },
    { field: 'MobileNo', headerName: 'Mobile No', width: 130 },
    { field: 'ClosingBalance', headerName: 'Closing Balance', width: 150, type: 'number' },
    { 
      field: 'action', 
      headerName: 'Action', 
      width: 100, 
      sortable: false,
      renderCell: (params) => {
        const hasPaymentDetails = params.row.UPI || (params.row.BankName && params.row.AccountNo);
        if (hasPaymentDetails) {
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
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FactoryFlow', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Payable', 14, 30);
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 36);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40); 

    const tableData = payables.map(row => [
      row.RowId,
      row.VendorName,
      row.MobileNo || '-',
      row.ClosingBalance
    ]);
    
    autoTable(doc, {
      head: [['ID', 'Vendor Name', 'Mobile No', 'Closing Balance']],
      body: tableData,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, halign: 'left' },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 249] }
    });

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const reportName = 'PayableReport';
      
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
      doc.save('payable_report.pdf');
    }
  };

  const handleExportExcel = () => {
    const exportData = payables.map(row => ({
      'Ledger ID': row.RowId,
      'Vendor Name': row.VendorName,
      'Mobile No': row.MobileNo,
      'Closing Balance': row.ClosingBalance
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payable');
    XLSX.writeFile(workbook, 'payable_report.xlsx');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Payable
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
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
            rows={payables}
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
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            pageSizeOptions={[10, 25, 50]}
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
            
            <Box sx={{ mt: 4, p: 2, bgcolor: '#fff3e0', borderRadius: 1, border: '1px solid #ffe0b2' }}>
              <Typography variant="body2" color="error.dark" align="center" fontWeight="bold">
                Outstanding Balance: ₹ {Math.abs(selectedLedger?.ClosingBalance || 0).toLocaleString('en-IN')}
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
        title="Payable Preview" 
      />
    </Box>
  );
};

export default PayableReport;
