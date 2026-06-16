import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert
} from '@mui/material';
import { 
  Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Delete as DeleteIcon, Category as CategoryIcon
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';

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

  const [formData, setFormData] = useState({ ItemType: '' });

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
    return type.ItemType && type.ItemType.toLowerCase().includes(searchLower);
  });

  const handleOpenDialog = (mode, type = null) => {
    setDialogMode(mode);
    setDialogError('');
    if (mode === 'edit' && type) {
      setSelectedItemType(type.ItemType);
      setFormData({ ItemType: type.ItemType });
    } else {
      setSelectedItemType(null);
      setFormData({ ItemType: '' });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedItemType(null);
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
      
      const payload = { ItemType: formData.ItemType };

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

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CategoryIcon /> Item Type
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, display: 'flex', justifyContent: 'space-between', pt: 2, pb: 2 }}>
          <TextField
            size="small"
            placeholder="Search item types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
            sx={{ width: '300px' }}
          />
          <Button 
            variant="contained" 
            color="secondary" 
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog('add')} disabled={!hasAddPermission()}
            sx={{ boxShadow: 0 }}
          >
            Add Item Type
          </Button>
        </Toolbar>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 500, '& .MuiTableRow-root': { height: 40 } }}>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Item Type Name</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 80 }}>Edit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 80 }}>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItemTypes
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => (
                  <TableRow hover tabIndex={-1} key={row.ItemType}>
                    <TableCell sx={{ fontWeight: 500 }}>{row.ItemType}</TableCell>
                    <TableCell align="center">
                      <IconButton 
                        color="primary" 
                        size="small" 
                        onClick={() => handleOpenDialog('edit', row)}
                        disabled={!hasEditPermission() || row.IsSystem === true || row.IsSystem === 1}
                        title={(row.IsSystem === true || row.IsSystem === 1) ? "System Item Types cannot be edited" : "Edit Item Type"}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton 
                        color="error" 
                        size="small" 
                        onClick={() => openDeleteConfirm(row.ItemType)}
                        disabled={!hasDeletePermission() || row.IsSystem === true || row.IsSystem === 1}
                        title={(row.IsSystem === true || row.IsSystem === 1) ? "System Item Types cannot be deleted" : "Delete Item Type"}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
              ))}
              {filteredItemTypes.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 3 }}>No item types found.</TableCell>
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
        <DialogTitle>{dialogMode === 'add' ? 'Add New Item Type' : 'Edit Item Type'}</DialogTitle>
        <DialogContent dividers>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Item Type Name" name="ItemType" value={formData.ItemType} onChange={handleInputChange} fullWidth size="small" required />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
          <Button onClick={handleSaveItemType} variant="contained" color="primary">Save</Button>
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
