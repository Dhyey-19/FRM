import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert, Chip
} from '@mui/material';
import { 
  Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Delete as DeleteIcon, Category as CategoryIcon,
  FileDownload as ExportIcon, FileUpload as ImportIcon
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import * as XLSX from 'xlsx';
import { ensureNumericWorksheet } from '../utils/excelHelper';

const ItemTypeMaster = () => {
  const [itemTypes, setItemTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add');
  const [dialogError, setDialogError] = useState('');
  const [selectedItemType, setSelectedItemType] = useState(null);
  
  // Delete Confirm States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [formData, setFormData] = useState({ ItemType: '', Description: '' });

  const fetchItemTypes = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/item-types`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setItemTypes(data);
      } else {
        setItemTypes([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching item types:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItemTypes();
  }, []);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

  const filteredItemTypes = itemTypes.filter(type => {
    const searchLower = searchTerm.toLowerCase();
    const matchesCode = type.ItemType && type.ItemType.toLowerCase().includes(searchLower);
    const matchesDesc = type.Description && type.Description.toLowerCase().includes(searchLower);
    return matchesCode || matchesDesc;
  });

  const handleOpenDialog = (mode, type = null) => {
    setDialogMode(mode);
    setDialogError('');
    if (mode === 'edit' && type) {
      setSelectedItemType(type.ItemType);
      setFormData({ ItemType: type.ItemType, Description: type.Description || '' });
    } else {
      setSelectedItemType(null);
      setFormData({ ItemType: '', Description: '' });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedItemType(null);
    setFormData({ ItemType: '', Description: '' });
    setDialogError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSaveItemType = async () => {
    try {
      const url = dialogMode === 'add' 
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/item-types` 
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/item-types/${selectedItemType}`;
      
      const method = dialogMode === 'add' ? 'POST' : 'PUT';
      
      const payload = { 
        ItemType: formData.ItemType.trim().toUpperCase(),
        Description: (formData.Description || '').trim()
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        handleCloseDialog();
        fetchItemTypes();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving item type');
      }
    } catch (error) {
      console.error('Error saving item type:', error);
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

  const handleDeleteItemType = async () => {
    if (itemToDelete) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/item-types/${itemToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchItemTypes();
          closeDeleteConfirm();
        } else {
          console.error('Error deleting item type');
        }
      } catch (error) {
        console.error('Error deleting item type:', error);
      }
    }
  };

  const handleExport = () => {
    const exportData = filteredItemTypes.map((t, index) => ({
      'Sr. No.': index + 1,
      'Item Type': t.ItemType,
      'Description': t.Description || (
        t.ItemType === 'FG' ? 'Finished Good' :
        t.ItemType === 'RM' ? 'Raw Material' :
        t.ItemType === 'SF' ? 'Semi-Finished' :
        t.ItemType === 'BOP' ? 'Bought Out Part' : ''
      )
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    ensureNumericWorksheet(worksheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ItemTypes');
    XLSX.writeFile(workbook, 'ItemTypeMaster.xlsx');
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
          const mappedData = data.map(row => ({
            ItemType: row['Item Type'] || row.ItemType || row.Type || '',
            Description: row.Description || row['Description'] || ''
          })).filter(r => r.ItemType && String(r.ItemType).trim());

          if (mappedData.length === 0) {
            alert('No valid item type rows found in the uploaded file.');
            return;
          }

          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/item-types/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mappedData)
          });

          const resData = await response.json();
          if (response.ok) {
            fetchItemTypes();
            alert(resData.message || 'Item types imported successfully!');
          } else {
            alert(`Error importing item types: ${resData.message}`);
          }
        } else {
          alert('Excel file is empty.');
        }
      } catch (err) {
        console.error('Error importing item types:', err);
        alert('Failed to parse or upload excel file.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CategoryIcon /> Item Type
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        
        <Toolbar sx={{ pl: { xs: 1.5, sm: 2 }, pr: { xs: 1.5, sm: 2 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, pt: 2, pb: 2 }}>
          <TextField
            size="small"
            placeholder="Search item types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
            sx={{ width: { xs: '100%', sm: 300 } }}
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
            <input
              accept=".xlsx, .xls"
              style={{ display: 'none' }}
              id="itemtype-import-file"
              type="file"
              onChange={handleImport}
            />
            <label htmlFor={hasAddPermission() ? "itemtype-import-file" : ""} style={{ flex: 1 }}>
              <Button 
                disabled={!hasAddPermission()} 
                variant="outlined" 
                component="span"
                startIcon={<ImportIcon />}
                sx={{ boxShadow: 0, width: '100%' }}
              >
                Import
              </Button>
            </label>
            <Button 
              variant="outlined" 
              startIcon={<ExportIcon />}
              onClick={handleExport}
              sx={{ boxShadow: 0, flex: { xs: 1, sm: 'none' } }}
            >
              Export
            </Button>
            <Button 
              variant="contained" 
              color="secondary" 
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog('add')} disabled={!hasAddPermission()}
              sx={{ boxShadow: 0, width: { xs: '100%', sm: 'auto' } }}
            >
              Add Item Type
            </Button>
          </Box>
        </Toolbar>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 500, '& .MuiTableRow-root': { height: 38 } }}>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, width: 140 }}>Item Type Code</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description / Meaning</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, width: 140 }}>Classification</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, width: 70 }}>Edit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, width: 70 }}>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItemTypes
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => {
                  const isSystem = row.IsSystem === true || row.IsSystem === 1;
                  return (
                    <TableRow hover tabIndex={-1} key={row.ItemType}>
                      <TableCell sx={{ fontWeight: 700, color: '#0F3B66' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
                            {row.ItemType}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: '#334155', fontWeight: 500 }}>
                        {row.Description || (
                          row.ItemType === 'FG' ? 'Finished Good' :
                          row.ItemType === 'RM' ? 'Raw Material' :
                          row.ItemType === 'SF' ? 'Semi-Finished' :
                          row.ItemType === 'BOP' ? 'Bought Out Part' : '-'
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {isSystem ? (
                          <Chip 
                            label="System Default" 
                            size="small" 
                            color="primary" 
                            variant="filled"
                            sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }} 
                          />
                        ) : (
                          <Chip 
                            label="Custom" 
                            size="small" 
                            variant="outlined" 
                            sx={{ fontWeight: 500, fontSize: '0.7rem', height: 22, color: '#64748b' }} 
                          />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton 
                          color="primary" 
                          size="small" 
                          onClick={() => handleOpenDialog('edit', row)}
                          disabled={!hasEditPermission() || isSystem}
                          title={isSystem ? "System Item Types (FG, RM, SF, BOP) cannot be edited" : "Edit Item Type"}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton 
                          color="error" 
                          size="small" 
                          onClick={() => openDeleteConfirm(row.ItemType)}
                          disabled={!hasDeletePermission() || isSystem}
                          title={isSystem ? "System Item Types (FG, RM, SF, BOP) cannot be deleted" : "Delete Item Type"}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {filteredItemTypes.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3, color: '#94a3b8' }}>No item types found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredItemTypes.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      <Dialog open={openDialog} onClose={(event, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#0F3B66' }}>
          {dialogMode === 'add' ? 'Add New Item Type' : 'Edit Item Type'}
        </DialogTitle>
        <DialogContent dividers>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField 
              label="Item Type Code (e.g. FG, RM, SF, BOP)" 
              name="ItemType" 
              value={formData.ItemType} 
              onChange={handleInputChange} 
              fullWidth 
              size="small" 
              required 
              disabled={dialogMode === 'edit' && (selectedItemType === 'FG' || selectedItemType === 'RM' || selectedItemType === 'SF' || selectedItemType === 'BOP')}
              inputProps={{ style: { textTransform: 'uppercase', fontWeight: 600 } }}
              helperText="Short uppercase code used across item inventory"
            />
            <TextField 
              label="Description / Meaning (e.g. Finished Good, Raw Material)" 
              name="Description" 
              value={formData.Description} 
              onChange={handleInputChange} 
              fullWidth 
              size="small" 
              helperText="Full descriptive name of this item type"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
          <Button onClick={handleSaveItemType} variant="contained" color="primary" sx={{ fontWeight: 600 }}>Save</Button>
        </DialogActions>
      </Dialog>

      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={closeDeleteConfirm}
        onConfirm={handleDeleteItemType}
        title="Confirm Deletion"
        itemName="this item type"
      />
    </Box>
  );
};

export default ItemTypeMaster;
