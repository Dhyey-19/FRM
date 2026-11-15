import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  Paper,
  Tabs,
  Tab,
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
  Card,
  CardContent,
  IconButton,
  Tooltip
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
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { DEFAULT_CONFIG, SIZES, SERIES_DEFINITIONS, calculateCosting } from '../utils/itemCostingEngine';
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
  const location = useLocation();

  // Top Rate Inputs state
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', severity: 'success' });

  // Items for Selection
  const [itemsList, setItemsList] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Selected Item BOM Breakdown state
  const [bomBreakdown, setBomBreakdown] = useState(null);
  const [loadingBOM, setLoadingBOM] = useState(false);
  const [itemMargin, setItemMargin] = useState(0);
  const [updatingItemPrice, setUpdatingItemPrice] = useState(false);

  // Page view mode: 0 = Single Item BOM Inspector, 1 = Complete 8-Series Matrix
  const [pageTab, setPageTab] = useState(0);
  const [matrixSeriesTab, setMatrixSeriesTab] = useState(0);
  const [margins, setMargins] = useState({});
  const [bulkMarginVal, setBulkMarginVal] = useState('');

  // 1. Fetch Config
  const fetchConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/costing/config`);
      const data = await res.json();
      if (res.ok && data.success && data.config) {
        setConfig(data.config);
        if (data.config.MarginsJson) {
          try {
            setMargins(typeof data.config.MarginsJson === 'string' ? JSON.parse(data.config.MarginsJson) : data.config.MarginsJson);
          } catch (e) {
            setMargins({});
          }
        }
      }
    } catch (err) {
      console.error('Failed to load costing config from server:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  // 2. Fetch Items for dropdown
  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setItemsList(data);
        // If query state or first item, auto-select
        const defaultItem = data.find(i => i.ItemCode === 'ITM-2000-12') || data.find(i => i.ItemType === 'FG') || data[0];
        if (defaultItem) {
          setSelectedItem(defaultItem);
        }
      }
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchItems();
  }, []);

  // 3. Live calculation derived from top rates
  const calculationResult = useMemo(() => {
    return calculateCosting(config, margins);
  }, [config, margins]);

  // 4. Fetch BOM Breakdown when selectedItem or config changes
  const fetchItemBOM = async (item) => {
    if (!item || !item.ItemCode) {
      setBomBreakdown(null);
      return;
    }
    setLoadingBOM(true);
    try {
      const subCodeParam = item.SubCode ? `?subCode=${encodeURIComponent(item.SubCode)}` : '';
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/costing/item-bom-breakdown/${encodeURIComponent(item.ItemCode)}${subCodeParam}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setBomBreakdown(data);
        setItemMargin(data.margin || 0);
      } else {
        setBomBreakdown({
          item: item,
          breakdown: [],
          totalCosting: Number(item.Costing) || 0,
          margin: Math.max(0, (Number(item.MRP) || 0) - (Number(item.Costing) || 0)),
          salePrice: Number(item.MRP) || Number(item.Costing) || 0
        });
        setItemMargin(Math.max(0, (Number(item.MRP) || 0) - (Number(item.Costing) || 0)));
      }
    } catch (err) {
      console.error('Error fetching item BOM breakdown:', err);
    } finally {
      setLoadingBOM(false);
    }
  };

  useEffect(() => {
    if (selectedItem) {
      fetchItemBOM(selectedItem);
    }
  }, [selectedItem, config]);

  const handleConfigChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value === '' ? '' : Number(value)
    }));
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const payload = {
        ...config,
        MarginsJson: margins
      };
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/costing/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast({ show: true, message: data.message || 'Rates saved & stored in database successfully!', severity: 'success' });
        if (selectedItem) fetchItemBOM(selectedItem);
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

  // Update single item costing & sale price to ItemMaster
  const handleUpdateItemPrice = async () => {
    if (!selectedItem || !bomBreakdown) return;
    setUpdatingItemPrice(true);
    try {
      const calcCost = bomBreakdown.totalCosting;
      const calcMRP = Math.round((calcCost + Number(itemMargin || 0)) * 100) / 100;

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/costing/update-item-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemCode: selectedItem.ItemCode,
          subCode: selectedItem.SubCode || '',
          costing: calcCost,
          mrp: calcMRP
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast({ show: true, message: `Updated ${selectedItem.ItemCode} in Item Master: Costing = ₹${calcCost}, MRP = ₹${calcMRP}`, severity: 'success' });
        // Update local item
        setSelectedItem(prev => ({ ...prev, Costing: calcCost, MRP: calcMRP }));
      } else {
        setToast({ show: true, message: data.message || 'Failed to update item price', severity: 'error' });
      }
    } catch (err) {
      setToast({ show: true, message: 'Error updating item: ' + err.message, severity: 'error' });
    } finally {
      setUpdatingItemPrice(false);
    }
  };

  // Export full matrix or single item breakdown
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Rates
    const rateRows = [
      ['FRM-BBP - ITEM COSTING RATE SHEET'],
      [],
      ['Pipe Rate / MTR', config.PipeRatePerMeter, '', 'Brass Rate / Kg', config.BrassRatePerKg],
      ['HCP Pipe Rate / MTR', config.HcpPipeRatePerMeter],
      ['Nylon Insert', config.NylonInsertRate, '', 'Brass Insert (Cost)', calculationResult.derived.brassInsertCost],
      ['Nylon Nut', config.NylonNutRate, '', 'Brass Nut N (Cost)', calculationResult.derived.brassNutNCost],
      ['SS201 Nut', config.SS201NutRate, '', 'Brass Nut PC (Cost)', calculationResult.derived.brassNutPCCost],
      ['SS304 Nut', config.SS304NutRate],
      ['SS Inner', config.SSInnerRate],
      [],
      ['BRASS SPECIFICATIONS'],
      ['Component', 'Base Brass Rate', 'Conversion Rate', 'Weight (Kg)', 'Derived Cost'],
      ['Brass Insert', config.BrassRatePerKg, config.BrassInsertConv, config.BrassInsertWeight, calculationResult.derived.brassInsertCost],
      ['Brass Nut (N)', config.BrassRatePerKg, config.BrassNutNConv, config.BrassNutNWeight, calculationResult.derived.brassNutNCost],
      ['Brass Nut (PC)', config.BrassRatePerKg, config.BrassNutPCConv, config.BrassNutPCWeight, calculationResult.derived.brassNutPCCost],
      []
    ];

    if (bomBreakdown && selectedItem) {
      rateRows.push(['CURRENT SELECTED ITEM BOM BREAKDOWN']);
      rateRows.push(['Item Code', selectedItem.ItemCode]);
      rateRows.push(['Item Name', selectedItem.ItemName]);
      rateRows.push(['Total Costing', bomBreakdown.totalCosting]);
      rateRows.push(['Margin', itemMargin]);
      rateRows.push(['Sale Price', Math.round((bomBreakdown.totalCosting + Number(itemMargin || 0)) * 100) / 100]);
      rateRows.push([]);
      rateRows.push(['Sub-Product Code', 'Sub-Product Name', 'Required Qty', 'Unit Rate', 'Line Cost', 'Formula / Source']);
      bomBreakdown.breakdown.forEach(b => {
        rateRows.push([b.childItemCode, b.childItemName, b.quantity, b.unitRate, b.lineCost, b.rateSource]);
      });
    }

    const ws1 = XLSX.utils.aoa_to_sheet(rateRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Rates_and_Breakdown');

    // Sheet 2: 8-Series Matrix
    const matrixRows = [];
    calculationResult.series.forEach(s => {
      matrixRows.push([s.seriesName]);
      matrixRows.push(['Component', '12"', '18"', '24"', '30"', '36"']);
      matrixRows.push(['Pipe', ...s.sizes.map(x => x.pipeCost)]);
      matrixRows.push(['Cap', ...s.sizes.map(x => x.capCost)]);
      matrixRows.push([`Nut (${s.nutName})`, ...s.sizes.map(x => x.nutCost)]);
      matrixRows.push([`Inner (${s.innerName})`, ...s.sizes.map(x => x.innerCost)]);
      matrixRows.push(['Key', ...s.sizes.map(x => x.keyCost)]);
      matrixRows.push(['Washer', ...s.sizes.map(x => x.washerCost)]);
      matrixRows.push(['Labour', ...s.sizes.map(x => x.labourCost)]);
      matrixRows.push(['Packing', ...s.sizes.map(x => x.packingCost)]);
      matrixRows.push(['COSTING (Total)', ...s.sizes.map(x => x.totalCost)]);
      matrixRows.push(['Margin', ...s.sizes.map(x => x.margin)]);
      matrixRows.push(['SALE PRICE', ...s.sizes.map(x => x.salePrice)]);
      matrixRows.push([]);
    });

    const ws2 = XLSX.utils.aoa_to_sheet(matrixRows);
    XLSX.utils.book_append_sheet(wb, ws2, '8_Series_Matrix');

    XLSX.writeFile(wb, `FRM_Costing_Calculator_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const calculatedSalePrice = bomBreakdown 
    ? Math.round((bomBreakdown.totalCosting + Number(itemMargin || 0)) * 100) / 100 
    : 0;

  return (
    <Box sx={{ p: 3, bgcolor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header Toolbar */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 46, height: 46, borderRadius: 2, bgcolor: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CalculateIcon sx={{ color: '#be123c', fontSize: 30 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F3B66' }}>
              Item Costing Calculator & BOM Breakdown
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Store raw material & brass rates, select any item to calculate its live BOM sub-item cost breakdown and sale price.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={handleExportExcel}
            sx={{ color: '#0F3B66', borderColor: '#cbd5e1', textTransform: 'none', fontWeight: 600 }}
          >
            Export to Excel
          </Button>

          <Button
            variant="outlined"
            startIcon={<BOMIcon />}
            onClick={() => navigate('/dashboard/bom')}
            sx={{ color: '#0F3B66', borderColor: '#cbd5e1', textTransform: 'none', fontWeight: 600 }}
          >
            BOM Master
          </Button>

          <Button
            variant="contained"
            startIcon={savingConfig ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSaveConfig}
            disabled={savingConfig}
            sx={{ bgcolor: '#be123c', '&:hover': { bgcolor: '#9f1239' }, textTransform: 'none', fontWeight: 700 }}
          >
            {savingConfig ? 'Saving...' : 'Save & Store Rates'}
          </Button>
        </Box>
      </Paper>

      {toast.show && (
        <Alert 
          severity={toast.severity} 
          onClose={() => setToast({ ...toast, show: false })}
          sx={{ mb: 3 }}
        >
          {toast.message}
        </Alert>
      )}

      {/* TOP SECTION: RAW MATERIAL & BRASS RATES TABLE (EXACT EXCEL LAYOUT) */}
      <Paper elevation={1} sx={{ p: 2.5, mb: 3, borderRadius: 2, border: '1.5px solid #fecdd3', bgcolor: '#ffffff' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 14, height: 14, bgcolor: '#f43f5e', borderRadius: '3px' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#9f1239' }}>
              Raw Material Rates & Brass Matrix (Input & Stored in Database)
            </Typography>
            <Chip label="User Editable Rates" size="small" sx={{ bgcolor: '#ffe4e6', color: '#be123c', fontWeight: 700, fontSize: '0.75rem' }} />
          </Box>
          <Button
            size="small"
            startIcon={<ResetIcon />}
            onClick={handleResetDefaults}
            sx={{ color: '#64748b', textTransform: 'none' }}
          >
            Reset Defaults
          </Button>
        </Box>

        <Grid container spacing={2.5}>
          {/* Left Column: Standard Rates */}
          <Grid item xs={12} lg={6}>
            <TableContainer sx={{ border: '1.5px solid #fecdd3', borderRadius: 2 }}>
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
                    <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>Pipe</TableCell>
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
                    <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>Rate / MTR (2900 Series)</TableCell>
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

          {/* Right Column: Brass Conversion, Weight & Derived Cost Matrix */}
          <Grid item xs={12} lg={6}>
            <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#fff1f2', p: 1.5, borderRadius: 2, border: '1.5px solid #fecdd3' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#9f1239' }}>
                Base Brass Rate / Kg:
              </Typography>
              <TextField
                size="small"
                type="number"
                value={config.BrassRatePerKg}
                onChange={(e) => handleConfigChange('BrassRatePerKg', e.target.value)}
                sx={{ ...RED_CELL_STYLE, width: 160 }}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Box>

            <TableContainer sx={{ border: '1.5px solid #fecdd3', borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#fff1f2' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, color: '#9f1239' }}>Brass Component</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#9f1239' }} align="center">Conversion (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#9f1239' }} align="center">Weight (Kg)</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#15803d' }} align="center">Derived Cost (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
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
                      ₹{calculationResult.derived.brassInsertCost.toFixed(2)}
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
                      ₹{calculationResult.derived.brassNutNCost.toFixed(2)}
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
                      ₹{calculationResult.derived.brassNutPCCost.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {/* Overheads breakdown summary */}
            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                Fixed Overheads per unit: Cap (₹2.50) + Key (₹1.00) + Washer (₹0.80) + Labour (₹2.00) + Packing (₹1.00) = <strong style={{ color: '#0F3B66' }}>₹7.30</strong>
              </Typography>
              <Chip label="Overheads: ₹7.30" size="small" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }} />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* VIEW TABS: SINGLE ITEM BOM INSPECTOR vs COMPLETE 8-SERIES MATRIX */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={pageTab} 
          onChange={(e, val) => setPageTab(val)}
          sx={{
            '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', fontSize: '0.95rem' },
            '& .Mui-selected': { color: '#0F3B66' }
          }}
        >
          <Tab icon={<BOMIcon />} iconPosition="start" label="Select Item & View BOM Cost Breakdown" />
          <Tab icon={<CalculateIcon />} iconPosition="start" label="Complete 8-Series Production Matrix (Excel Reference)" />
        </Tabs>
      </Box>

      {/* TAB 0: SELECT ANY ITEM -> SHOW BOM BREAKDOWN WITH PRICES */}
      {pageTab === 0 && (
        <Box>
          {/* Item Selector Bar */}
          <Paper elevation={1} sx={{ p: 2.5, mb: 3, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #cbd5e1' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={7}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <SearchIcon sx={{ fontSize: 20 }} /> Select Any Item to Inspect BOM & Dynamic Costing:
                </Typography>
                <Autocomplete
                  options={itemsList}
                  getOptionLabel={(option) => `${option.ItemCode} - ${option.ItemName} [${option.ItemType || 'FG'}]`}
                  value={selectedItem}
                  onChange={(event, newValue) => {
                    setSelectedItem(newValue);
                  }}
                  isOptionEqualToValue={(option, value) => option.ItemCode === value.ItemCode && option.SubCode === value.SubCode}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      placeholder="Search by code, series, or item name..." 
                      size="small" 
                      fullWidth 
                      sx={{ bgcolor: '#f8fafc' }}
                    />
                  )}
                />
              </Grid>

              {/* Quick Info Chip */}
              {selectedItem && (
                <Grid item xs={12} md={5}>
                  <Box sx={{ p: 1.5, bgcolor: '#f1f5f9', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#0F3B66' }}>
                      {selectedItem.ItemName}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                      <Chip label={`Code: ${selectedItem.ItemCode}`} size="small" sx={{ fontWeight: 600, fontSize: '0.72rem' }} />
                      {selectedItem.Series && <Chip label={`Series: ${selectedItem.Series}`} size="small" sx={{ bgcolor: '#e0f2fe', color: '#0284c7', fontWeight: 600, fontSize: '0.72rem' }} />}
                      <Chip label={`Type: ${selectedItem.ItemType || 'FG'}`} size="small" sx={{ fontWeight: 600, fontSize: '0.72rem' }} />
                      <Chip label={`Unit: ${selectedItem.Unit || 'PCS'}`} size="small" sx={{ fontWeight: 600, fontSize: '0.72rem' }} />
                    </Box>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Paper>

          {/* BOM Breakdown Content */}
          {loadingBOM ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : !bomBreakdown ? (
            <Alert severity="info">Please select an item from the dropdown above to view its BOM breakdown and costing.</Alert>
          ) : bomBreakdown.breakdown.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
              <BOMIcon sx={{ fontSize: 50, color: '#94a3b8', mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#334155' }}>
                No Bill of Materials (BOM) Found for {selectedItem?.ItemCode}
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                This item does not have sub-items registered in the BOM Master yet.
              </Typography>
              <Button 
                variant="contained" 
                startIcon={<BOMIcon />}
                onClick={() => navigate('/dashboard/bom', { state: { editParentCode: selectedItem?.ItemCode, editParentSubCode: selectedItem?.SubCode } })}
                sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#082542' }, textTransform: 'none', fontWeight: 600 }}
              >
                Create BOM in BOM Master
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {/* Left Column: BOM Sub-Items Table with Live Prices */}
              <Grid item xs={12} lg={8}>
                <Paper elevation={2} sx={{ p: 2.5, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #cbd5e1' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1, borderBottom: '2px solid #0F3B66' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BOMIcon sx={{ color: '#0F3B66' }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0F3B66' }}>
                        Required Sub-Items / Components from BOM ({bomBreakdown.breakdown.length} items)
                      </Typography>
                    </Box>
                    {bomBreakdown.size && (
                      <Chip 
                        label={`Product Size: ${bomBreakdown.size} (multiplier ${bomBreakdown.multiplier})`} 
                        size="small" 
                        sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }} 
                      />
                    )}
                  </Box>

                  <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800, color: '#475569' }}>#</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Sub-Product Code</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Sub-Product Name</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Type</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#475569' }} align="center">Required Qty</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#475569' }} align="right">Unit Price (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#0F3B66' }} align="right">Line Cost (₹)</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#475569' }} align="center">Source</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {bomBreakdown.breakdown.map((row, idx) => (
                          <TableRow key={row.childItemCode} hover>
                            <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>{idx + 1}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: '#0F3B66' }}>{row.childItemCode}</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>{row.childItemName}</TableCell>
                            <TableCell>
                              <Chip label={row.childItemType} size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                            </TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>
                              {row.quantity} {row.childUnit}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, color: '#475569' }}>
                              ₹{row.unitRate.toFixed(2)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, color: '#1e40af', bgcolor: '#f8fafc' }}>
                              ₹{row.lineCost.toFixed(2)}
                            </TableCell>
                            <TableCell align="center">
                              <Chip label={row.rateSource} size="small" sx={{ fontSize: '0.68rem', bgcolor: '#f1f5f9', color: '#475569' }} />
                            </TableCell>
                          </TableRow>
                        ))}

                        {/* Total Costing Row */}
                        <TableRow sx={{ bgcolor: '#eff6ff', borderTop: '2px solid #3b82f6' }}>
                          <TableCell colSpan={6} sx={{ fontWeight: 800, color: '#1e3a8a', fontSize: '0.95rem', textAlign: 'right' }}>
                            TOTAL PRODUCT COSTING:
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 900, color: '#1e40af', fontSize: '1.15rem' }}>
                            ₹{bomBreakdown.totalCosting.toFixed(2)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>

              {/* Right Column: Pricing & Margin Summary Card */}
              <Grid item xs={12} lg={4}>
                <Paper elevation={3} sx={{ p: 2.5, borderRadius: 2, bgcolor: '#ffffff', border: '1.5px solid #cbd5e1' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F3B66', mb: 2, pb: 1, borderBottom: '2px solid #0F3B66' }}>
                    Costing & Sale Price Summary
                  </Typography>

                  <Box sx={{ mb: 2.5, p: 2, bgcolor: '#eff6ff', borderRadius: 2, border: '1px solid #bfdbfe' }}>
                    <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Calculated Production Cost
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 900, color: '#1e3a8a', my: 0.5 }}>
                      ₹{bomBreakdown.totalCosting.toFixed(2)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#3b82f6' }}>
                      Sum of {bomBreakdown.breakdown.length} sub-items from BOM
                    </Typography>
                  </Box>

                  {/* Margin Input */}
                  <Box sx={{ mb: 2.5, p: 2, bgcolor: '#fffbeb', borderRadius: 2, border: '1px solid #fde68a' }}>
                    <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Add Profit Margin (₹)
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Margin (₹)"
                        value={itemMargin}
                        onChange={(e) => setItemMargin(e.target.value)}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">₹</InputAdornment>
                        }}
                        sx={{ bgcolor: '#ffffff' }}
                      />
                    </Box>
                  </Box>

                  {/* Final Sale Price (MRP) */}
                  <Box sx={{ mb: 3, p: 2, bgcolor: '#dcfce7', borderRadius: 2, border: '2px solid #22c55e' }}>
                    <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Calculated Sale Price / MRP
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#14532d', my: 0.5 }}>
                      ₹{calculatedSalePrice.toFixed(2)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 600 }}>
                      Formula: Total Costing (₹{bomBreakdown.totalCosting.toFixed(2)}) + Margin (₹{Number(itemMargin || 0).toFixed(2)})
                    </Typography>
                  </Box>

                  {/* Current Database Comparison */}
                  <Box sx={{ mb: 3, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block', mb: 0.5 }}>
                      Current In Item Master:
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>Master Costing: <strong>₹{Number(selectedItem.Costing || 0).toFixed(2)}</strong></span>
                      <span>Master MRP: <strong>₹{Number(selectedItem.MRP || 0).toFixed(2)}</strong></span>
                    </Box>
                  </Box>

                  {/* One-Click Save Button */}
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    startIcon={updatingItemPrice ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                    onClick={handleUpdateItemPrice}
                    disabled={updatingItemPrice}
                    sx={{ 
                      bgcolor: '#15803d', 
                      '&:hover': { bgcolor: '#166534' }, 
                      py: 1.4, 
                      fontWeight: 800, 
                      fontSize: '0.95rem',
                      textTransform: 'none',
                      borderRadius: 2
                    }}
                  >
                    {updatingItemPrice ? 'Saving to Item Master...' : 'Save Costing & Sale Price to Item Master'}
                  </Button>
                </Paper>
              </Grid>
            </Grid>
          )}
        </Box>
      )}

      {/* TAB 1: COMPLETE 8-SERIES PRODUCTION MATRIX (EXCEL REFERENCE) */}
      {pageTab === 1 && (
        <Box>
          {/* Global Margin Quick Fill Tool */}
          <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2, border: '1px solid #fed7aa', bgcolor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <TrendingUpIcon sx={{ color: '#ea580c', fontSize: 28 }} />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#9a3412' }}>
                  Batch Margin Tool
                </Typography>
                <Typography variant="body2" sx={{ color: '#c2410c' }}>
                  Quickly apply a profit margin across all sizes and series to instantly compute the Sale Price (MRP = Costing + Margin).
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <TextField
                size="small"
                type="number"
                placeholder="Margin in ₹"
                value={bulkMarginVal}
                onChange={(e) => setBulkMarginVal(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                sx={{ width: 150, bgcolor: '#ffffff' }}
              />
              <Button
                variant="contained"
                onClick={() => {
                  const num = Number(bulkMarginVal);
                  if (isNaN(num)) return;
                  const newMargins = {};
                  SERIES_DEFINITIONS.forEach(s => {
                    newMargins[s.seriesKey] = {};
                    SIZES.forEach(sz => {
                      newMargins[s.seriesKey][sz.size] = num;
                    });
                  });
                  setMargins(newMargins);
                  setToast({ show: true, message: `Applied margin ₹${num} across all series and sizes!`, severity: 'success' });
                }}
                sx={{ bgcolor: '#ea580c', '&:hover': { bgcolor: '#c2410c' }, textTransform: 'none', fontWeight: 700 }}
              >
                Apply to All 40 Sizes
              </Button>
            </Box>
          </Paper>

          {/* Series Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs 
              value={matrixSeriesTab} 
              onChange={(e, val) => setMatrixSeriesTab(val)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '0.9rem' },
                '& .Mui-selected': { color: '#0F3B66', fontWeight: 800 }
              }}
            >
              <Tab label="All 8 Series (Complete Grid)" />
              {calculationResult.series.map(s => (
                <Tab key={s.seriesKey} label={`${s.seriesKey} Series`} />
              ))}
            </Tabs>
          </Box>

          {/* Matrix Tables */}
          {calculationResult.series
            .filter((s, idx) => matrixSeriesTab === 0 || matrixSeriesTab === idx + 1)
            .map(s => (
              <Paper 
                key={s.seriesKey}
                elevation={2}
                sx={{ 
                  p: 2.5, 
                  mb: 3, 
                  borderRadius: 2, 
                  border: '1px solid #cbd5e1',
                  bgcolor: '#ffffff'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, pb: 1, borderBottom: '2px solid #0F3B66', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0F3B66' }}>
                    {s.seriesName}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip 
                      label={`Nut: ${s.nutName} (₹${s.nutUnitCost} × 2 = ₹${s.nutTotalCost})`} 
                      size="small" 
                      sx={{ bgcolor: '#f1f5f9', fontWeight: 600, color: '#334155' }} 
                    />
                    <Chip 
                      label={`Inner: ${s.innerName} (₹${s.innerUnitCost} × 2 = ₹${s.innerTotalCost})`} 
                      size="small" 
                      sx={{ bgcolor: '#f1f5f9', fontWeight: 600, color: '#334155' }} 
                    />
                    {s.isHcp && (
                      <Chip 
                        label="HCP Pipe" 
                        size="small" 
                        sx={{ bgcolor: '#e0f2fe', color: '#0284c7', fontWeight: 700 }} 
                      />
                    )}
                  </Box>
                </Box>

                <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, width: '22%', color: '#475569' }}>Sub-Item / Component</TableCell>
                        {s.sizes.map(sz => (
                          <TableCell key={sz.size} align="center" sx={{ fontWeight: 800, color: '#0F3B66', fontSize: '0.92rem' }}>
                            {sz.size}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow hover>
                        <TableCell sx={{ color: '#475569' }}>Pipe Cost (Rate/38×mult)</TableCell>
                        {s.sizes.map(sz => (
                          <TableCell key={sz.size} align="center" sx={{ fontWeight: 500 }}>
                            ₹{sz.pipeCost.toFixed(2)}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow hover>
                        <TableCell sx={{ color: '#475569' }}>Cap</TableCell>
                        {s.sizes.map(sz => (
                          <TableCell key={sz.size} align="center" sx={{ color: '#64748b' }}>₹{sz.capCost.toFixed(2)}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow hover>
                        <TableCell sx={{ color: '#475569' }}>Nut ({s.nutName} ×2)</TableCell>
                        {s.sizes.map(sz => (
                          <TableCell key={sz.size} align="center" sx={{ color: '#64748b' }}>₹{sz.nutCost.toFixed(2)}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow hover>
                        <TableCell sx={{ color: '#475569' }}>Inner ({s.innerName} ×2)</TableCell>
                        {s.sizes.map(sz => (
                          <TableCell key={sz.size} align="center" sx={{ color: '#64748b' }}>₹{sz.innerCost.toFixed(2)}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow hover>
                        <TableCell sx={{ color: '#475569' }}>Key</TableCell>
                        {s.sizes.map(sz => (
                          <TableCell key={sz.size} align="center" sx={{ color: '#64748b' }}>₹{sz.keyCost.toFixed(2)}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow hover>
                        <TableCell sx={{ color: '#475569' }}>Washer</TableCell>
                        {s.sizes.map(sz => (
                          <TableCell key={sz.size} align="center" sx={{ color: '#64748b' }}>₹{sz.washerCost.toFixed(2)}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow hover>
                        <TableCell sx={{ color: '#475569' }}>Labour</TableCell>
                        {s.sizes.map(sz => (
                          <TableCell key={sz.size} align="center" sx={{ color: '#64748b' }}>₹{sz.labourCost.toFixed(2)}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow hover>
                        <TableCell sx={{ color: '#475569' }}>Packing</TableCell>
                        {s.sizes.map(sz => (
                          <TableCell key={sz.size} align="center" sx={{ color: '#64748b' }}>₹{sz.packingCost.toFixed(2)}</TableCell>
                        ))}
                      </TableRow>

                      <TableRow sx={{ bgcolor: '#eff6ff', borderTop: '2px solid #3b82f6' }}>
                        <TableCell sx={{ fontWeight: 800, color: '#1e3a8a', fontSize: '0.92rem' }}>
                          ITEM COSTING (₹)
                        </TableCell>
                        {s.sizes.map(sz => (
                          <TableCell key={sz.size} align="center" sx={{ fontWeight: 800, color: '#1e40af', fontSize: '1rem' }}>
                            ₹{sz.totalCost.toFixed(2)}
                          </TableCell>
                        ))}
                      </TableRow>

                      <TableRow sx={{ bgcolor: '#fffbeb' }}>
                        <TableCell sx={{ fontWeight: 700, color: '#b45309' }}>
                          + Add Margin (₹)
                        </TableCell>
                        {s.sizes.map(sz => (
                          <TableCell key={sz.size} align="center" sx={{ p: 0.8 }}>
                            <TextField
                              size="small"
                              type="number"
                              value={margins[s.seriesKey]?.[sz.size] ?? ''}
                              placeholder="0"
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                setMargins(prev => ({
                                  ...prev,
                                  [s.seriesKey]: {
                                    ...(prev[s.seriesKey] || {}),
                                    [sz.size]: val
                                  }
                                }));
                              }}
                              InputProps={{
                                startAdornment: <InputAdornment position="start">₹</InputAdornment>
                              }}
                              sx={{
                                width: 105,
                                bgcolor: '#ffffff',
                                '& input': { textAlign: 'right', fontWeight: 600, color: '#b45309' }
                              }}
                            />
                          </TableCell>
                        ))}
                      </TableRow>

                      <TableRow sx={{ bgcolor: '#dcfce7', borderTop: '2px solid #22c55e', borderBottom: '2px solid #22c55e' }}>
                        <TableCell sx={{ fontWeight: 800, color: '#14532d', fontSize: '0.95rem' }}>
                          SALE PRICE / MRP (₹)
                        </TableCell>
                        {s.sizes.map(sz => (
                          <TableCell key={sz.size} align="center" sx={{ fontWeight: 900, color: '#15803d', fontSize: '1.08rem' }}>
                            ₹{sz.salePrice.toFixed(2)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            ))}
        </Box>
      )}
    </Box>
  );
};

export default ItemCostingPage;
