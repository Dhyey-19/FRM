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
  TableSortLabel
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
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [dialogError, setDialogError] = useState('');
  
  // Track original ItemCode for edit PUT request
  const [originalItemCode, setOriginalItemCode] = useState(null);
  
  // Delete Confirm States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);



  const [formData, setFormData] = useState({
    ItemCode: '',
    ItemName: '',
    ItemType: '',
    BrandName: '',
    Unit: '',
    MRP: '',
    COSTING: '',
    OpeningStock: '',
    ClosingStock: ''
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

  // Filter items based on search
  const filteredItems = items.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (item.ItemName && item.ItemName.toLowerCase().includes(searchLower)) ||
      (item.ItemCode && item.ItemCode.toLowerCase().includes(searchLower)) ||
      (item.BrandName && item.BrandName.toLowerCase().includes(searchLower))
    );
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
        BrandName: item.BrandName,
        Unit: item.Unit || '',
        MRP: item.MRP || '',
        COSTING: item.COSTING || '',
        OpeningStock: item.OpeningStock || '',
        ClosingStock: item.ClosingStock || ''
      });
    } else {
      setOriginalItemCode(null);
      setFormData({ ItemCode: '', ItemName: '', ItemType: '', BrandName: '', Unit: '', MRP: '', COSTING: '', OpeningStock: '', ClosingStock: '' });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setOriginalItemCode(null);
    setDialogError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
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
        BrandName: formData.BrandName,
        Unit: formData.Unit,
        MRP: parseFloat(formData.MRP) || 0,
        COSTING: parseFloat(formData.COSTING) || 0,
        OpeningStock: formData.OpeningStock ? parseFloat(formData.OpeningStock) : null,
        ClosingStock: formData.ClosingStock ? parseFloat(formData.ClosingStock) : null
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
      BrandName: item.BrandName || '',
      Unit: item.Unit || '',
      MRP: item.MRP || 0,
      COSTING: item.COSTING || 0,
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
        
        // Ensure data exists
        if (data.length > 0) {
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          if (response.ok) {
            fetchItems();
            alert('Items imported successfully!');
          } else {
            const resData = await response.json();
            alert(`Error importing items: ${resData.message}`);
          }
        }
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Error parsing the Excel file.');
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
        
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, display: 'flex', justifyContent: 'space-between', pt: 2, pb: 2 }}>
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
            sx={{ width: '300px' }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
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
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 40 } }} aria-labelledby="tableTitle">
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
                    active={sortConfig.key === 'ItemType'}
                    direction={sortConfig.key === 'ItemType' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('ItemType')}
                  >
                    Type
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'BrandName'}
                    direction={sortConfig.key === 'BrandName' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('BrandName')}
                  >
                    Series
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
                    active={sortConfig.key === 'COSTING'}
                    direction={sortConfig.key === 'COSTING' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('COSTING')}
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
                <TableCell align="center" sx={{ fontWeight: 600 }}>Edit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedItems
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => {
                  return (
                    <TableRow hover tabIndex={-1} key={row.ItemCode}>
                      <TableCell sx={{ fontWeight: 500 }}>{row.ItemCode}</TableCell>
                      <TableCell>{row.ItemName}</TableCell>
                      <TableCell>{row.ItemType}</TableCell>
                      <TableCell>{row.BrandName}</TableCell>
                      <TableCell>{row.Unit}</TableCell>
                      <TableCell>{row.MRP}</TableCell>
                      <TableCell>{row.COSTING}</TableCell>
                      <TableCell>{row.OpeningStock}</TableCell>
                      <TableCell>{row.ClosingStock}</TableCell>
                      <TableCell align="center">
                        <IconButton color="primary" size="small" onClick={() => handleOpenDialog('edit', row)} disabled={!hasEditPermission()}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton color="error" size="small" onClick={() => openDeleteConfirm(row.ItemCode)} disabled={!hasDeletePermission()}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {sortedItems.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
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
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField 
                label="Code" 
                name="ItemCode" 
                value={formData.ItemCode} 
                onChange={handleInputChange} 
                fullWidth size="small" 
              />
              <TextField label="Item Name" name="ItemName" value={formData.ItemName} onChange={handleInputChange} fullWidth size="small" />
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
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
                value={formData.BrandName}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, BrandName: newValue || '' });
                }}
                fullWidth
                size="small"
                renderInput={(params) => <TextField {...params} label="Series Name" />}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="MRP" name="MRP" type="number" value={formData.MRP} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="Costing" name="COSTING" type="number" value={formData.COSTING} onChange={handleInputChange} fullWidth size="small" />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Opening Stock" name="OpeningStock" type="number" value={formData.OpeningStock} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="Closing Stock" name="ClosingStock" type="number" value={formData.ClosingStock} onChange={handleInputChange} fullWidth size="small" />
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
    </Box>
  );
};

export default ItemMaster;
