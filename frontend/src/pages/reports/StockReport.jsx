import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Paper, CircularProgress, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, InputAdornment, Toolbar, TableSortLabel,
  ToggleButton, ToggleButtonGroup,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { PictureAsPdf, Visibility, TableView, Share, Search as SearchIcon } from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const StockReport = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [reportType, setReportType] = useState('item'); // 'item' or 'department'
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  
  // Sorting states
  const [orderBy, setOrderBy] = useState('ItemCode');
  const [order, setOrder] = useState('asc');

  useEffect(() => {
    fetchData();
  }, [reportType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = reportType === 'item' 
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/departments/stock`;
      
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch stock report');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReportTypeChange = (event, newType) => {
    if (newType !== null) {
      setReportType(newType);
      setSearchTerm('');
      setTypeFilter('All');
      setBrandFilter('All');
      setDeptFilter('All');
      setOrderBy(newType === 'item' ? 'ItemCode' : 'DeptName');
    }
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // Unique filter lists
  const uniqueTypes = ['All', ...new Set(data.map(d => d.ItemType).filter(Boolean))];
  const uniqueBrands = ['All', ...new Set(data.map(d => d.Series).filter(Boolean))];
  const uniqueDepts = ['All', ...new Set(data.map(d => d.DeptName).filter(Boolean))];

  // Filter Data
  const filteredData = data.filter(row => {
    // Dropdown filters
    if (reportType === 'item') {
      if (typeFilter !== 'All' && row.ItemType !== typeFilter) return false;
      if (brandFilter !== 'All' && row.Series !== brandFilter) return false;
    } else {
      if (deptFilter !== 'All' && row.DeptName !== deptFilter) return false;
    }

    // Search term
    const search = searchTerm.toLowerCase();
    if (!search) return true;
    
    if (reportType === 'item') {
      return (row.ItemCode?.toLowerCase().includes(search) || 
              row.ItemName?.toLowerCase().includes(search) ||
              row.ItemType?.toLowerCase().includes(search) ||
              row.Series?.toLowerCase().includes(search));
    } else {
      return (row.DeptName?.toLowerCase().includes(search) || 
              row.ItemCode?.toLowerCase().includes(search) ||
              row.ItemName?.toLowerCase().includes(search));
    }
  });

  // Sort Data
  const sortedData = [...filteredData].sort((a, b) => {
    let aValue = a[orderBy] || '';
    let bValue = b[orderBy] || '';

    // Handle numeric sorting
    if (['MRP', 'Costing', 'OpeningStock', 'ClosingStock', 'Pcs', 'Weight'].includes(orderBy)) {
      aValue = parseFloat(aValue) || 0;
      bValue = parseFloat(bValue) || 0;
    } else {
      aValue = aValue.toString().toLowerCase();
      bValue = bValue.toString().toLowerCase();
    }

    if (aValue < bValue) return order === 'asc' ? -1 : 1;
    if (aValue > bValue) return order === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate Totals
  const totalOpening = sortedData.reduce((sum, row) => sum + (parseFloat(row.OpeningStock) || 0), 0);
  const totalClosing = sortedData.reduce((sum, row) => sum + (parseFloat(row.ClosingStock) || 0), 0);
  const totalPcs = sortedData.reduce((sum, row) => sum + (parseFloat(row.Pcs) || 0), 0);
  const totalWeight = sortedData.reduce((sum, row) => sum + (parseFloat(row.Weight) || 0), 0);

  const handleExportPDF = (action = 'download') => {
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(20);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FactoryFlow', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    const title = reportType === 'item' ? 'Item Stock Report' : 'Department Stock Report';
    doc.text(title, 14, 30);
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 36);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 280, 40);

    const tableData = [];
    let head = [];

    if (reportType === 'item') {
      head = [['Code', 'Name', 'Type', 'Series', 'Unit', 'MRP', 'Costing', 'Opening', 'Closing']];
      sortedData.forEach(row => {
        tableData.push([
          row.ItemCode, 
          row.ItemName, 
          row.ItemType || '-', 
          row.Series || '-', 
          row.Unit || '-', 
          row.MRP?.toFixed(2) || '0.00', 
          row.Costing?.toFixed(2) || '0.00', 
          row.OpeningStock || 0, 
          row.ClosingStock || 0
        ]);
      });
      if (sortedData.length > 0) {
        tableData.push([
          { content: 'Total:', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', textColor: [15, 59, 102] } },
          { content: totalOpening, styles: { fontStyle: 'bold', textColor: [211, 47, 47] } },
          { content: totalClosing, styles: { fontStyle: 'bold', textColor: [211, 47, 47] } }
        ]);
      }
    } else {
      head = [['Department', 'Code', 'Item Name', 'Pcs', 'Weight']];
      sortedData.forEach(row => {
        tableData.push([
          row.DeptName, 
          row.ItemCode, 
          row.ItemName || '-', 
          row.Pcs || 0, 
          row.Weight || 0
        ]);
      });
      if (sortedData.length > 0) {
        tableData.push([
          { content: 'Total:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', textColor: [15, 59, 102] } },
          { content: totalPcs, styles: { fontStyle: 'bold', textColor: [211, 47, 47] } },
          { content: totalWeight, styles: { fontStyle: 'bold', textColor: [211, 47, 47] } }
        ]);
      }
    }
    
    autoTable(doc, {
      head: head,
      body: tableData,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      margin: { top: 45 }
    });

    const filename = reportType === 'item' ? 'item_stock_report.pdf' : 'department_stock_report.pdf';

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const reportName = typeof filename !== 'undefined' ? filename.replace('.pdf', '') : 'StockReport';
      
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
      doc.save(filename);
    }
  };

  const handleExportExcel = () => {
    const flatData = [];
    if (reportType === 'item') {
      sortedData.forEach(row => {
        flatData.push({
          'Code': row.ItemCode,
          'Item Name': row.ItemName,
          'Type': row.ItemType || '-',
          'Series': row.Series || '-',
          'Unit': row.Unit || '-',
          'MRP': row.MRP || 0,
          'Costing': row.Costing || 0,
          'Opening Stock': row.OpeningStock || 0,
          'Closing Stock': row.ClosingStock || 0
        });
      });
      if (sortedData.length > 0) {
        flatData.push({
          'Code': '', 'Item Name': '', 'Type': '', 'Series': '', 'Unit': '', 'MRP': '', 'Costing': 'Total:',
          'Opening Stock': totalOpening,
          'Closing Stock': totalClosing
        });
      }
    } else {
      sortedData.forEach(row => {
        flatData.push({
          'Department': row.DeptName,
          'Code': row.ItemCode,
          'Item Name': row.ItemName || '-',
          'Pcs': row.Pcs || 0,
          'Weight': row.Weight || 0
        });
      });
      if (sortedData.length > 0) {
        flatData.push({
          'Department': '', 'Code': '', 'Item Name': 'Total:',
          'Pcs': totalPcs,
          'Weight': totalWeight
        });
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    const sheetName = reportType === 'item' ? 'Item Stock' : 'Department Stock';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const filename = reportType === 'item' ? 'item_stock_report.xlsx' : 'department_stock_report.xlsx';
    XLSX.writeFile(workbook, filename);
  };

  const SortableTableCell = ({ label, property, align = 'left', width }) => (
    <TableCell align={align} sx={{ backgroundColor: '#0F3B66', width, py: 0.5 }}>
      <TableSortLabel
        active={orderBy === property}
        direction={orderBy === property ? order : 'asc'}
        onClick={() => handleRequestSort(property)}
        sx={{ color: '#ffffff !important', fontWeight: 'bold', '& .MuiTableSortLabel-icon': { color: '#ffffff !important' } }}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Stock
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<TableView />} onClick={handleExportExcel} sx={{ color: '#107c41', borderColor: '#107c41' }}>
            Export Excel
          </Button>
          <Button variant="outlined" startIcon={<Visibility />} onClick={() => handleExportPDF('preview')} sx={{ color: '#0F3B66', borderColor: '#0F3B66' }}>
            Preview PDF
          </Button>
          <Button variant="outlined" startIcon={<PictureAsPdf />} onClick={() => handleExportPDF('download')} sx={{ color: '#d32f2f', borderColor: '#d32f2f' }}>
            Export PDF
          </Button>
          <Button variant="contained" startIcon={<Share />} onClick={() => handleExportPDF('share')} sx={{ bgcolor: 'secondary.main' }}>
            Share
          </Button>
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1, width: '100%' }}>
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 2 }, pt: 2, pb: 2, display: 'flex', gap: 3, alignItems: 'center', backgroundColor: '#f8fafc', borderBottom: '1px solid #e0e0e0' }}>
          
          <ToggleButtonGroup
            color="primary"
            value={reportType}
            exclusive
            onChange={handleReportTypeChange}
            size="small"
            sx={{ backgroundColor: '#fff' }}
          >
            <ToggleButton value="item" sx={{ px: 3, fontWeight: 600 }}>Item Stock</ToggleButton>
            <ToggleButton value="department" sx={{ px: 3, fontWeight: 600 }}>Department Stock</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            size="small"
            placeholder="Search report..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ width: '300px', backgroundColor: '#fff', borderRadius: 1 }}
          />

          {reportType === 'item' ? (
            <>
              <FormControl size="small" sx={{ minWidth: 150, backgroundColor: '#fff', borderRadius: 1 }}>
                <InputLabel>Type</InputLabel>
                <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value)}>
                  {uniqueTypes.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150, backgroundColor: '#fff', borderRadius: 1 }}>
                <InputLabel>Series</InputLabel>
                <Select value={brandFilter} label="Series" onChange={(e) => setBrandFilter(e.target.value)}>
                  {uniqueBrands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                </Select>
              </FormControl>
            </>
          ) : (
            <FormControl size="small" sx={{ minWidth: 200, backgroundColor: '#fff', borderRadius: 1 }}>
              <InputLabel>Department</InputLabel>
              <Select value={deptFilter} label="Department" onChange={(e) => setDeptFilter(e.target.value)}>
                {uniqueDepts.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </Select>
            </FormControl>
          )}

        </Toolbar>

        <TableContainer sx={{ maxHeight: 600 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table stickyHeader size="small" sx={{ 
              minWidth: 750, 
              border: '1px solid #e0e0e0',
              '& .MuiTableRow-root': { height: 40 },
              '& .MuiTableCell-head': { py: 0.5, lineHeight: '1.2' },
              '& .MuiTableCell-root': { borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0' }
            }}>
              <TableHead>
                <TableRow>
                  {reportType === 'item' ? (
                    <>
                      <SortableTableCell label="Code" property="ItemCode" width="10%" />
                      <SortableTableCell label="Item Name" property="ItemName" width="20%" />
                      <SortableTableCell label="Type" property="ItemType" width="10%" />
                      <SortableTableCell label="Series" property="Series" width="10%" />
                      <SortableTableCell label="Unit" property="Unit" width="10%" />
                      <SortableTableCell label="MRP" property="MRP" align="right" width="10%" />
                      <SortableTableCell label="Costing" property="Costing" align="right" width="10%" />
                      <SortableTableCell label="Opening" property="OpeningStock" align="right" width="10%" />
                      <SortableTableCell label="Closing" property="ClosingStock" align="right" width="10%" />
                    </>
                  ) : (
                    <>
                      <SortableTableCell label="Department" property="DeptName" width="25%" />
                      <SortableTableCell label="Code" property="ItemCode" width="15%" />
                      <SortableTableCell label="Item Name" property="ItemName" width="30%" />
                      <SortableTableCell label="Pcs" property="Pcs" align="right" width="15%" />
                      <SortableTableCell label="Weight" property="Weight" align="right" width="15%" />
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={reportType === 'item' ? 9 : 5} align="center" sx={{ py: 3 }}>
                      No records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((row, index) => (
                    <TableRow hover key={index}>
                      {reportType === 'item' ? (
                        <>
                          <TableCell sx={{ fontWeight: 500 }}>{row.ItemCode}</TableCell>
                          <TableCell>{row.ItemName}</TableCell>
                          <TableCell>{row.ItemType || '-'}</TableCell>
                          <TableCell>{row.Series || '-'}</TableCell>
                          <TableCell>{row.Unit || '-'}</TableCell>
                          <TableCell align="right">{row.MRP || 0}</TableCell>
                          <TableCell align="right">{row.Costing || 0}</TableCell>
                          <TableCell align="right">{row.OpeningStock || 0}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: '#0F3B66' }}>{row.ClosingStock || 0}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell sx={{ fontWeight: 500 }}>{row.DeptName}</TableCell>
                          <TableCell>{row.ItemCode}</TableCell>
                          <TableCell>{row.ItemName || '-'}</TableCell>
                          <TableCell align="right">{row.Pcs || 0}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: '#0F3B66' }}>{row.Weight || 0}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
                {sortedData.length > 0 && (
                  <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                    {reportType === 'item' ? (
                      <>
                        <TableCell colSpan={7} sx={{ fontWeight: 'bold', textAlign: 'right', color: '#0F3B66' }}>Total:</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>{totalOpening}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>{totalClosing}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell colSpan={3} sx={{ fontWeight: 'bold', textAlign: 'right', color: '#0F3B66' }}>Total:</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>{totalPcs}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>{totalWeight}</TableCell>
                      </>
                    )}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Box>
    
      <PdfPreviewModal 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        pdfUrl={previewUrl} 
        title="Stock Preview" 
      />
    </Box>
  );
};

export default StockReport;
