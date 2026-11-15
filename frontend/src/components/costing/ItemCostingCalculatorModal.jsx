import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
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
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
  InputAdornment
} from '@mui/material';
import {
  Calculate as CalculateIcon,
  Save as SaveIcon,
  Sync as SyncIcon,
  FileDownload as ExportIcon,
  Close as CloseIcon,
  RestartAlt as ResetIcon,
  Add as AddIcon,
  CheckCircle as CheckIcon,
  TrendingUp as TrendingUpIcon,
  InfoOutlined as InfoIcon
} from '@mui/icons-material';
import { DEFAULT_CONFIG, SIZES, SERIES_DEFINITIONS, calculateCosting } from '../../utils/itemCostingEngine';
import * as XLSX from 'xlsx';

const RED_INPUT_STYLE = {
  bgcolor: '#fff1f2',
  '& .MuiOutlinedInput-root': {
    bgcolor: '#fff1f2',
    '& fieldset': { borderColor: '#f43f5e', borderWidth: '1.5px' },
    '&:hover fieldset': { borderColor: '#e11d48' },
    '&.Mui-focused fieldset': { borderColor: '#be123c', borderWidth: '2px' }
  },
  '& .MuiInputLabel-root': { color: '#be123c', fontWeight: 600 }
};

const ItemCostingCalculatorModal = ({ open, onClose, onItemsUpdated }) => {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [margins, setMargins] = useState({});
  const [activeTab, setActiveTab] = useState(0); // 0 = All Series, 1..8 = specific series
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', severity: 'success' });
  const [bulkMarginVal, setBulkMarginVal] = useState('');
  const [createMissingItems, setCreateMissingItems] = useState(true);

  // Fetch saved config from backend
  const fetchConfig = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchConfig();
    }
  }, [open]);

  // Live calculation based on current state
  const calculationResult = useMemo(() => {
    return calculateCosting(config, margins);
  }, [config, margins]);

  const handleInputChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value === '' ? '' : Number(value)
    }));
  };

  const handleMarginChange = (seriesKey, size, value) => {
    const val = value === '' ? 0 : Number(value);
    setMargins(prev => ({
      ...prev,
      [seriesKey]: {
        ...(prev[seriesKey] || {}),
        [size]: val
      }
    }));
  };

  const handleApplyBulkMargin = () => {
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
  };

  const handleResetDefaults = () => {
    setConfig(DEFAULT_CONFIG);
    setMargins({});
    setToast({ show: true, message: 'Reset all inputs and formulas to Excel defaults', severity: 'info' });
  };

  // Save config to database
  const handleSaveConfig = async () => {
    setSaving(true);
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
        setToast({ show: true, message: 'Costing rates & margins saved to database successfully!', severity: 'success' });
      } else {
        setToast({ show: true, message: data.message || 'Failed to save rates', severity: 'error' });
      }
    } catch (err) {
      setToast({ show: true, message: 'Network error saving rates: ' + err.message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Sync / Apply to ItemMaster
  const handleSyncToItemMaster = async () => {
    setSyncing(true);
    try {
      const itemsToSync = [];
      calculationResult.series.forEach(s => {
        s.sizes.forEach(sz => {
          itemsToSync.push({
            seriesKey: s.seriesKey,
            seriesCode: s.seriesCode,
            seriesName: s.seriesName,
            size: sz.size,
            totalCost: sz.totalCost,
            salePrice: sz.salePrice,
            margin: sz.margin
          });
        });
      });

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/costing/apply-to-item-master`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemsToSync,
          createMissing: createMissingItems
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToast({ show: true, message: data.message, severity: 'success' });
        if (onItemsUpdated) onItemsUpdated();
      } else {
        setToast({ show: true, message: data.message || 'Failed to apply costing to Item Master', severity: 'error' });
      }
    } catch (err) {
      setToast({ show: true, message: 'Error syncing with Item Master: ' + err.message, severity: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  // Export to Excel file
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = [];

    // Header section
    rows.push(['Pipe Rate/MTR', config.PipeRatePerMeter, '', 'Brass Rate/Kg', config.BrassRatePerKg]);
    rows.push(['HCP Pipe Rate/MTR', config.HcpPipeRatePerMeter, '', 'Brass Insert Cost', calculationResult.derived.brassInsertCost]);
    rows.push(['Nylon Insert', config.NylonInsertRate, '', 'Brass Nut (N) Cost', calculationResult.derived.brassNutNCost]);
    rows.push(['Nylon Nut', config.NylonNutRate, '', 'Brass Nut (PC) Cost', calculationResult.derived.brassNutPCCost]);
    rows.push(['SS201 Nut', config.SS201NutRate]);
    rows.push(['SS304 Nut', config.SS304NutRate]);
    rows.push(['SS Inner', config.SSInnerRate]);
    rows.push([]);

    // Series tables
    calculationResult.series.forEach(s => {
      rows.push([s.seriesName]);
      rows.push(['Component', '12"', '18"', '24"', '30"', '36"']);
      rows.push(['Pipe', ...s.sizes.map(x => x.pipeCost)]);
      rows.push(['Cap', ...s.sizes.map(x => x.capCost)]);
      rows.push([`Nut (${s.nutName})`, ...s.sizes.map(x => x.nutCost)]);
      rows.push([`Inner (${s.innerName})`, ...s.sizes.map(x => x.innerCost)]);
      rows.push(['Key', ...s.sizes.map(x => x.keyCost)]);
      rows.push(['Washer', ...s.sizes.map(x => x.washerCost)]);
      rows.push(['Labour', ...s.sizes.map(x => x.labourCost)]);
      rows.push(['Packing', ...s.sizes.map(x => x.packingCost)]);
      rows.push(['COSTING (Total)', ...s.sizes.map(x => x.totalCost)]);
      rows.push(['Margin', ...s.sizes.map(x => x.margin)]);
      rows.push(['SALE PRICE', ...s.sizes.map(x => x.salePrice)]);
      rows.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Costing_Calculation');
    XLSX.writeFile(wb, `FRM_Item_Costing_Matrix_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const renderSeriesCard = (s) => (
    <Paper 
      key={s.seriesKey}
      elevation={2}
      sx={{ 
        p: 2, 
        mb: 2.5, 
        borderRadius: 2, 
        border: '1px solid #cbd5e1',
        bgcolor: '#ffffff'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, pb: 1, borderBottom: '2px solid #0F3B66' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0F3B66' }}>
          {s.seriesName}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
              <TableCell sx={{ fontWeight: 700, width: '22%', color: '#475569' }}>Component</TableCell>
              {s.sizes.map(sz => (
                <TableCell key={sz.size} align="center" sx={{ fontWeight: 800, color: '#0F3B66', fontSize: '0.9rem' }}>
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

            {/* Total Costing Row */}
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

            {/* Margin Input Row */}
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
                    onChange={(e) => handleMarginChange(s.seriesKey, sz.size, e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₹</InputAdornment>
                    }}
                    sx={{
                      width: 100,
                      bgcolor: '#ffffff',
                      '& input': { textAlign: 'right', fontWeight: 600, color: '#b45309' }
                    }}
                  />
                </TableCell>
              ))}
            </TableRow>

            {/* Final Sale Price Row (Green like Excel FFC6EFCE) */}
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
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2.5,
          minHeight: '85vh',
          bgcolor: '#f8fafc'
        }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: '#0F3B66', 
        color: '#ffffff', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        py: 1.5,
        px: 2.5
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <CalculateIcon sx={{ color: '#F88A01', fontSize: 28 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Item Master Costing & Sale Price Calculator
            </Typography>
            <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
              Automated production costing from raw material rates with margin & MRP calculation
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#ffffff', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5 }}>
        {toast.show && (
          <Alert 
            severity={toast.severity} 
            onClose={() => setToast({ ...toast, show: false })}
            sx={{ mb: 2 }}
          >
            {toast.message}
          </Alert>
        )}

        {/* Top Section: Red Input Fields from Excel */}
        <Paper elevation={1} sx={{ p: 2.2, mb: 2.5, borderRadius: 2, border: '1px solid #fecdd3', bgcolor: '#ffffff' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 14, height: 14, bgcolor: '#f43f5e', borderRadius: '3px' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#9f1239' }}>
                Primary Rate Inputs (Highlighted Red in Excel)
              </Typography>
              <Chip label="User Editable Rates" size="small" sx={{ bgcolor: '#ffe4e6', color: '#be123c', fontWeight: 600, fontSize: '0.72rem' }} />
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

          <Grid container spacing={2}>
            {/* 1. Pipe & Brass Primary Rates */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Pipe Rate / MTR"
                type="number"
                value={config.PipeRatePerMeter}
                onChange={(e) => handleInputChange('PipeRatePerMeter', e.target.value)}
                sx={RED_INPUT_STYLE}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                helperText="Base pipe rate for Series 2000-2600"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Brass Rate / Kg"
                type="number"
                value={config.BrassRatePerKg}
                onChange={(e) => handleInputChange('BrassRatePerKg', e.target.value)}
                sx={RED_INPUT_STYLE}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                helperText="Base brass raw material cost"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="HCP Pipe Rate / MTR"
                type="number"
                value={config.HcpPipeRatePerMeter}
                onChange={(e) => handleInputChange('HcpPipeRatePerMeter', e.target.value)}
                sx={RED_INPUT_STYLE}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                helperText="Used specifically for 2900 Series"
              />
            </Grid>

            {/* 2. Nut & Insert Rates */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Nylon Insert Rate"
                type="number"
                value={config.NylonInsertRate}
                onChange={(e) => handleInputChange('NylonInsertRate', e.target.value)}
                sx={RED_INPUT_STYLE}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Nylon Nut Rate"
                type="number"
                value={config.NylonNutRate}
                onChange={(e) => handleInputChange('NylonNutRate', e.target.value)}
                sx={RED_INPUT_STYLE}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="SS201 Nut Rate"
                type="number"
                value={config.SS201NutRate}
                onChange={(e) => handleInputChange('SS201NutRate', e.target.value)}
                sx={RED_INPUT_STYLE}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="SS304 Nut Rate"
                type="number"
                value={config.SS304NutRate}
                onChange={(e) => handleInputChange('SS304NutRate', e.target.value)}
                sx={RED_INPUT_STYLE}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="SS Inner Rate"
                type="number"
                value={config.SSInnerRate}
                onChange={(e) => handleInputChange('SSInnerRate', e.target.value)}
                sx={RED_INPUT_STYLE}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Brass Conversion & Weight Specs */}
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', mb: 1.2 }}>
            Brass Components Conversion & Weight Formula: (Brass Rate + Conversion) × Weight = Cost
          </Typography>

          <Grid container spacing={2}>
            {/* Brass Insert */}
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: '#fafaf9' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>Brass Insert</Typography>
                  <Chip 
                    label={`Cost: ₹${calculationResult.derived.brassInsertCost}`} 
                    size="small" 
                    sx={{ bgcolor: '#ecfdf5', color: '#059669', fontWeight: 700 }} 
                  />
                </Box>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Conversion"
                      type="number"
                      value={config.BrassInsertConv}
                      onChange={(e) => handleInputChange('BrassInsertConv', e.target.value)}
                      sx={RED_INPUT_STYLE}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Weight (Kg)"
                      type="number"
                      value={config.BrassInsertWeight}
                      onChange={(e) => handleInputChange('BrassInsertWeight', e.target.value)}
                      sx={RED_INPUT_STYLE}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* Brass Nut (N) */}
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: '#fafaf9' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>Brass Nut (N)</Typography>
                  <Chip 
                    label={`Cost: ₹${calculationResult.derived.brassNutNCost}`} 
                    size="small" 
                    sx={{ bgcolor: '#ecfdf5', color: '#059669', fontWeight: 700 }} 
                  />
                </Box>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Conversion"
                      type="number"
                      value={config.BrassNutNConv}
                      onChange={(e) => handleInputChange('BrassNutNConv', e.target.value)}
                      sx={RED_INPUT_STYLE}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Weight (Kg)"
                      type="number"
                      value={config.BrassNutNWeight}
                      onChange={(e) => handleInputChange('BrassNutNWeight', e.target.value)}
                      sx={RED_INPUT_STYLE}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* Brass Nut (PC) */}
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: '#fafaf9' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>Brass Nut (PC)</Typography>
                  <Chip 
                    label={`Cost: ₹${calculationResult.derived.brassNutPCCost}`} 
                    size="small" 
                    sx={{ bgcolor: '#ecfdf5', color: '#059669', fontWeight: 700 }} 
                  />
                </Box>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Conversion"
                      type="number"
                      value={config.BrassNutPCConv}
                      onChange={(e) => handleInputChange('BrassNutPCConv', e.target.value)}
                      sx={RED_INPUT_STYLE}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Weight (Kg)"
                      type="number"
                      value={config.BrassNutPCWeight}
                      onChange={(e) => handleInputChange('BrassNutPCWeight', e.target.value)}
                      sx={RED_INPUT_STYLE}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </Paper>

        {/* Global Margin Quick Fill Tool */}
        <Paper elevation={0} sx={{ p: 1.5, mb: 2, borderRadius: 2, border: '1px solid #fed7aa', bgcolor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon sx={{ color: '#ea580c' }} />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#9a3412' }}>
                Batch Margin Tool
              </Typography>
              <Typography variant="caption" sx={{ color: '#c2410c' }}>
                Quickly add a fixed profit margin across all sizes and series to calculate Sale Price (MRP)
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              type="number"
              placeholder="Margin in ₹"
              value={bulkMarginVal}
              onChange={(e) => setBulkMarginVal(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              sx={{ width: 140, bgcolor: '#ffffff' }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleApplyBulkMargin}
              sx={{ bgcolor: '#ea580c', '&:hover': { bgcolor: '#c2410c' }, textTransform: 'none', fontWeight: 600 }}
            >
              Apply to All Sizes
            </Button>
          </Box>
        </Paper>

        {/* Series Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, val) => setActiveTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '0.86rem' },
              '& .Mui-selected': { color: '#0F3B66', fontWeight: 800 }
            }}
          >
            <Tab label="All 8 Series (Complete Grid)" />
            {calculationResult.series.map(s => (
              <Tab key={s.seriesKey} label={`${s.seriesKey} Series`} />
            ))}
          </Tabs>
        </Box>

        {/* Series Content */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : activeTab === 0 ? (
          <Box>
            {calculationResult.series.map(s => renderSeriesCard(s))}
          </Box>
        ) : (
          <Box>
            {renderSeriesCard(calculationResult.series[activeTab - 1])}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={handleExportExcel}
            sx={{ color: '#0F3B66', borderColor: '#0F3B66', textTransform: 'none', fontWeight: 600 }}
          >
            Export to Excel
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={onClose}
            sx={{ color: '#64748b', textTransform: 'none' }}
          >
            Close
          </Button>

          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSaveConfig}
            disabled={saving}
            sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#082542' }, textTransform: 'none', fontWeight: 600 }}
          >
            {saving ? 'Saving...' : 'Save Rates & Margins'}
          </Button>

          <Button
            variant="contained"
            startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
            onClick={handleSyncToItemMaster}
            disabled={syncing}
            sx={{ bgcolor: '#15803d', '&:hover': { bgcolor: '#166534' }, textTransform: 'none', fontWeight: 700 }}
          >
            {syncing ? 'Syncing...' : 'Update Item Master Costing & Sale Prices'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default ItemCostingCalculatorModal;
