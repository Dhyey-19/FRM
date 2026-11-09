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
  Alert,
  TableSortLabel
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

const AssetMaster = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'AssetId', direction: 'asc' });
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [dialogError, setDialogError] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  
  // Delete Confirm States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState(null);

  const [formData, setFormData] = useState({
    AssetName: '',
    Quantity: 0,
    UnitValue: 0
  });

  const fetchAssets = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/assets`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setAssets(data);
      } else {
        setAssets([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching assets:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter assets based on search
  const filteredAssets = assets.filter(asset => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (asset.AssetName && asset.AssetName.toLowerCase().includes(searchLower))
    );
  });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const handleOpenDialog = (mode, asset = null) => {
    setDialogMode(mode);
    setDialogError('');
    if (mode === 'edit' && asset) {
      setSelectedAssetId(asset.AssetId);
      setFormData({
        AssetName: asset.AssetName,
        Quantity: asset.Quantity,
        UnitValue: asset.UnitValue
      });
    } else {
      setFormData({ AssetName: '', Quantity: 0, UnitValue: 0 });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedAssetId(null);
    setDialogError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSaveAsset = async () => {
    try {
      const url = dialogMode === 'add' ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/assets` : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/assets/${selectedAssetId}`;
      const method = dialogMode === 'add' ? 'POST' : 'PUT';
      
      const qty = parseInt(formData.Quantity, 10) || 0;
      const unitVal = parseFloat(formData.UnitValue) || 0;
      const payload = {
        AssetName: formData.AssetName,
        Quantity: qty,
        UnitValue: unitVal,
        TotalValue: qty * unitVal
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        handleCloseDialog();
        fetchAssets();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving asset');
      }
    } catch (error) {
      console.error('Error saving asset:', error);
      setDialogError('A network error occurred. Please try again.');
    }
  };

  const openDeleteConfirm = (id) => {
    setAssetToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    setAssetToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const handleDeleteAsset = async () => {
    if (assetToDelete) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/assets/${assetToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchAssets();
          closeDeleteConfirm();
        } else {
          console.error('Error deleting asset');
        }
      } catch (error) {
        console.error('Error deleting asset:', error);
      }
    }
  };

  const handleExport = () => {
    const exportData = assets.map((asset, index) => {
      const q = Number(asset.Quantity) || 0;
      const u = Number(asset.UnitValue) || 0;
      return {
        'Sr. No.': index + 1,
        AssetName: asset.AssetName,
        Quantity: q,
        UnitValue: u,
        TotalValue: asset.TotalValue != null ? Number(asset.TotalValue) : (q * u)
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");
    XLSX.writeFile(workbook, "AssetMaster.xlsx");
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
        
        // Ensure data exists
        if (data.length > 0) {
          // Map potential column names
          const mappedData = data.map(row => ({
            AssetName: row.AssetName || row['Asset Name'],
            Quantity: row.Quantity,
            UnitValue: row.UnitValue || row['Unit Value']
          }));

          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/assets/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mappedData)
          });
          
          if (response.ok) {
            fetchAssets();
            alert('Assets imported successfully!');
          } else {
            const resData = await response.json();
            alert(`Error importing assets: ${resData.message}`);
          }
        }
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Error parsing the Excel file.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // reset input
  };


  return (
    <Box>
      {/* Page Title */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
          Asset Master
        </Typography>
      </Box>

      {/* Main Content Paper */}
      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        
        {/* Toolbar */}
        <Toolbar sx={{ pl: { xs: 1.5, sm: 2 }, pr: { xs: 1.5, sm: 2 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, pt: 2, pb: 2 }}>
          <TextField
            size="small"
            placeholder="Search assets..."
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
              id="raised-button-file"
              type="file"
              onChange={handleImport}
            />
            <label htmlFor={hasAddPermission() ? "raised-button-file" : ""} style={{ flex: 1 }}>
              <Button disabled={!hasAddPermission()} 
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
              Add Asset
            </Button>
          </Box>
        </Toolbar>

        {/* Data Table */}
        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 32 } }} aria-labelledby="tableTitle">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Sr. No.</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'AssetName'}
                    direction={sortConfig.key === 'AssetName' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('AssetName')}
                  >
                    Asset Name
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'Quantity'}
                    direction={sortConfig.key === 'Quantity' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('Quantity')}
                  >
                    Quantity
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'UnitValue'}
                    direction={sortConfig.key === 'UnitValue' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('UnitValue')}
                  >
                    Unit Value
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'TotalValue'}
                    direction={sortConfig.key === 'TotalValue' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('TotalValue')}
                  >
                    Total Value
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Edit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedAssets
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row, index) => {
                  return (
                    <TableRow hover tabIndex={-1} key={row.AssetId}>
                      <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{row.AssetName}</TableCell>
                      <TableCell>{row.Quantity}</TableCell>
                      <TableCell>{row.UnitValue}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#0F3B66' }}>
                        {Number(row.TotalValue != null ? row.TotalValue : ((row.Quantity || 0) * (row.UnitValue || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton color="primary" size="small" onClick={() => handleOpenDialog('edit', row)} disabled={!hasEditPermission()}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton color="error" size="small" onClick={() => openDeleteConfirm(row.AssetId)} disabled={!hasDeletePermission()}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {sortedAssets.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    No assets found.
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
          count={sortedAssets.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add / Edit Dialog */}
      <Dialog open={openDialog} onClose={(event, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogMode === 'add' ? 'Add New Asset' : 'Edit Asset'}</DialogTitle>
        <DialogContent dividers>
          {dialogError && (
            <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>
          )}
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Asset Name" name="AssetName" value={formData.AssetName} onChange={handleInputChange} fullWidth size="small" />
            <TextField label="Quantity" name="Quantity" type="number" value={formData.Quantity} onChange={handleInputChange} fullWidth size="small" />
            <TextField label="Unit Value" name="UnitValue" type="number" value={formData.UnitValue} onChange={handleInputChange} fullWidth size="small" />
            <TextField 
              label="Total Value (Calculated: Quantity × Unit Value)" 
              value={((parseInt(formData.Quantity, 10) || 0) * (parseFloat(formData.UnitValue) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
              InputProps={{ readOnly: true }} 
              fullWidth 
              size="small" 
              sx={{ backgroundColor: '#f8fafc' }} 
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
          <Button onClick={handleSaveAsset} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={closeDeleteConfirm}
        onConfirm={handleDeleteAsset}
        title="Confirm Deletion"
        itemName="this asset"
      />
    </Box>
  );
};

export default AssetMaster;
