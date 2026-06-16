import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, 
  Typography, 
  Breadcrumbs, 
  Link as MuiLink, 
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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  FormControlLabel,
  Checkbox,
  MenuItem,
  Alert,
  TableSortLabel
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  Home as HomeIcon,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';

// We will fetch users from the backend
const UserMaster = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'UserId', direction: 'asc' });
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [dialogError, setDialogError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Delete Confirm States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  const [formData, setFormData] = useState({
    Username: '',
    Password: '',
    MobileNo: '',
    UserRole: 'OPERATOR',
    IsActive: false,
    IsAdd: false,
    IsEdit: false,
    IsDelete: false
  });

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/users`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setUsers(data);
      } else {
        setUsers([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      setLoading(false);
    }
  };

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter users based on search
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.Username && user.Username.toLowerCase().includes(searchLower)) ||
      (user.UserRole && user.UserRole.toLowerCase().includes(searchLower)) ||
      (user.MobileNo && user.MobileNo.includes(searchTerm))
    );
  });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const handleOpenDialog = (mode, user = null) => {
    setDialogMode(mode);
    setDialogError('');
    setShowPassword(false);
    if (mode === 'edit' && user) {
      setSelectedUserId(user.UserId);
      const isAdmin = user.UserRole === 'ADMIN';
      setFormData({
        Username: user.Username,
        Password: user.Password || '',
        MobileNo: user.MobileNo || '',
        UserRole: user.UserRole,
        IsActive: user.IsActive,
        IsAdd: isAdmin ? true : !!user.IsAdd,
        IsEdit: isAdmin ? true : !!user.IsEdit,
        IsDelete: isAdmin ? true : !!user.IsDelete
      });
    } else {
      setFormData({ Username: '', Password: '', MobileNo: '', UserRole: 'OPERATOR', IsActive: false, IsAdd: false, IsEdit: false, IsDelete: false });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedUserId(null);
    setDialogError('');
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'UserRole' && value === 'ADMIN') {
      setFormData({
        ...formData,
        UserRole: value,
        IsAdd: true,
        IsEdit: true,
        IsDelete: true
      });
    } else {
      setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    }
  };

  const handleSaveUser = async () => {
    try {
      const url = dialogMode === 'add' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/users` : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/users/${selectedUserId}`;
      const method = dialogMode === 'add' ? 'POST' : 'PUT';
      
      const payload = {
        ...formData,
        IsAdd: formData.UserRole === 'ADMIN' ? true : formData.IsAdd,
        IsEdit: formData.UserRole === 'ADMIN' ? true : formData.IsEdit,
        IsDelete: formData.UserRole === 'ADMIN' ? true : formData.IsDelete
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        handleCloseDialog();
        fetchUsers();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving user');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      setDialogError('A network error occurred. Please try again.');
    }
  };

  const openDeleteConfirm = (id) => {
    setUserToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    setUserToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const handleDeleteUser = async () => {
    if (userToDelete) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/users/${userToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchUsers();
          closeDeleteConfirm();
        } else {
          // If needed, we could add a snackbar here, but logging is fine for edge case delete errors
          console.error('Error deleting user');
        }
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  return (
    <Box>
      {/* Page Title */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
          User Master
        </Typography>
      </Box>

      {/* Main Content Paper */}
      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        
        {/* Toolbar */}
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, display: 'flex', justifyContent: 'space-between', pt: 2, pb: 2 }}>
          <TextField
            size="small"
            placeholder="Search users..."
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
            Add User
          </Button>
        </Toolbar>

        {/* Data Table */}
        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 40 } }} aria-labelledby="tableTitle">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Sr. No.</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'Username'}
                    direction={sortConfig.key === 'Username' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('Username')}
                  >
                    Username
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'MobileNo'}
                    direction={sortConfig.key === 'MobileNo' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('MobileNo')}
                  >
                    Mobile Number
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'UserRole'}
                    direction={sortConfig.key === 'UserRole' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('UserRole')}
                  >
                    Role
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'IsActive'}
                    direction={sortConfig.key === 'IsActive' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('IsActive')}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Add</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Edit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Delete</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedUsers
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row, index) => {
                  return (
                    <TableRow hover tabIndex={-1} key={row.UserId}>
                      <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{row.Username}</TableCell>
                      <TableCell>{row.MobileNo || '-'}</TableCell>
                      <TableCell>{row.UserRole}</TableCell>
                      <TableCell>
                        <Chip 
                          label={row.IsActive ? 'Active' : 'Inactive'} 
                          color={row.IsActive ? 'success' : 'error'} 
                          size="small" 
                          sx={{ fontWeight: 600, height: 24 }}
                        />
                      </TableCell>
                      <TableCell align="center">{row.IsAdd ? 'Yes' : 'No'}</TableCell>
                      <TableCell align="center">{row.IsEdit ? 'Yes' : 'No'}</TableCell>
                      <TableCell align="center">{row.IsDelete ? 'Yes' : 'No'}</TableCell>
                      <TableCell align="center">
                        <IconButton color="primary" size="small" onClick={() => handleOpenDialog('edit', row)} disabled={!hasEditPermission()}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton color="error" size="small" onClick={() => openDeleteConfirm(row.UserId)} disabled={!hasDeletePermission()}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {sortedUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                    No users found matching your search.
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
          count={sortedUsers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add / Edit Dialog */}
      <Dialog open={openDialog} onClose={(event, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogMode === 'add' ? 'Add New User' : 'Edit User'}</DialogTitle>
        <DialogContent dividers>
          {dialogError && (
            <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>
          )}
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Username" name="Username" value={formData.Username} onChange={handleInputChange} fullWidth size="small" />
            <TextField 
              label="Password" 
              name="Password" 
              value={formData.Password} 
              onChange={handleInputChange} 
              type={showPassword ? 'text' : 'password'} 
              fullWidth 
              size="small" 
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                      sx={{ p: 0.5 }}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <TextField label="Mobile No" name="MobileNo" value={formData.MobileNo} onChange={handleInputChange} fullWidth size="small" />
            <TextField label="Role" name="UserRole" value={formData.UserRole} onChange={handleInputChange} select fullWidth size="small">
              <MenuItem value="OPERATOR">OPERATOR</MenuItem>
              <MenuItem value="ADMIN">ADMIN</MenuItem>
              <MenuItem value="MANAGER">MANAGER</MenuItem>
            </TextField>
            <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={<Checkbox name="IsActive" checked={formData.IsActive} onChange={handleInputChange} />}
                label="Active"
              />
              <FormControlLabel
                control={<Checkbox name="IsAdd" checked={formData.UserRole === 'ADMIN' ? true : formData.IsAdd} onChange={handleInputChange} disabled={formData.UserRole === 'ADMIN'} />}
                label="Add Permission"
              />
              <FormControlLabel
                control={<Checkbox name="IsEdit" checked={formData.UserRole === 'ADMIN' ? true : formData.IsEdit} onChange={handleInputChange} disabled={formData.UserRole === 'ADMIN'} />}
                label="Edit Permission"
              />
              <FormControlLabel
                control={<Checkbox name="IsDelete" checked={formData.UserRole === 'ADMIN' ? true : formData.IsDelete} onChange={handleInputChange} disabled={formData.UserRole === 'ADMIN'} />}
                label="Delete Permission"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
          <Button onClick={handleSaveUser} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={closeDeleteConfirm}
        onConfirm={handleDeleteUser}
        title="Confirm Deletion"
        itemName="this user"
      />
    </Box>
  );
};

export default UserMaster;
