import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, IconButton, CircularProgress, Alert,
  Tooltip, LinearProgress, Stack, Collapse, Divider
} from '@mui/material';
import {
  AccountTree as BOMIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ShoppingCartCheckout as OrderIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  Layers as LayersIcon,
  Refresh as RefreshIcon,
  Store as WarehouseIcon
} from '@mui/icons-material';

const BOMShortfallView = ({
  parentCode,
  parentSubCode = '',
  parentName = '',
  shortfallQty = 1,
  onOrderChildPart,
  onOpenBOMMaster,
  inline = false
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bomData, setBomData] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});

  const fetchBreakup = async () => {
    if (!parentCode) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (parentSubCode) params.append('subCode', parentSubCode);
      if (shortfallQty) params.append('shortfallQty', shortfallQty);

      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bom/shortfall-breakup/${encodeURIComponent(parentCode)}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch BOM breakup (Status ${res.status})`);
      }
      const data = await res.json();
      setBomData(data);
    } catch (err) {
      console.error('Error fetching BOM shortfall breakup:', err);
      setError(err.message || 'Error loading BOM breakdown');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBreakup();
  }, [parentCode, parentSubCode, shortfallQty]);

  const toggleRow = (key) => {
    setExpandedRows(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={32} sx={{ color: '#0F3B66' }} />
        <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary', fontWeight: 600 }}>
          Calculating BOM component stock availability for {shortfallQty} units...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 1 }} action={
        <IconButton size="small" color="inherit" onClick={fetchBreakup}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      }>
        {error}
      </Alert>
    );
  }

  if (!bomData || !bomData.hasBOM || !bomData.childParts || bomData.childParts.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BOMIcon sx={{ color: '#94a3b8', fontSize: 32 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>
              No Bill of Materials (BOM) Configured
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Item <strong>{parentCode}{parentSubCode ? ` (${parentSubCode})` : ''}</strong> does not have child components defined in BOM Master.
            </Typography>
          </Box>
          {onOpenBOMMaster && (
            <Button
              size="small"
              variant="outlined"
              onClick={onOpenBOMMaster}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Configure BOM
            </Button>
          )}
        </Box>
      </Paper>
    );
  }

  const { summary, childParts, parentItem } = bomData;

  return (
    <Box sx={{ width: '100%', ...(inline ? { my: 1 } : {}) }}>
      {/* Header Metric Cards */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          bgcolor: '#f1f5f9',
          border: '1px solid #e2e8f0',
          borderRadius: 2
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <BOMIcon sx={{ color: '#0F3B66' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0F3B66' }}>
                BOM Component Availability & Shortfall
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.3 }}>
              Required to fulfill FG Shortfall of <strong>{shortfallQty} {parentItem?.Unit || 'PCS'}</strong> for <strong>{parentCode}</strong> {parentName || parentItem?.ItemName ? `(${parentName || parentItem?.ItemName})` : ''}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5} flexWrap="wrap">
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: '1rem !important' }} />}
              label={`${summary.partsInStock} / ${summary.totalChildParts} Parts In Stock`}
              color={summary.partsWithShortfall === 0 ? 'success' : 'default'}
              size="small"
              sx={{ fontWeight: 700 }}
            />
            {summary.partsWithShortfall > 0 && (
              <Chip
                icon={<ErrorIcon sx={{ fontSize: '1rem !important' }} />}
                label={`${summary.partsWithShortfall} Shortfall ${summary.partsWithShortfall === 1 ? 'Part' : 'Parts'}`}
                color="error"
                size="small"
                sx={{ fontWeight: 800, bgcolor: '#fee2e2', color: '#dc2626' }}
              />
            )}
            <Chip
              label={`Readiness: ${summary.overallReadinessPct}%`}
              size="small"
              sx={{
                fontWeight: 800,
                bgcolor: summary.overallReadinessPct === 100 ? '#dcfce7' : summary.overallReadinessPct >= 50 ? '#fef3c7' : '#fee2e2',
                color: summary.overallReadinessPct === 100 ? '#15803d' : summary.overallReadinessPct >= 50 ? '#b45309' : '#b91c1c'
              }}
            />
          </Stack>
        </Stack>

        {/* Readiness Bar */}
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              Assembly Readiness
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: summary.overallReadinessPct === 100 ? '#16a34a' : '#d97706' }}>
              {summary.overallReadinessPct}% Ready {summary.totalShortfallValue > 0 ? `(Shortfall Est: ₹${summary.totalShortfallValue.toLocaleString('en-IN')})` : ''}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={summary.overallReadinessPct}
            sx={{
              height: 7,
              borderRadius: 3.5,
              bgcolor: '#e2e8f0',
              '& .MuiLinearProgress-bar': {
                bgcolor: summary.overallReadinessPct === 100 ? '#10b981' : summary.overallReadinessPct >= 50 ? '#f59e0b' : '#ef4444'
              }
            }}
          />
        </Box>
      </Paper>

      {/* Child Parts Table */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ width: 36, p: 0.5 }}></TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Child Part Code</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Description & Category</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Warehouse / Bin</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>BOM Ratio</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>Req. Qty</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>Available Stock</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>Child Shortfall</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, color: '#334155' }}>Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>Est. Value</TableCell>
              {onOrderChildPart && (
                <TableCell align="center" sx={{ fontWeight: 700, color: '#334155' }}>Action</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {childParts.map((child, idx) => {
              const rowKey = `${child.childItemCode}___${child.childSubCode || ''}`;
              const isExpanded = !!expandedRows[rowKey];
              const isShortfall = child.childShortfallQty > 0;

              return (
                <React.Fragment key={rowKey}>
                  <TableRow
                    hover
                    sx={{
                      bgcolor: isShortfall ? '#fff5f5' : 'inherit',
                      '&:hover': { bgcolor: isShortfall ? '#fee2e2 !important' : undefined }
                    }}
                  >
                    <TableCell sx={{ p: 0.5 }}>
                      {child.hasSubBOM ? (
                        <Tooltip title={isExpanded ? "Hide Sub-Assembly Raw Materials" : "View Sub-Assembly Raw Materials"}>
                          <IconButton size="small" onClick={() => toggleRow(rowKey)}>
                            {isExpanded ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#0F3B66' }}>
                        {child.childItemCode}
                      </Typography>
                      {child.childSubCode && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', bgcolor: '#e2e8f0', px: 0.8, py: 0.2, borderRadius: 1 }}>
                          SubCode: {child.childSubCode}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {child.childItemName}
                      </Typography>
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.3 }}>
                        <Chip
                          size="small"
                          label={child.category === 'SubContract' ? 'Sub-Contract' : child.category}
                          variant="outlined"
                          color={child.category === 'SubContract' ? 'warning' : child.category === 'BOP' ? 'secondary' : 'default'}
                          sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }}
                        />
                        <Chip
                          size="small"
                          label={child.itemType}
                          sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f1f5f9' }}
                        />
                      </Stack>
                    </TableCell>

                    <TableCell>
                      <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                        <WarehouseIcon sx={{ fontSize: 13 }} />
                        {child.warehouseNo || 'WH-01'}{child.location ? ` / ${child.location}` : ''}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {child.bomRatio} / unit
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                        {child.requiredQty} {child.unit}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          color: child.stockInHand >= child.requiredQty ? '#16a34a' : child.stockInHand > 0 ? '#d97706' : '#dc2626'
                        }}
                      >
                        {child.stockInHand} {child.unit}
                      </Typography>
                      {child.pendingPIQty > 0 && (
                        <Typography variant="caption" sx={{ color: '#0284c7', display: 'block' }}>
                          +{child.pendingPIQty} in PI
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell align="right">
                      {isShortfall ? (
                        <Chip
                          size="small"
                          label={`-${child.childShortfallQty} ${child.unit}`}
                          color="error"
                          sx={{ fontWeight: 900, fontSize: '0.75rem', height: 22 }}
                        />
                      ) : (
                        <Chip
                          size="small"
                          label="Covered (0)"
                          color="success"
                          variant="outlined"
                          sx={{ fontWeight: 600, fontSize: '0.7rem', height: 20 }}
                        />
                      )}
                    </TableCell>

                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={child.status}
                        color={
                          child.status === 'In Stock' ? 'success' :
                          child.status === 'Partial Stock' ? 'warning' : 'error'
                        }
                        sx={{ fontWeight: 700, fontSize: '0.68rem', height: 20 }}
                      />
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: isShortfall ? '#dc2626' : 'text.secondary' }}>
                        {isShortfall ? `₹${child.shortfallValue.toLocaleString('en-IN')}` : '₹0'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        @₹{child.costing}/u
                      </Typography>
                    </TableCell>

                    {onOrderChildPart && (
                      <TableCell align="center">
                        {isShortfall ? (
                          <Tooltip title={`Create PI for ${child.childShortfallQty} ${child.unit} of ${child.childItemCode}`}>
                            <Button
                              size="small"
                              variant="contained"
                              color="warning"
                              startIcon={<OrderIcon sx={{ fontSize: 14 }} />}
                              onClick={() => onOrderChildPart({
                                ItemCode: child.childItemCode,
                                SubCode: child.childSubCode,
                                ItemName: child.childItemName,
                                Unit: child.unit,
                                Costing: child.costing,
                                MissingQty: child.childShortfallQty,
                                Category: child.category
                              })}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                py: 0.2,
                                px: 1,
                                height: 24
                              }}
                            >
                              Order
                            </Button>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                    )}
                  </TableRow>

                  {/* Level 2 Sub-Assembly Explosion Accordion */}
                  {child.hasSubBOM && (
                    <TableRow>
                      <TableCell colSpan={onOrderChildPart ? 11 : 10} sx={{ py: 0, px: 2, bgcolor: '#f8fafc' }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ my: 1.5, p: 1.5, bgcolor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 1.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                              <LayersIcon sx={{ fontSize: 15, color: '#0F3B66' }} />
                              Sub-Assembly Raw Material Explosion for <strong>{child.childItemCode}</strong> ({child.childItemName})
                            </Typography>
                            <Table size="small">
                              <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                                <TableRow>
                                  <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Raw Material Code</TableCell>
                                  <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Material Name</TableCell>
                                  <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Category</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>BOM Ratio</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Total Needed</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>RM In Hand</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>RM Shortfall</TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Status</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {child.subBOM.map((sub, sIdx) => (
                                  <TableRow key={sIdx} hover>
                                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F3B66' }}>
                                      {sub.childItemCode}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.75rem' }}>{sub.childItemName}</TableCell>
                                    <TableCell sx={{ fontSize: '0.75rem' }}>
                                      <Chip size="small" label={sub.category} sx={{ height: 16, fontSize: '0.62rem' }} />
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: '0.75rem' }}>{sub.bomRatio}</TableCell>
                                    <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
                                      {sub.requiredQty} {sub.unit}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                                      {sub.stockInHand} {sub.unit}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                                      {sub.childShortfallQty > 0 ? (
                                        <Typography sx={{ color: '#dc2626', fontWeight: 800, fontSize: '0.75rem' }}>
                                          -{sub.childShortfallQty} {sub.unit}
                                        </Typography>
                                      ) : (
                                        <Typography sx={{ color: '#16a34a', fontSize: '0.75rem' }}>Covered</Typography>
                                      )}
                                    </TableCell>
                                    <TableCell align="center">
                                      <Chip
                                        size="small"
                                        label={sub.status}
                                        color={sub.status === 'In Stock' ? 'success' : 'error'}
                                        sx={{ height: 16, fontSize: '0.62rem' }}
                                      />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default BOMShortfallView;
