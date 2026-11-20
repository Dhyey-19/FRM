import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Alert,
  Autocomplete,
  TableSortLabel,
  LinearProgress,
  Tabs,
  Tab,
  MenuItem,
  Chip,
  FormControl,
  InputLabel,
  Select,
  Tooltip
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  Inventory2Outlined as InventoryIcon,
  FileDownload as ExportIcon,
  FileUpload as ImportIcon,
  FilterList as FilterListIcon,
  RestartAlt as ResetIcon,
  WarningAmber,
  HourglassEmpty
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import * as XLSX from 'xlsx';
import { ensureNumericWorksheet } from '../utils/excelHelper';

const ItemMaster = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParamItemCode = searchParams.get('itemCode');
  const filterParamSubCode = searchParams.get('subCode');

  const [items, setItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [itemTypes, setItemTypes] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'ItemCode', direction: 'asc' });
  
  // Filter States
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterItemCategory, setFilterItemCategory] = useState('All');
  const [filterItemType, setFilterItemType] = useState('All');
  const [filterSeries, setFilterSeries] = useState('All');
  const [filterDeadStock, setFilterDeadStock] = useState('All');
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [dialogError, setDialogError] = useState('');

  // View Details Modal States
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedViewItem, setSelectedViewItem] = useState(null);

  const handleOpenViewModal = (item) => {
    setSelectedViewItem(item);
    setViewModalOpen(true);
  };

  const handleCloseViewModal = () => {
    setViewModalOpen(false);
    setSelectedViewItem(null);
  };
  
  // Quick Dead Stock Modal States
  const [deadStockModalOpen, setDeadStockModalOpen] = useState(false);
  const [selectedDeadStockItem, setSelectedDeadStockItem] = useState(null);
  const [quickDeadStockType, setQuickDeadStockType] = useState('None');
  const [quickDeadStockDays, setQuickDeadStockDays] = useState('');
  const [quickModalLoading, setQuickModalLoading] = useState(false);

  // Track original composite key for edit PUT request
  const [originalItemCode, setOriginalItemCode] = useState(null);
  const [originalSubCode, setOriginalSubCode] = useState('');
  
  // Delete Confirm States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Import States
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState({ added: [], updated: [], failed: [] });
  const [showImportResults, setShowImportResults] = useState(false);
  const [resultTab, setResultTab] = useState(0);

  const [formData, setFormData] = useState({
    Category: 'Inhouse',
    ItemCategory: '',
    ItemCode: '',
    SubCode: '',
    ItemName: '',
    WarehouseNo: '',
    Location: '',
    ItemType: '',
    Series: '',
    StdWeight: '',
    Unit: '',
    MRP: '',
    Costing: '',
    OpeningStock: '',
    ClosingStock: '',
    HSNCode: '',
    ReorderLevel: '',
    DeadStockType: 'None',
    DeadStockDays: '',
    IsDeadStock: false
  });

  const fetchItems = async (singleCode = null, singleSubCode = null) => {
    setLoading(true);
    try {
      let url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items`;
      if (singleCode) {
        url += `?itemCode=${encodeURIComponent(singleCode)}`;
        if (singleSubCode !== null && singleSubCode !== undefined) {
          url += `&subCode=${encodeURIComponent(singleSubCode)}`;
        }
      }
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setItems(data);
      } else {
        setItems([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching items:', error);
      setLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/brands`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setBrands(data.map(b => b.BrandName));
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  const getItemTypeLabel = (code) => {
    if (!code) return '';
    const map = {
      'FG': 'FG (Finished Good)',
      'RM': 'RM (Raw Material)',
      'SF': 'SF (Semi-Finished)',
      'BOP': 'BOP (Bought Out Part)'
    };
    return map[code.toUpperCase()] || code;
  };

  const fetchItemTypes = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/item-types`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setItemTypes(data.map(t => t.ItemType));
      }
    } catch (error) {
      console.error('Error fetching item types:', error);
    }
  };

  const fetchUnits = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/units`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setUnits(data.map(u => u.Unit));
      }
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  useEffect(() => {
    if (filterParamItemCode) {
      fetchItems(filterParamItemCode, filterParamSubCode);
    } else {
      fetchItems();
    }
    fetchBrands();
    fetchItemTypes();
    fetchUnits();
  }, [filterParamItemCode, filterParamSubCode]);

  const handleClearSingleItemFilter = () => {
    setSearchParams({});
    fetchItems();
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter items based on search and dropdowns
  const uniqueSeries = ['All', ...new Set(items.map(i => i.Series).filter(Boolean))];
  const uniqueItemCategories = ['All', ...new Set(items.map(i => i.ItemCategory).filter(Boolean))];

  const filteredItems = items.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      (item.ItemName && item.ItemName.toLowerCase().includes(searchLower)) ||
      (item.ItemCode && item.ItemCode.toLowerCase().includes(searchLower)) ||
      (item.SubCode && item.SubCode.toLowerCase().includes(searchLower)) ||
      (item.ItemCategory && item.ItemCategory.toLowerCase().includes(searchLower)) ||
      (item.WarehouseNo && item.WarehouseNo.toLowerCase().includes(searchLower)) ||
      (item.Location && item.Location.toLowerCase().includes(searchLower)) ||
      (item.Series && item.Series.toLowerCase().includes(searchLower))
    );
    const matchesCategory = filterCategory === 'All' || item.Category === filterCategory;
    const matchesItemCategory = filterItemCategory === 'All' || item.ItemCategory === filterItemCategory;
    const matchesType = filterItemType === 'All' || item.ItemType === filterItemType;
    const matchesSeries = filterSeries === 'All' || item.Series === filterSeries;
    
    let matchesDeadStock = true;
    if (filterDeadStock === 'Auto') {
      matchesDeadStock = item.DeadStockType === 'Auto';
    } else if (filterDeadStock === 'Manual') {
      matchesDeadStock = item.DeadStockType === 'Manual' || item.IsDeadStock === 1;
    } else if (filterDeadStock === 'Active') {
      matchesDeadStock = (!item.DeadStockType || item.DeadStockType === 'None') && !item.IsDeadStock;
    } else if (filterDeadStock === 'AllDead') {
      matchesDeadStock = item.DeadStockType === 'Auto' || item.DeadStockType === 'Manual' || item.IsDeadStock === 1;
    }

    return matchesSearch && matchesCategory && matchesItemCategory && matchesType && matchesSeries && matchesDeadStock;
  });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = [...filteredItems].sort((a, b) => {
    const valA = a[sortConfig.key] !== undefined && a[sortConfig.key] !== null ? a[sortConfig.key] : '';
    const valB = b[sortConfig.key] !== undefined && b[sortConfig.key] !== null ? b[sortConfig.key] : '';
    if (valA < valB) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (valA > valB) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const handleOpenDialog = (mode, item = null) => {
    setDialogMode(mode);
    setDialogError('');
    if (mode === 'edit' && item) {
      setOriginalItemCode(item.ItemCode);
      setOriginalSubCode(item.SubCode || '');
      setFormData({
        Category: item.Category || 'Inhouse',
        ItemCategory: item.ItemCategory || '',
        ItemCode: item.ItemCode,
        SubCode: item.SubCode || '',
        ItemName: item.ItemName,
        WarehouseNo: item.WarehouseNo || '',
        Location: item.Location || '',
        ItemType: item.ItemType || '',
        Series: item.Series || '',
        StdWeight: item.StdWeight != null ? Number(item.StdWeight).toFixed(3) : '',
        Unit: item.Unit || '',
        MRP: item.MRP || '',
        Costing: item.Costing || '',
        OpeningStock: item.OpeningStock || '',
        ClosingStock: item.ClosingStock || '',
        HSNCode: item.HSNCode || '',
        ReorderLevel: item.ReorderLevel != null ? item.ReorderLevel : '',
        DeadStockType: item.DeadStockType || 'None',
        DeadStockDays: item.DeadStockDays != null && item.DeadStockDays > 0 ? item.DeadStockDays : '',
        IsDeadStock: item.IsDeadStock === 1 || item.DeadStockType === 'Manual'
      });
    } else {
      setOriginalItemCode(null);
      setOriginalSubCode('');
      setFormData({
        Category: 'Inhouse',
        ItemCategory: '',
        ItemCode: '',
        SubCode: '',
        ItemName: '',
        WarehouseNo: '',
        Location: '',
        ItemType: '',
        Series: '',
        StdWeight: '',
        Unit: '',
        MRP: '',
        Costing: '',
        OpeningStock: '',
        ClosingStock: '',
        HSNCode: '',
        ReorderLevel: '',
        DeadStockType: 'None',
        DeadStockDays: '',
        IsDeadStock: false
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setOriginalItemCode(null);
    setOriginalSubCode('');
    setDialogError('');
  };

  const handleInputChange = (e) => {
    let { name, value } = e.target;
    
    if (name === 'HSNCode') {
      value = (value || '').slice(0, 8).toUpperCase();
      setFormData(prev => ({ ...prev, HSNCode: value }));
      return;
    }

    if (name === 'OpeningStock') {
      const newOpening = parseFloat(value) || 0;
      
      setFormData(prev => {
        if (dialogMode === 'add') {
          return { ...prev, OpeningStock: value, ClosingStock: value };
        } else if (dialogMode === 'edit') {
          const oldOpening = parseFloat(prev.OpeningStock) || 0;
          const currentClosing = parseFloat(prev.ClosingStock) || 0;
          const diff = newOpening - oldOpening;
          const newClosing = currentClosing + diff;
          const newClosingRounded = Math.round(newClosing * 1000) / 1000;
          return { ...prev, OpeningStock: value, ClosingStock: newClosingRounded.toString() };
        }
        return prev;
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveItem = async () => {
    if (!formData.ItemCode || !formData.ItemName || !formData.Unit) {
      setDialogError('Item Code, Item Name, and Unit are required fields.');
      return;
    }
    
    try {
      const url = dialogMode === 'add' 
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items` 
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items/${encodeURIComponent(originalItemCode)}?subCode=${encodeURIComponent(originalSubCode || '')}`;
      const method = dialogMode === 'add' ? 'POST' : 'PUT';
      
      const payload = {
        originalItemCode: originalItemCode,
        originalSubCode: originalSubCode || '',
        Category: formData.Category || 'Inhouse',
        ItemCode: formData.ItemCode.trim(),
        SubCode: (formData.SubCode || '').trim(),
        ItemName: formData.ItemName.trim(),
        WarehouseNo: (formData.WarehouseNo || '').trim(),
        Location: (formData.Location || '').trim(),
        ItemType: formData.ItemType || null,
        Series: formData.Series || null,
        StdWeight: formData.StdWeight ? parseFloat(formData.StdWeight) : null,
        Unit: formData.Unit,
        MRP: parseFloat(formData.MRP) || 0,
        Costing: parseFloat(formData.Costing) || 0,
        OpeningStock: formData.OpeningStock ? parseFloat(formData.OpeningStock) : null,
        ClosingStock: formData.ClosingStock ? parseFloat(formData.ClosingStock) : null,
        HSNCode: formData.HSNCode ? formData.HSNCode.trim().slice(0, 8).toUpperCase() : null,
        ReorderLevel: formData.ReorderLevel !== '' && formData.ReorderLevel != null ? parseFloat(formData.ReorderLevel) : 0,
        DeadStockType: formData.DeadStockType || 'None',
        DeadStockDays: formData.DeadStockType === 'Auto' && formData.DeadStockDays ? parseInt(formData.DeadStockDays, 10) : 0,
        IsDeadStock: (formData.DeadStockType === 'Manual' || formData.IsDeadStock) ? 1 : 0
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        handleCloseDialog();
        if (filterParamItemCode) {
          fetchItems(filterParamItemCode, filterParamSubCode);
        } else {
          fetchItems();
        }
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving item');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      setDialogError('A network error occurred. Please try again.');
    }
  };

  const handleOpenDeadStockModal = (item) => {
    setSelectedDeadStockItem(item);
    setQuickDeadStockType(item.DeadStockType || (item.IsDeadStock ? 'Manual' : 'None'));
    setQuickDeadStockDays(item.DeadStockDays != null && item.DeadStockDays > 0 ? item.DeadStockDays : '');
    setDeadStockModalOpen(true);
  };

  const handleCloseDeadStockModal = () => {
    setDeadStockModalOpen(false);
    setSelectedDeadStockItem(null);
  };

  const handleSaveQuickDeadStock = async () => {
    if (!selectedDeadStockItem) return;
    if (quickDeadStockType === 'Auto' && (!quickDeadStockDays || parseInt(quickDeadStockDays, 10) <= 0)) {
      alert('Please specify a valid number of days for Auto Dead Stock detection.');
      return;
    }

    setQuickModalLoading(true);
    try {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items/${encodeURIComponent(selectedDeadStockItem.ItemCode)}/dead-stock?subCode=${encodeURIComponent(selectedDeadStockItem.SubCode || '')}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subCode: selectedDeadStockItem.SubCode || '',
          deadStockType: quickDeadStockType,
          deadStockDays: quickDeadStockType === 'Auto' ? parseInt(quickDeadStockDays, 10) : 0,
          isDeadStock: quickDeadStockType === 'Manual' ? 1 : 0
        })
      });

      if (response.ok) {
        handleCloseDeadStockModal();
        if (filterParamItemCode) {
          fetchItems(filterParamItemCode, filterParamSubCode);
        } else {
          fetchItems();
        }
      } else {
        const err = await response.json();
        alert(err.message || 'Failed to update dead stock status');
      }
    } catch (err) {
      console.error('Error updating dead stock:', err);
      alert('Network error while updating dead stock status');
    } finally {
      setQuickModalLoading(false);
    }
  };

  const openDeleteConfirm = (item) => {
    setItemToDelete({ ItemCode: item.ItemCode, SubCode: item.SubCode || '', ItemName: item.ItemName });
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    setItemToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const handleDeleteItem = async () => {
    if (itemToDelete) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items/${encodeURIComponent(itemToDelete.ItemCode)}?subCode=${encodeURIComponent(itemToDelete.SubCode || '')}`, 
          { method: 'DELETE' }
        );
        if (response.ok) {
          if (filterParamItemCode) {
            handleClearSingleItemFilter();
          } else {
            fetchItems();
          }
          closeDeleteConfirm();
        } else {
          console.error('Error deleting item');
        }
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const handleExport = () => {
    const exportData = items.map(item => ({
      Category: item.Category || 'Inhouse',
      ItemCategory: item.ItemCategory || '',
      ItemCode: item.ItemCode,
      SubCode: item.SubCode || '',
      ItemName: item.ItemName,
      WarehouseNo: item.WarehouseNo || '',
      Location: item.Location || '',
      ItemType: item.ItemType || '',
      Series: item.Series || '',
      StdWeight: Number(item.StdWeight) || 0,
      Unit: item.Unit || '',
      MRP: Number(item.MRP) || 0,
      Costing: Number(item.Costing) || 0,
      OpeningStock: Number(item.OpeningStock) || 0,
      ClosingStock: Number(item.ClosingStock) || 0,
      HSNCode: item.HSNCode || '',
      ReorderLevel: Number(item.ReorderLevel) || 0,
      DeadStockType: item.DeadStockType || 'None',
      DeadStockDays: Number(item.DeadStockDays) || 0,
      IsDeadStock: Number(item.IsDeadStock) || 0
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    ensureNumericWorksheet(worksheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Items");
    XLSX.writeFile(workbook, "ItemMaster.xlsx");
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
        const rawData = XLSX.utils.sheet_to_json(ws);
        
        if (!rawData || rawData.length === 0) {
          alert('Uploaded excel sheet is empty!');
          return;
        }

        // Attach actual 1-based Excel row number (header is row 1, data starts row 2)
        const data = rawData.map((row, idx) => ({
          ...row,
          __rowNum__: idx + 2
        }));

        setImporting(true);
        setImportProgress(10);

        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        setImportProgress(90);
        const result = await response.json();
        setImportProgress(100);

        setTimeout(() => {
          setImporting(false);
          setImportResults(result);
          setShowImportResults(true);
          fetchItems();
        }, 500);

      } catch (err) {
        console.error('Import error:', err);
        setImporting(false);
        alert('Failed to parse or upload excel file.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  return (
    <Box>
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 0.5 }}>
            Item Master
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Manage inventory items with composite identification (Code + SubCode), procurement classification, and warehouse tracking.
          </Typography>
        </Box>
        {filterParamItemCode && (
          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<ResetIcon />}
            onClick={handleClearSingleItemFilter}
            sx={{ textTransform: 'none', borderColor: '#0F3B66', color: '#0F3B66', fontWeight: 600 }}
          >
            Show All Items
          </Button>
        )}
      </Box>

      {filterParamItemCode && (
        <Alert 
          severity="info" 
          action={
            <Button color="inherit" size="small" onClick={handleClearSingleItemFilter} startIcon={<ResetIcon />}>
              Reset Filter
            </Button>
          }
          sx={{ mb: 2.5, borderRadius: 2, bgcolor: '#eff6ff', color: '#1e3a8a', border: '1px solid #bfdbfe' }}
        >
          <strong>Single Item Alert View:</strong> Showing only record for Item Code <strong>{filterParamItemCode}</strong>{filterParamSubCode ? ` (SubCode: "${filterParamSubCode}")` : ''}.
        </Alert>
      )}

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        
        <Toolbar sx={{ px: { xs: 1.5, sm: 2 }, display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'space-between', pt: 2, pb: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, width: { xs: '100%', md: 'auto' } }}>
            <TextField
              size="small"
              placeholder="Search items, subcode, warehouse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ width: { xs: '100%', sm: 240, md: 260 } }}
            />
            <TextField
              select
              size="small"
              label="Sourcing"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              sx={{ width: { xs: '100%', sm: 180 }, minWidth: { sm: 180 } }}
              SelectProps={{
                MenuProps: { PaperProps: { sx: { minWidth: 200, maxHeight: 400 } } },
                sx: { '& .MuiSelect-select': { whiteSpace: 'nowrap' } }
              }}
            >
              <MenuItem value="All" sx={{ whiteSpace: 'nowrap' }}>All Sourcing</MenuItem>
              <MenuItem value="SubContract" sx={{ whiteSpace: 'nowrap' }}>Sub-Contract</MenuItem>
              <MenuItem value="Inhouse" sx={{ whiteSpace: 'nowrap' }}>Inhouse</MenuItem>
              <MenuItem value="BOP" sx={{ whiteSpace: 'nowrap' }}>BOP</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="Item Category"
              value={filterItemCategory}
              onChange={(e) => setFilterItemCategory(e.target.value)}
              sx={{ width: { xs: '100%', sm: 260 }, minWidth: { sm: 260 } }}
              SelectProps={{
                MenuProps: { PaperProps: { sx: { minWidth: 280, maxHeight: 400 } } },
                sx: { '& .MuiSelect-select': { whiteSpace: 'nowrap' } }
              }}
            >
              {uniqueItemCategories.map(c => (
                <MenuItem key={c} value={c} sx={{ whiteSpace: 'nowrap' }}>
                  {c === 'All' ? 'All Item Categories' : c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Item Type"
              value={filterItemType}
              onChange={(e) => setFilterItemType(e.target.value)}
              sx={{ width: { xs: '100%', sm: 260 }, minWidth: { sm: 260 } }}
              SelectProps={{
                MenuProps: { PaperProps: { sx: { minWidth: 280, maxHeight: 400 } } },
                sx: { '& .MuiSelect-select': { whiteSpace: 'nowrap' } }
              }}
            >
              <MenuItem value="All" sx={{ whiteSpace: 'nowrap' }}>All Types</MenuItem>
              {itemTypes.map(t => (
                <MenuItem key={t} value={t} sx={{ whiteSpace: 'nowrap' }}>
                  {getItemTypeLabel(t)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Series"
              value={filterSeries}
              onChange={(e) => setFilterSeries(e.target.value)}
              sx={{ width: { xs: '100%', sm: 220 }, minWidth: { sm: 220 } }}
              SelectProps={{
                MenuProps: { PaperProps: { sx: { minWidth: 240, maxHeight: 400 } } },
                sx: { '& .MuiSelect-select': { whiteSpace: 'nowrap' } }
              }}
            >
              {uniqueSeries.map(s => (
                <MenuItem key={s} value={s} sx={{ whiteSpace: 'nowrap' }}>
                  {s === 'All' ? 'All Series' : s}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Dead Stock"
              value={filterDeadStock}
              onChange={(e) => setFilterDeadStock(e.target.value)}
              sx={{ width: { xs: '100%', sm: 250 }, minWidth: { sm: 250 } }}
              SelectProps={{
                MenuProps: { PaperProps: { sx: { minWidth: 260, maxHeight: 400 } } },
                sx: { '& .MuiSelect-select': { whiteSpace: 'nowrap' } }
              }}
            >
              <MenuItem value="All" sx={{ whiteSpace: 'nowrap' }}>All Stock Status</MenuItem>
              <MenuItem value="Active" sx={{ whiteSpace: 'nowrap' }}>🟢 Active Inventory</MenuItem>
              <MenuItem value="Auto" sx={{ whiteSpace: 'nowrap' }}>⚡ Auto Dead Stock</MenuItem>
              <MenuItem value="Manual" sx={{ whiteSpace: 'nowrap' }}>🔴 Manual Dead Stock</MenuItem>
              <MenuItem value="AllDead" sx={{ whiteSpace: 'nowrap' }}>⚠️ All Dead Stock</MenuItem>
            </TextField>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: { xs: '100%', md: 'auto' }, justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
            <input
              accept=".xlsx, .xls"
              style={{ display: 'none' }}
              id="raised-button-file"
              type="file"
              onChange={handleImport}
            />
            <label htmlFor={hasAddPermission() ? "raised-button-file" : ""}>
              <Button disabled={!hasAddPermission()} 
                variant="outlined" 
                component="span"
                startIcon={<ImportIcon />}
                sx={{ boxShadow: 0, textTransform: 'none', fontWeight: 600 }}
              >
                Import
              </Button>
            </label>
            <Button 
              variant="outlined" 
              startIcon={<ExportIcon />}
              onClick={handleExport}
              sx={{ boxShadow: 0, textTransform: 'none', fontWeight: 600 }}
            >
              Export
            </Button>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog('add')} 
              disabled={!hasAddPermission()}
              sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#F88A01' }, textTransform: 'none', fontWeight: 600, boxShadow: 0 }}
            >
              Add Item
            </Button>
          </Box>
        </Toolbar>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 650, '& .MuiTableRow-root': { height: 44 } }} aria-labelledby="tableTitle">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: '#0F3B66' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'ItemCode'}
                    direction={sortConfig.key === 'ItemCode' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('ItemCode')}
                  >
                    Item Code
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#0F3B66' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'ItemName'}
                    direction={sortConfig.key === 'ItemName' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('ItemName')}
                  >
                    Item Name
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#0F3B66' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'ItemType'}
                    direction={sortConfig.key === 'ItemType' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('ItemType')}
                  >
                    Item Type
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#0F3B66' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'Unit'}
                    direction={sortConfig.key === 'Unit' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('Unit')}
                  >
                    Unit
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#0F3B66' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'ClosingStock'}
                    direction={sortConfig.key === 'ClosingStock' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('ClosingStock')}
                  >
                    Closing Stock
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, color: '#0F3B66', width: 140 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedItems
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => {
                  const isLowStock = row.ReorderLevel > 0 && (row.ClosingStock || 0) < row.ReorderLevel;

                  return (
                    <TableRow hover tabIndex={-1} key={`${row.ItemCode}_${row.SubCode || ''}`}>
                      <TableCell sx={{ fontWeight: 600, color: '#0F3B66' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                          {row.ItemCode}
                        </Typography>
                        {row.SubCode && (
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>
                            Sub: {row.SubCode}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {row.ItemName}
                        </Typography>
                        {row.ItemCategory && (
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>
                            {row.ItemCategory}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.ItemType ? (
                          <Chip 
                            label={row.ItemType} 
                            size="small" 
                            sx={{ 
                              fontSize: '0.72rem', 
                              fontWeight: 700,
                              bgcolor: '#f1f5f9', 
                              color: '#0F3B66',
                              border: '1px solid #cbd5e1',
                              height: 22 
                            }} 
                          />
                        ) : '-'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500, color: '#334155' }}>
                        {row.Unit || '-'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: isLowStock ? '#ef4444' : 'inherit' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>{row.ClosingStock || 0}</span>
                          {isLowStock && (
                            <Chip 
                              label="Low" 
                              size="small" 
                              color="error" 
                              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }} 
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
                          <Tooltip title="View Item Details">
                            <IconButton 
                              size="small" 
                              onClick={() => handleOpenViewModal(row)}
                              sx={{ color: '#0284c7', '&:hover': { bgcolor: '#e0f2fe' } }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Item">
                            <IconButton color="primary" size="small" onClick={() => handleOpenDialog('edit', row)} disabled={!hasEditPermission()}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Item">
                            <IconButton color="error" size="small" onClick={() => openDeleteConfirm(row)} disabled={!hasDeletePermission()}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {sortedItems.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: '#64748b' }}>
                    No items found matching the selected filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={sortedItems.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add / Edit Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={(event, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#0F3B66', borderBottom: '1px solid #e2e8f0', pb: 1.5 }}>
          {dialogMode === 'add' ? 'Add New Item' : 'Edit Item'}
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2.5 }}>
          {dialogError && (
            <Alert severity="error" sx={{ mb: 2.5 }}>{dialogError}</Alert>
          )}
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 0.5 }}>
            
            {/* Sourcing Category & Sanitary Item Category */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <FormControl fullWidth size="small" sx={{ minWidth: { sm: 320 } }}>
                <InputLabel id="item-category-label">Sourcing Category *</InputLabel>
                <Select
                  labelId="item-category-label"
                  label="Sourcing Category *"
                  name="Category"
                  value={formData.Category || 'Inhouse'}
                  onChange={handleInputChange}
                  sx={{ fontWeight: 600, '& .MuiSelect-select': { whiteSpace: 'nowrap' } }}
                  MenuProps={{
                    PaperProps: { sx: { minWidth: 380, maxHeight: 400 } }
                  }}
                  renderValue={(selected) => {
                    const map = {
                      SubContract: 'Sub-Contract (External sub-contractors)',
                      Inhouse: 'Inhouse (In-house factory production)',
                      BOP: 'BOP (Bought-Out Parts)'
                    };
                    return map[selected] || selected;
                  }}
                >
                  <MenuItem value="SubContract" sx={{ whiteSpace: 'nowrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label="Sub-Contract" size="small" sx={{ bgcolor: '#fff7ed', color: '#ea580c', fontWeight: 700, height: 20 }} />
                      <Typography variant="body2" sx={{ color: '#475569', whiteSpace: 'nowrap' }}>- External sub-contractors</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="Inhouse" sx={{ whiteSpace: 'nowrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label="Inhouse" size="small" sx={{ bgcolor: '#eff6ff', color: '#0F3B66', fontWeight: 700, height: 20 }} />
                      <Typography variant="body2" sx={{ color: '#475569', whiteSpace: 'nowrap' }}>- In-house factory production</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="BOP" sx={{ whiteSpace: 'nowrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label="BOP" size="small" sx={{ bgcolor: '#ecfeff', color: '#0891b2', fontWeight: 700, height: 20 }} />
                      <Typography variant="body2" sx={{ color: '#475569', whiteSpace: 'nowrap' }}>- Bought-Out Parts</Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
              <TextField 
                label="Item Category (Sanitary)" 
                name="ItemCategory" 
                value={formData.ItemCategory || ''} 
                onChange={handleInputChange} 
                fullWidth 
                size="small" 
                placeholder="e.g. SS Chain Tube, Health Faucet, Angle Valve"
                helperText="Product line / sanitary category"
              />
            </Box>

            {/* Composite Primary Key Fields: ItemCode & SubCode */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField 
                label="Item Code *" 
                name="ItemCode" 
                value={formData.ItemCode} 
                onChange={handleInputChange} 
                fullWidth 
                size="small" 
                required
                helperText="Primary identifier (e.g. SS16, HF101)"
              />
              <TextField 
                label="Sub Code" 
                name="SubCode" 
                value={formData.SubCode} 
                onChange={handleInputChange} 
                fullWidth 
                size="small" 
                placeholder="Variant / Size SubCode (e.g. SS201, 12IN, 1.5M)"
                helperText="Composite key with Item Code"
              />
            </Box>

            {/* Item Name */}
            <TextField 
              label="Item Name *" 
              name="ItemName" 
              value={formData.ItemName} 
              onChange={handleInputChange} 
              fullWidth 
              size="small" 
              required 
            />

            {/* WarehouseNo and Location (Both string inputs) */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField 
                label="Warehouse No" 
                name="WarehouseNo" 
                placeholder="e.g. WH-1, Raw Material Shed, Yard-B"
                value={formData.WarehouseNo} 
                onChange={handleInputChange} 
                fullWidth 
                size="small" 
              />
              <TextField 
                label="Location" 
                name="Location" 
                placeholder="e.g. Bin-04, Rack-A3, Shelf-2"
                value={formData.Location} 
                onChange={handleInputChange} 
                fullWidth 
                size="small" 
              />
            </Box>
            
            {/* Classification, Unit & Series */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <Autocomplete
                autoHighlight
                autoSelect
                options={itemTypes}
                getOptionLabel={(option) => getItemTypeLabel(option)}
                renderOption={(props, option) => (
                  <li {...props} key={option} style={{ whiteSpace: 'nowrap' }}>
                    {getItemTypeLabel(option)}
                  </li>
                )}
                value={formData.ItemType}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, ItemType: newValue || '' });
                }}
                fullWidth
                size="small"
                sx={{ flex: 1.5, minWidth: { sm: 300 } }}
                slotProps={{
                  popper: {
                    sx: { minWidth: 340 }
                  }
                }}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Item Type" 
                    InputProps={{
                      ...params.InputProps,
                      sx: { '& input': { whiteSpace: 'nowrap', textOverflow: 'ellipsis' } }
                    }}
                  />
                )}
              />
              <Autocomplete
                autoHighlight
                autoSelect
                freeSolo={false}
                options={units}
                value={formData.Unit}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, Unit: newValue || '' });
                }}
                fullWidth
                size="small"
                sx={{ flex: 1, minWidth: { sm: 160 } }}
                renderOption={(props, option) => (
                  <li {...props} key={option} style={{ whiteSpace: 'nowrap' }}>
                    {option}
                  </li>
                )}
                renderInput={(params) => <TextField {...params} label="Unit *" required />}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <Autocomplete
                autoHighlight
                autoSelect
                freeSolo={false}
                options={brands}
                value={formData.Series}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, Series: newValue || '' });
                }}
                fullWidth
                size="small"
                sx={{ minWidth: { sm: 300 } }}
                slotProps={{
                  popper: {
                    sx: { minWidth: 320 }
                  }
                }}
                renderOption={(props, option) => (
                  <li {...props} key={option} style={{ whiteSpace: 'nowrap' }}>
                    {option}
                  </li>
                )}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Series Name" 
                    InputProps={{
                      ...params.InputProps,
                      sx: { '& input': { whiteSpace: 'nowrap', textOverflow: 'ellipsis' } }
                    }}
                  />
                )}
              />
            </Box>

            {/* Weights and Pricing */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField label="Std Weight (Kg)" name="StdWeight" type="number" inputProps={{ step: "0.001" }} value={formData.StdWeight} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="MRP (₹) [Sale Price]" name="MRP" type="number" inputProps={{ step: "0.01" }} value={formData.MRP} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="Costing (₹)" name="Costing" type="number" inputProps={{ step: "0.01" }} value={formData.Costing} onChange={handleInputChange} fullWidth size="small" />
            </Box>

            {/* Stock Quantities */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField label="Opening Stock" name="OpeningStock" type="number" value={formData.OpeningStock} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="Closing Stock" name="ClosingStock" type="number" value={formData.ClosingStock} onChange={handleInputChange} fullWidth size="small" />
            </Box>

            {/* HSN Code & Reorder Level */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField 
                label="HSN Code" 
                name="HSNCode" 
                value={formData.HSNCode} 
                onChange={handleInputChange} 
                inputProps={{ maxLength: 8 }} 
                helperText="8 characters max"
                fullWidth 
                size="small" 
              />
              <TextField 
                label="Reorder Level" 
                name="ReorderLevel" 
                type="number" 
                inputProps={{ step: "any" }}
                value={formData.ReorderLevel} 
                onChange={handleInputChange} 
                helperText="Alerts when closing stock is below this threshold"
                fullWidth 
                size="small" 
              />
            </Box>

            {/* Dead Stock Declaration Section */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #cbd5e1' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <WarningAmber sx={{ color: '#d97706', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                  Dead Stock Declaration
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>
                Declare this item as dead stock either automatically (if not moved in specified days) or manually.
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'flex-start' }}>
                <FormControl fullWidth size="small" sx={{ minWidth: { sm: 340 } }}>
                  <InputLabel id="dead-stock-type-label">Declaration Mode</InputLabel>
                  <Select
                    labelId="dead-stock-type-label"
                    label="Declaration Mode"
                    name="DeadStockType"
                    value={formData.DeadStockType || 'None'}
                    onChange={handleInputChange}
                    sx={{ '& .MuiSelect-select': { whiteSpace: 'nowrap' } }}
                    MenuProps={{
                      PaperProps: { sx: { minWidth: 360, maxHeight: 350 } }
                    }}
                  >
                    <MenuItem value="None" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#059669', whiteSpace: 'nowrap' }}>
                        🟢 None (Active Inventory)
                      </Typography>
                    </MenuItem>
                    <MenuItem value="Auto" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#d97706', whiteSpace: 'nowrap' }}>
                        ⚡ Auto (No movement in X days)
                      </Typography>
                    </MenuItem>
                    <MenuItem value="Manual" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#dc2626', whiteSpace: 'nowrap' }}>
                        🔴 Manual (Declare as Dead Stock now)
                      </Typography>
                    </MenuItem>
                  </Select>
                </FormControl>

                {formData.DeadStockType === 'Auto' && (
                  <TextField
                    label="Inactivity Days Threshold *"
                    name="DeadStockDays"
                    type="number"
                    size="small"
                    fullWidth
                    placeholder="e.g. 30, 60, 90, 180, 365"
                    value={formData.DeadStockDays}
                    onChange={handleInputChange}
                    helperText="Classified as dead stock if not moved for this many days"
                    inputProps={{ min: 1 }}
                  />
                )}
              </Box>

              {formData.DeadStockType === 'Manual' && (
                <Alert severity="warning" sx={{ mt: 1.5, py: 0.5, fontSize: '0.82rem' }}>
                  This item is manually declared as Dead Stock and will appear in the Dead Stock Report.
                </Alert>
              )}
              {formData.DeadStockType === 'Auto' && (
                <Alert severity="info" sx={{ mt: 1.5, py: 0.5, fontSize: '0.82rem' }}>
                  System will track transactions across Purchases, Sales, Sub-Contract, and Transfers. If no transaction occurs within {formData.DeadStockDays || 'the specified'} days, it will be classified as dead stock.
                </Alert>
              )}
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={handleCloseDialog} color="inherit" sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button 
            onClick={handleSaveItem} 
            variant="contained" 
            sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#F88A01' }, textTransform: 'none', fontWeight: 600, px: 3 }}
          >
            Save Item
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Item Details Modal */}
      <Dialog
        open={viewModalOpen}
        onClose={handleCloseViewModal}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2.5, overflow: 'hidden' }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#f8fafc', 
          borderBottom: '1px solid #e2e8f0', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          py: 2,
          px: 3
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ 
              width: 40, 
              height: 40, 
              borderRadius: 2, 
              bgcolor: '#0F3B66', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <InventoryIcon />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66', lineHeight: 1.2 }}>
                {selectedViewItem?.ItemName || 'Item Details'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                <Chip 
                  label={`Code: ${selectedViewItem?.ItemCode || '-'}`} 
                  size="small" 
                  sx={{ fontWeight: 700, bgcolor: '#0F3B66', color: '#ffffff', height: 22, fontSize: '0.75rem' }} 
                />
                {selectedViewItem?.SubCode && (
                  <Chip 
                    label={`Sub: ${selectedViewItem.SubCode}`} 
                    size="small" 
                    sx={{ fontWeight: 600, bgcolor: '#e2e8f0', color: '#334155', height: 22, fontSize: '0.75rem' }} 
                  />
                )}
                <Chip 
                  label={selectedViewItem?.Category === 'SubContract' ? 'Sub-Contract' : (selectedViewItem?.Category || 'Inhouse')} 
                  size="small" 
                  sx={{ 
                    fontWeight: 700, 
                    bgcolor: selectedViewItem?.Category === 'SubContract' ? '#fff7ed' : (selectedViewItem?.Category === 'BOP' ? '#ecfeff' : '#eff6ff'), 
                    color: selectedViewItem?.Category === 'SubContract' ? '#ea580c' : (selectedViewItem?.Category === 'BOP' ? '#0891b2' : '#0F3B66'),
                    height: 22, 
                    fontSize: '0.75rem' 
                  }} 
                />
                {selectedViewItem?.ItemType && (
                  <Chip 
                    label={selectedViewItem.ItemType} 
                    size="small" 
                    sx={{ fontWeight: 600, bgcolor: '#f1f5f9', color: '#0F3B66', border: '1px solid #cbd5e1', height: 22, fontSize: '0.75rem' }} 
                  />
                )}
              </Box>
            </Box>
          </Box>
          <IconButton onClick={handleCloseViewModal} size="small" sx={{ color: '#64748b' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent dividers sx={{ p: 3, bgcolor: '#ffffff' }}>
          {selectedViewItem && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              
              {/* Section 1: Identification & General Details */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1.5 }}>
                  General Information
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Item Code</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>{selectedViewItem.ItemCode}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Sub Code</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>{selectedViewItem.SubCode || '—'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Item Name</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>{selectedViewItem.ItemName}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Sanitary / Item Category</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>{selectedViewItem.ItemCategory || '—'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Sourcing Category</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>{selectedViewItem.Category || 'Inhouse'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>HSN Code</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#0F3B66' }}>{selectedViewItem.HSNCode || '—'}</Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Section 2: Classification & Physical Attributes */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#ffffff', borderColor: '#e2e8f0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1.5 }}>
                  Classification & Specifications
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Item Type</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>{getItemTypeLabel(selectedViewItem.ItemType) || '—'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Series / Brand</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>{selectedViewItem.Series || '—'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Unit of Measure</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>{selectedViewItem.Unit || '—'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Standard Weight</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                      {selectedViewItem.StdWeight != null && selectedViewItem.StdWeight !== '' ? `${Number(selectedViewItem.StdWeight).toFixed(3)} Kg` : '—'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Section 3: Warehouse & Storage */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#ffffff', borderColor: '#e2e8f0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1.5 }}>
                  Storage & Location
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Warehouse No</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: selectedViewItem.WarehouseNo ? '#1e293b' : '#94a3b8' }}>
                      {selectedViewItem.WarehouseNo || 'Not specified'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Location / Bin / Rack</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: selectedViewItem.Location ? '#1e293b' : '#94a3b8' }}>
                      {selectedViewItem.Location || 'Not specified'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Section 4: Inventory & Stock Levels */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1.5 }}>
                  Inventory & Stock Levels
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
                  <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Opening Stock</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#334155' }}>
                      {selectedViewItem.OpeningStock || 0} <Typography component="span" variant="caption" sx={{ color: '#64748b' }}>{selectedViewItem.Unit}</Typography>
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    p: 1.5, 
                    bgcolor: (selectedViewItem.ReorderLevel > 0 && (selectedViewItem.ClosingStock || 0) < selectedViewItem.ReorderLevel) ? '#fef2f2' : '#ffffff', 
                    borderRadius: 1.5, 
                    border: (selectedViewItem.ReorderLevel > 0 && (selectedViewItem.ClosingStock || 0) < selectedViewItem.ReorderLevel) ? '1px solid #fecaca' : '1px solid #e2e8f0' 
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Closing Stock</Typography>
                      {(selectedViewItem.ReorderLevel > 0 && (selectedViewItem.ClosingStock || 0) < selectedViewItem.ReorderLevel) && (
                        <Chip label="Low Stock" size="small" color="error" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }} />
                      )}
                    </Box>
                    <Typography variant="h6" sx={{ 
                      fontWeight: 700, 
                      color: (selectedViewItem.ReorderLevel > 0 && (selectedViewItem.ClosingStock || 0) < selectedViewItem.ReorderLevel) ? '#dc2626' : '#0F3B66' 
                    }}>
                      {selectedViewItem.ClosingStock || 0} <Typography component="span" variant="caption" sx={{ color: '#64748b' }}>{selectedViewItem.Unit}</Typography>
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>Reorder Level</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: selectedViewItem.ReorderLevel ? '#d97706' : '#94a3b8' }}>
                      {selectedViewItem.ReorderLevel != null && Number(selectedViewItem.ReorderLevel) > 0 ? selectedViewItem.ReorderLevel : 'Not set'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Section 5: Costing & Sale Price */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#ffffff', borderColor: '#e2e8f0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1.5 }}>
                  Pricing & Valuation
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1.5, border: '1px solid #bbf7d0' }}>
                    <Typography variant="caption" sx={{ color: '#166534', fontWeight: 600, display: 'block' }}>Costing</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#15803d' }}>
                      ₹ {selectedViewItem.Costing != null && selectedViewItem.Costing !== '' ? Number(selectedViewItem.Costing).toFixed(2) : '0.00'}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5, bgcolor: '#eff6ff', borderRadius: 1.5, border: '1px solid #bfdbfe' }}>
                    <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 600, display: 'block' }}>MRP / Sale Price</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1d4ed8' }}>
                      ₹ {selectedViewItem.MRP != null && selectedViewItem.MRP !== '' ? Number(selectedViewItem.MRP).toFixed(2) : '0.00'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Section 6: Dead Stock Status */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1.5 }}>
                  Dead Stock Status
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  {selectedViewItem.DeadStockType === 'Manual' || selectedViewItem.IsDeadStock === 1 ? (
                    <Chip 
                      label="Manual Dead Stock (Declared manually)" 
                      sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 700 }} 
                    />
                  ) : selectedViewItem.DeadStockType === 'Auto' ? (
                    <Chip 
                      label={`Auto Dead Stock (Inactivity threshold: ${selectedViewItem.DeadStockDays || 0} days)`} 
                      sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700 }} 
                    />
                  ) : (
                    <Chip 
                      label="Active Inventory (Normal Movement)" 
                      variant="outlined" 
                      sx={{ color: '#059669', borderColor: '#a7f3d0', fontWeight: 700 }} 
                    />
                  )}
                </Box>
              </Paper>

            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
          <Button onClick={handleCloseViewModal} color="inherit" sx={{ textTransform: 'none', fontWeight: 600 }}>
            Close
          </Button>
          {hasEditPermission() && (
            <Button 
              variant="contained" 
              startIcon={<EditIcon />}
              onClick={() => {
                const itemToEdit = selectedViewItem;
                handleCloseViewModal();
                handleOpenDialog('edit', itemToEdit);
              }}
              sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#F88A01' }, textTransform: 'none', fontWeight: 600 }}
            >
              Edit Item
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Quick Dead Stock Status Modal */}
      <Dialog
        open={deadStockModalOpen}
        onClose={handleCloseDeadStockModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#0F3B66', borderBottom: '1px solid #e2e8f0', pb: 1.5 }}>
          Dead Stock Declaration
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          {selectedDeadStockItem && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Box sx={{ p: 1.5, bgcolor: '#f1f5f9', borderRadius: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                  {selectedDeadStockItem.ItemName}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Code: {selectedDeadStockItem.ItemCode} {selectedDeadStockItem.SubCode ? `/ ${selectedDeadStockItem.SubCode}` : ''} | Current Stock: {selectedDeadStockItem.ClosingStock || 0} {selectedDeadStockItem.Unit || ''}
                </Typography>
              </Box>

              <FormControl fullWidth size="small" sx={{ minWidth: 320 }}>
                <InputLabel id="quick-dead-stock-mode-label">Declaration Mode</InputLabel>
                <Select
                  labelId="quick-dead-stock-mode-label"
                  label="Declaration Mode"
                  value={quickDeadStockType}
                  onChange={(e) => setQuickDeadStockType(e.target.value)}
                  sx={{ '& .MuiSelect-select': { whiteSpace: 'nowrap' } }}
                  MenuProps={{
                    PaperProps: { sx: { minWidth: 360, maxHeight: 350 } }
                  }}
                >
                  <MenuItem value="None" sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#059669', whiteSpace: 'nowrap' }}>
                      🟢 None (Active Inventory)
                    </Typography>
                  </MenuItem>
                  <MenuItem value="Auto" sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#d97706', whiteSpace: 'nowrap' }}>
                      ⚡ Auto (No movement in X days)
                    </Typography>
                  </MenuItem>
                  <MenuItem value="Manual" sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#dc2626', whiteSpace: 'nowrap' }}>
                      🔴 Manual (Declare as Dead Stock now)
                    </Typography>
                  </MenuItem>
                </Select>
              </FormControl>

              {quickDeadStockType === 'Auto' && (
                <TextField
                  label="Threshold Inactivity Days *"
                  type="number"
                  size="small"
                  fullWidth
                  placeholder="e.g. 30, 60, 90, 180"
                  value={quickDeadStockDays}
                  onChange={(e) => setQuickDeadStockDays(e.target.value)}
                  helperText="Days of inactivity to trigger dead stock"
                  inputProps={{ min: 1 }}
                />
              )}

              {quickDeadStockType === 'Manual' && (
                <Alert severity="warning" sx={{ py: 0.5, fontSize: '0.8rem' }}>
                  Item will be marked as Dead Stock immediately.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={handleCloseDeadStockModal} color="inherit" sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveQuickDeadStock}
            variant="contained"
            disabled={quickModalLoading}
            sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#F88A01' }, textTransform: 'none', fontWeight: 600 }}
          >
            {quickModalLoading ? 'Saving...' : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>



      {/* Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={closeDeleteConfirm}
        onConfirm={handleDeleteItem}
        title="Confirm Deletion"
        itemName={itemToDelete ? `${itemToDelete.ItemName} (${itemToDelete.ItemCode}${itemToDelete.SubCode ? ` / ${itemToDelete.SubCode}` : ''})` : 'this item'}
      />

      {/* Import Progress Dialog */}
      <Dialog open={importing} disableEscapeKeyDown>
        <DialogTitle>Importing Items...</DialogTitle>
        <DialogContent sx={{ minWidth: 400 }}>
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress variant="determinate" value={importProgress} />
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
              {importProgress}% Complete
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Import Results Dialog */}
      <Dialog open={showImportResults} onClose={() => setShowImportResults(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import Results</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={resultTab} onChange={(e, val) => setResultTab(val)}>
              <Tab label={`Added (${importResults.added.length})`} />
              <Tab label={`Updated (${importResults.updated.length})`} />
              <Tab label={`Failed (${importResults.failed.length})`} sx={{ color: importResults.failed.length > 0 ? 'error.main' : 'inherit' }} />
            </Tabs>
          </Box>
          <Box sx={{ mt: 2 }}>
            {resultTab === 0 && (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Sub Code</TableCell>
                      <TableCell>Item Name</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importResults.added.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontWeight: 600 }}>{item.ItemCode}</TableCell>
                        <TableCell>{item.SubCode || '-'}</TableCell>
                        <TableCell>{item.ItemName}</TableCell>
                      </TableRow>
                    ))}
                    {importResults.added.length === 0 && <TableRow><TableCell colSpan={3} align="center">No items added</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {resultTab === 1 && (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Sub Code</TableCell>
                      <TableCell>Item Name</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importResults.updated.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontWeight: 600 }}>{item.ItemCode}</TableCell>
                        <TableCell>{item.SubCode || '-'}</TableCell>
                        <TableCell>{item.ItemName}</TableCell>
                      </TableRow>
                    ))}
                    {importResults.updated.length === 0 && <TableRow><TableCell colSpan={3} align="center">No items updated</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {resultTab === 2 && (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, width: 110 }}>Excel Row #</TableCell>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Sub Code</TableCell>
                      <TableCell>Item Name</TableCell>
                      <TableCell sx={{ color: 'error.main' }}>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importResults.failed.map((fail, idx) => {
                      const rowNum = fail.rowNumber || fail.item?.__rowNum__ || (idx + 2);
                      return (
                        <TableRow key={idx}>
                          <TableCell sx={{ fontWeight: 700, color: '#dc2626' }}>Row #{rowNum}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{fail.item?.ItemCode || 'Unknown'}</TableCell>
                          <TableCell>{fail.item?.SubCode || '-'}</TableCell>
                          <TableCell>{fail.item?.ItemName || 'Unknown'}</TableCell>
                          <TableCell sx={{ color: 'error.main' }}>{fail.reason}</TableCell>
                        </TableRow>
                      );
                    })}
                    {importResults.failed.length === 0 && <TableRow><TableCell colSpan={5} align="center">No failed items</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportResults(false)} variant="contained">Close</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default ItemMaster;
