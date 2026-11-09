import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Button, CircularProgress, TextField } from '@mui/material';
import { DataGrid, GridToolbar, useGridApiRef, gridFilteredSortedRowEntriesSelector } from '@mui/x-data-grid';
import { PictureAsPdf, Visibility, TableView, Share } from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ensureNumericWorksheet } from '../../utils/excelHelper';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const ItemwiseOutwardReport = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [outwards, setOutwards] = useState([]);
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

  const fetchOutwards = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/outwards/report`);
      if (!response.ok) throw new Error('Failed to fetch outward report');
      const data = await response.json();
      setOutwards(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutwards();
  }, []);

  const aggregatedData = useMemo(() => {
    const filtered = outwards.filter(row => {
      if (!row.OUTWARDDATE) return true;
      const rowDate = new Date(row.OUTWARDDATE);
      rowDate.setHours(0, 0, 0, 0);
      const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
      const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

      const isAfterFrom = start ? rowDate.getTime() >= start : true;
      const isBeforeTo = end ? rowDate.getTime() <= end : true;
      
      return isAfterFrom && isBeforeTo;
    });

    const itemMap = new Map();
    
    filtered.forEach(row => {
      const itemCode = row.ITEMCODE || 'Unknown';
      const subCode = row.SUBCODE || '';
      const mapKey = `${itemCode}__${subCode}`;
      if (!itemMap.has(mapKey)) {
        itemMap.set(mapKey, {
          id: mapKey,
          ITEMCODE: itemCode,
          SUBCODE: subCode,
          ItemName: row.ItemName || 'Unknown Item',
          UNIT: row.UNIT || '-',
          QUANTITY: 0,
          GROSSWT: 0,
          NETWT: 0,
          AMOUNT: 0
        });
      }
      const itemAgg = itemMap.get(mapKey);
      itemAgg.QUANTITY += parseFloat(row.QUANTITY) || 0;
      itemAgg.GROSSWT += parseFloat(row.GROSSWT) || 0;
      itemAgg.NETWT += parseFloat(row.NETWT) || 0;
      itemAgg.AMOUNT += parseFloat(row.AMOUNT) || 0;
    });

    return Array.from(itemMap.values()).sort((a, b) => a.ItemName.localeCompare(b.ItemName));
  }, [outwards, startDate, endDate]);

  const columns = [
    { field: 'ITEMCODE', headerName: 'Item Code', width: 130 },
    { field: 'SUBCODE', headerName: 'Sub Code', width: 110, valueGetter: (value, row) => row?.SUBCODE || '-' },
    { field: 'ItemName', headerName: 'Item Name', flex: 1 },
    { field: 'UNIT', headerName: 'Unit', width: 100 },
    { field: 'QUANTITY', headerName: 'Total Qty', width: 130, type: 'number', valueFormatter: (val) => val?.toFixed(2) },
    { field: 'GROSSWT', headerName: 'Total Gross Wt', width: 130, type: 'number', valueFormatter: (val) => val?.toFixed(3) },
    { field: 'NETWT', headerName: 'Total Net Wt', width: 130, type: 'number', valueFormatter: (val) => val?.toFixed(3) },
    { field: 'AMOUNT', headerName: 'Total Amount', width: 150, type: 'number', valueFormatter: (val) => val?.toFixed(2) },
  ];

  const calculateTotals = (rows) => ({
    totalQty: rows.reduce((sum, row) => sum + (parseFloat(row.QUANTITY) || 0), 0),
    totalGrossWt: rows.reduce((sum, row) => sum + (parseFloat(row.GROSSWT) || 0), 0),
    totalNetWt: rows.reduce((sum, row) => sum + (parseFloat(row.NETWT) || 0), 0),
    totalAmount: rows.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0),
  });

  const [displayedTotals, setDisplayedTotals] = useState({ totalQty: 0, totalGrossWt: 0, totalNetWt: 0, totalAmount: 0 });

  useEffect(() => {
    setDisplayedTotals(calculateTotals(aggregatedData));
  }, [aggregatedData]);

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
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FRM', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Item-wise Sales Report', 14, 30);
    
    doc.setFontSize(10);
    const dateStr = (startDate && endDate) 
      ? `Date Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
      : `Generated on: ${new Date().toLocaleDateString()}`;
    doc.text(dateStr, 14, 36);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40); 

    const tableData = aggregatedData.map(row => [
      row.ITEMCODE,
      row.SUBCODE || '-',
      row.ItemName,
      row.UNIT,
      row.QUANTITY.toFixed(2),
      row.GROSSWT.toFixed(3),
      row.NETWT.toFixed(3),
      row.AMOUNT.toFixed(2)
    ]);
    
    tableData.push([
      '', '', 'GRAND TOTAL', '', displayedTotals.totalQty.toFixed(2), displayedTotals.totalGrossWt.toFixed(3), displayedTotals.totalNetWt.toFixed(3), displayedTotals.totalAmount.toFixed(2)
    ]);

    autoTable(doc, {
      head: [['Item Code', 'Sub Code', 'Item Name', 'Unit', 'Total Qty', 'Gross Wt', 'Net Wt', 'Total Amount']],
      body: tableData,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 249] },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' }
      },
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
      const reportName = 'ItemwiseSalesReport';
      
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
      doc.save('Itemwise_Sales_Report.pdf');
    }
  };

  const handleExportExcel = () => {
    const exportData = aggregatedData.map(row => ({
      'Item Code': row.ITEMCODE,
      'Sub Code': row.SUBCODE || '-',
      'Item Name': row.ItemName,
      'Unit': row.UNIT,
      'Total Qty': Number(row.QUANTITY) || 0,
      'Total Gross Wt': Number(row.GROSSWT) || 0,
      'Total Net Wt': Number(row.NETWT) || 0,
      'Total Amount': Number(row.AMOUNT) || 0
    }));
    exportData.push({
      'Item Code': '',
      'Sub Code': '',
      'Item Name': 'GRAND TOTAL',
      'Unit': '',
      'Total Qty': Number(displayedTotals.totalQty) || 0,
      'Total Gross Wt': Number(displayedTotals.totalGrossWt) || 0,
      'Total Net Wt': Number(displayedTotals.totalNetWt) || 0,
      'Total Amount': Number(displayedTotals.totalAmount) || 0
    });
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    ensureNumericWorksheet(ws);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Itemwise Sales');
    XLSX.writeFile(wb, 'Itemwise_Sales_Report.xlsx');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Item-wise Sales Report
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
            rows={aggregatedData}
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
              '& .even-row': {
                backgroundColor: '#fafafa',
              },
              '& .odd-row': {
                backgroundColor: '#ffffff',
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: '#e3f2fd',
              }
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
      />
    </Box>
  );
};

export default ItemwiseOutwardReport;
