import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Button, Paper, CircularProgress, TextField, Chip, IconButton } from '@mui/material';
import { DataGrid, GridToolbar, useGridApiRef, gridFilteredSortedRowEntriesSelector } from '@mui/x-data-grid';
import { PictureAsPdf, Visibility, TableView, Share, QrCode2, ElectricBolt } from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import EInvoiceModal from '../../components/common/EInvoiceModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const OutwardReport = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [outwards, setOutwards] = useState([]);
  const [loading, setLoading] = useState(true);

  // e-Invoice Modal state
  const [einvoiceModalOpen, setEinvoiceModalOpen] = useState(false);
  const [selectedEinvoiceRow, setSelectedEinvoiceRow] = useState(null);

  const handleOpenEinvoice = (row) => {
    setSelectedEinvoiceRow(row);
    setEinvoiceModalOpen(true);
  };

  const handleInvoiceUpdated = (updated) => {
    setOutwards(prev => prev.map(o => (o.OutwardHeaderId === updated.ID || o.OUTWARDNO === updated.OUTWARDNO ? { ...o, ...updated } : o)));
    if (selectedEinvoiceRow && (selectedEinvoiceRow.OutwardHeaderId === updated.ID || selectedEinvoiceRow.OUTWARDNO === updated.OUTWARDNO)) {
      setSelectedEinvoiceRow(prev => ({ ...prev, ...updated }));
    }
  };

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

  const fetchOutwards = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/outwards/report`);
      if (!response.ok) throw new Error('Failed to fetch outward report');
      const data = await response.json();
      setOutwards(data.map(item => ({ ...item, id: item.RowId })));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutwards();
  }, []);

  const columns = [
    { 
      field: 'OUTWARDNO', 
      headerName: 'Outward No', 
      width: 110,
      sortComparator: (v1, v2) => {
        const num1 = parseInt(v1, 10);
        const num2 = parseInt(v2, 10);
        const isNum1 = !isNaN(num1) && /^\d+$/.test(String(v1 || '').trim());
        const isNum2 = !isNaN(num2) && /^\d+$/.test(String(v2 || '').trim());
        if (isNum1 && isNum2) return num1 - num2;
        if (isNum1) return -1;
        if (isNum2) return 1;
        return String(v1 || '').localeCompare(String(v2 || ''), undefined, { numeric: true });
      }
    },
    { 
      field: 'OUTWARDDATE', 
      headerName: 'Date', 
      width: 110,
      valueFormatter: (value) => {
        if (!value) return '';
        return new Date(value).toLocaleDateString();
      }
    },
    { field: 'LedgerName', headerName: 'Ledger Name', width: 180 },
    { field: 'ITEMCODE', headerName: 'Item Code', width: 110 },
    { field: 'SUBCODE', headerName: 'Sub Code', width: 95, valueGetter: (value, row) => row?.SUBCODE || '-' },
    { field: 'ItemName', headerName: 'Item Name', flex: 1 },
    { field: 'UNIT', headerName: 'Unit', width: 80 },
    { field: 'QUANTITY', headerName: 'Qty', width: 80, type: 'number' },
    { field: 'GROSSWT', headerName: 'Gross Wt', width: 90, type: 'number' },
    { field: 'NETWT', headerName: 'Net Wt', width: 90, type: 'number' },
    { field: 'RATE', headerName: 'Rate', width: 90, type: 'number' },
    { 
      field: 'DISCOUNT', 
      headerName: 'Disc %', 
      width: 80, 
      type: 'number',
      valueFormatter: (value) => (value ? `${parseFloat(value).toFixed(2)}%` : '-')
    },
    { field: 'AMOUNT', headerName: 'Amount', width: 110, type: 'number' },
    { 
      field: 'EInvoiceStatus', 
      headerName: 'e-Invoice', 
      width: 140,
      renderCell: (params) => {
        const row = params?.row || {};
        const status = row.EInvoiceStatus || (row.IRN ? 'Generated' : 'Pending');
        const isGenerated = status === 'Generated' || Boolean(row.IRN);
        const isCancelled = status === 'Cancelled';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}>
            <Chip 
              size="small" 
              label={status}
              color={isGenerated ? 'success' : isCancelled ? 'error' : 'default'}
              variant={isGenerated ? 'filled' : 'outlined'}
              onClick={() => handleOpenEinvoice(row)}
              sx={{ fontSize: '0.72rem', height: 22, fontWeight: 600, cursor: 'pointer' }}
              title="Click to view e-Invoice / Export JSON"
            />
            <IconButton 
              size="small" 
              color={isGenerated ? 'info' : 'primary'} 
              onClick={() => handleOpenEinvoice(row)}
              title={isGenerated ? 'View e-Invoice QR & IRN' : '1-Click Generate e-Invoice (NIC IRP)'}
              sx={{ p: 0.25 }}
            >
              {isGenerated ? <QrCode2 fontSize="small" /> : <ElectricBolt fontSize="small" />}
            </IconButton>
          </Box>
        );
      }
    },
  ];

  const filteredOutwards = useMemo(() => {
    return outwards.filter(row => {
      if (!row.OUTWARDDATE) return true;
      const rowDate = new Date(row.OUTWARDDATE);
      rowDate.setHours(0,0,0,0);
      const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
      const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;
      
      const isAfterFrom = start ? rowDate.getTime() >= start : true;
      const isBeforeTo = end ? rowDate.getTime() <= end : true;
      return isAfterFrom && isBeforeTo;
    }).sort((a, b) => {
      const numA = parseInt(a.OUTWARDNO, 10);
      const numB = parseInt(b.OUTWARDNO, 10);
      const isNumA = !isNaN(numA) && /^\d+$/.test(String(a.OUTWARDNO || '').trim());
      const isNumB = !isNaN(numB) && /^\d+$/.test(String(b.OUTWARDNO || '').trim());
      if (isNumA && isNumB) return numB - numA;
      if (isNumA) return -1;
      if (isNumB) return 1;
      return String(b.OUTWARDNO || '').localeCompare(String(a.OUTWARDNO || ''), undefined, { numeric: true });
    });
  }, [outwards, startDate, endDate]);

  const calculateTotals = (rows) => ({
    totalQty: rows.reduce((sum, row) => sum + (parseFloat(row.QUANTITY) || 0), 0),
    totalGrossWt: rows.reduce((sum, row) => sum + (parseFloat(row.GROSSWT) || 0), 0),
    totalNetWt: rows.reduce((sum, row) => sum + (parseFloat(row.NETWT) || 0), 0),
    totalAmount: rows.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0),
  });

  const [displayedTotals, setDisplayedTotals] = useState({ totalQty: 0, totalGrossWt: 0, totalNetWt: 0, totalAmount: 0 });

  useEffect(() => {
    setDisplayedTotals(calculateTotals(filteredOutwards));
  }, [filteredOutwards]);

  const apiRef = useGridApiRef();

  const handleFilterModelChange = () => {
    setTimeout(() => {
      if (apiRef.current) {
        const visibleRows = gridFilteredSortedRowEntriesSelector(apiRef).map(entry => entry.model);
        setDisplayedTotals(calculateTotals(visibleRows));
      }
    }, 0);
  };

  const handleExportPDF = (action = 'download') => {
    const doc = new jsPDF('landscape');
    
    // Add Company Header
    doc.setFontSize(20);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FRM', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Outward', 14, 30);
    
    // Add date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 36);
    
    // Line separator
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 283, 40); // landscape width is 297

    const tableData = filteredOutwards.map(row => [
      row.OUTWARDNO,
      row.OUTWARDDATE ? new Date(row.OUTWARDDATE).toLocaleDateString() : '',
      row.LedgerName || '',
      row.ITEMCODE,
      row.SUBCODE || '-',
      row.ItemName,
      row.UNIT || '',
      row.QUANTITY,
      row.GROSSWT,
      row.NETWT,
      row.RATE,
      row.DISCOUNT ? `${parseFloat(row.DISCOUNT).toFixed(2)}%` : '-',
      row.AMOUNT
    ]);
    
    tableData.push([
      '', '', '', '', '', 'GRAND TOTAL', '', displayedTotals.totalQty.toFixed(2), displayedTotals.totalGrossWt.toFixed(3), displayedTotals.totalNetWt.toFixed(3), '', '', displayedTotals.totalAmount.toFixed(2)
    ]);

    autoTable(doc, {
      head: [['Outward No', 'Date', 'Ledger', 'Item Code', 'Sub Code', 'Item Name', 'Unit', 'Qty', 'Gross Wt', 'Net Wt', 'Rate', 'Disc %', 'Amount']],
      body: tableData,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, halign: 'left' },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 249] },
      margin: { top: 45 },
      didParseCell: function(data) {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [220, 230, 240];
        }
      }
    });

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const reportName = 'OutwardReport';
      
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
      doc.save('outward_report.pdf');
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredOutwards.map(row => ({
      'Outward No': row.OUTWARDNO,
      'Date': row.OUTWARDDATE ? new Date(row.OUTWARDDATE).toLocaleDateString() : '',
      'Ledger Name': row.LedgerName,
      'Item Code': row.ITEMCODE,
      'Sub Code': row.SUBCODE || '-',
      'Item Name': row.ItemName,
      'Unit': row.UNIT,
      'Qty': row.QUANTITY,
      'Gross Wt': row.GROSSWT,
      'Net Wt': row.NETWT,
      'Rate': row.RATE,
      'Disc %': row.DISCOUNT ? `${parseFloat(row.DISCOUNT).toFixed(2)}%` : '',
      'Amount': row.AMOUNT
    }));
    
    exportData.push({
      'Outward No': '',
      'Date': '',
      'Ledger Name': '',
      'Item Code': '',
      'Sub Code': '',
      'Item Name': 'GRAND TOTAL',
      'Unit': '',
      'Qty': displayedTotals.totalQty,
      'Gross Wt': displayedTotals.totalGrossWt,
      'Net Wt': displayedTotals.totalNetWt,
      'Rate': '',
      'Disc %': '',
      'Amount': displayedTotals.totalAmount
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Outward');
    XLSX.writeFile(workbook, 'outward_report.xlsx');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Sales Report
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', width: { xs: '100%', lg: 'auto' } }}>
          <Box sx={{ width: { xs: '100%', sm: 250 } }}>
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

      <Box sx={{ flexGrow: 1, height: 500, width: '100%', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
          <DataGrid
            apiRef={apiRef}
            onFilterModelChange={handleFilterModelChange}
            rows={filteredOutwards}
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
              sorting: {
                sortModel: [{ field: 'OUTWARDNO', sort: 'desc' }],
              },
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
          <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'flex-end', gap: 4, bgcolor: '#f0f4f8', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', borderRadius: '0 0 4px 4px' }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mr: 'auto', color: '#0F3B66' }}>GRAND TOTAL</Typography>
            <Typography variant="subtitle2" fontWeight="bold" color="#0F3B66">Qty: {displayedTotals.totalQty.toFixed(2)}</Typography>
            <Typography variant="subtitle2" fontWeight="bold" color="#0F3B66">Gross Wt: {displayedTotals.totalGrossWt.toFixed(3)}</Typography>
            <Typography variant="subtitle2" fontWeight="bold" color="#0F3B66">Net Wt: {displayedTotals.totalNetWt.toFixed(3)}</Typography>
            <Typography variant="subtitle2" fontWeight="bold" color="#0F3B66">Amount: {displayedTotals.totalAmount.toFixed(2)}</Typography>
          </Box>
          </>
        )}
      </Box>
    
      <PdfPreviewModal 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        pdfUrl={previewUrl} 
        title="Outward Preview" 
      />

      <EInvoiceModal 
        open={einvoiceModalOpen}
        onClose={() => setEinvoiceModalOpen(false)}
        invoice={selectedEinvoiceRow}
        onInvoiceUpdated={handleInvoiceUpdated}
      />
    </Box>
  );
};

export default OutwardReport;
