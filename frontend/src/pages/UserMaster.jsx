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
import { MENU_STRUCTURE, getAllMenuPaths } from '../config/menuConfig';

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
    IsDelete: false,
    AllowedMenus: [],
    FullName: '',
    BiometricCode: '',
    Department: 'LABOUR',
    Designation: 'Operator',
    SalaryType: 'Monthly',
    MonthlySalary: 15000,
    DailyRate: 600,
    HourlyRate: 75,
    OvertimeRatePerHour: 0,
    StandardWorkingHours: 8
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
      (user.FullName && user.FullName.toLowerCase().includes(searchLower)) ||
      (user.BiometricCode && String(user.BiometricCode).toLowerCase().includes(searchLower)) ||
      (user.Department && user.Department.toLowerCase().includes(searchLower)) ||
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
        IsDelete: isAdmin ? true : !!user.IsDelete,
        FullName: user.FullName || '',
        BiometricCode: user.BiometricCode || '',
        Department: user.Department || 'LABOUR',
        Designation: user.Designation || 'Operator',
        SalaryType: user.SalaryType || 'Monthly',
        MonthlySalary: user.MonthlySalary !== undefined && user.MonthlySalary !== null ? user.MonthlySalary : 15000,
        DailyRate: user.DailyRate !== undefined && user.DailyRate !== null ? user.DailyRate : 600,
        HourlyRate: user.HourlyRate !== undefined && user.HourlyRate !== null ? user.HourlyRate : 75,
        OvertimeRatePerHour: user.OvertimeRatePerHour !== undefined && user.OvertimeRatePerHour !== null ? user.OvertimeRatePerHour : 0,
        StandardWorkingHours: user.StandardWorkingHours !== undefined && user.StandardWorkingHours !== null ? user.StandardWorkingHours : 8,
        AllowedMenus: (user.AllowedMenus !== undefined && user.AllowedMenus !== null)
          ? (user.AllowedMenus ? user.AllowedMenus.split(',').map(s => s.trim()).filter(Boolean) : [])
          : getAllMenuPaths()
      });
    } else {
      setFormData({ 
        Username: '', 
        Password: '', 
        MobileNo: '', 
        UserRole: 'OPERATOR', 
        IsActive: true, 
        IsAdd: false, 
        IsEdit: false, 
        IsDelete: false, 
        FullName: '',
        BiometricCode: '',
        Department: 'LABOUR',
        Designation: 'Operator',
        SalaryType: 'Monthly',
        MonthlySalary: 15000,
        DailyRate: 600,
        HourlyRate: 75,
        OvertimeRatePerHour: 0,
        StandardWorkingHours: 8,
        AllowedMenus: getAllMenuPaths() 
      });
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

  const handleMenuToggle = (path) => {
    setFormData(prev => {
      const current = prev.AllowedMenus;
      if (current.includes(path)) {
        return { ...prev, AllowedMenus: current.filter(p => p !== path) };
      } else {
        return { ...prev, AllowedMenus: [...current, path] };
      }
    });
  };

  const handleSelectAllMenus = (select) => {
    setFormData(prev => ({
      ...prev,
      AllowedMenus: select ? getAllMenuPaths() : []
    }));
  };

  const handleSaveUser = async () => {
    try {
      const url = dialogMode === 'add' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/users` : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/users/${selectedUserId}`;
      const method = dialogMode === 'add' ? 'POST' : 'PUT';
      
      const payload = {
        ...formData,
        IsAdd: formData.UserRole === 'ADMIN' ? true : formData.IsAdd,
        IsEdit: formData.UserRole === 'ADMIN' ? true : formData.IsEdit,
        IsDelete: formData.UserRole === 'ADMIN' ? true : formData.IsDelete,
        AllowedMenus: formData.AllowedMenus.join(',')
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        handleCloseDialog();
        fetchUsers();

        // If the edited user is currently logged in, sync their session immediately
        const currentLogged = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
        if (currentLogged.UserId === selectedUserId) {
          const updatedLogged = { ...currentLogged, ...payload };
          if (localStorage.getItem('user')) {
            localStorage.setItem('user', JSON.stringify(updatedLogged));
          } else if (sessionStorage.getItem('user')) {
            sessionStorage.setItem('user', JSON.stringify(updatedLogged));
          }
          window.dispatchEvent(new Event('storage'));
        }
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
        <Toolbar sx={{ pl: { xs: 1.5, sm: 2 }, pr: { xs: 1.5, sm: 2 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, pt: 2, pb: 2 }}>
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
            sx={{ width: { xs: '100%', sm: 300 } }}
          />
          <Button 
            variant="contained" 
            color="secondary" 
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog('add')} disabled={!hasAddPermission()}
            sx={{ boxShadow: 0, width: { xs: '100%', sm: 'auto' } }}
          >
            Add User
          </Button>
        </Toolbar>

        {/* Data Table */}
        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 32 } }} aria-labelledby="tableTitle">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Sr. No.</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'BiometricCode'}
                    direction={sortConfig.key === 'BiometricCode' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('BiometricCode')}
                  >
                    Biometric ID
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'FullName'}
                    direction={sortConfig.key === 'FullName' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('FullName')}
                  >
                    Employee / User
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'Department'}
                    direction={sortConfig.key === 'Department' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('Department')}
                  >
                    Department
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Salary Basis</TableCell>
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
                <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedUsers
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row, index) => {
                  const salaryText = row.SalaryType === 'Daily'
                    ? `₹${row.DailyRate || 0} / Day`
                    : row.SalaryType === 'Hourly'
                    ? `₹${row.HourlyRate || 0} / Hr`
                    : `₹${row.MonthlySalary || 0} / Month`;

                  return (
                    <TableRow hover tabIndex={-1} key={row.UserId}>
                      <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                      <TableCell>
                        <Chip
                          label={row.BiometricCode ? `#${row.BiometricCode}` : 'N/A'}
                          size="small"
                          sx={{ fontWeight: 600, bgcolor: row.BiometricCode ? '#e0f2fe' : '#f1f5f9', color: row.BiometricCode ? '#0369a1' : '#64748b' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F3B66' }}>
                          {row.FullName || row.Username}
                        </Typography>
                        {row.FullName && row.FullName !== row.Username && (
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                            User: {row.Username}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {row.Department || 'LABOUR'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {row.Designation || 'Operator'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#166534' }}>
                          {salaryText}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                          OT: ₹{row.OvertimeRatePerHour !== undefined && row.OvertimeRatePerHour !== null ? row.OvertimeRatePerHour : 0}/hr • {row.StandardWorkingHours || 8}h/day
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={row.UserRole} 
                          size="small" 
                          color={row.UserRole === 'ADMIN' ? 'primary' : 'default'}
                          sx={{ fontWeight: 600, height: 22 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={row.IsActive ? 'Active' : 'Inactive'} 
                          color={row.IsActive ? 'success' : 'error'} 
                          size="small" 
                          sx={{ fontWeight: 600, height: 22 }}
                        />
                      </TableCell>
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
                  <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
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
      <Dialog open={openDialog} onClose={(event, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#0F3B66', pb: 1 }}>
          {dialogMode === 'add' ? 'Add New User & Employee' : 'Edit User & Employee Settings'}
        </DialogTitle>
        <DialogContent dividers>
          {dialogError && (
            <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>
          )}
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            
            {/* Identity & Credentials */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              1. Basic Information & Login Credentials
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField 
                label="Username" 
                name="Username" 
                value={formData.Username} 
                onChange={handleInputChange} 
                fullWidth 
                size="small" 
                required 
              />
              <TextField 
                label="Full Employee Name" 
                name="FullName" 
                value={formData.FullName} 
                onChange={handleInputChange} 
                fullWidth 
                size="small" 
                placeholder="e.g. AKSHAY LOKHIL"
              />
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
              <TextField 
                label="Mobile No" 
                name="MobileNo" 
                value={formData.MobileNo} 
                onChange={handleInputChange} 
                fullWidth 
                size="small" 
              />
              <TextField 
                label="Biometric ID / Code" 
                name="BiometricCode" 
                value={formData.BiometricCode} 
                onChange={handleInputChange} 
                fullWidth 
                size="small" 
                helperText="Matches User ID in biometric machine (e.g. 0001, 0002)"
              />
              <TextField 
                label="System Role" 
                name="UserRole" 
                value={formData.UserRole} 
                onChange={handleInputChange} 
                select 
                fullWidth 
                size="small"
              >
                <MenuItem value="OPERATOR">OPERATOR</MenuItem>
                <MenuItem value="ADMIN">ADMIN</MenuItem>
                <MenuItem value="MANAGER">MANAGER</MenuItem>
              </TextField>
            </Box>

            {/* Department & Designation */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', textTransform: 'uppercase', letterSpacing: 0.5, mt: 1 }}>
              2. Department & Designation
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField 
                label="Department" 
                name="Department" 
                value={formData.Department} 
                onChange={handleInputChange} 
                fullWidth 
                size="small" 
                placeholder="e.g. LABOUR, OFFICE, TURNING"
              />
              <TextField 
                label="Designation" 
                name="Designation" 
                value={formData.Designation} 
                onChange={handleInputChange} 
                fullWidth 
                size="small" 
                placeholder="e.g. Operator, Staff, Manager"
              />
            </Box>

            {/* Attendance & Salary Configuration */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', textTransform: 'uppercase', letterSpacing: 0.5, mt: 1 }}>
              3. Attendance & Salary Parameters
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
              <TextField 
                label="Salary Calculation Type" 
                name="SalaryType" 
                value={formData.SalaryType} 
                onChange={handleInputChange} 
                select 
                fullWidth 
                size="small"
              >
                <MenuItem value="Monthly">Monthly Fixed</MenuItem>
                <MenuItem value="Daily">Daily Wages</MenuItem>
                <MenuItem value="Hourly">Hourly Rate</MenuItem>
              </TextField>

              {formData.SalaryType === 'Monthly' && (
                <TextField 
                  label="Monthly Base Salary (₹)" 
                  name="MonthlySalary" 
                  type="number"
                  value={formData.MonthlySalary} 
                  onChange={handleInputChange} 
                  fullWidth 
                  size="small" 
                />
              )}

              {formData.SalaryType === 'Daily' && (
                <TextField 
                  label="Daily Rate (₹)" 
                  name="DailyRate" 
                  type="number"
                  value={formData.DailyRate} 
                  onChange={handleInputChange} 
                  fullWidth 
                  size="small" 
                />
              )}

              {formData.SalaryType === 'Hourly' && (
                <TextField 
                  label="Hourly Rate (₹)" 
                  name="HourlyRate" 
                  type="number"
                  value={formData.HourlyRate} 
                  onChange={handleInputChange} 
                  fullWidth 
                  size="small" 
                />
              )}

              <TextField 
                label="Overtime Rate / Hour (₹)" 
                name="OvertimeRatePerHour" 
                type="number"
                value={formData.OvertimeRatePerHour} 
                onChange={handleInputChange} 
                fullWidth 
                size="small" 
                helperText="Leave 0 if OT is not applicable"
              />
              <TextField 
                label="Standard Working Hours / Day" 
                name="StandardWorkingHours" 
                type="number"
                value={formData.StandardWorkingHours} 
                onChange={handleInputChange} 
                fullWidth 
                size="small" 
                placeholder="8"
              />
            </Box>

            {/* Access & Action Permissions */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', textTransform: 'uppercase', letterSpacing: 0.5, mt: 1 }}>
              4. Permissions & Status
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', p: 1, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e2e8f0' }}>
              <FormControlLabel
                control={<Checkbox name="IsActive" checked={formData.IsActive} onChange={handleInputChange} color="success" />}
                label="Active Account"
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

            {/* Menus Access Section */}
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#0F3B66' }}>
                  Menu Access Permissions
                </Typography>
                <Box>
                  <Button size="small" onClick={() => handleSelectAllMenus(true)} disabled={formData.UserRole === 'ADMIN'}>Select All</Button>
                  <Button size="small" onClick={() => handleSelectAllMenus(false)} disabled={formData.UserRole === 'ADMIN'}>Deselect All</Button>
                </Box>
              </Box>
              <Box sx={{ maxHeight: 250, overflowY: 'auto', p: 1.5, border: '1px solid #e2e8f0', borderRadius: 1, bgcolor: formData.UserRole === 'ADMIN' ? '#f8fafc' : '#ffffff' }}>
                {MENU_STRUCTURE.map((section, idx) => {
                  if (section.adminOnly) return null;
                  
                  const renderCheckbox = (item) => {
                    if (!item.path) return null;
                    return (
                      <FormControlLabel
                        key={item.path}
                        control={
                          <Checkbox 
                            checked={formData.UserRole === 'ADMIN' || formData.AllowedMenus.includes(item.path)}
                            onChange={() => handleMenuToggle(item.path)}
                            disabled={formData.UserRole === 'ADMIN'}
                            size="small"
                            sx={{ padding: '4px' }}
                          />
                        }
                        label={<Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{item.title}</Typography>}
                        sx={{ minWidth: '160px', m: 0, mr: 2 }}
                      />
                    );
                  };

                  return (
                    <Box key={idx} sx={{ mb: 1.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        {section.title}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', ml: 1, mt: 0.5 }}>
                        {section.path && renderCheckbox(section)}
                        {section.children && section.children.map(renderCheckbox)}
                        {section.groups && section.groups.map(group => (
                          <Box key={group.groupTitle} sx={{ width: '100%', mt: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: '#94a3b8' }}>{group.groupTitle}</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', ml: 1 }}>
                              {group.children.map(renderCheckbox)}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
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
