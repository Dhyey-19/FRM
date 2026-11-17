import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Divider,
  InputAdornment,
  Autocomplete,
  IconButton,
  Tooltip,
  Collapse,
  Stack
} from '@mui/material';
import {
  Calculate as CalculateIcon,
  Save as SaveIcon,
  Sync as SyncIcon,
  FileDownload as ExportIcon,
  RestartAlt as ResetIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckIcon,
  Inventory as InventoryIcon,
  AccountTree as BOMIcon,
  Search as SearchIcon,
  FilterAlt as FilterIcon,
  Clear as ClearIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_CONFIG, SIZES } from '../utils/itemCostingEngine';
import * as XLSX from 'xlsx';

const RED_CELL_STYLE = {
  bgcolor: '#fff1f2',
  '& .MuiOutlinedInput-root': {
    bgcolor: '#fff1f2',
    fontWeight: 700,
    color: '#9f1239',
    '& fieldset': { borderColor: '#f43f5e', borderWidth: '1.5px' },
    '&:hover fieldset': { borderColor: '#e11d48' },
    '&.Mui-focused fieldset': { borderColor: '#be123c', borderWidth: '2px' }
  },
  '& .MuiInputLabel-root': { color: '#be123c', fontWeight: 700 }
};

const ItemCostingPage = () => {
  const navigate = useNavigate();

  // Top Rate Inputs state (red cells)
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', severity: 'success' });

  // Items List & Loading State
  const [itemsList, setItemsList] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // 4 Dropdown Filters for Item Selection
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedItemCode, setSelectedItemCode] = useState(null);
  const [selectedSubCode, setSelectedSubCode] = useState(null);
  const [selectedProductName, setSelectedProductName] = useState(null);

  // Row Expand/Collapse for BOM Details
  const [expandedRows, setExpandedRows] = useState({});

  // Individual Row Custom Margins: { [itemKey]: marginValue }
  const [rowMargins, setRowMargins] = useState({});
  const [bulkDisplayedMargin, setBulkDisplayedMargin] = useState('');

  // Batch Update Progress State
  const [updatingBatch, setUpdatingBatch] = useState(false);
  const [updatingRowKey, setUpdatingRowKey] = useState(null);

  // 1. Fetch Config from Database
  const fetchConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/costing/config`);
      const data = await res.json();
      if (res.ok && data.success && data.config) {
        setConfig(data.config);
        if (data.config.MarginsJson) {
          try {
            setMatrixMargins(typeof data.config.MarginsJson === 'string' ? JSON.parse(data.config.MarginsJson) : data.config.MarginsJson);
          } catch (e) {
            setMatrixMargins({});
          }
        }
      }
    } catch (err) {
      console.error('Failed to load costing config:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  // 2. Fetch All Items with full BOM details
  const fetchItemsCosting = async () => {
    setLoadingItems(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/costing/items-costing-list`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.items)) {
        setItemsList(data.items);
        // Pre-fill margins from existing difference if positive
        const initialMargins = {};
        data.items.forEach(itm => {
          const key = `${itm.itemCode}|${itm.subCode || ''}`;
          initialMargins[key] = itm.margin || Math.max(0, Math.round((itm.currentMRP - itm.calculatedCosting) * 100) / 100);
        });
        setRowMargins(initialMargins);
      }
    } catch (err) {
      console.error('Failed to load items costing list:', err);
      setToast({ show: true, message: 'Failed to load items list: ' + err.message, severity: 'error' });
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchItemsCosting();
  }, []);

  // 3. Derived Brass Costs from top rates
  const derived = useMemo(() => {
    const brassRate = Number(config.BrassRatePerKg) || 0;
    const brassInsertConv = Number(config.BrassInsertConv) || 0;
    const brassInsertWt = Number(config.BrassInsertWeight) || 0;
    const brassNutNConv = Number(config.BrassNutNConv) || 0;
    const brassNutNWt = Number(config.BrassNutNWeight) || 0;
    const brassNutPCConv = Number(config.BrassNutPCConv) || 0;
    const brassNutPCWt = Number(config.BrassNutPCWeight) || 0;

    return {
      brassInsertCost: Math.round((brassRate + brassInsertConv) * brassInsertWt * 100) / 100,
      brassNutNCost: Math.round((brassRate + brassNutNConv) * brassNutNWt * 100) / 100,
      brassNutPCCost: Math.round((brassRate + brassNutPCConv) * brassNutPCWt * 100) / 100,
      fixedOverhead: Math.round(((Number(config.CapRate) || 0) + (Number(config.KeyRate) || 0) + (Number(config.WasherRate) || 0) + (Number(config.LabourRate) || 0) + (Number(config.PackingRate) || 0)) * 100) / 100
    };
  }, [config]);

  // Live dynamic calculation of each item's BOM and total costing in real time
  const itemsWithLiveCalculations = useMemo(() => {
    const pRate = Number(config.PipeRatePerMeter) || DEFAULT_CONFIG.PipeRatePerMeter;
    const hcpRate = Number(config.HcpPipeRatePerMeter) || DEFAULT_CONFIG.HcpPipeRatePerMeter;

    return itemsList.map(item => {
      const key = `${item.itemCode}|${item.subCode || ''}`;
      if (!item.bom || item.bom.length === 0) {
        const margin = rowMargins[key] !== undefined ? Number(rowMargins[key]) : (item.margin || 0);
        return {
          ...item,
          liveCost: item.currentCosting,
          liveBOM: [],
          liveMargin: margin,
          liveSalePrice: Math.round((item.currentCosting + margin) * 100) / 100
        };
      }

      let totalCost = 0;
      const computedBOM = item.bom.map(b => {
        const childCode = b.childItemCode;
        let unitRate = Number(b.unitRate) || 0;
        let rateSource = b.rateSource || 'Master Cost';

        if (childCode === 'RM-PIPE-HCP') {
          if (item.subCode && item.subCode.includes('M')) {
            unitRate = hcpRate;
            rateSource = `₹${hcpRate}/MTR (HCP)`;
          } else {
            const mult = SIZES.find(sz => item.itemName?.includes(sz.size) || item.subCode?.endsWith(sz.size.replace(/"/g, '')))?.mult || 11;
            unitRate = (hcpRate / 38) * mult;
            rateSource = `(${hcpRate}/38)×${mult}`;
          }
        } else if (childCode === 'RM-PIPE-STD' || childCode.includes('PIPE')) {
          if (item.subCode && item.subCode.includes('M')) {
            unitRate = pRate;
            rateSource = `₹${pRate}/MTR`;
          } else {
            const mult = SIZES.find(sz => item.itemName?.includes(sz.size) || item.subCode?.endsWith(sz.size.replace(/"/g, '')))?.mult || 11;
            unitRate = (pRate / 38) * mult;
            rateSource = `(${pRate}/38)×${mult}`;
          }
        } else if (childCode === 'RM-INS-BRS') {
          unitRate = derived.brassInsertCost;
          rateSource = 'Brass Formula';
        } else if (childCode === 'RM-NUT-BRS-N') {
          unitRate = derived.brassNutNCost;
          rateSource = 'Brass Formula';
        } else if (childCode === 'RM-NUT-BRS-PC') {
          unitRate = derived.brassNutPCCost;
          rateSource = 'Brass Formula';
        } else if (childCode === 'RM-NUT-NYL') {
          unitRate = Number(config.NylonNutRate) || DEFAULT_CONFIG.NylonNutRate;
          rateSource = 'Nylon Rate';
        } else if (childCode === 'RM-INS-NYL') {
          unitRate = Number(config.NylonInsertRate) || DEFAULT_CONFIG.NylonInsertRate;
          rateSource = 'Nylon Rate';
        } else if (childCode === 'RM-NUT-SS201') {
          unitRate = Number(config.SS201NutRate) || DEFAULT_CONFIG.SS201NutRate;
          rateSource = 'SS Rate';
        } else if (childCode === 'RM-NUT-SS304') {
          unitRate = Number(config.SS304NutRate) || DEFAULT_CONFIG.SS304NutRate;
          rateSource = 'SS Rate';
        } else if (childCode === 'RM-INR-SS') {
          unitRate = Number(config.SSInnerRate) || DEFAULT_CONFIG.SSInnerRate;
          rateSource = 'SS Rate';
        } else if (childCode === 'BOP-CAP') {
          unitRate = Number(config.CapRate) || DEFAULT_CONFIG.CapRate;
          rateSource = 'Standard Rate';
        } else if (childCode === 'BOP-KEY') {
          unitRate = Number(config.KeyRate) || DEFAULT_CONFIG.KeyRate;
          rateSource = 'Standard Rate';
        } else if (childCode === 'BOP-WSH') {
          unitRate = Number(config.WasherRate) || DEFAULT_CONFIG.WasherRate;
          rateSource = 'Standard Rate';
        } else if (childCode === 'SRV-LABOUR') {
          unitRate = Number(config.LabourRate) || DEFAULT_CONFIG.LabourRate;
          rateSource = 'Labour Rate';
        } else if (childCode === 'BOP-PCK') {
          unitRate = Number(config.PackingRate) || DEFAULT_CONFIG.PackingRate;
          rateSource = 'Packing Rate';
        }

        const qty = Number(b.quantity) || 1;
        const lineCost = Math.round(unitRate * qty * 100) / 100;
        totalCost += lineCost;

        return {
          ...b,
          unitRate: Math.round(unitRate * 100) / 100,
          lineCost,
          rateSource
        };
      });

      const roundedCost = Math.round(totalCost * 100) / 100;
      const margin = rowMargins[key] !== undefined ? Number(rowMargins[key]) : (item.margin || 0);
      const roundedMRP = Math.round((roundedCost + margin) * 100) / 100;

      return {
        ...item,
        liveCost: roundedCost,
        liveBOM: computedBOM,
        liveMargin: margin,
        liveSalePrice: roundedMRP
      };
    });
  }, [itemsList, config, derived, rowMargins]);

  // 6. Multi-Dropdown Filtering: Filter items based on Category, ItemCode, SubCode, ProductName
  const displayedItems = useMemo(() => {
    return itemsWithLiveCalculations.filter(item => {
      if (selectedCategory && item.itemCategory !== selectedCategory) return false;
      if (selectedItemCode && item.itemCode !== selectedItemCode) return false;
      if (selectedSubCode && (item.subCode || '') !== selectedSubCode) return false;
      if (selectedProductName && item.itemName !== selectedProductName) return false;
      return true;
    });
  }, [itemsWithLiveCalculations, selectedCategory, selectedItemCode, selectedSubCode, selectedProductName]);

  // Options for Dropdowns
  const categoryOptions = useMemo(() => {
    const cats = [...new Set(itemsWithLiveCalculations.map(i => i.itemCategory).filter(Boolean))];
    return cats.sort();
  }, [itemsWithLiveCalculations]);

  const itemCodeOptions = useMemo(() => {
    let pool = itemsWithLiveCalculations;
    if (selectedCategory) pool = pool.filter(i => i.itemCategory === selectedCategory);
    const codes = [...new Set(pool.map(i => i.itemCode).filter(Boolean))];
    return codes.sort();
  }, [itemsWithLiveCalculations, selectedCategory]);

  const subCodeOptions = useMemo(() => {
    let pool = itemsWithLiveCalculations;
    if (selectedCategory) pool = pool.filter(i => i.itemCategory === selectedCategory);
    if (selectedItemCode) pool = pool.filter(i => i.itemCode === selectedItemCode);
    const subs = [...new Set(pool.map(i => i.subCode || '').filter(Boolean))];
    return subs.sort();
  }, [itemsWithLiveCalculations, selectedCategory, selectedItemCode]);

  const productNameOptions = useMemo(() => {
    let pool = itemsWithLiveCalculations;
    if (selectedCategory) pool = pool.filter(i => i.itemCategory === selectedCategory);
    if (selectedItemCode) pool = pool.filter(i => i.itemCode === selectedItemCode);
    if (selectedSubCode) pool = pool.filter(i => (i.subCode || '') === selectedSubCode);
    const names = [...new Set(pool.map(i => i.itemName).filter(Boolean))];
    return names.sort();
  }, [itemsWithLiveCalculations, selectedCategory, selectedItemCode, selectedSubCode]);

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedCategory(null);
    setSelectedItemCode(null);
    setSelectedSubCode(null);
    setSelectedProductName(null);
  };

  // Toggle Row Expand
  const toggleRowExpand = (itemKey) => {
    setExpandedRows(prev => ({
      ...prev,
      [itemKey]: !prev[itemKey]
    }));
  };

  // Expand or Collapse All Displayed Rows
  const handleToggleAllRows = (expand) => {
    const updated = {};
    if (expand) {
      displayedItems.forEach(i => {
        updated[`${i.itemCode}|${i.subCode || ''}`] = true;
      });
    }
    setExpandedRows(updated);
  };

  // Handle Rate Changes
  const handleConfigChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value === '' ? '' : Number(value)
    }));
  };

  // Save Config Rates to Database & Auto-Update Displayed Items
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const payload = {
        ...config,
        MarginsJson: matrixMargins
      };
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/costing/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast({ show: true, message: data.message || 'Rates saved & stored in database successfully!', severity: 'success' });
        // Automatically update the displayed items with new calculated costings
        if (displayedItems.length > 0) {
          await handleUpdateDisplayedItems();
        } else {
          fetchItemsCosting();
        }
      } else {
        setToast({ show: true, message: data.message || 'Failed to save rates', severity: 'error' });
      }
    } catch (err) {
      setToast({ show: true, message: 'Network error saving rates: ' + err.message, severity: 'error' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleResetDefaults = () => {
    setConfig(DEFAULT_CONFIG);
    setToast({ show: true, message: 'Reset all rate fields to default formulas and values', severity: 'info' });
  };

  // Apply Bulk Margin to currently displayed items
  const handleApplyBulkMarginToDisplayed = () => {
    const val = Number(bulkDisplayedMargin);
    if (isNaN(val)) return;
    setRowMargins(prev => {
      const next = { ...prev };
      displayedItems.forEach(itm => {
        const key = `${itm.itemCode}|${itm.subCode || ''}`;
        next[key] = val;
      });
      return next;
    });
    setToast({
      show: true,
      message: `Applied margin ₹${val.toFixed(2)} to all ${displayedItems.length} displayed items! Click "Update Costing for Displayed Items" to save.`,
      severity: 'info'
    });
  };

  // Update Costing & Sale Price for ALL Displayed Items in ItemMaster
  const handleUpdateDisplayedItems = async () => {
    if (displayedItems.length === 0) {
      setToast({ show: true, message: 'No items currently displayed to update', severity: 'warning' });
      return;
    }

    setUpdatingBatch(true);
    try {
      const payload = {
        items: displayedItems.map(item => ({
          itemCode: item.itemCode,
          subCode: item.subCode || '',
          costing: item.liveCost,
          mrp: item.liveSalePrice
        }))
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/costing/update-batch-prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast({
          show: true,
          message: `Successfully updated Costing & Sale Price (MRP) for all ${data.updatedCount} displayed items in Item Master!`,
          severity: 'success'
        });
        // Refresh master records from server to keep everything in sync
        await fetchItemsCosting();
      } else {
        setToast({ show: true, message: data.message || 'Failed to update items', severity: 'error' });
      }
    } catch (err) {
      setToast({ show: true, message: 'Error updating items: ' + err.message, severity: 'error' });
    } finally {
      setUpdatingBatch(false);
    }
  };

  // Update Single Item Costing & Sale Price in ItemMaster
  const handleUpdateSingleItem = async (item) => {
    const key = `${item.itemCode}|${item.subCode || ''}`;
    setUpdatingRowKey(key);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/costing/update-item-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemCode: item.itemCode,
          subCode: item.subCode || '',
          costing: item.liveCost,
          mrp: item.liveSalePrice
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast({
          show: true,
          message: `Updated ${item.itemCode}${item.subCode ? ` (${item.subCode})` : ''}: Costing = ₹${item.liveCost.toFixed(2)}, MRP = ₹${item.liveSalePrice.toFixed(2)}`,
          severity: 'success'
        });
        await fetchItemsCosting();
      } else {
        setToast({ show: true, message: data.message || 'Failed to update item price', severity: 'error' });
      }
    } catch (err) {
      setToast({ show: true, message: 'Error updating item: ' + err.message, severity: 'error' });
    } finally {
      setUpdatingRowKey(null);
    }
  };

  // Export Displayed Records to Excel
  const handleExportDisplayedExcel = () => {
    const wb = XLSX.utils.book_new();

    const rows = [
      ['FRM-BBP - ITEM COSTING & PRICING BREAKDOWN'],
      [`Exported: ${new Date().toLocaleDateString()}`],
      [],
      ['#', 'Item Category', 'Item Code', 'Sub Code', 'Product Name', 'BOM Parts', 'Current Master Cost (₹)', 'New Calculated Cost (₹)', 'Margin (₹)', 'Calculated Sale Price / MRP (₹)', 'Impact (₹)']
    ];

    displayedItems.forEach((itm, idx) => {
      const diff = Math.round((itm.liveCost - itm.currentCosting) * 100) / 100;
      rows.push([
        idx + 1,
        itm.itemCategory || '',
        itm.itemCode,
        itm.subCode || '',
        itm.itemName,
        itm.bomCount || 0,
        itm.currentCosting,
        itm.liveCost,
        itm.liveMargin,
        itm.liveSalePrice,
        diff
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Displayed Costing');

    // Sheet 2: Rates
    const rateRows = [
      ['RATE CONFIGURATION'],
      ['Pipe Rate / MTR', config.PipeRatePerMeter],
      ['HCP Pipe Rate / MTR', config.HcpPipeRatePerMeter],
      ['Brass Rate / Kg', config.BrassRatePerKg],
      ['Nylon Insert', config.NylonInsertRate],
      ['Nylon Nut', config.NylonNutRate],
      ['SS201 Nut', config.SS201NutRate],
      ['SS304 Nut', config.SS304NutRate],
      ['SS Inner', config.SSInnerRate],
      ['Brass Insert (Cost)', derived.brassInsertCost],
      ['Brass Nut N (Cost)', derived.brassNutNCost],
      ['Brass Nut PC (Cost)', derived.brassNutPCCost]
    ];
    const wsRates = XLSX.utils.aoa_to_sheet(rateRows);
    XLSX.utils.book_append_sheet(wb, wsRates, 'Rates');

    XLSX.writeFile(wb, `Item_Costing_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setToast({ show: true, message: `Exported ${displayedItems.length} items to Excel!`, severity: 'success' });
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, bgcolor: '#f8fafc', minHeight: '100vh' }}>
      {/* Toast Alert */}
      {toast.show && (
        <Alert
          severity={toast.severity}
          onClose={() => setToast({ ...toast, show: false })}
          sx={{ mb: 2, boxShadow: 2 }}
        >
          {toast.message}
        </Alert>
      )}

      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F3B66', display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalculateIcon sx={{ fontSize: 32, color: '#0F3B66' }} />
            Item Costing & BOM Calculator
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
            Input master material rates (red cells) to dynamically calculate BOM component breakdowns, production cost, and sale price.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<ResetIcon />}
            onClick={handleResetDefaults}
            sx={{ textTransform: 'none', borderColor: '#cbd5e1', color: '#475569', '&:hover': { bgcolor: '#f1f5f9' } }}
          >
            Reset Rates
          </Button>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={handleExportDisplayedExcel}
            sx={{ textTransform: 'none', borderColor: '#0F3B66', color: '#0F3B66' }}
          >
            Export Excel
          </Button>
          <Button
            variant="contained"
            startIcon={savingConfig ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSaveConfig}
            disabled={savingConfig}
            sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#082542' }, textTransform: 'none', fontWeight: 700 }}
          >
            {savingConfig ? 'Saving Rates...' : 'Save Master Rates'}
          </Button>
        </Box>
      </Box>

      {/* TOP RATE INPUTS (RED CELLS AS PER EXCEL SPECIFICATION) */}
      <Paper elevation={2} sx={{ p: 2.5, mb: 3, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #cbd5e1' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1, borderBottom: '2px solid #f43f5e' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 14, height: 14, bgcolor: '#f43f5e', borderRadius: '3px' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#9f1239' }}>
              Master Raw Material Rates (Values in Red Cells Directly Drive All Product Costing)
            </Typography>
          </Box>
          <Chip label="Live Costing Engine Active" size="small" sx={{ bgcolor: '#ffe4e6', color: '#9f1239', fontWeight: 700 }} />
        </Box>

        <Grid container spacing={2}>
          {/* Column 1: Pipe & Standard Hardware Inputs */}
          <Grid item xs={12} md={6}>
            <TableContainer sx={{ border: '1px solid #fecdd3', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#fff1f2' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, color: '#9f1239', width: '40%' }}>Raw Material</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#9f1239', width: '35%' }} align="center">Rate / Value (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#9f1239', width: '25%' }}>Unit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>Pipe Rate</TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={config.PipeRatePerMeter}
                        onChange={(e) => handleConfigChange('PipeRatePerMeter', e.target.value)}
                        sx={RED_CELL_STYLE}
                        InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>Rate / MTR</TableCell>
                  </TableRow>

                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>HCP Pipe</TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={config.HcpPipeRatePerMeter}
                        onChange={(e) => handleConfigChange('HcpPipeRatePerMeter', e.target.value)}
                        sx={RED_CELL_STYLE}
                        InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>Rate / MTR (Heavy/Shower)</TableCell>
                  </TableRow>

                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>Nylon Insert</TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={config.NylonInsertRate}
                        onChange={(e) => handleConfigChange('NylonInsertRate', e.target.value)}
                        sx={RED_CELL_STYLE}
                        InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>per piece</TableCell>
                  </TableRow>

                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>Nylon Nut</TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={config.NylonNutRate}
                        onChange={(e) => handleConfigChange('NylonNutRate', e.target.value)}
                        sx={RED_CELL_STYLE}
                        InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>per piece</TableCell>
                  </TableRow>

                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>SS201 Nut</TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={config.SS201NutRate}
                        onChange={(e) => handleConfigChange('SS201NutRate', e.target.value)}
                        sx={RED_CELL_STYLE}
                        InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>per piece</TableCell>
                  </TableRow>

                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>SS304 Nut</TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={config.SS304NutRate}
                        onChange={(e) => handleConfigChange('SS304NutRate', e.target.value)}
                        sx={RED_CELL_STYLE}
                        InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>per piece</TableCell>
                  </TableRow>

                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>SS Inner</TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={config.SSInnerRate}
                        onChange={(e) => handleConfigChange('SSInnerRate', e.target.value)}
                        sx={RED_CELL_STYLE}
                        InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>per piece</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          {/* Column 2: Brass Rates & Derived Calculations */}
          <Grid item xs={12} md={6}>
            <TableContainer sx={{ border: '1px solid #fecdd3', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#fff1f2' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, color: '#9f1239', width: '25%' }}>Brass Item</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#9f1239', width: '25%' }} align="center">Conversion (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#9f1239', width: '25%' }} align="center">Weight (Kg)</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#9f1239', width: '25%' }} align="center">Cost / Pc (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Brass Master Rate */}
                  <TableRow sx={{ bgcolor: '#fff7ed' }}>
                    <TableCell sx={{ fontWeight: 800, color: '#c2410c' }}>
                      Brass Rate / Kg
                    </TableCell>
                    <TableCell colSpan={2} align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={config.BrassRatePerKg}
                        onChange={(e) => handleConfigChange('BrassRatePerKg', e.target.value)}
                        sx={RED_CELL_STYLE}
                        InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, color: '#c2410c' }}>
                      Base Rate
                    </TableCell>
                  </TableRow>

                  {/* Brass Insert */}
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>
                      Brass Insert
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={config.BrassInsertConv}
                        onChange={(e) => handleConfigChange('BrassInsertConv', e.target.value)}
                        sx={{ ...RED_CELL_STYLE, width: 105 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        inputProps={{ step: "0.001" }}
                        value={config.BrassInsertWeight}
                        onChange={(e) => handleConfigChange('BrassInsertWeight', e.target.value)}
                        sx={{ ...RED_CELL_STYLE, width: 105 }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#dcfce7', fontWeight: 900, color: '#15803d', fontSize: '1rem' }}>
                      ₹{derived.brassInsertCost.toFixed(2)}
                    </TableCell>
                  </TableRow>

                  {/* Brass Nut (N) */}
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>
                      Brass Nut (N)
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={config.BrassNutNConv}
                        onChange={(e) => handleConfigChange('BrassNutNConv', e.target.value)}
                        sx={{ ...RED_CELL_STYLE, width: 105 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        inputProps={{ step: "0.001" }}
                        value={config.BrassNutNWeight}
                        onChange={(e) => handleConfigChange('BrassNutNWeight', e.target.value)}
                        sx={{ ...RED_CELL_STYLE, width: 105 }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#dcfce7', fontWeight: 900, color: '#15803d', fontSize: '1rem' }}>
                      ₹{derived.brassNutNCost.toFixed(2)}
                    </TableCell>
                  </TableRow>

                  {/* Brass Nut (PC) */}
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>
                      Brass Nut (PC)
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={config.BrassNutPCConv}
                        onChange={(e) => handleConfigChange('BrassNutPCConv', e.target.value)}
                        sx={{ ...RED_CELL_STYLE, width: 105 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        inputProps={{ step: "0.001" }}
                        value={config.BrassNutPCWeight}
                        onChange={(e) => handleConfigChange('BrassNutPCWeight', e.target.value)}
                        sx={{ ...RED_CELL_STYLE, width: 105 }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#dcfce7', fontWeight: 900, color: '#15803d', fontSize: '1rem' }}>
                      ₹{derived.brassNutPCCost.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {/* Overheads breakdown summary */}
            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                Fixed Overheads per unit: Cap (₹{Number(config.CapRate || 2.5).toFixed(2)}) + Key (₹{Number(config.KeyRate || 1).toFixed(2)}) + Washer (₹{Number(config.WasherRate || 0.8).toFixed(2)}) + Labour (₹{Number(config.LabourRate || 2).toFixed(2)}) + Packing (₹{Number(config.PackingRate || 1).toFixed(2)}) = <strong style={{ color: '#0F3B66' }}>₹{derived.fixedOverhead.toFixed(2)}</strong>
              </Typography>
              <Chip label={`Overheads: ₹${derived.fixedOverhead.toFixed(2)}`} size="small" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }} />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* PRODUCT COSTING & BOM CALCULATOR (FILTERED MULTI-RECORD VIEW) */}
      <Box>
          {/* 4 DROPDOWNS FILTER BAR: Category, ItemCode, SubCode, ProductName */}
          <Paper elevation={2} sx={{ p: 2.5, mb: 3, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #cbd5e1' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1, borderBottom: '1.5px solid #e2e8f0', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterIcon sx={{ color: '#0F3B66' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0F3B66' }}>
                  Filter & Select Records by Category, Code, Sizing / SubCode, or Product Name
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={`Showing ${displayedItems.length} of ${itemsWithLiveCalculations.length} records`} 
                  color="primary" 
                  size="small" 
                  sx={{ fontWeight: 700 }} 
                />
                {(selectedCategory || selectedItemCode || selectedSubCode || selectedProductName) && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ClearIcon />}
                    onClick={handleClearFilters}
                    sx={{ textTransform: 'none', borderColor: '#f43f5e', color: '#e11d48', py: 0.2 }}
                  >
                    Clear Filters
                  </Button>
                )}
              </Box>
            </Box>

            <Grid container spacing={2}>
              {/* 1. Item Category Dropdown */}
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', display: 'block', mb: 0.5 }}>
                  1. ITEM CATEGORY
                </Typography>
                <Autocomplete
                  size="small"
                  options={categoryOptions}
                  value={selectedCategory}
                  onChange={(e, val) => setSelectedCategory(val)}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="All Categories" fullWidth sx={{ bgcolor: '#f8fafc' }} />
                  )}
                />
              </Grid>

              {/* 2. Item Code Dropdown */}
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', display: 'block', mb: 0.5 }}>
                  2. ITEM CODE
                </Typography>
                <Autocomplete
                  size="small"
                  options={itemCodeOptions}
                  value={selectedItemCode}
                  onChange={(e, val) => setSelectedItemCode(val)}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="All Item Codes" fullWidth sx={{ bgcolor: '#f8fafc' }} />
                  )}
                />
              </Grid>

              {/* 3. Sub Code Dropdown */}
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', display: 'block', mb: 0.5 }}>
                  3. SUB CODE / SIZE
                </Typography>
                <Autocomplete
                  size="small"
                  options={subCodeOptions}
                  value={selectedSubCode}
                  onChange={(e, val) => setSelectedSubCode(val)}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="All Sub Codes" fullWidth sx={{ bgcolor: '#f8fafc' }} />
                  )}
                />
              </Grid>

              {/* 4. Product Name Dropdown */}
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', display: 'block', mb: 0.5 }}>
                  4. PRODUCT NAME
                </Typography>
                <Autocomplete
                  size="small"
                  options={productNameOptions}
                  value={selectedProductName}
                  onChange={(e, val) => setSelectedProductName(val)}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="All Product Names" fullWidth sx={{ bgcolor: '#f8fafc' }} />
                  )}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* BATCH ACTION & BULK MARGIN BAR */}
          <Paper elevation={1} sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: '#eff6ff', border: '1.5px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon sx={{ color: '#1e40af' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a' }}>
                  Bulk Margin for Displayed:
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  size="small"
                  type="number"
                  placeholder="Margin (₹)"
                  value={bulkDisplayedMargin}
                  onChange={(e) => setBulkDisplayedMargin(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  sx={{ width: 140, bgcolor: '#ffffff' }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleApplyBulkMarginToDisplayed}
                  disabled={displayedItems.length === 0}
                  sx={{ borderColor: '#2563eb', color: '#1d4ed8', fontWeight: 700, textTransform: 'none' }}
                >
                  Apply Margin
                </Button>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="text"
                size="small"
                onClick={() => handleToggleAllRows(true)}
                sx={{ textTransform: 'none', fontWeight: 600, color: '#475569' }}
              >
                Expand All BOMs
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => handleToggleAllRows(false)}
                sx={{ textTransform: 'none', fontWeight: 600, color: '#475569' }}
              >
                Collapse All
              </Button>
              {/* PRIMARY BATCH UPDATE BUTTON */}
              <Button
                variant="contained"
                size="medium"
                startIcon={updatingBatch ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                onClick={handleUpdateDisplayedItems}
                disabled={updatingBatch || displayedItems.length === 0}
                sx={{ 
                  bgcolor: '#15803d', 
                  '&:hover': { bgcolor: '#166534' }, 
                  fontWeight: 800, 
                  textTransform: 'none',
                  px: 2.5
                }}
              >
                {updatingBatch ? 'Updating Database...' : `Update Costing for Displayed Items (${displayedItems.length})`}
              </Button>
            </Box>
          </Paper>

          {/* DISPLAYED RECORDS TABLE */}
          {loadingItems ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : displayedItems.length === 0 ? (
            <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
              <SearchIcon sx={{ fontSize: 50, color: '#94a3b8', mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#334155' }}>
                No records match the selected filters
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                Try selecting a different Category, Item Code, or click Clear Filters to view all records.
              </Typography>
              <Button variant="outlined" onClick={handleClearFilters} sx={{ textTransform: 'none', borderColor: '#0F3B66', color: '#0F3B66' }}>
                Clear Filters
              </Button>
            </Paper>
          ) : (
            <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2, border: '1px solid #cbd5e1' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#0F3B66' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 800, width: 40 }} />
                    <TableCell sx={{ color: '#ffffff', fontWeight: 800, width: 50 }}>#</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 800 }}>Item Code</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 800 }}>Sub Code</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 800 }}>Product Name</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 800 }}>Category</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 800 }} align="center">BOM Parts</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 800 }} align="right">Current Master Cost</TableCell>
                    <TableCell sx={{ color: '#fde047', fontWeight: 900 }} align="right">New Calculated Cost</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 800 }} align="center">Margin (₹)</TableCell>
                    <TableCell sx={{ color: '#86efac', fontWeight: 900 }} align="right">Calculated Sale Price</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 800 }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedItems.map((item, idx) => {
                    const rowKey = `${item.itemCode}|${item.subCode || ''}`;
                    const isExpanded = !!expandedRows[rowKey];
                    const isSavingThisRow = updatingRowKey === rowKey;
                    const diff = Math.round((item.liveCost - item.currentCosting) * 100) / 100;

                    return (
                      <React.Fragment key={rowKey}>
                        <TableRow 
                          hover 
                          sx={{ 
                            bgcolor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                            '&:hover': { bgcolor: '#f1f5f9' },
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          {/* Expand/Collapse Chevron */}
                          <TableCell sx={{ p: 0.5, textAlign: 'center' }}>
                            <IconButton size="small" onClick={() => toggleRowExpand(rowKey)}>
                              {isExpanded ? <ArrowUpIcon fontSize="small" sx={{ color: '#0F3B66' }} /> : <ArrowDownIcon fontSize="small" sx={{ color: '#64748b' }} />}
                            </IconButton>
                          </TableCell>

                          <TableCell sx={{ fontWeight: 600, color: '#64748b' }}>{idx + 1}</TableCell>

                          {/* Item Code */}
                          <TableCell sx={{ fontWeight: 800 }}>
                            <Chip 
                              label={item.itemCode} 
                              size="small" 
                              sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 800, fontSize: '0.78rem' }} 
                            />
                          </TableCell>

                          {/* Sub Code */}
                          <TableCell>
                            {item.subCode ? (
                              <Chip 
                                label={item.subCode} 
                                size="small" 
                                sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: '0.75rem' }} 
                              />
                            ) : (
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>-</Typography>
                            )}
                          </TableCell>

                          {/* Product Name */}
                          <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>
                            {item.itemName}
                          </TableCell>

                          {/* Category */}
                          <TableCell sx={{ color: '#475569', fontSize: '0.82rem' }}>
                            {item.itemCategory || '-'}
                          </TableCell>

                          {/* BOM Parts count */}
                          <TableCell align="center">
                            <Tooltip title="Click row to view component details">
                              <Chip 
                                icon={<BOMIcon sx={{ fontSize: '14px !important' }} />}
                                label={`${item.bomCount || 0} parts`} 
                                size="small" 
                                onClick={() => toggleRowExpand(rowKey)}
                                sx={{ cursor: 'pointer', bgcolor: '#f8fafc', border: '1px solid #cbd5e1', fontWeight: 600, fontSize: '0.72rem' }} 
                              />
                            </Tooltip>
                          </TableCell>

                          {/* Current Master Cost */}
                          <TableCell align="right" sx={{ fontWeight: 600, color: '#64748b' }}>
                            ₹{item.currentCosting.toFixed(2)}
                          </TableCell>

                          {/* New Calculated Cost */}
                          <TableCell align="right" sx={{ fontWeight: 900, color: '#1e40af', fontSize: '0.98rem', bgcolor: diff !== 0 ? '#eff6ff' : 'transparent' }}>
                            ₹{item.liveCost.toFixed(2)}
                            {diff !== 0 && (
                              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.68rem', color: diff > 0 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
                                {diff > 0 ? `+₹${diff.toFixed(2)}` : `-₹${Math.abs(diff).toFixed(2)}`}
                              </Typography>
                            )}
                          </TableCell>

                          {/* Margin Input */}
                          <TableCell align="center" sx={{ p: 0.5 }}>
                            <TextField
                              size="small"
                              type="number"
                              value={item.liveMargin}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                setRowMargins(prev => ({ ...prev, [rowKey]: val }));
                              }}
                              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                              sx={{ 
                                width: 110, 
                                bgcolor: '#ffffff',
                                '& input': { textAlign: 'right', fontWeight: 700, color: '#b45309' } 
                              }}
                            />
                          </TableCell>

                          {/* Calculated Sale Price (MRP) */}
                          <TableCell align="right" sx={{ fontWeight: 900, color: '#15803d', fontSize: '1.02rem', bgcolor: '#f0fdf4' }}>
                            ₹{item.liveSalePrice.toFixed(2)}
                          </TableCell>

                          {/* Row Actions */}
                          <TableCell align="center">
                            <Tooltip title={`Save ${item.itemCode} costing to ItemMaster`}>
                              <IconButton
                                size="small"
                                color="success"
                                disabled={isSavingThisRow}
                                onClick={() => handleUpdateSingleItem(item)}
                                sx={{ bgcolor: '#dcfce7', '&:hover': { bgcolor: '#bbf7d0' }, p: 0.8 }}
                              >
                                {isSavingThisRow ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>

                        {/* Collapsible BOM Component Breakdown Sub-Table */}
                        <TableRow>
                          <TableCell colSpan={12} sx={{ p: 0, borderBottom: isExpanded ? '2px solid #0F3B66' : 'none' }}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box sx={{ p: 2.5, bgcolor: '#f1f5f9' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F3B66', display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <BOMIcon fontSize="small" sx={{ color: '#0F3B66' }} />
                                    Bill of Materials (BOM) Breakdown for {item.itemName} [{item.itemCode}{item.subCode ? ` - ${item.subCode}` : ''}]
                                  </Typography>
                                  <Chip 
                                    label={`Total Calculated Cost: ₹${item.liveCost.toFixed(2)}`} 
                                    size="small" 
                                    sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 800 }} 
                                  />
                                </Box>

                                {item.liveBOM && item.liveBOM.length > 0 ? (
                                  <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 1.5 }}>
                                    <Table size="small">
                                      <TableHead sx={{ bgcolor: '#e2e8f0' }}>
                                        <TableRow>
                                          <TableCell sx={{ fontWeight: 700, color: '#475569' }}>#</TableCell>
                                          <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Child Part Code</TableCell>
                                          <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Component Name</TableCell>
                                          <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Type</TableCell>
                                          <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="center">Required Qty</TableCell>
                                          <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="right">Unit Rate (₹)</TableCell>
                                          <TableCell sx={{ fontWeight: 700, color: '#0F3B66' }} align="right">Line Cost (₹)</TableCell>
                                          <TableCell sx={{ fontWeight: 700, color: '#475569' }} align="center">Rate Source / Formula</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {item.liveBOM.map((part, pIdx) => (
                                          <TableRow key={`${part.childItemCode}-${pIdx}`} hover sx={{ bgcolor: '#ffffff' }}>
                                            <TableCell sx={{ color: '#64748b' }}>{pIdx + 1}</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: '#0F3B66' }}>{part.childItemCode}</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>{part.childItemName}</TableCell>
                                            <TableCell>
                                              <Chip label={part.childItemType || 'RM'} size="small" sx={{ fontSize: '0.68rem', height: 18 }} />
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700 }}>
                                              {part.quantity} {part.childUnit || 'PCS'}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600, color: '#475569' }}>
                                              ₹{part.unitRate.toFixed(2)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, color: '#1e40af', bgcolor: '#f8fafc' }}>
                                              ₹{part.lineCost.toFixed(2)}
                                            </TableCell>
                                            <TableCell align="center">
                                              <Chip label={part.rateSource} size="small" sx={{ fontSize: '0.68rem', bgcolor: '#f1f5f9', color: '#475569' }} />
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                        <TableRow sx={{ bgcolor: '#eff6ff' }}>
                                          <TableCell colSpan={6} sx={{ fontWeight: 800, color: '#1e3a8a', textAlign: 'right' }}>
                                            TOTAL COMPONENT COST:
                                          </TableCell>
                                          <TableCell align="right" sx={{ fontWeight: 900, color: '#1e40af', fontSize: '1.05rem' }}>
                                            ₹{item.liveCost.toFixed(2)}
                                          </TableCell>
                                          <TableCell />
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </TableContainer>
                                ) : (
                                  <Alert severity="info" sx={{ mt: 1 }}>
                                    No BOM components registered for this item in BOM Master.
                                  </Alert>
                                )}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
    </Box>
  );
};

export default ItemCostingPage;
