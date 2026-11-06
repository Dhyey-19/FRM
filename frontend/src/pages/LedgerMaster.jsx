import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  MenuItem, Select, FormControl, InputLabel, Autocomplete
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Delete as DeleteIcon, ContactPage as ContactIcon } from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';

const initialFormState = {
  LedgerName: '', AccountGroupID: '', Address: '', City: '', State: '', GSTIN: '',
  MobileNo: '', Email: '', OpeningBalance: '', ClosingBalance: '', BankName: '', AccountNo: '',
  IFSC: '', UPI: '', OwnBrand: '', OtherBrand: '', Discount: '', CD: '', Bill: '',
  PaymentTerm: '', Transport: '', DeliveryDays: '', Remark: ''
};

const indianStates = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam",
  "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal"
];

const LedgerMaster = () => {
  const [ledgers, setLedgers] = useState([]);
  const [accountGroups, setAccountGroups] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccountGroup, setSelectedAccountGroup] = useState('All');
  
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add');
  const [dialogError, setDialogError] = useState('');
  const [editId, setEditId] = useState(null);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [formData, setFormData] = useState(initialFormState);

  // Quick Add states
  const [openGroupDialog, setOpenGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const fetchLedgers = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setLedgers(data);
    } catch (error) {
      console.error('Error fetching ledgers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountGroups = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/account-groups`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setAccountGroups(data);
    } catch (error) {
      console.error('Error fetching account groups:', error);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/brands`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setBrands(data);
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  useEffect(() => {
    fetchLedgers();
    fetchAccountGroups();
    fetchBrands();
  }, []);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

  const uniqueAccountGroups = Array.from(
    new Set([
      ...accountGroups.map(g => g.GroupName).filter(Boolean),
      ...ledgers.map(l => l.AccountGroupName).filter(Boolean)
    ])
  ).sort((a, b) => a.localeCompare(b));

  const filteredLedgers = ledgers.filter(l => {
    const matchesSearch = (l.LedgerName && l.LedgerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.AccountGroupName && l.AccountGroupName.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesGroup = selectedAccountGroup === 'All' || 
      (l.AccountGroupName && l.AccountGroupName.toLowerCase() === selectedAccountGroup.toLowerCase());

    return matchesSearch && matchesGroup;
  });

  const handleOpenDialog = (mode, ledger = null) => {
    setDialogMode(mode);
    setDialogError('');
    if (mode === 'edit' && ledger) {
      setEditId(ledger.Id);
      setFormData({
        ...initialFormState,
        ...ledger
      });
    } else {
      setEditId(null);
      setFormData({
        ...initialFormState,
        AccountGroupID: accountGroups.length > 0 ? accountGroups[0].Id : ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditId(null);
    setDialogError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'ClosingBalance') return;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      if (name === 'OpeningBalance') {
        const oldOb = parseFloat(prev.OpeningBalance || 0);
        const newOb = parseFloat(value || 0);
        const diff = newOb - oldOb;
        
        if (dialogMode === 'add') {
          newData.ClosingBalance = value;
        } else {
          const currentCb = parseFloat(prev.ClosingBalance || 0);
          newData.ClosingBalance = Math.round((currentCb + diff) * 100) / 100;
        }
      }
      
      return newData;
    });
  };

  const handleSaveLedger = async () => {
    try {
      const url = dialogMode === 'add' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers` : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers/${editId}`;
      const method = dialogMode === 'add' ? 'POST' : 'PUT';
      
      const payload = { ...formData };
      ['OpeningBalance', 'Discount', 'CD', 'Bill', 'DeliveryDays'].forEach(field => {
        if (payload[field] === '') payload[field] = null;
      });

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        handleCloseDialog();
        fetchLedgers();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving ledger');
      }
    } catch (error) {
      setDialogError('Network error. Please try again.');
    }
  };

  const openDeleteConfirm = (id) => {
    setItemToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteLedger = async () => {
    if (itemToDelete) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers/${itemToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchLedgers();
          setDeleteConfirmOpen(false);
        }
      } catch (error) {
        console.error('Error deleting ledger:', error);
      }
    }
  };

  const handleQuickAddGroup = async () => {
    if (!newGroupName) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/account-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ GroupName: newGroupName })
      });
      if (response.ok) {
        await fetchAccountGroups();
        setOpenGroupDialog(false);
        setNewGroupName('');
      } else {
        alert('Failed to add group. It may already exist.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error.');
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ContactIcon /> Ledger Master
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <Toolbar sx={{ pl: { xs: 1.5, sm: 2 }, pr: { xs: 1.5, sm: 2 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, pt: 2, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', width: { xs: '100%', md: 'auto' } }}>
            <TextField
              size="small"
              placeholder="Search ledgers..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
              sx={{ width: { xs: '100%', sm: 260 } }}
            />
            <FormControl size="small" sx={{ width: { xs: '100%', sm: 220 } }}>
              <InputLabel>Account Group</InputLabel>
              <Select
                label="Account Group"
                value={selectedAccountGroup}
                onChange={(e) => {
                  setSelectedAccountGroup(e.target.value);
                  setPage(0);
                }}
                MenuProps={{ PaperProps: { sx: { maxHeight: 350 } } }}
              >
                <MenuItem value="All">All Groups</MenuItem>
                {uniqueAccountGroups.map((groupName) => (
                  <MenuItem key={groupName} value={groupName}>
                    {groupName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {(searchTerm || selectedAccountGroup !== 'All') && (
              <Button 
                size="small" 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedAccountGroup('All');
                  setPage(0);
                }}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Clear
              </Button>
            )}
          </Box>
          <Button 
            variant="contained" 
            color="secondary" 
            startIcon={<AddIcon />} 
            onClick={() => handleOpenDialog('add')} 
            disabled={!hasAddPermission()}
            sx={{ width: { xs: '100%', md: 'auto' } }}
          >
            Add Ledger
          </Button>
        </Toolbar>

        <TableContainer>
          <Table 
            size="small" 
            sx={{ 
              minWidth: 750, 
              '& .MuiTableRow-root': { height: 32 },
              '& .MuiTableCell-root': { py: 0.35, px: 1.5, fontSize: '0.85rem' },
              '& .MuiTableCell-head': { py: 0.75, fontWeight: 700 }
            }}
          >
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Ledger Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Account Group</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Transport / Delivery</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Opening Bal.</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Closing Bal.</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Edit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLedgers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => (
                <TableRow hover tabIndex={-1} key={row.Id}>
                  <TableCell sx={{ fontWeight: 500 }}>{row.LedgerName}</TableCell>
                  <TableCell>{row.AccountGroupName}</TableCell>
                  <TableCell>
                    {row.Transport || row.DeliveryDays ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span>{row.Transport || '-'}</span>
                        {row.DeliveryDays ? (
                          <Chip 
                            label={`${row.DeliveryDays}d`} 
                            size="small" 
                            variant="outlined" 
                            sx={{ height: 20, fontSize: '0.72rem', fontWeight: 600, color: '#0F3B66', borderColor: '#cbd5e1' }} 
                            title={`Expected delivery: ${row.DeliveryDays} days`}
                          />
                        ) : null}
                      </Box>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{row.OpeningBalance || '0.00'}</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: row.ClosingBalance < 0 ? 'error.main' : 'success.main' }}>
                    {row.ClosingBalance || '0.00'}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton 
                      color="primary" 
                      size="small" 
                      onClick={() => handleOpenDialog('edit', row)}
                      disabled={!hasEditPermission()}
                      title="Edit Ledger"
                      sx={{ p: 0.25 }}
                    >
                      <EditIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton 
                      color="error" 
                      size="small" 
                      onClick={() => openDeleteConfirm(row.Id)}
                      disabled={!hasDeletePermission()}
                      title="Delete Ledger"
                      sx={{ p: 0.25 }}
                    >
                      <DeleteIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filteredLedgers.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3 }}>No ledgers found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredLedgers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add / Edit Dialog */}
      <Dialog open={openDialog} onClose={(e, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="md" fullWidth>
        <DialogTitle>{dialogMode === 'add' ? 'Add New Ledger' : 'Edit Ledger'}</DialogTitle>
        <DialogContent dividers>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
          
          <Box component="form" sx={{ 
            display: 'flex', flexDirection: 'column', gap: 2, mt: 1,
            '& input[type=number]': {
              '-moz-appearance': 'textfield'
            },
            '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
              '-webkit-appearance': 'none',
              margin: 0
            }
          }}>
            
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e0e0e0', pb: 0.5, mt: 1 }}>General Details</Typography>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField label="Ledger Name" name="LedgerName" value={formData.LedgerName} onChange={handleInputChange} fullWidth size="small" required />
              
              <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                <Autocomplete
                  options={accountGroups}
                  getOptionLabel={(option) => option.GroupName || ''}
                  value={accountGroups.find(ag => ag.Id === formData.AccountGroupID) || null}
                  onChange={(event, newValue) => {
                    handleInputChange({ target: { name: 'AccountGroupID', value: newValue ? newValue.Id : '' } });
                  }}
                  renderInput={(params) => <TextField {...params} label="Account Group" required />}
                  fullWidth
                  size="small"
                  disableClearable
                />
                 <IconButton color="secondary" onClick={() => setOpenGroupDialog(true)} disabled={!hasAddPermission()} sx={{ border: '1px solid', borderColor: 'secondary.main', borderRadius: 1 }}>
                  <AddIcon />
                </IconButton>
              </Box>
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e0e0e0', pb: 0.5, mt: 2 }}>Contact & Location</Typography>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField label="Address" name="Address" value={formData.Address || ''} onChange={handleInputChange} fullWidth size="small" />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField label="City" name="City" value={formData.City || ''} onChange={handleInputChange} fullWidth size="small" />
              <Autocomplete
                options={indianStates}
                value={formData.State || null}
                onChange={(event, newValue) => {
                  handleInputChange({ target: { name: 'State', value: newValue || '' } });
                }}
                renderInput={(params) => <TextField {...params} label="State" size="small" />}
                fullWidth
                size="small"
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField label="Mobile No" name="MobileNo" value={formData.MobileNo || ''} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="Email" name="Email" value={formData.Email || ''} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="GSTIN" name="GSTIN" value={formData.GSTIN || ''} onChange={handleInputChange} fullWidth size="small" />
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e0e0e0', pb: 0.5, mt: 2 }}>Financial & Banking</Typography>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField label="Opening Balance" name="OpeningBalance" type="number" value={formData.OpeningBalance || ''} onChange={handleInputChange} fullWidth size="small" />
              <TextField 
                label="Closing Balance" 
                name="ClosingBalance" 
                type="number" 
                value={formData.ClosingBalance !== undefined && formData.ClosingBalance !== null ? formData.ClosingBalance : ''} 
                InputProps={{ readOnly: true, sx: { bgcolor: '#f0f0f0' } }} 
                fullWidth 
                size="small" 
              />
              <TextField label="Bank Name" name="BankName" value={formData.BankName || ''} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="Account No" name="AccountNo" value={formData.AccountNo || ''} onChange={handleInputChange} fullWidth size="small" />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField label="IFSC Code" name="IFSC" value={formData.IFSC || ''} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="UPI" name="UPI" value={formData.UPI || ''} onChange={handleInputChange} fullWidth size="small" />
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e0e0e0', pb: 0.5, mt: 2 }}>Business & Terms</Typography>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <Autocomplete
                options={brands.map(b => b.BrandName)}
                value={formData.OwnBrand || ''}
                onChange={(event, newValue) => setFormData(prev => ({ ...prev, OwnBrand: newValue || '' }))}
                renderInput={(params) => <TextField {...params} label="Own Brand" size="small" />}
                sx={{ width: '100%' }}
              />
              <TextField label="Other Brand" name="OtherBrand" value={formData.OtherBrand || ''} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="Discount (%)" name="Discount" type="number" value={formData.Discount || ''} onChange={handleInputChange} fullWidth size="small" />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField label="Cash Discount (CD) %" name="CD" type="number" value={formData.CD || ''} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="Bill (%)" name="Bill" type="number" value={formData.Bill || ''} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="Payment Term" name="PaymentTerm" type="number" value={formData.PaymentTerm || ''} onChange={handleInputChange} fullWidth size="small" />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField label="Transport" name="Transport" value={formData.Transport || ''} onChange={handleInputChange} fullWidth size="small" />
              <TextField 
                label="Delivery Days" 
                name="DeliveryDays" 
                type="number" 
                inputProps={{ min: 0 }} 
                value={formData.DeliveryDays || ''} 
                onChange={handleInputChange} 
                helperText="Expected days of delivery" 
                fullWidth 
                size="small" 
              />
              <TextField label="Remark" name="Remark" value={formData.Remark || ''} onChange={handleInputChange} fullWidth size="small" />
            </Box>

          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
          <Button onClick={handleSaveLedger} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteLedger}
        title="Confirm Deletion"
        itemName="this ledger"
      />

      {/* Quick Add Account Group Dialog */}
      <Dialog open={openGroupDialog} onClose={() => setOpenGroupDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Account Group</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus
            label="Group Name"
            fullWidth
            size="small"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenGroupDialog(false)} color="inherit">Cancel</Button>
          <Button onClick={handleQuickAddGroup} variant="contained" color="primary" disabled={!newGroupName}>Add</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default LedgerMaster;
