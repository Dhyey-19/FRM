import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Paper, CircularProgress, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, InputAdornment, Toolbar, TableSortLabel,
  FormControl, InputLabel, Select, MenuItem, IconButton
} from '@mui/material';
import { PictureAsPdf, Visibility, TableView, Share, Search as SearchIcon, KeyboardArrowDown, KeyboardArrowRight, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { hasEditPermission, hasDeletePermission } from '../../utils/auth';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const BOMReport = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const navigate = useNavigate();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bomToDelete, setBomToDelete] = useState(null);

  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('All');
  
  // Sorting states
  const [orderBy, setOrderBy] = useState('Code');
  const [order, setOrder] = useState('asc');

  // Collapse state
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    fetchBOMs();
  }, []);

  const toggleGroup = (code) => {
    setExpandedGroups(prev => ({...prev, [code]: !prev[code]}));
  };

  const handleEdit = (e, parentCode) => {
    e.stopPropagation();
    navigate('/dashboard/bom', { state: { editParentCode: parentCode } });
  };

  const openDeleteConfirm = (e, parentCode) => {
    e.stopPropagation();
    setBomToDelete(parentCode);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    setBomToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const handleDeleteBOM = async () => {
    if (bomToDelete) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bom/${bomToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchBOMs();
          closeDeleteConfirm();
        } else {
          console.error('Error deleting BOM');
        }
      } catch (error) {
        console.error('Error deleting BOM:', error);
      }
    }
  };

  const fetchBOMs = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bom/report`);
      if (!response.ok) throw new Error('Failed to fetch BOM report');
      const data = await response.json();

      // Group the data by ParentItemCode
      const grouped = Object.values(data.reduce((acc, row) => {
        if (!acc[row.ParentItemCode]) {
          acc[row.ParentItemCode] = {
            ParentItemCode: row.ParentItemCode,
            ParentItemName: row.ParentItemName,
            ParentBrandName: row.ParentBrandName || 'N/A',
            ParentTotalCost: 0,
            children: []
          };
        }
        acc[row.ParentItemCode].children.push({
          ChildItemCode: row.ChildItemCode,
          ChildItemName: row.ChildItemName,
          Quantity: row.Quantity,
          ChildCosting: row.ChildCosting,
          TotalChildCost: row.TotalChildCost
        });
        acc[row.ParentItemCode].ParentTotalCost += row.TotalChildCost;
        return acc;
      }, {}));

      setBoms(grouped);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const uniqueBrands = ['All', ...new Set(boms.map(b => b.ParentBrandName))];

  // Apply Filter & Search
  const filteredBoms = boms.filter(group => {
    if (brandFilter !== 'All' && group.ParentBrandName !== brandFilter) {
      return false;
    }
    
    const search = searchTerm.toLowerCase();
    if (group.ParentItemCode.toLowerCase().includes(search) || 
        group.ParentItemName.toLowerCase().includes(search) ||
        group.ParentBrandName.toLowerCase().includes(search)) {
      return true;
    }
    
    return group.children.some(child => 
      child.ChildItemCode.toLowerCase().includes(search) || 
      child.ChildItemName.toLowerCase().includes(search)
    );
  });

  // Apply Sorting
  const sortedBoms = [...filteredBoms].sort((a, b) => {
    let aValue, bValue;
    if (orderBy === 'Code') {
      aValue = a.ParentItemCode; bValue = b.ParentItemCode;
    } else if (orderBy === 'Name') {
      aValue = a.ParentItemName; bValue = b.ParentItemName;
    } else if (orderBy === 'Brand') {
      aValue = a.ParentBrandName; bValue = b.ParentBrandName;
    } else if (orderBy === 'TotalCost') {
      aValue = a.ParentTotalCost; bValue = b.ParentTotalCost;
    } else {
      aValue = a.ParentItemCode; bValue = b.ParentItemCode;
    }

    if (aValue < bValue) return order === 'asc' ? -1 : 1;
    if (aValue > bValue) return order === 'asc' ? 1 : -1;
    return 0;
  });

  const handleExportPDF = (action = 'download') => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FRM', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Bill of Materials (BOM) Grouped Report', 14, 30);
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 36);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40);

    const tableData = [];
    sortedBoms.forEach(group => {
      // Parent Row (Darker background)
      tableData.push([
        { content: `${group.ParentItemCode} - ${group.ParentItemName} (Brand: ${group.ParentBrandName})`, colSpan: 4, styles: { fillColor: [226, 232, 240], fontStyle: 'bold', textColor: [15, 59, 102] } },
        { content: group.ParentTotalCost.toFixed(2), styles: { fillColor: [226, 232, 240], fontStyle: 'bold', textColor: [15, 59, 102], halign: 'right' } }
      ]);
      
      // Child Rows
      group.children.forEach(child => {
        tableData.push([
          `    ${child.ChildItemCode}`, 
          child.ChildItemName, 
          { content: child.Quantity, styles: { halign: 'right' } }, 
          { content: child.ChildCosting.toFixed(2), styles: { halign: 'right' } }, 
          { content: child.TotalChildCost.toFixed(2), styles: { halign: 'right' } }
        ]);
      });
    });
    
    autoTable(doc, {
      head: [['Code', 'Item Name', 'Qty', 'Cost', 'Total']],
      body: tableData,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      margin: { top: 45 }
    });

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const reportName = 'BOMReport';
      
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
      doc.save('bom_grouped_report.pdf');
    }
  };

  const handleExportExcel = () => {
    const flatData = [];
    sortedBoms.forEach(group => {
      flatData.push({
        'Level': 'Finished Good',
        'Code': group.ParentItemCode,
        'Name': group.ParentItemName,
        'Brand': group.ParentBrandName,
        'Quantity': '',
        'Costing': '',
        'Total Cost': group.ParentTotalCost.toFixed(2)
      });
      group.children.forEach(child => {
        flatData.push({
          'Level': 'Raw Material',
          'Code': child.ChildItemCode,
          'Name': child.ChildItemName,
          'Brand': '-',
          'Quantity': child.Quantity,
          'Costing': child.ChildCosting.toFixed(2),
          'Total Cost': child.TotalChildCost.toFixed(2)
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'BOM Report');
    XLSX.writeFile(workbook, 'bom_grouped_report.xlsx');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Bill of Materials (BOM)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          <Button variant="outlined" startIcon={<TableView />} onClick={handleExportExcel} sx={{ color: '#107c41', borderColor: '#107c41', flex: { xs: 1, sm: 'none' } }}>
            Export Excel
          </Button>
          <Button variant="outlined" startIcon={<Visibility />} onClick={() => handleExportPDF('preview')} sx={{ color: '#0F3B66', borderColor: '#0F3B66', flex: { xs: 1, sm: 'none' } }}>
            Preview PDF
          </Button>
          <Button variant="outlined" startIcon={<PictureAsPdf />} onClick={() => handleExportPDF('download')} sx={{ color: '#d32f2f', borderColor: '#d32f2f', flex: { xs: 1, sm: 'none' } }}>
            Export PDF
          </Button>
          <Button variant="contained" startIcon={<Share />} onClick={() => handleExportPDF('share')} sx={{ bgcolor: 'secondary.main', flex: { xs: 1, sm: 'none' } }}>
            Share
          </Button>
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1, width: '100%' }}>
        <Toolbar sx={{ pl: { xs: 1.5, sm: 2 }, pr: { xs: 1.5, sm: 2 }, pt: 2, pb: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search all items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: { xs: '100%', sm: 300 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ width: '300px' }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Filter by Brand</InputLabel>
            <Select
              value={brandFilter}
              label="Filter by Brand"
              onChange={(e) => setBrandFilter(e.target.value)}
            >
              {uniqueBrands.map(brand => (
                <MenuItem key={brand} value={brand}>{brand}</MenuItem>
              ))}
            </Select>
          </FormControl>
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
              '& .MuiTableRow-root': { height: 32 },
              '& .MuiTableCell-head': {
                py: 0.5,
                lineHeight: '1.2'
              },
              '& .MuiTableCell-root': { 
                borderRight: '1px solid #e0e0e0',
                borderBottom: '1px solid #e0e0e0'
              },
              '& .MuiTableCell-root:last-child': {
                borderRight: 'none'
              }
            }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ backgroundColor: '#0F3B66', width: '25%' }}>
                    <TableSortLabel
                      active={orderBy === 'Code'}
                      direction={orderBy === 'Code' ? order : 'asc'}
                      onClick={() => handleRequestSort('Code')}
                      sx={{ color: '#ffffff !important', fontWeight: 'bold', '& .MuiTableSortLabel-icon': { color: '#ffffff !important' } }}
                    >
                      Code
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#0F3B66', width: '35%' }}>
                    <TableSortLabel
                      active={orderBy === 'Name'}
                      direction={orderBy === 'Name' ? order : 'asc'}
                      onClick={() => handleRequestSort('Name')}
                      sx={{ color: '#ffffff !important', fontWeight: 'bold', '& .MuiTableSortLabel-icon': { color: '#ffffff !important' } }}
                    >
                      Item Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sx={{ backgroundColor: '#0F3B66', width: '10%' }}>
                    <Typography sx={{ color: '#ffffff', fontWeight: 'bold', fontSize: '0.875rem' }}>Quantity</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ backgroundColor: '#0F3B66', width: '15%' }}>
                    <Typography sx={{ color: '#ffffff', fontWeight: 'bold', fontSize: '0.875rem' }}>Costing</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ backgroundColor: '#0F3B66', width: '15%' }}>
                    <TableSortLabel
                      active={orderBy === 'TotalCost'}
                      direction={orderBy === 'TotalCost' ? order : 'asc'}
                      onClick={() => handleRequestSort('TotalCost')}
                      sx={{ color: '#ffffff !important', fontWeight: 'bold', '& .MuiTableSortLabel-icon': { color: '#ffffff !important' } }}
                    >
                      Total Cost
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center" sx={{ backgroundColor: '#0F3B66', width: '10%' }}>
                    <Typography sx={{ color: '#ffffff', fontWeight: 'bold', fontSize: '0.875rem' }}>Actions</Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedBoms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      No BOM records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedBoms.map((group) => (
                    <React.Fragment key={group.ParentItemCode}>
                      {/* Parent Group Header Row */}
                      <TableRow 
                        onClick={() => toggleGroup(group.ParentItemCode)}
                        sx={{ backgroundColor: '#e2e8f0', '&:hover': { backgroundColor: '#cbd5e1' }, cursor: 'pointer' }}
                      >
                        <TableCell colSpan={4} sx={{ fontWeight: 'bold', color: '#0f3b66', fontSize: '0.95rem' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {expandedGroups[group.ParentItemCode] ? <KeyboardArrowDown sx={{ mr: 1 }} /> : <KeyboardArrowRight sx={{ mr: 1 }} />}
                            {group.ParentItemCode} - {group.ParentItemName} <Typography component="span" sx={{ color: '#64748b', ml: 1, fontSize: '0.85rem' }}>(Brand: {group.ParentBrandName})</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f', fontSize: '0.95rem' }}>
                          ₹{group.ParentTotalCost.toFixed(2)}
                        </TableCell>
                        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
                            <IconButton color="primary" size="small" onClick={(e) => handleEdit(e, group.ParentItemCode)} disabled={!hasEditPermission()}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton color="error" size="small" onClick={(e) => openDeleteConfirm(e, group.ParentItemCode)} disabled={!hasDeletePermission()}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                      
                      {/* Child Rows */}
                      {expandedGroups[group.ParentItemCode] && group.children.map((child) => (
                        <TableRow hover key={`${group.ParentItemCode}_${child.ChildItemCode}`}>
                          <TableCell sx={{ pl: 4, color: 'text.secondary' }}>
                            {child.ChildItemCode}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>
                            {child.ChildItemName}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>
                            {child.Quantity}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>
                            {parseFloat(child.ChildCosting).toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>
                            {parseFloat(child.TotalChildCost).toFixed(2)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))
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
        title="B O M Preview" 
      />

      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={closeDeleteConfirm}
        onConfirm={handleDeleteBOM}
        title="Confirm Deletion"
        itemName="this BOM"
      />
    </Box>
  );
};

export default BOMReport;
