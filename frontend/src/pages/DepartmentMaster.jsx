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
  Delete as DeleteIcon,
  FileDownload as ExportIcon,
  FileUpload as ImportIcon
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import * as XLSX from 'xlsx';
import { ensureNumericWorksheet } from '../utils/excelHelper';

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
    DeptName: '',
    Costing: ''
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
        DeptName: dept.DeptName,
        Costing: dept.Costing != null && dept.Costing !== '' ? dept.Costing : ''
      });
    } else {
      setFormData({ DeptName: '', Costing: '' });
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
        DeptName: formData.DeptName,
        Costing: parseFloat(formData.Costing) || 0
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

  const handleExport = () => {
    const exportData = filteredDepartments.map((d, index) => ({
      'Sr. No.': index + 1,
      'Department Name': d.DeptName,
      'Costing': Number(d.Costing) || 0
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    ensureNumericWorksheet(worksheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Departments');
    XLSX.writeFile(workbook, 'DepartmentMaster.xlsx');
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
          const mappedData = data.map((row, idx) => ({
            __rowNum__: idx + 2,
            DeptName: row['Department Name'] || row.DeptName || row.DepartmentName || row.Department || '',
            Costing: parseFloat(row.Costing !== undefined ? row.Costing : row['Costing']) || 0
          }));

          if (mappedData.length === 0) {
            alert('No valid department rows found in the uploaded file.');
            return;
          }

          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/departments/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mappedData)
          });

          const resData = await response.json();
          if (response.ok) {
            fetchDepartments();
            alert(resData.message || 'Departments imported successfully!');
          } else {
            alert(`Error importing departments: ${resData.message}`);
          }
        } else {
          alert('Excel file is empty.');
        }
      } catch (err) {
        console.error('Error importing departments:', err);
        alert('Failed to parse or upload excel file.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
          Departments
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        
        <Toolbar sx={{ pl: { xs: 1.5, sm: 2 }, pr: { xs: 1.5, sm: 2 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, pt: 2, pb: 2 }}>
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
            sx={{ width: { xs: '100%', sm: 300 } }}
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
            <input
              accept=".xlsx, .xls"
              style={{ display: 'none' }}
              id="department-import-file"
              type="file"
              onChange={handleImport}
            />
            <label htmlFor={hasAddPermission() ? "department-import-file" : ""} style={{ flex: 1 }}>
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
              Add Department
            </Button>
          </Box>
        </Toolbar>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 32 } }} aria-labelledby="tableTitle">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Department Name</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, width: 160 }}>Costing (₹)</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 100 }}>Edit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 100 }}>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDepartments
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => {
                  return (
                    <TableRow hover tabIndex={-1} key={row.DeptID}>
                      <TableCell sx={{ fontWeight: 500 }}>{row.DeptName}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: '#0F3B66' }}>
                        ₹{Number(row.Costing || 0).toFixed(2)}
                      </TableCell>
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
                  <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
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
            <TextField label="Department Name" name="DeptName" value={formData.DeptName} onChange={handleInputChange} fullWidth size="small" required />
            <TextField label="Costing (₹)" name="Costing" type="number" inputProps={{ step: "0.01" }} value={formData.Costing} onChange={handleInputChange} fullWidth size="small" helperText="Department costing per unit (Pcs / Kg) for stock valuation" />
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
