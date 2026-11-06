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
  Alert
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';

const BrandMaster = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [dialogError, setDialogError] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState(null);
  
  // Delete Confirm States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState(null);

  const [formData, setFormData] = useState({
    BrandName: ''
  });

  const fetchBrands = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/brands`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setBrands(data);
      } else {
        setBrands([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching brands:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter brands based on search
  const filteredBrands = brands.filter(brand => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (brand.BrandName && brand.BrandName.toLowerCase().includes(searchLower))
    );
  });

  const handleOpenDialog = (mode, brand = null) => {
    setDialogMode(mode);
    setDialogError('');
    if (mode === 'edit' && brand) {
      setSelectedBrandId(brand.BrandId);
      setFormData({
        BrandName: brand.BrandName
      });
    } else {
      setFormData({ BrandName: '' });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedBrandId(null);
    setDialogError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSaveBrand = async () => {
    try {
      const url = dialogMode === 'add' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/brands` : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/brands/${selectedBrandId}`;
      const method = dialogMode === 'add' ? 'POST' : 'PUT';
      
      const payload = {
        BrandName: formData.BrandName
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        handleCloseDialog();
        fetchBrands();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving brand');
      }
    } catch (error) {
      console.error('Error saving brand:', error);
      setDialogError('A network error occurred. Please try again.');
    }
  };

  const openDeleteConfirm = (id) => {
    setBrandToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    setBrandToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const handleDeleteBrand = async () => {
    if (brandToDelete) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/brands/${brandToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchBrands();
          closeDeleteConfirm();
        } else {
          console.error('Error deleting brand');
        }
      } catch (error) {
        console.error('Error deleting brand:', error);
      }
    }
  };

  return (
    <Box>
      {/* Page Title */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
          Series Master
        </Typography>
      </Box>

      {/* Main Content Paper */}
      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        
        {/* Toolbar */}
        <Toolbar sx={{ pl: { xs: 1.5, sm: 2 }, pr: { xs: 1.5, sm: 2 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, pt: 2, pb: 2 }}>
          <TextField
            size="small"
            placeholder="Search series..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: '100%', sm: 300 } }}
          />
          <Button 
            variant="contained" 
            color="secondary" 
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog('add')} disabled={!hasAddPermission()}
            sx={{ boxShadow: 0, width: { xs: '100%', sm: 'auto' } }}
          >
            Add Series
          </Button>
        </Toolbar>

        {/* Data Table */}
        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 32 } }} aria-labelledby="tableTitle">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Sr. No.</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Series Name</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Edit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBrands
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row, index) => {
                  return (
                    <TableRow hover tabIndex={-1} key={row.BrandId}>
                      <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{row.BrandName}</TableCell>
                      <TableCell align="center">
                        <IconButton color="primary" size="small" onClick={() => handleOpenDialog('edit', row)} disabled={!hasEditPermission()}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton color="error" size="small" onClick={() => openDeleteConfirm(row.BrandId)} disabled={!hasDeletePermission()}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {filteredBrands.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                    No series found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredBrands.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add / Edit Dialog */}
      <Dialog open={openDialog} onClose={(event, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogMode === 'add' ? 'Add New Series' : 'Edit Series'}</DialogTitle>
        <DialogContent dividers>
          {dialogError && (
            <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>
          )}
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Series Name" name="BrandName" value={formData.BrandName} onChange={handleInputChange} fullWidth size="small" />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
          <Button onClick={handleSaveBrand} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={closeDeleteConfirm}
        onConfirm={handleDeleteBrand}
        title="Confirm Deletion"
        itemName="this series"
      />
    </Box>
  );
};

export default BrandMaster;
