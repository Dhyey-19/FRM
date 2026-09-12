import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  CircularProgress, 
  ToggleButtonGroup, 
  ToggleButton, 
  Grid, 
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
  ArrowBack,
  Schedule 
} from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const ReceivableReport = () => {
  const navigate = useNavigate();
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [receivables, setReceivables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('combined'); // 'combined', 'with_bill', 'without_bill', 'all_columns'

  const fetchReceivables = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers/receivable`);
      if (!response.ok) throw new Error('Failed to fetch receivable report');
      const data = await response.json();
      setReceivables(data.map(item => ({ ...item, id: item.RowId })));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceivables();
  }, []);

  // Summary KPI Calculations
  const summaryKPIs = useMemo(() => {
    let totalCombined = 0;
    let totalWithBill = 0;
    let totalWithoutBill = 0;

    receivables.forEach(row => {
      totalCombined += parseFloat(row.ReceivableCombined) || 0;
      totalWithBill += parseFloat(row.ReceivableWithBill) || 0;
      totalWithoutBill += parseFloat(row.ReceivableWithoutBill) || 0;
    });

    return { totalCombined, totalWithBill, totalWithoutBill };
  }, [receivables]);

  // Filter rows based on viewMode
  const filteredRows = useMemo(() => {
    if (viewMode === 'with_bill') {
      return receivables.filter(r => Math.abs(parseFloat(r.ReceivableWithBill) || 0) > 0.001);
    } else if (viewMode === 'without_bill') {
      return receivables.filter(r => Math.abs(parseFloat(r.ReceivableWithoutBill) || 0) > 0.001);
    } else if (viewMode === 'combined') {
      return receivables.filter(r => (parseFloat(r.ReceivableCombined) || 0) > 0);
    }
    // all_columns
    return receivables;
  }, [receivables, viewMode]);

  // Dynamic DataGrid Columns
  const columns = useMemo(() => {
    const actionColumn = {
      field: 'action',
      headerName: 'Ledger',
      width: 110,
      sortable: false,
      renderCell: (params) => (
        <Button
          variant="outlined"
          size="small"
          color="primary"
          onClick={() => navigate('/dashboard/reports/account-ledger', { state: { ledgerId: params.row.RowId } })}
          sx={{ textTransform: 'none', px: 1, py: 0.2, fontSize: '0.75rem', borderRadius: 1.5 }}
        >
          View Ledger
        </Button>
      )
    };

    if (viewMode === 'with_bill') {
      return [
        { field: 'RowId', headerName: 'Ledger ID', width: 90 },
        { field: 'PartyName', headerName: 'Party Name', flex: 1 },
        { field: 'MobileNo', headerName: 'Mobile No', width: 130, valueGetter: (val, row) => row.MobileNo || '-' },
        { 
          field: 'ReceivableWithBill', 
          headerName: 'With Bill Receivable (₹)', 
          width: 210, 
          type: 'number',
          renderCell: (params) => {
            const val = parseFloat(params.value || 0);
            return (
              <Typography variant="body2" sx={{ fontWeight: 700, color: val < 0 ? '#dc2626' : '#0F3B66' }}>
                ₹ {val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {val < 0 && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>(Cr)</span>}
              </Typography>
            );
          }
        },
        actionColumn
      ];
    } else if (viewMode === 'without_bill') {
      return [
        { field: 'RowId', headerName: 'Ledger ID', width: 90 },
        { field: 'PartyName', headerName: 'Party Name', flex: 1 },
        { field: 'MobileNo', headerName: 'Mobile No', width: 130, valueGetter: (val, row) => row.MobileNo || '-' },
        { 
          field: 'ReceivableWithoutBill', 
          headerName: 'Without Bill Receivable (₹)', 
          width: 220, 
          type: 'number',
          renderCell: (params) => {
            const val = parseFloat(params.value || 0);
            return (
              <Typography variant="body2" sx={{ fontWeight: 700, color: val < 0 ? '#dc2626' : '#b45309' }}>
                ₹ {val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {val < 0 && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>(Cr)</span>}
              </Typography>
            );
          }
        },
        actionColumn
      ];
    } else if (viewMode === 'all_columns') {
      return [
        { field: 'RowId', headerName: 'Ledger ID', width: 90 },
        { field: 'PartyName', headerName: 'Party Name', flex: 1 },
        { field: 'MobileNo', headerName: 'Mobile No', width: 130, valueGetter: (val, row) => row.MobileNo || '-' },
        { 
          field: 'ReceivableWithBill', 
          headerName: 'With Bill (₹)', 
          width: 150, 
          type: 'number',
          renderCell: (params) => {
            const val = parseFloat(params.value || 0);
            return (
              <Typography variant="body2" sx={{ fontWeight: 600, color: val < 0 ? '#dc2626' : '#0F3B66' }}>
                ₹ {val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {val < 0 && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>(Cr)</span>}
              </Typography>
            );
          }
        },
        { 
          field: 'ReceivableWithoutBill', 
          headerName: 'Without Bill (₹)', 
          width: 150, 
          type: 'number',
          renderCell: (params) => {
            const val = parseFloat(params.value || 0);
            return (
              <Typography variant="body2" sx={{ fontWeight: 600, color: val < 0 ? '#dc2626' : '#b45309' }}>
                ₹ {val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {val < 0 && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>(Cr)</span>}
              </Typography>
            );
          }
        },
        { 
          field: 'ReceivableCombined', 
          headerName: 'Combined Total (₹)', 
          width: 180, 
          type: 'number',
          renderCell: (params) => (
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#166534' }}>
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
      { field: 'PartyName', headerName: 'Party Name', flex: 1 },
      { field: 'MobileNo', headerName: 'Mobile No', width: 130, valueGetter: (val, row) => row.MobileNo || '-' },
      { 
        field: 'ReceivableCombined', 
        headerName: 'Combined Receivable (₹)', 
        width: 200, 
        type: 'number',
        renderCell: (params) => (
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#166534' }}>
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
    doc.text(localUser.companyName || 'FactoryFlow', 14, 18);
    
    doc.setFontSize(13);
    doc.setTextColor(60);
    const viewTitle = viewMode === 'with_bill' ? 'Receivable Report (With Bill)' :
                      viewMode === 'without_bill' ? 'Receivable Report (Without Bill)' :
                      viewMode === 'all_columns' ? 'Receivable Report (All Columns Breakdown)' :
                      'Receivable Report (Combined)';
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
      head = [['ID', 'Party Name', 'Mobile No', 'With Bill Receivable (Rs.)']];
      tableData = filteredRows.map(r => [
        r.RowId,
        r.PartyName,
        r.MobileNo || '-',
        parseFloat(r.ReceivableWithBill || 0).toFixed(2)
      ]);
      tableData.push(['', 'TOTAL', '', summaryKPIs.totalWithBill.toFixed(2)]);
    } else if (viewMode === 'without_bill') {
      head = [['ID', 'Party Name', 'Mobile No', 'Without Bill Receivable (Rs.)']];
      tableData = filteredRows.map(r => [
        r.RowId,
        r.PartyName,
        r.MobileNo || '-',
        parseFloat(r.ReceivableWithoutBill || 0).toFixed(2)
      ]);
      tableData.push(['', 'TOTAL', '', summaryKPIs.totalWithoutBill.toFixed(2)]);
    } else if (viewMode === 'all_columns') {
      head = [['ID', 'Party Name', 'Mobile No', 'With Bill (Rs.)', 'Without Bill (Rs.)', 'Combined Total (Rs.)']];
      tableData = filteredRows.map(r => [
        r.RowId,
        r.PartyName,
        r.MobileNo || '-',
        parseFloat(r.ReceivableWithBill || 0).toFixed(2),
        parseFloat(r.ReceivableWithoutBill || 0).toFixed(2),
        parseFloat(r.ReceivableCombined || 0).toFixed(2)
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
      head = [['ID', 'Party Name', 'Mobile No', 'Combined Receivable (Rs.)']];
      tableData = filteredRows.map(r => [
        r.RowId,
        r.PartyName,
        r.MobileNo || '-',
        parseFloat(r.ReceivableCombined || 0).toFixed(2)
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
      const reportName = `ReceivableReport_${viewMode}`;
      
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
      doc.save(`receivable_report_${viewMode}.pdf`);
    }
  };

  const handleExportExcel = () => {
    let exportData = [];

    if (viewMode === 'with_bill') {
      exportData = filteredRows.map(row => ({
        'Ledger ID': row.RowId,
        'Party Name': row.PartyName,
        'Mobile No': row.MobileNo || '-',
        'With Bill Receivable (Rs.)': parseFloat(row.ReceivableWithBill || 0).toFixed(2)
      }));
    } else if (viewMode === 'without_bill') {
      exportData = filteredRows.map(row => ({
        'Ledger ID': row.RowId,
        'Party Name': row.PartyName,
        'Mobile No': row.MobileNo || '-',
        'Without Bill Receivable (Rs.)': parseFloat(row.ReceivableWithoutBill || 0).toFixed(2)
      }));
    } else if (viewMode === 'all_columns') {
      exportData = filteredRows.map(row => ({
        'Ledger ID': row.RowId,
        'Party Name': row.PartyName,
        'Mobile No': row.MobileNo || '-',
        'With Bill Receivable (Rs.)': parseFloat(row.ReceivableWithBill || 0).toFixed(2),
        'Without Bill Receivable (Rs.)': parseFloat(row.ReceivableWithoutBill || 0).toFixed(2),
        'Combined Receivable (Rs.)': parseFloat(row.ReceivableCombined || 0).toFixed(2)
      }));
    } else {
      exportData = filteredRows.map(row => ({
        'Ledger ID': row.RowId,
        'Party Name': row.PartyName,
        'Mobile No': row.MobileNo || '-',
        'Combined Receivable (Rs.)': parseFloat(row.ReceivableCombined || 0).toFixed(2)
      }));
    }
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Receivable');
    XLSX.writeFile(workbook, `receivable_report_${viewMode}.xlsx`);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Receivable Report
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button 
            variant="contained" 
            startIcon={<Schedule />}
            onClick={() => navigate('/dashboard/reports/invoice-receivable')}
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
                🧾 WITH BILL RECEIVABLE
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
                📋 WITHOUT BILL RECEIVABLE
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
                🌐 COMBINED NET RECEIVABLE
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#14532d', mt: 0.5 }}>
                ₹ {summaryKPIs.totalCombined.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
              <Typography variant="caption" sx={{ color: '#166534', fontSize: '0.7rem', display: 'block', mt: 0.25 }}>
                ✓ With Bill + Without Bill = Combined Total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Toolbar & View Filter */}
      <Paper sx={{ p: 1.5, mb: 2, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
          Showing {filteredRows.length} {filteredRows.length === 1 ? 'Party' : 'Parties'}
        </Typography>

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, nextMode) => { if (nextMode) setViewMode(nextMode); }}
          size="small"
        >
          <ToggleButton value="combined" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5 }}>
            <Tooltip title="Combined receivable per party">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ReceiptLong fontSize="small" /> Combined
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="with_bill" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5 }}>
            <Tooltip title="Only With Bill (Official) receivable">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Receipt fontSize="small" color="primary" /> With Bill
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="without_bill" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5 }}>
            <Tooltip title="Only Without Bill (Cash) receivable">
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
    
      <PdfPreviewModal 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        pdfUrl={previewUrl} 
        title="Receivable Report Preview" 
      />
    </Box>
  );
};

export default ReceivableReport;
