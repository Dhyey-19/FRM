import { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, CircularProgress, TextField } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { PictureAsPdf, Visibility, TableView, Share } from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const StockJournalReport = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const fetchJournals = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/stock-journal`);
      if (!response.ok) throw new Error('Failed to fetch stock journals');
      const data = await response.json();
      setJournals(data.map(item => ({ ...item, id: item.SJID })));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, []);

  const columns = [
    { field: 'SJID', headerName: 'Journal ID', width: 100 },
    { 
      field: 'SJDate', 
      headerName: 'Date', 
      width: 120,
      valueFormatter: (value) => {
        if (!value) return '';
        return new Date(value).toLocaleDateString();
      }
    },
    { field: 'SJType', headerName: 'Type', width: 120 },
    { field: 'ItemCode', headerName: 'Item Code', width: 120 },
    { field: 'ItemName', headerName: 'Item Name', flex: 1 },
    { field: 'Qty', headerName: 'Qty', width: 100, type: 'number' },
    { field: 'Remarks', headerName: 'Remarks', flex: 1 },
  ];

  const handleExportPDF = (action = 'download') => {
    const doc = new jsPDF('landscape');
    
    // Add Company Header
    doc.setFontSize(20);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FRM', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Stock Journal', 14, 30);
    
    // Add date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 36);
    
    // Line separator
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 283, 40); // landscape width is 297

    const filteredJournals = journals.filter(row => {
      if (!row.SJDate) return true;
      const rowDate = new Date(row.SJDate);
              rowDate.setHours(0,0,0,0);
              const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
              const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;
              
              const isAfterFrom = start ? rowDate.getTime() >= start : true;
              const isBeforeTo = end ? rowDate.getTime() <= end : true;
              return isAfterFrom && isBeforeTo;
    });

    const tableData = filteredJournals.map(row => [
      row.SJID,
      row.SJDate ? new Date(row.SJDate).toLocaleDateString() : '',
      row.SJType,
      row.ItemCode,
      row.ItemName,
      row.Qty,
      row.Remarks || ''
    ]);
    
    autoTable(doc, {
      head: [['Journal ID', 'Date', 'Type', 'Item Code', 'Item Name', 'Qty', 'Remarks']],
      body: tableData,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, halign: 'left' },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 249] },
      margin: { top: 45 }
    });

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const reportName = 'StockJournalReport';
      
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
      doc.save('stock_journal_report.pdf');
    }
  };

  const handleExportExcel = () => {
    const filteredJournals = journals.filter(row => {
      if (!row.SJDate) return true;
      const rowDate = new Date(row.SJDate);
              rowDate.setHours(0,0,0,0);
              const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
              const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;
              
              const isAfterFrom = start ? rowDate.getTime() >= start : true;
              const isBeforeTo = end ? rowDate.getTime() <= end : true;
              return isAfterFrom && isBeforeTo;
    });

    const exportData = filteredJournals.map(row => ({
      'Journal ID': row.SJID,
      'Date': row.SJDate ? new Date(row.SJDate).toLocaleDateString() : '',
      'Type': row.SJType,
      'Item Code': row.ItemCode,
      'Item Name': row.ItemName,
      'Qty': row.Qty,
      'Remarks': row.Remarks
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Journal');
    XLSX.writeFile(workbook, 'stock_journal_report.xlsx');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Stock Journal
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
            rows={journals.filter(row => {
              if (!row.SJDate) return true;
              const rowDate = new Date(row.SJDate);
              rowDate.setHours(0,0,0,0);
              const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
              const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;
              
              const isAfterFrom = start ? rowDate.getTime() >= start : true;
              const isBeforeTo = end ? rowDate.getTime() <= end : true;
              return isAfterFrom && isBeforeTo;
            })}
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
        title="Stock Journal Preview" 
      />
    </Box>
  );
};

export default StockJournalReport;
