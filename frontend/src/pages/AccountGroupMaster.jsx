import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert
} from '@mui/material';
import { 
  Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Delete as DeleteIcon,
  FileDownload as ExportIcon, FileUpload as ImportIcon
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import * as XLSX from 'xlsx';
import { ensureNumericWorksheet } from '../utils/excelHelper';

const AccountGroupMaster = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add');
  const [dialogError, setDialogError] = useState('');
  const [editId, setEditId] = useState(null);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [formData, setFormData] = useState({ GroupName: '' });

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/account-groups`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setGroups(data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching groups:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

  const filteredGroups = groups.filter(g => 
    g.GroupName && g.GroupName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (mode, group = null) => {
    setDialogMode(mode);
    setDialogError('');
    if (mode === 'edit' && group) {
      setEditId(group.Id);
      setFormData({ GroupName: group.GroupName });
    } else {
      setEditId(null);
      setFormData({ GroupName: '' });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditId(null);
    setDialogError('');
  };

  const handleSaveGroup = async () => {
    try {
      const url = dialogMode === 'add' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/account-groups` : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/account-groups/${editId}`;
      const method = dialogMode === 'add' ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        handleCloseDialog();
        fetchGroups();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving account group');
      }
    } catch (error) {
      setDialogError('Network error. Please try again.');
    }
  };

  const openDeleteConfirm = (id) => {
    setItemToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteGroup = async () => {
    if (itemToDelete) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/account-groups/${itemToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchGroups();
          setDeleteConfirmOpen(false);
        }
      } catch (error) {
        console.error('Error deleting group:', error);
      }
    }
  };

  const sortedGroups = [...filteredGroups].sort((a, b) => {
    return (a.GroupName || '').localeCompare(b.GroupName || '');
  });

  const handleExport = () => {
    const exportData = sortedGroups.map((g, index) => ({
      'Sr. No.': index + 1,
      'Group Name': g.GroupName
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    ensureNumericWorksheet(worksheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'AccountGroups');
    XLSX.writeFile(workbook, 'AccountGroupMaster.xlsx');
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
            GroupName: row['Group Name'] || row.GroupName || row['Account Group'] || ''
          })).filter(r => r.GroupName && String(r.GroupName).trim());

          if (mappedData.length === 0) {
            alert('No valid account group rows found in the uploaded file.');
            return;
          }

          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/account-groups/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mappedData)
          });

          const resData = await response.json();
          if (response.ok) {
            fetchGroups();
            alert(resData.message || 'Account groups imported successfully!');
          } else {
            alert(`Error importing account groups: ${resData.message}`);
          }
        } else {
          alert('Excel file is empty.');
        }
      } catch (err) {
        console.error('Error importing account groups:', err);
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
          Group Name Master
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <Toolbar sx={{ pl: { xs: 1.5, sm: 2 }, pr: { xs: 1.5, sm: 2 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, pt: 2, pb: 2 }}>
          <TextField
            size="small"
            placeholder="Search groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
            sx={{ width: { xs: '100%', sm: 300 } }}
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
            <input
              accept=".xlsx, .xls"
              style={{ display: 'none' }}
              id="accountgroup-import-file"
              type="file"
              onChange={handleImport}
            />
            <label htmlFor={hasAddPermission() ? "accountgroup-import-file" : ""} style={{ flex: 1 }}>
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
              onClick={() => handleOpenDialog('add')} 
              disabled={!hasAddPermission()} 
              sx={{ boxShadow: 0, width: { xs: '100%', sm: 'auto' } }}
            >
              Add Group
            </Button>
          </Box>
        </Toolbar>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 32 } }}>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Group Name</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Edit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedGroups.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => (
                <TableRow hover tabIndex={-1} key={row.Id}>
                  <TableCell sx={{ fontWeight: 500 }}>{row.Id}</TableCell>
                  <TableCell>{row.GroupName}</TableCell>
                  <TableCell align="center">
                    <IconButton 
                      color="primary" 
                      size="small" 
                      onClick={() => handleOpenDialog('edit', row)}
                      disabled={!hasEditPermission() || row.IsSystem === true || row.IsSystem === 1}
                      title={(row.IsSystem === true || row.IsSystem === 1) ? "System Account Groups cannot be edited" : "Edit Account Group"}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton 
                      color="error" 
                      size="small" 
                      onClick={() => openDeleteConfirm(row.Id)}
                      disabled={!hasDeletePermission() || row.IsSystem === true || row.IsSystem === 1}
                      title={(row.IsSystem === true || row.IsSystem === 1) ? "System Account Groups cannot be deleted" : "Delete Account Group"}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filteredGroups.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3 }}>No account groups found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredGroups.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add / Edit Dialog */}
      <Dialog open={openDialog} onClose={(e, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogMode === 'add' ? 'Add New Account Group' : 'Edit Account Group'}</DialogTitle>
        <DialogContent dividers>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField 
              label="Group Name" 
              value={formData.GroupName} 
              onChange={(e) => setFormData({ GroupName: e.target.value })} 
              fullWidth size="small" 
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
          <Button onClick={handleSaveGroup} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteGroup}
        title="Confirm Deletion"
        itemName="this account group"
      />
    </Box>
  );
};

export default AccountGroupMaster;
