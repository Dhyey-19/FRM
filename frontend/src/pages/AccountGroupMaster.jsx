import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';

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
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => handleOpenDialog('add')} disabled={!hasAddPermission()} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Add Group
          </Button>
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
