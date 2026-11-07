import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, 
  Typography, 
  Paper, 
  Toolbar, 
  Button, 
  TextField, 
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Alert,
  Autocomplete,
  TableSortLabel,
  LinearProgress,
  Tabs,
  Tab,
  MenuItem,
  Chip
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  FileDownload as ExportIcon,
  FileUpload as ImportIcon
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import * as XLSX from 'xlsx';

const ItemMaster = () => {
  const [items, setItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [itemTypes, setItemTypes] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'ItemCode', direction: 'asc' });
  
  // Filter States
  const [filterItemType, setFilterItemType] = useState('All');
  const [filterSeries, setFilterSeries] = useState('All');
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [dialogError, setDialogError] = useState('');
  
  // Track original ItemCode for edit PUT request
  const [originalItemCode, setOriginalItemCode] = useState(null);
  
  // Delete Confirm States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Import States
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState({ added: [], updated: [], failed: [] });
  const [showImportResults, setShowImportResults] = useState(false);
  const [resultTab, setResultTab] = useState(0);



  const [formData, setFormData] = useState({
    ItemCode: '',
    ItemName: '',
    ItemType: '',
    Series: '',
    StdWeight: '',
    Unit: '',
    MRP: '',
    Costing: '',
    OpeningStock: '',
    ClosingStock: '',
    HSNCode: '',
    ReorderLevel: ''
  });

  const fetchItems = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setItems(data);
      } else {
        setItems([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching items:', error);
      setLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/brands`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setBrands(data.map(b => b.BrandName));
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  const fetchItemTypes = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/item-types`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setItemTypes(data.map(t => t.ItemType));
      }
    } catch (error) {
      console.error('Error fetching item types:', error);
    }
  };

  const fetchUnits = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/units`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setUnits(data.map(u => u.Unit));
      }
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchBrands();
    fetchItemTypes();
    fetchUnits();
  }, []);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter items based on search and dropdowns
  const uniqueSeries = ['All', ...new Set(items.map(i => i.Series).filter(Boolean))];

  const filteredItems = items.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      (item.ItemName && item.ItemName.toLowerCase().includes(searchLower)) ||
      (item.ItemCode && item.ItemCode.toLowerCase().includes(searchLower)) ||
      (item.Series && item.Series.toLowerCase().includes(searchLower))
    );
    const matchesType = filterItemType === 'All' || item.ItemType === filterItemType;
    const matchesSeries = filterSeries === 'All' || item.Series === filterSeries;
    return matchesSearch && matchesType && matchesSeries;
  });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const handleOpenDialog = (mode, item = null) => {
    setDialogMode(mode);
    setDialogError('');
    if (mode === 'edit' && item) {
      setOriginalItemCode(item.ItemCode);
      setFormData({
        ItemCode: item.ItemCode,
        ItemName: item.ItemName,
        ItemType: item.ItemType || '',
        Series: item.Series || '',
        StdWeight: item.StdWeight != null ? Number(item.StdWeight).toFixed(3) : '',
        Unit: item.Unit || '',
        MRP: item.MRP || '',
        Costing: item.Costing || '',
        OpeningStock: item.OpeningStock || '',
        ClosingStock: item.ClosingStock || '',
        HSNCode: item.HSNCode || '',
        ReorderLevel: item.ReorderLevel != null ? item.ReorderLevel : ''
      });
    } else {
      setOriginalItemCode(null);
      setFormData({ ItemCode: '', ItemName: '', ItemType: '', Series: '', StdWeight: '', Unit: '', MRP: '', Costing: '', OpeningStock: '', ClosingStock: '', HSNCode: '', ReorderLevel: '' });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setOriginalItemCode(null);
    setDialogError('');
  };

  const handleInputChange = (e) => {
    let { name, value } = e.target;
    
    if (name === 'HSNCode') {
      value = (value || '').slice(0, 8).toUpperCase();
      setFormData(prev => ({ ...prev, HSNCode: value }));
      return;
    }

    if (name === 'OpeningStock') {
      const newOpening = parseFloat(value) || 0;
      
      setFormData(prev => {
        if (dialogMode === 'add') {
          return { ...prev, OpeningStock: value, ClosingStock: value };
        } else if (dialogMode === 'edit') {
          const oldOpening = parseFloat(prev.OpeningStock) || 0;
          const currentClosing = parseFloat(prev.ClosingStock) || 0;
          const diff = newOpening - oldOpening;
          const newClosing = currentClosing + diff;
          
          // Using Math.round to avoid floating point precision issues
          const newClosingRounded = Math.round(newClosing * 1000) / 1000;
          return { ...prev, OpeningStock: value, ClosingStock: newClosingRounded.toString() };
        }
        return prev;
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveItem = async () => {
    if (!formData.ItemCode || !formData.ItemName || !formData.Unit) {
      setDialogError('Item Code, Item Name, and Unit are required fields.');
      return;
    }
    
    try {
      const url = dialogMode === 'add' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items` : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items/${originalItemCode}`;
      const method = dialogMode === 'add' ? 'POST' : 'PUT';
      
      const payload = {
        ItemCode: formData.ItemCode,
        ItemName: formData.ItemName,
        ItemType: formData.ItemType,
        Series: formData.Series,
        StdWeight: formData.StdWeight ? parseFloat(formData.StdWeight) : null,
        Unit: formData.Unit,
        MRP: parseFloat(formData.MRP) || 0,
        Costing: parseFloat(formData.Costing) || 0,
        OpeningStock: formData.OpeningStock ? parseFloat(formData.OpeningStock) : null,
        ClosingStock: formData.ClosingStock ? parseFloat(formData.ClosingStock) : null,
        HSNCode: formData.HSNCode ? formData.HSNCode.trim().slice(0, 8).toUpperCase() : null,
        ReorderLevel: formData.ReorderLevel !== '' && formData.ReorderLevel != null ? parseFloat(formData.ReorderLevel) : 0
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        handleCloseDialog();
        fetchItems();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving item');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      setDialogError('A network error occurred. Please try again.');
    }
  };

  const openDeleteConfirm = (id) => {
    setItemToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    setItemToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const handleDeleteItem = async () => {
    if (itemToDelete) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items/${itemToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchItems();
          closeDeleteConfirm();
        } else {
          console.error('Error deleting item');
        }
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const handleExport = () => {
    const exportData = items.map(item => ({
      ItemCode: item.ItemCode,
      ItemName: item.ItemName,
      ItemType: item.ItemType || '',
      Series: item.Series || '',
      StdWeight: item.StdWeight || 0,
      Unit: item.Unit || '',
      MRP: item.MRP || 0,
      Costing: item.Costing || 0,
      OpeningStock: item.OpeningStock || 0,
      ClosingStock: item.ClosingStock || 0
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Items");
    XLSX.writeFile(workbook, "ItemMaster.xlsx");
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length > 0) {
          setImporting(true);
          setImportProgress(0);
          setImportResults({ added: [], updated: [], failed: [] });
          
          const BATCH_SIZE = 50;
          let processed = 0;
          const results = { added: [], updated: [], failed: [] };

          for (let i = 0; i < data.length; i += BATCH_SIZE) {
            const chunk = data.slice(i, i + BATCH_SIZE);
            
            try {
              const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chunk)
              });
              
              if (response.ok) {
                const resData = await response.json();
                results.added.push(...(resData.added || []));
                results.updated.push(...(resData.updated || []));
                results.failed.push(...(resData.failed || []));
              } else {
                const resData = await response.json();
                chunk.forEach(item => results.failed.push({ item, reason: resData.message || 'Server error' }));
              }
            } catch (err) {
              chunk.forEach(item => results.failed.push({ item, reason: err.message || 'Network error' }));
            }
            
            processed += chunk.length;
            setImportProgress(Math.round((processed / data.length) * 100));
          }
          
          setImportResults(results);
          setImporting(false);
          setShowImportResults(true);
          fetchItems();
        }
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Error parsing the Excel file.');
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // reset input
  };



  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
          Item Master
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        
        <Toolbar sx={{ px: { xs: 1.5, sm: 2 }, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', pt: 2, pb: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, width: { xs: '100%', md: 'auto' } }}>
            <TextField
              size="small"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ width: { xs: '100%', sm: 220, md: 250 } }}
            />
            <TextField
              select
              size="small"
              label="Item Type"
              value={filterItemType}
              onChange={(e) => setFilterItemType(e.target.value)}
              sx={{ width: { xs: '100%', sm: 150 }, minWidth: { sm: 150 } }}
            >
              <MenuItem value="All">All Types</MenuItem>
              {itemTypes.map(t => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Series"
              value={filterSeries}
              onChange={(e) => setFilterSeries(e.target.value)}
              sx={{ width: { xs: '100%', sm: 150 }, minWidth: { sm: 150 } }}
            >
              {uniqueSeries.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: { xs: '100%', md: 'auto' }, justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
            <input
              accept=".xlsx, .xls"
              style={{ display: 'none' }}
              id="raised-button-file"
              type="file"
              onChange={handleImport}
            />
            <label htmlFor={hasAddPermission() ? "raised-button-file" : ""}>
              <Button disabled={!hasAddPermission()} 
                variant="outlined" 
                component="span"
                startIcon={<ImportIcon />}
                sx={{ boxShadow: 0 }}
              >
                Import
              </Button>
            </label>
            <Button 
              variant="outlined" 
              startIcon={<ExportIcon />}
              onClick={handleExport}
              sx={{ boxShadow: 0 }}
            >
              Export
            </Button>
            <Button 
              variant="contained" 
              color="secondary" 
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog('add')} disabled={!hasAddPermission()}
              sx={{ boxShadow: 0 }}
            >
              Add Item
            </Button>
          </Box>
        </Toolbar>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 32 } }} aria-labelledby="tableTitle">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'ItemCode'}
                    direction={sortConfig.key === 'ItemCode' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('ItemCode')}
                  >
                    Code
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'ItemName'}
                    direction={sortConfig.key === 'ItemName' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('ItemName')}
                  >
                    Item Name
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'HSNCode'}
                    direction={sortConfig.key === 'HSNCode' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('HSNCode')}
                  >
                    HSN Code
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'ItemType'}
                    direction={sortConfig.key === 'ItemType' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('ItemType')}
                  >
                    Type
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'Series'}
                    direction={sortConfig.key === 'Series' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('Series')}
                  >
                    Series
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'StdWeight'}
                    direction={sortConfig.key === 'StdWeight' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('StdWeight')}
                  >
                    Std Wt
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'Unit'}
                    direction={sortConfig.key === 'Unit' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('Unit')}
                  >
                    Unit
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'MRP'}
                    direction={sortConfig.key === 'MRP' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('MRP')}
                  >
                    MRP
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'Costing'}
                    direction={sortConfig.key === 'Costing' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('Costing')}
                  >
                    Costing
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'OpeningStock'}
                    direction={sortConfig.key === 'OpeningStock' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('OpeningStock')}
                  >
                    Opening
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'ClosingStock'}
                    direction={sortConfig.key === 'ClosingStock' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('ClosingStock')}
                  >
                    Closing
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'ReorderLevel'}
                    direction={sortConfig.key === 'ReorderLevel' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('ReorderLevel')}
                  >
                    Reorder Level
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedItems
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => {
                  const isLowStock = row.ReorderLevel > 0 && (row.ClosingStock || 0) < row.ReorderLevel;
                  return (
                    <TableRow hover tabIndex={-1} key={row.ItemCode}>
                      <TableCell sx={{ fontWeight: 500 }}>{row.ItemCode}</TableCell>
                      <TableCell>{row.ItemName}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: row.HSNCode ? '#0F3B66' : 'text.secondary' }}>
                          {row.HSNCode || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.ItemType}</TableCell>
                      <TableCell>{row.Series}</TableCell>
                      <TableCell>{row.StdWeight != null && row.StdWeight !== '' ? Number(row.StdWeight).toFixed(3) : ''}</TableCell>
                      <TableCell>{row.Unit}</TableCell>
                      <TableCell>{row.MRP}</TableCell>
                      <TableCell>{row.Costing}</TableCell>
                      <TableCell>{row.OpeningStock}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: isLowStock ? '#ef4444' : 'inherit' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>{row.ClosingStock}</span>
                          {isLowStock && (
                            <Chip 
                              label="Low" 
                              size="small" 
                              color="error" 
                              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }} 
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {row.ReorderLevel != null && Number(row.ReorderLevel) > 0 ? (
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#d97706' }}>
                            {row.ReorderLevel}
                          </Typography>
                        ) : '-'}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
                          <IconButton color="primary" size="small" onClick={() => handleOpenDialog('edit', row)} disabled={!hasEditPermission()}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton color="error" size="small" onClick={() => openDeleteConfirm(row.ItemCode)} disabled={!hasDeletePermission()}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {sortedItems.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={13} align="center" sx={{ py: 3 }}>
                    No items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={sortedItems.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add / Edit Dialog */}
      <Dialog open={openDialog} onClose={(event, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogMode === 'add' ? 'Add New Item' : 'Edit Item'}</DialogTitle>
        <DialogContent dividers>
          {dialogError && (
            <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>
          )}
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField 
                label="Code" 
                name="ItemCode" 
                value={formData.ItemCode} 
                onChange={handleInputChange} 
                fullWidth size="small" 
              />
              <TextField label="Item Name" name="ItemName" value={formData.ItemName} onChange={handleInputChange} fullWidth size="small" />
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <Autocomplete
                autoHighlight
                autoSelect
                options={itemTypes}
                value={formData.ItemType}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, ItemType: newValue || '' });
                }}
                fullWidth
                size="small"
                renderInput={(params) => <TextField {...params} label="Item Type" />}
              />
              <Autocomplete
                autoHighlight
                autoSelect
                freeSolo={false}
                options={units}
                value={formData.Unit}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, Unit: newValue || '' });
                }}
                fullWidth
                size="small"
                renderInput={(params) => <TextField {...params} label="Unit" required />}
              />
              <Autocomplete
                autoHighlight
                autoSelect
                freeSolo={false}
                options={brands}
                value={formData.Series}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, Series: newValue || '' });
                }}
                fullWidth
                size="small"
                renderInput={(params) => <TextField {...params} label="Series Name" />}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField label="Std Weight" name="StdWeight" type="number" inputProps={{ step: "0.001" }} value={formData.StdWeight} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="MRP" name="MRP" type="number" value={formData.MRP} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="Costing" name="Costing" type="number" value={formData.Costing} onChange={handleInputChange} fullWidth size="small" />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField label="Opening Stock" name="OpeningStock" type="number" value={formData.OpeningStock} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="Closing Stock" name="ClosingStock" type="number" value={formData.ClosingStock} onChange={handleInputChange} fullWidth size="small" />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField 
                label="HSN Code" 
                name="HSNCode" 
                value={formData.HSNCode} 
                onChange={handleInputChange} 
                inputProps={{ maxLength: 8 }} 
                helperText="8 characters max"
                fullWidth 
                size="small" 
              />
              <TextField 
                label="Reorder Level" 
                name="ReorderLevel" 
                type="number" 
                inputProps={{ step: "any" }}
                value={formData.ReorderLevel} 
                onChange={handleInputChange} 
                helperText="Alerts when closing stock is below this"
                fullWidth 
                size="small" 
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
          <Button onClick={handleSaveItem} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>



      {/* Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={closeDeleteConfirm}
        onConfirm={handleDeleteItem}
        title="Confirm Deletion"
        itemName="this item"
      />

      {/* Import Progress Dialog */}
      <Dialog open={importing} disableEscapeKeyDown>
        <DialogTitle>Importing Items...</DialogTitle>
        <DialogContent sx={{ minWidth: 400 }}>
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress variant="determinate" value={importProgress} />
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
              {importProgress}% Complete
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Import Results Dialog */}
      <Dialog open={showImportResults} onClose={() => setShowImportResults(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import Results</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={resultTab} onChange={(e, val) => setResultTab(val)}>
              <Tab label={`Added (${importResults.added.length})`} />
              <Tab label={`Updated (${importResults.updated.length})`} />
              <Tab label={`Failed (${importResults.failed.length})`} sx={{ color: importResults.failed.length > 0 ? 'error.main' : 'inherit' }} />
            </Tabs>
          </Box>
          <Box sx={{ mt: 2 }}>
            {resultTab === 0 && (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Item Name</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importResults.added.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.ItemCode}</TableCell>
                        <TableCell>{item.ItemName}</TableCell>
                      </TableRow>
                    ))}
                    {importResults.added.length === 0 && <TableRow><TableCell colSpan={2} align="center">No items added</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {resultTab === 1 && (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Item Name</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importResults.updated.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.ItemCode}</TableCell>
                        <TableCell>{item.ItemName}</TableCell>
                      </TableRow>
                    ))}
                    {importResults.updated.length === 0 && <TableRow><TableCell colSpan={2} align="center">No items updated</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {resultTab === 2 && (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Item Name</TableCell>
                      <TableCell sx={{ color: 'error.main' }}>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importResults.failed.map((fail, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{fail.item?.ItemCode || 'Unknown'}</TableCell>
                        <TableCell>{fail.item?.ItemName || 'Unknown'}</TableCell>
                        <TableCell sx={{ color: 'error.main' }}>{fail.reason}</TableCell>
                      </TableRow>
                    ))}
                    {importResults.failed.length === 0 && <TableRow><TableCell colSpan={3} align="center">No failed items</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportResults(false)} variant="contained">Close</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default ItemMaster;
