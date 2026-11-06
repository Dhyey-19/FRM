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

const UnitMaster = () => {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [dialogError, setDialogError] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  
  // Delete Confirm States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState(null);

  const [formData, setFormData] = useState({
    Unit: ''
  });

  const fetchUnits = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/units`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setUnits(data);
      } else {
        setUnits([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching units:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter units based on search
  const filteredUnits = units.filter(unit => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (unit.Unit && unit.Unit.toLowerCase().includes(searchLower))
    );
  });

  const handleOpenDialog = (mode, unit = null) => {
    setDialogMode(mode);
    setDialogError('');
    if (mode === 'edit' && unit) {
      setSelectedUnitId(unit.Unit);
      setFormData({
        Unit: unit.Unit
      });
    } else {
      setFormData({ Unit: '' });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedUnitId(null);
    setDialogError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSaveUnit = async () => {
    try {
      const url = dialogMode === 'add' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/units` : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/units/${selectedUnitId}`;
      const method = dialogMode === 'add' ? 'POST' : 'PUT';
      
      const payload = {
        Unit: formData.Unit
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        handleCloseDialog();
        fetchUnits();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving unit');
      }
    } catch (error) {
      console.error('Error saving unit:', error);
      setDialogError('A network error occurred. Please try again.');
    }
  };

  const openDeleteConfirm = (id) => {
    setUnitToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    setUnitToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const handleDeleteUnit = async () => {
    if (unitToDelete) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/units/${unitToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchUnits();
          closeDeleteConfirm();
        } else {
          console.error('Error deleting unit');
        }
      } catch (error) {
        console.error('Error deleting unit:', error);
      }
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
          Unit Master
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        
        <Toolbar sx={{ pl: { xs: 1.5, sm: 2 }, pr: { xs: 1.5, sm: 2 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, pt: 2, pb: 2 }}>
          <TextField
            size="small"
            placeholder="Search units..."
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
            Add Unit
          </Button>
        </Toolbar>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 32 } }} aria-labelledby="tableTitle">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Unit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Edit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUnits
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => {
                  return (
                    <TableRow hover tabIndex={-1} key={row.Unit}>
                      <TableCell sx={{ fontWeight: 500 }}>{row.Unit}</TableCell>
                      <TableCell align="center">
                        <IconButton 
                          color="primary" 
                          size="small" 
                          onClick={() => handleOpenDialog('edit', row)}
                          disabled={!hasEditPermission() || row.IsSystem === true || row.IsSystem === 1}
                          title={(row.IsSystem === true || row.IsSystem === 1) ? "System units cannot be edited" : "Edit Unit"}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton 
                          color="error" 
                          size="small" 
                          onClick={() => openDeleteConfirm(row.Unit)}
                          disabled={!hasDeletePermission() || row.IsSystem === true || row.IsSystem === 1}
                          title={(row.IsSystem === true || row.IsSystem === 1) ? "System units cannot be deleted" : "Delete Unit"}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {filteredUnits.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                    No units found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredUnits.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      <Dialog open={openDialog} onClose={(event, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogMode === 'add' ? 'Add New Unit' : 'Edit Unit'}</DialogTitle>
        <DialogContent dividers>
          {dialogError && (
            <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>
          )}
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Unit" name="Unit" value={formData.Unit} onChange={handleInputChange} fullWidth size="small" />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
          <Button onClick={handleSaveUnit} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={closeDeleteConfirm}
        onConfirm={handleDeleteUnit}
        title="Confirm Deletion"
        itemName="this unit"
      />
    </Box>
  );
};

export default UnitMaster;
