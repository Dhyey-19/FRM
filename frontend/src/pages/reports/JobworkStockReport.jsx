import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Button, Paper, CircularProgress } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { PictureAsPdf, Visibility, TableView, Share } from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ensureNumericWorksheet } from '../../utils/excelHelper';

const JobworkStockReport = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [stockRecords, setStockRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStockRecords = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/jobwork-ins/stock-report`);
      if (!response.ok) throw new Error('Failed to fetch jobwork stock report');
      const data = await response.json();
      setStockRecords(data.map(item => ({ ...item, id: item.RowId })));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockRecords();
  }, []);

  const getColWidth = (field, headerName, minWidth = 80) => {
    let maxLen = headerName.length;
    stockRecords.forEach(row => {
      let val = '';
      if (field === 'LedgerName') val = row.LedgerName || '';
      else if (field === 'ItemCode') val = row.ItemCode || '';
      else if (field === 'ItemName') val = row.ItemName || '';
      else if (field === 'OutQty') val = row.OutQty !== undefined ? Number(row.OutQty).toFixed(2) : '';
      else if (field === 'OutNetWt') val = row.OutNetWt !== undefined ? Number(row.OutNetWt).toFixed(3) : '';
      else if (field === 'InQty') val = row.InQty !== undefined ? Number(row.InQty).toFixed(2) : '';
      else if (field === 'InNetWt') val = row.InNetWt !== undefined ? Number(row.InNetWt).toFixed(3) : '';
      else if (field === 'BalQty') val = row.BalQty !== undefined ? Number(row.BalQty).toFixed(2) : '';
      else if (field === 'BalNetWt') val = row.BalNetWt !== undefined ? Number(row.BalNetWt).toFixed(3) : '';
      
      const len = val.toString().length;
      if (len > maxLen) {
        maxLen = len;
      }
    });
    return Math.max(maxLen * 8.5 + 60, minWidth);
  };

  const columns = useMemo(() => {
    return [
      { field: 'LedgerName', headerName: 'Job Worker', width: getColWidth('LedgerName', 'Job Worker', 180) },
      { field: 'ItemCode', headerName: 'Item Code', width: getColWidth('ItemCode', 'Item Code', 110) },
      { field: 'SubCode', headerName: 'Sub Code', width: getColWidth('SubCode', 'Sub Code', 100), valueGetter: (value, row) => row?.SubCode || '-' },
      { field: 'ItemName', headerName: 'Item Name', width: getColWidth('ItemName', 'Item Name', 180) },
      { field: 'OutQty', headerName: 'Sent Qty', width: getColWidth('OutQty', 'Sent Qty', 120), type: 'number' },
      { field: 'OutNetWt', headerName: 'Sent Wt', width: getColWidth('OutNetWt', 'Sent Wt', 120), type: 'number' },
      { field: 'InQty', headerName: 'Ret Qty', width: getColWidth('InQty', 'Ret Qty', 120), type: 'number' },
      { field: 'InNetWt', headerName: 'Ret Wt', width: getColWidth('InNetWt', 'Ret Wt', 120), type: 'number' },
      { 
        field: 'BalQty', 
        headerName: 'Outs Qty', 
        width: getColWidth('BalQty', 'Outs Qty', 125), 
        type: 'number',
        renderCell: (params) => (
          <span style={{ fontWeight: 'bold', color: params.value > 0 ? '#b91c1c' : '#1e293b' }}>
            {params.value.toFixed(2)}
          </span>
        )
      },
      { 
        field: 'BalNetWt', 
        headerName: 'Outs Wt', 
        width: getColWidth('BalNetWt', 'Outs Wt', 125), 
        type: 'number',
        renderCell: (params) => (
          <span style={{ fontWeight: 'bold', color: params.value > 0 ? '#b91c1c' : '#1e293b' }}>
            {params.value.toFixed(3)}
          </span>
        )
      },
      {
        field: 'Costing',
        headerName: 'Costing (₹)',
        width: 110,
        type: 'number',
        valueGetter: (value, row) => Number(row?.Costing || 0).toFixed(2)
      },
      {
        field: 'Valuation',
        headerName: 'Valuation (₹)',
        width: 135,
        type: 'number',
        renderCell: (params) => (
          <span style={{ fontWeight: 'bold', color: '#c2410c' }}>
            ₹{Number(params.value || 0).toFixed(2)}
          </span>
        )
      }
    ];
  }, [stockRecords]);

  const handleExportPDF = (action = 'download') => {
    const doc = new jsPDF('landscape');
    
    // Add Company Header
    doc.setFontSize(20);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FRM', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Job Work Outstanding Stock Report', 14, 30);
    
    // Add date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 36);
    
    // Line separator
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 280, 40);

    const tableData = stockRecords.map(row => [
      row.LedgerName || '',
      row.ItemCode || '',
      row.SubCode || '-',
      row.ItemName || '',
      row.OutQty,
      row.OutNetWt,
      row.InQty,
      row.InNetWt,
      row.BalQty,
      row.BalNetWt,
      Number(row.Costing || 0).toFixed(2),
      Number(row.Valuation || 0).toFixed(2)
    ]);
    
    autoTable(doc, {
      head: [['Job Worker', 'Item Code', 'Sub Code', 'Item Name', 'Sent Qty', 'Sent Wt', 'Ret Qty', 'Ret Wt', 'Outs Qty', 'Outs Wt', 'Costing (Rs.)', 'Valuation (Rs.)']],
      body: tableData,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, halign: 'left' },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 249] },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right', fontStyle: 'bold' },
        9: { halign: 'right', fontStyle: 'bold' },
        10: { halign: 'right' },
        11: { halign: 'right', fontStyle: 'bold', textColor: [194, 65, 12] }
      },
      margin: { top: 45 }
    });

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const reportName = 'JobworkStockReport';
      
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
      doc.save('jobwork_stock_report.pdf');
    }
  };

  const handleExportExcel = () => {
    const exportData = stockRecords.map(row => ({
      'Job Worker': row.LedgerName,
      'Item Code': row.ItemCode,
      'Sub Code': row.SubCode || '-',
      'Item Name': row.ItemName,
      'Sent Qty': Number(row.OutQty) || 0,
      'Sent Wt': Number(row.OutNetWt) || 0,
      'Ret Qty': Number(row.InQty) || 0,
      'Ret Wt': Number(row.InNetWt) || 0,
      'Outs Qty': Number(row.BalQty) || 0,
      'Outs Wt': Number(row.BalNetWt) || 0,
      'Costing (Rs.)': Number(row.Costing) || 0,
      'Valuation (Rs.)': Number(row.Valuation) || 0
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    ensureNumericWorksheet(worksheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Outstanding Stock');
    XLSX.writeFile(workbook, 'jobwork_stock_report.xlsx');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Subcontract Stock Report
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          <Button 
            variant="outlined" 
            startIcon={<TableView />}
            onClick={handleExportExcel}
            sx={{ color: '#107c41', borderColor: '#107c41', flex: { xs: 1, sm: 'none' } }}
          >
            Export Excel
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<Visibility />}
            onClick={() => handleExportPDF('preview')}
            sx={{ color: '#0F3B66', borderColor: '#0F3B66', flex: { xs: 1, sm: 'none' } }}
          >
            Preview PDF
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<PictureAsPdf />}
            onClick={() => handleExportPDF('download')}
            sx={{ color: '#d32f2f', borderColor: '#d32f2f', flex: { xs: 1, sm: 'none' } }}
          >
            Export PDF
          </Button>
          <Button 
            variant="contained" 
            startIcon={<Share />}
            onClick={() => handleExportPDF('share')}
            sx={{ bgcolor: 'secondary.main', flex: { xs: 1, sm: 'none' } }}
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
            rows={stockRecords}
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
        title="Job Work Stock Preview" 
      />
    </Box>
  );
};

export default JobworkStockReport;
