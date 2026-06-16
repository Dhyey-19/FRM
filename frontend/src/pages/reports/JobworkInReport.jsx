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

const JobworkInReport = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [jobworkIns, setJobworkIns] = useState([]);
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

  const fetchJobworkIns = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/jobwork-ins/report`);
      if (!response.ok) throw new Error('Failed to fetch jobwork in report');
      const data = await response.json();
      setJobworkIns(data.map(item => ({ ...item, id: item.RowId })));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobworkIns();
  }, []);

  const columns = [
    { field: 'JWINWARDNO', headerName: 'Inward Challan', width: 110 },
    { 
      field: 'JWINWARDDATE', 
      headerName: 'Date', 
      width: 110,
      valueFormatter: (value) => {
        if (!value) return '';
        return new Date(value).toLocaleDateString();
      }
    },
    { field: 'JWOUTWARDNO', headerName: 'Outward Ref', width: 110 },
    { field: 'LedgerName', headerName: 'Ledger Name', width: 150 },
    { field: 'OUTITEMCODE', headerName: 'Raw Code', width: 90 },
    { field: 'OutItemName', headerName: 'Raw Name', width: 120 },
    { field: 'INITEMCODE', headerName: 'Fin Code', width: 90 },
    { field: 'InItemName', headerName: 'Fin Name', width: 120 },
    { field: 'PROCESS', headerName: 'Process', width: 100 },
    { field: 'UNIT', headerName: 'Unit', width: 80 },
    { field: 'QUANTITY', headerName: 'Qty', width: 80, type: 'number' },
    { field: 'GROSSWT', headerName: 'Gross Wt', width: 90, type: 'number' },
    { field: 'NETWT', headerName: 'Net Wt', width: 90, type: 'number' },
    { field: 'SCRAPITEMCODE', headerName: 'Scrap Code', width: 95 },
    { field: 'ScrapItemName', headerName: 'Scrap Name', width: 120 },
    { field: 'SCRAPPCS', headerName: 'Scrap Pcs', width: 85, type: 'number' },
    { field: 'SCRAPWT', headerName: 'Scrap Wt', width: 85, type: 'number' },
    { field: 'RATE', headerName: 'Rate', width: 80, type: 'number' },
    { field: 'AMOUNT', headerName: 'Amount', width: 100, type: 'number' },
  ];

  const handleExportPDF = (action = 'download') => {
    const doc = new jsPDF('landscape');
    
    // Add Company Header
    doc.setFontSize(20);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FactoryFlow', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Job Work Inward Report', 14, 30);
    
    // Add date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 36);
    
    // Line separator
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 283, 40); // landscape width is 297

    const filteredJobworkIns = jobworkIns.filter(row => {
      if (!row.JWINWARDDATE) return true;
      const rowDate = new Date(row.JWINWARDDATE);
              rowDate.setHours(0,0,0,0);
              const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
              const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;
              
              const isAfterFrom = start ? rowDate.getTime() >= start : true;
              const isBeforeTo = end ? rowDate.getTime() <= end : true;
              return isAfterFrom && isBeforeTo;
    });

    const tableData = filteredJobworkIns.map(row => [
      row.JWINWARDNO,
      row.JWINWARDDATE ? new Date(row.JWINWARDDATE).toLocaleDateString() : '',
      row.JWOUTWARDNO || '',
      row.LedgerName || '',
      row.OUTITEMCODE,
      row.INITEMCODE,
      row.PROCESS || '',
      row.UNIT || '',
      row.QUANTITY,
      row.NETWT,
      row.SCRAPITEMCODE || '',
      row.SCRAPPCS,
      row.SCRAPWT,
      row.RATE,
      row.AMOUNT
    ]);
    
    autoTable(doc, {
      head: [['Inward No', 'Date', 'Out Ref', 'Ledger', 'Raw Item', 'Fin Item', 'Process', 'Unit', 'Qty', 'Net Wt', 'Scrap', 'Scrap Pcs', 'Scrap Wt', 'Rate', 'Amount']],
      body: tableData,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, halign: 'left' },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 249] },
      margin: { top: 45 }
    });

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const reportName = 'JobworkInReport';
      
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
      doc.save('jobwork_inward_report.pdf');
    }
  };

  const handleExportExcel = () => {
    const filteredJobworkIns = jobworkIns.filter(row => {
      if (!row.JWINWARDDATE) return true;
      const rowDate = new Date(row.JWINWARDDATE);
              rowDate.setHours(0,0,0,0);
              const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
              const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;
              
              const isAfterFrom = start ? rowDate.getTime() >= start : true;
              const isBeforeTo = end ? rowDate.getTime() <= end : true;
              return isAfterFrom && isBeforeTo;
    });

    const exportData = filteredJobworkIns.map(row => ({
      'Inward Challan': row.JWINWARDNO,
      'Date': row.JWINWARDDATE ? new Date(row.JWINWARDDATE).toLocaleDateString() : '',
      'Outward Ref': row.JWOUTWARDNO,
      'Ledger Name': row.LedgerName,
      'Raw Item Code': row.OUTITEMCODE,
      'Raw Item Name': row.OutItemName,
      'Fin Item Code': row.INITEMCODE,
      'Fin Item Name': row.InItemName,
      'Process': row.PROCESS,
      'Unit': row.UNIT,
      'Qty': row.QUANTITY,
      'Gross Wt': row.GROSSWT,
      'Net Wt': row.NETWT,
      'Scrap Item Code': row.SCRAPITEMCODE,
      'Scrap Item Name': row.ScrapItemName,
      'Scrap Pcs': row.SCRAPPCS,
      'Scrap Wt': row.SCRAPWT,
      'Rate': row.RATE,
      'Amount': row.AMOUNT
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Jobwork In');
    XLSX.writeFile(workbook, 'jobwork_inward_report.xlsx');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Job Work Inward
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
            rows={jobworkIns.filter(row => {
              if (!row.JWINWARDDATE) return true;
              const rowDate = new Date(row.JWINWARDDATE);
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
    
      <PdfPreviewModal 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        pdfUrl={previewUrl} 
        title="Job Work Inward Preview" 
      />
    </Box>
  );
};

export default JobworkInReport;
