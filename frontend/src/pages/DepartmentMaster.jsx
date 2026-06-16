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

const DepartmentMaster = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [dialogError, setDialogError] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  
  // Delete Confirm States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState(null);

  const [formData, setFormData] = useState({
    DeptName: ''
  });

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/departments`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setDepartments(data);
      } else {
        setDepartments([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter departments based on search
  const filteredDepartments = departments.filter(dept => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (dept.DeptName && dept.DeptName.toLowerCase().includes(searchLower))
    );
  });

  const handleOpenDialog = (mode, dept = null) => {
    setDialogMode(mode);
    setDialogError('');
    if (mode === 'edit' && dept) {
      setSelectedDeptId(dept.DeptID);
      setFormData({
        DeptName: dept.DeptName
      });
    } else {
      setFormData({ DeptName: '' });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedDeptId(null);
    setDialogError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSaveDepartment = async () => {
    try {
      const url = dialogMode === 'add' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/departments` : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/departments/${selectedDeptId}`;
      const method = dialogMode === 'add' ? 'POST' : 'PUT';
      
      const payload = {
        DeptName: formData.DeptName
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        handleCloseDialog();
        fetchDepartments();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving department');
      }
    } catch (error) {
      console.error('Error saving department:', error);
      setDialogError('A network error occurred. Please try again.');
    }
  };

  const openDeleteConfirm = (id) => {
    setDeptToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    setDeptToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const handleDeleteDepartment = async () => {
    if (deptToDelete) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/departments/${deptToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchDepartments();
          closeDeleteConfirm();
        } else {
          console.error('Error deleting department');
        }
      } catch (error) {
        console.error('Error deleting department:', error);
      }
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
          Departments
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, display: 'flex', justifyContent: 'space-between', pt: 2, pb: 2 }}>
          <TextField
            size="small"
            placeholder="Search departments..."
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
          <Button 
            variant="contained" 
            color="secondary" 
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog('add')} disabled={!hasAddPermission()}
            sx={{ boxShadow: 0 }}
          >
            Add Department
          </Button>
        </Toolbar>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 40 } }} aria-labelledby="tableTitle">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Department Name</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Edit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDepartments
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => {
                  return (
                    <TableRow hover tabIndex={-1} key={row.DeptID}>
                      <TableCell sx={{ fontWeight: 500 }}>{row.DeptName}</TableCell>
                      <TableCell align="center">
                        <IconButton 
                          color="primary" 
                          size="small" 
                          onClick={() => handleOpenDialog('edit', row)}
                          disabled={!hasEditPermission() || row.IsSystem === true || row.IsSystem === 1}
                          title={(row.IsSystem === true || row.IsSystem === 1) ? "System departments cannot be edited" : "Edit Department"}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton 
                          color="error" 
                          size="small" 
                          onClick={() => openDeleteConfirm(row.DeptID)}
                          disabled={!hasDeletePermission() || row.IsSystem === true || row.IsSystem === 1}
                          title={(row.IsSystem === true || row.IsSystem === 1) ? "System departments cannot be deleted" : "Delete Department"}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {filteredDepartments.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                    No departments found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredDepartments.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      <Dialog open={openDialog} onClose={(event, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogMode === 'add' ? 'Add New Department' : 'Edit Department'}</DialogTitle>
        <DialogContent dividers>
          {dialogError && (
            <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>
          )}
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Department Name" name="DeptName" value={formData.DeptName} onChange={handleInputChange} fullWidth size="small" />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
          <Button onClick={handleSaveDepartment} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={closeDeleteConfirm}
        onConfirm={handleDeleteDepartment}
        title="Confirm Deletion"
        itemName="this department"
      />
    </Box>
  );
};

export default DepartmentMaster;
