import { useState, useEffect } from 'react';
import { 
  Typography, 
  Paper, 
  Box, 
  Grid, 
  Skeleton,
  Card,
  CardContent,
  CardActionArea,
  Avatar,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  IconButton,
  Badge,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  AccountBalanceWallet as ValueIcon,
  CallReceived as ReceivableIcon,
  CallMade as PayableIcon,
  Inventory as AssetIcon,
  Storefront as StockIcon,
  CalendarMonth as CalendarMonthIcon,
  Refresh as RefreshIcon,
  Notifications as NotificationsIcon,
  WarningAmber as WarningIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ArrowForward as ArrowForwardIcon,
  ShoppingCart,
  LocalShipping,
  CheckCircle,
  Launch as LaunchIcon,
  AccountTree as BOMIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import BOMShortfallModal from '../components/common/BOMShortfallModal';

const DashboardHome = () => {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [cashBankDialogOpen, setCashBankDialogOpen] = useState(false);
  const [cashBankLedgers, setCashBankLedgers] = useState([]);
  const [cashBankLoading, setCashBankLoading] = useState(false);

  const [purchaseShortfallModalOpen, setPurchaseShortfallModalOpen] = useState(false);
  const [salesOrdersModalOpen, setSalesOrdersModalOpen] = useState(false);

  // BOM Shortfall Breakup Drill-down states
  const [selectedBOMItem, setSelectedBOMItem] = useState(null);
  const [bomBreakupModalOpen, setBomBreakupModalOpen] = useState(false);

  const fetchCashBankLedgers = async () => {
    setCashBankDialogOpen(true);
    setCashBankLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers`);
      if (response.ok) {
        const data = await response.json();
        const filtered = data.filter(l => l.AccountGroupName === 'Cash-in-Hand' || l.AccountGroupName === 'Bank Accounts');
        setCashBankLedgers(filtered);
      }
    } catch (error) {
      console.error('Error fetching cash/bank ledgers:', error);
    } finally {
      setCashBankLoading(false);
    }
  };

  const fetchKPIs = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/dashboard/kpis`);
      const data = await response.json();
      if (response.ok) {
        setKpis(data);
      }
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKPIs();
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(value || 0));
  };

  const totalAlerts = (kpis?.lowStockCount || 0) + 
    ((kpis?.totalReceivableOverdue || 0) > 0 ? 1 : 0) + 
    ((kpis?.totalPayableOverdue || 0) > 0 ? 1 : 0);

  const tc = kpis?.turnoverComparison;

  const topKpis = [
    {
      title: 'Total Stock Valuation',
      subtitle: 'Closing Stock * Costing',
      value: formatCurrency(kpis?.totalValue || 0),
      icon: <StockIcon sx={{ fontSize: 26 }} />,
      color: '#10b981', // Emerald
      bgColor: '#d1fae5',
      link: '/dashboard/reports/stock',
      customFooter: (
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Total Items:</Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#0F3B66' }}>{kpis?.totalItems || 0} SKUs</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Reorder Alerts:</Typography>
            <Chip 
              label={(kpis?.lowStockCount || 0) > 0 ? `${kpis.lowStockCount} below min` : 'Stock Healthy'}
              size="small"
              sx={{ 
                height: 18, 
                fontSize: '0.65rem', 
                fontWeight: 700, 
                bgcolor: (kpis?.lowStockCount || 0) > 0 ? '#fee2e2' : '#dcfce7',
                color: (kpis?.lowStockCount || 0) > 0 ? '#ef4444' : '#15803d'
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Valuation Mode:</Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.72rem' }}>Closing * Costing</Typography>
          </Box>
        </Box>
      )
    },
    {
      title: 'Total Turnover',
      subtitle: 'Outward Revenue',
      value: formatCurrency(kpis?.totalTurnover || 0),
      icon: <ValueIcon sx={{ fontSize: 26 }} />,
      color: '#f59e0b', // Amber
      bgColor: '#fef3c7',
      link: '/dashboard/reports/outward',
      customFooter: (
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>This Month:</Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#0F3B66' }}>
              {formatCurrency(tc?.currentMonthTurnover || 0)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>vs Prev Month:</Typography>
            {tc?.hasPrevMonthData ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: (tc.prevMonthGrowthPercent >= 0 ? '#10b981' : '#ef4444'), display: 'flex', alignItems: 'center' }}>
                  {tc.prevMonthGrowthPercent >= 0 ? <TrendingUpIcon sx={{ fontSize: 13, mr: 0.2 }} /> : <TrendingDownIcon sx={{ fontSize: 13, mr: 0.2 }} />}
                  {tc.prevMonthGrowthPercent >= 0 ? '+' : ''}{tc.prevMonthGrowthPercent}%
                </Typography>
                <Chip 
                  label={formatCurrency(tc.previousMonthTurnover)} 
                  size="small" 
                  sx={{ height: 18, fontSize: '0.62rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569' }} 
                />
              </Box>
            ) : (
              <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.7rem' }}>
                No prev data
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>vs Last Year:</Typography>
            {tc?.hasLastYearData ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: (tc.lastYearGrowthPercent >= 0 ? '#10b981' : '#ef4444'), display: 'flex', alignItems: 'center' }}>
                  {tc.lastYearGrowthPercent >= 0 ? <TrendingUpIcon sx={{ fontSize: 13, mr: 0.2 }} /> : <TrendingDownIcon sx={{ fontSize: 13, mr: 0.2 }} />}
                  {tc.lastYearGrowthPercent >= 0 ? '+' : ''}{tc.lastYearGrowthPercent}%
                </Typography>
                <Chip 
                  label={formatCurrency(tc.lastYearSameMonthTurnover)} 
                  size="small" 
                  sx={{ height: 18, fontSize: '0.62rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569' }} 
                />
              </Box>
            ) : (
              <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.7rem' }}>
                No prior yr data
              </Typography>
            )}
          </Box>
        </Box>
      )
    },
    {
      title: 'Cash & Bank',
      subtitle: (kpis?.cashBankBalance || 0) < 0 ? 'Overdrawn / Negative' : 'Liquid Assets',
      value: formatCurrency(kpis?.cashBankBalance || 0),
      valueColor: (kpis?.cashBankBalance || 0) < 0 ? '#dc2626' : '#1e293b',
      icon: <ValueIcon sx={{ fontSize: 26 }} />,
      color: (kpis?.cashBankBalance || 0) < 0 ? '#ef4444' : '#8b5cf6',
      bgColor: (kpis?.cashBankBalance || 0) < 0 ? '#fef2f2' : '#f3e8ff',
      onClick: fetchCashBankLedgers,
      customFooter: (
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Liquidity State:</Typography>
            <Chip 
              label={(kpis?.cashBankBalance || 0) < 0 ? 'Overdrawn' : 'Solvent'} 
              size="small" 
              sx={{ 
                height: 18, 
                fontSize: '0.65rem', 
                fontWeight: 700, 
                bgcolor: (kpis?.cashBankBalance || 0) < 0 ? '#fee2e2' : '#f3e8ff',
                color: (kpis?.cashBankBalance || 0) < 0 ? '#ef4444' : '#7c3aed' 
              }} 
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Accounts:</Typography>
            <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 700, cursor: 'pointer' }}>
              Inspect Details ↗
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Scope:</Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.72rem' }}>Cash + Bank Ledgers</Typography>
          </Box>
        </Box>
      )
    },
    {
      title: 'Total Asset Value',
      subtitle: 'Sum of Registered Assets',
      value: formatCurrency(kpis?.totalAssetValue || 0),
      icon: <AssetIcon sx={{ fontSize: 26 }} />,
      color: '#0d9488', // Teal
      bgColor: '#ccfbf1',
      link: '/dashboard/assets',
      customFooter: (
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Departments:</Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#0F3B66' }}>{kpis?.totalDepartments || 0} Units</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Transfers Today:</Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#0d9488' }}>{kpis?.transfersToday || 0} batches</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Classification:</Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.72rem' }}>Fixed Plant & Machinery</Typography>
          </Box>
        </Box>
      )
    }
  ];

  const monthlyData = kpis?.monthlyOutward || [];
  const maxMonthlyAmount = monthlyData.length > 0 ? Math.max(...monthlyData.map(d => d.totalAmount)) : 1;
  const topParties = kpis?.topParties || [];

  return (
    <Box>
      {/* Operations Header Bar */}
      <Box sx={{ 
        mb: 3.5, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', sm: 'center' }, 
        flexDirection: { xs: 'column', sm: 'row' }, 
        gap: 2 
      }}>
        <Box>
          <Typography variant="h4" sx={{ 
            fontWeight: 800, 
            color: '#0F3B66', 
            letterSpacing: -0.5,
            fontSize: { xs: '1.45rem', sm: '1.75rem', md: '2.125rem' } 
          }}>
            Operations Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
            Real-time overview of manufacturing workflows, stock valuation, and finances.
          </Typography>
        </Box>

        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1, 
          flexWrap: 'wrap', 
          width: { xs: '100%', sm: 'auto' }, 
          justifyContent: { xs: 'flex-start', sm: 'flex-end' } 
        }}>
          <Chip 
            icon={<CalendarMonthIcon sx={{ fontSize: '16px !important', color: '#0F3B66 !important' }} />}
            label={new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            sx={{ 
              bgcolor: '#ffffff', 
              color: '#0F3B66', 
              fontWeight: 600, 
              border: '1px solid #cbd5e1', 
              px: 0.5,
              py: 0.5,
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          />
          <Tooltip title="Notification & Alert Logs">
            <IconButton
              onClick={() => navigate('/dashboard/logs')}
              sx={{
                bgcolor: '#ffffff',
                color: totalAlerts > 0 ? '#ea580c' : '#0F3B66',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                '&:hover': { bgcolor: '#f1f5f9', color: '#F88A01', borderColor: '#F88A01' }
              }}
            >
              <Badge badgeContent={totalAlerts} color="error" max={99}>
                <NotificationsIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            size="small"
            startIcon={<NotificationsIcon fontSize="small" />}
            onClick={() => navigate('/dashboard/logs')}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderRadius: 2,
              color: '#0F3B66',
              borderColor: '#cbd5e1',
              bgcolor: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              '&:hover': { borderColor: '#0F3B66', bgcolor: '#f8fafc' }
            }}
          >
            Alert Logs {totalAlerts > 0 && `(${totalAlerts})`}
          </Button>
          <Tooltip title="Refresh Dashboard Data">
            <IconButton 
              onClick={() => { setLoading(true); fetchKPIs(); }}
              sx={{ 
                bgcolor: '#ffffff', 
                color: '#0F3B66', 
                border: '1px solid #cbd5e1', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                '&:hover': { bgcolor: '#f1f5f9', color: '#F88A01', borderColor: '#F88A01' } 
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Low Stock Warning Alert Banner */}
      {kpis?.lowStockCount > 0 && (
        <Alert 
          severity="warning" 
          icon={<WarningIcon fontSize="inherit" />}
          sx={{ 
            mb: 3, 
            borderRadius: 2.5, 
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.1)',
            border: '1px solid #fde68a',
            bgcolor: '#fffbeb',
            color: '#92400e',
            alignItems: 'center',
            '& .MuiAlert-message': { 
              width: '100%', 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' }, 
              justifyContent: 'space-between', 
              alignItems: { xs: 'flex-start', sm: 'center' }, 
              gap: 1.5 
            }
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#92400e' }}>
              Low Stock Warning: {kpis.lowStockCount} {kpis.lowStockCount === 1 ? 'item is' : 'items are'} below minimum reorder level
            </Typography>
            <Typography variant="caption" sx={{ color: '#b45309' }}>
              Inventory stock has fallen under safety threshold. Prompt procurement or subcontract replenishment is recommended.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: { xs: '100%', sm: 'auto' } }}>
            <Button 
              size="small" 
              variant="contained" 
              onClick={() => navigate('/dashboard/logs')}
              sx={{ 
                bgcolor: '#d97706', 
                color: '#ffffff', 
                textTransform: 'none', 
                fontWeight: 700, 
                fontSize: '0.75rem',
                borderRadius: 1.5,
                boxShadow: 'none',
                flex: { xs: 1, sm: 'none' },
                '&:hover': { bgcolor: '#b45309', boxShadow: 'none' } 
              }}
            >
              View Alert Details
            </Button>
            <Button 
              size="small" 
              variant="outlined" 
              onClick={() => navigate('/dashboard/items')}
              sx={{ 
                color: '#92400e', 
                borderColor: '#d97706', 
                textTransform: 'none', 
                fontWeight: 700, 
                fontSize: '0.75rem',
                borderRadius: 1.5,
                flex: { xs: 1, sm: 'none' },
                '&:hover': { borderColor: '#b45309', bgcolor: '#fef3c7' } 
              }}
            >
              Item Master
            </Button>
          </Box>
        </Alert>
      )}

      {/* Row 1: Core KPI Metrics (4 Cards) */}
      <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }} sx={{ mb: 3 }}>
        {topKpis.map((card, index) => (
          <Grid item xs={12} sm={6} md={6} lg={3} key={index}>
            <Card sx={{ 
              borderRadius: 3, 
              boxShadow: '0 2px 10px rgba(15, 59, 102, 0.06)',
              border: '1px solid #e2e8f0',
              borderTop: `4px solid ${card.color}`,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { 
                transform: 'translateY(-3px)',
                boxShadow: '0 8px 24px rgba(15, 59, 102, 0.12)' 
              }
            }}>
              <CardActionArea 
                onClick={() => card.onClick ? card.onClick() : navigate(card.link)} 
                sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', p: 0 }}
              >
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {card.title}
                    </Typography>
                    <Avatar sx={{ 
                      bgcolor: card.bgColor, 
                      color: card.color, 
                      width: 44, 
                      height: 44, 
                      borderRadius: 2
                    }}>
                      {card.icon}
                    </Avatar>
                  </Box>

                  {loading ? (
                    <Box sx={{ mt: 'auto' }}>
                      <Skeleton variant="text" width={110} height={36} />
                      <Skeleton variant="rectangular" height={70} sx={{ mt: 1, borderRadius: 1 }} />
                    </Box>
                  ) : (
                    <Box sx={{ mt: 'auto' }}>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: card.valueColor || '#1e293b' }}>
                        {card.value}
                      </Typography>
                      {card.subtitle && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.3, mb: 0.5 }}>
                          {card.subtitle}
                        </Typography>
                      )}
                      {card.customFooter}
                    </Box>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Row 2: Authority Operations Center - Purchase Authority (Shortfall) & Sales Authority (Pending Orders & Dispatch) */}
      <Box sx={{ mb: 3.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F3B66', letterSpacing: -0.3 }}>
              Order Fulfillment & Authority Center
            </Typography>
            <Chip 
              label="Live Demand & Fulfillment Tracking" 
              size="small" 
              sx={{ bgcolor: '#eff6ff', color: '#1e40af', fontWeight: 700, fontSize: '0.68rem', height: 20 }} 
            />
          </Box>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Real-time synchronization between Customer POs, Store Stock & Procurement Pipeline
          </Typography>
        </Box>

        <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
          {/* Card 1: Purchase Authority - Shortfall Items */}
          <Grid item xs={12} lg={6}>
            <Card sx={{ 
              borderRadius: 3, 
              boxShadow: '0 2px 10px rgba(15, 59, 102, 0.06)',
              border: '1px solid #fed7aa',
              borderTop: '4px solid #ea580c',
              bgcolor: '#ffffff',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { 
                transform: 'translateY(-3px)',
                boxShadow: '0 8px 24px rgba(234, 88, 12, 0.12)' 
              }
            }}>
              <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } }, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                      <Chip 
                        icon={<ShoppingCart sx={{ fontSize: '15px !important', color: '#c2410c !important' }} />}
                        label="Purchase Authority" 
                        size="small" 
                        sx={{ bgcolor: '#fff7ed', color: '#c2410c', fontWeight: 800, fontSize: '0.74rem', height: 24, border: '1px solid #ffedd5' }} 
                      />
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                        Procurement & PO Fulfillment
                      </Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: (kpis?.purchaseAuthority?.shortfallItemsCount || 0) > 0 ? '#c2410c' : '#0F3B66', fontSize: { xs: '1.6rem', sm: '2rem' } }}>
                      {loading ? <Skeleton width={140} /> : (
                        <>
                          {kpis?.purchaseAuthority?.shortfallItemsCount || 0}{' '}
                          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#64748b' }}>
                            {kpis?.purchaseAuthority?.shortfallItemsCount === 1 ? 'Shortfall Item' : 'Shortfall Items'}
                          </span>
                        </>
                      )}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: '#fff7ed', color: '#ea580c', width: 46, height: 46, borderRadius: 2 }}>
                    <ShoppingCart sx={{ fontSize: 24 }} />
                  </Avatar>
                </Box>

                {/* 2x2 Metrics Box */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, my: 1, flexGrow: 1 }}>
                  {/* Metric 1: PO Qty */}
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', mb: 0.3 }}>
                      Total PO Qty (Demand)
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F3B66' }}>
                      {loading ? <Skeleton width={70} /> : `${(kpis?.purchaseAuthority?.totalPOQty || 0).toLocaleString()} PCS`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                      Required for active customer POs
                    </Typography>
                  </Box>

                  {/* Metric 2: Shortfall Qty */}
                  <Box sx={{ 
                    p: 1.5, 
                    borderRadius: 2, 
                    bgcolor: (kpis?.purchaseAuthority?.totalShortfallQty || 0) > 0 ? '#fff1f2' : '#f0fdf4', 
                    border: '1px solid',
                    borderColor: (kpis?.purchaseAuthority?.totalShortfallQty || 0) > 0 ? '#fecaca' : '#bbf7d0'
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.3 }}>
                      <Typography variant="caption" sx={{ 
                        fontWeight: 700, 
                        color: (kpis?.purchaseAuthority?.totalShortfallQty || 0) > 0 ? '#991b1b' : '#166534', 
                        textTransform: 'uppercase', 
                        letterSpacing: 0.4 
                      }}>
                        Shortfall Qty
                      </Typography>
                      {(kpis?.purchaseAuthority?.totalShortfallQty || 0) > 0 ? (
                        <Chip label="Procure Needed" size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 800, bgcolor: '#fee2e2', color: '#dc2626' }} />
                      ) : (
                        <Chip label="Healthy" size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 800, bgcolor: '#dcfce7', color: '#15803d' }} />
                      )}
                    </Box>
                    <Typography variant="h6" sx={{ 
                      fontWeight: 900, 
                      color: (kpis?.purchaseAuthority?.totalShortfallQty || 0) > 0 ? '#dc2626' : '#16a34a' 
                    }}>
                      {loading ? <Skeleton width={70} /> : `${(kpis?.purchaseAuthority?.totalShortfallQty || 0).toLocaleString()} PCS`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: (kpis?.purchaseAuthority?.totalShortfallQty || 0) > 0 ? '#ef4444' : '#15803d', fontSize: '0.7rem' }}>
                      {(kpis?.purchaseAuthority?.totalShortfallQty || 0) > 0 ? 'Missing qty after stock & pipeline' : 'All order demand fully covered'}
                    </Typography>
                  </Box>

                  {/* Metric 3: Pipeline Proforma Invoice Qty */}
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', mb: 0.3 }}>
                      In Procurement (PI)
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0284c7' }}>
                      {loading ? <Skeleton width={60} /> : `${(kpis?.purchaseAuthority?.pipelinePIQty || 0).toLocaleString()} PCS`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                      Ordered on Proforma Invoices
                    </Typography>
                  </Box>

                  {/* Metric 4: Est. Shortfall Capital */}
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', mb: 0.3 }}>
                      Est. Shortfall Valuation
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#b45309' }}>
                      {loading ? <Skeleton width={70} /> : formatCurrency(kpis?.purchaseAuthority?.totalMissingValue || 0)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                      Purchase capital needed @ Costing
                    </Typography>
                  </Box>
                </Box>

                {/* Footer Actions */}
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setPurchaseShortfallModalOpen(true)}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.76rem', color: '#c2410c', borderColor: '#fed7aa', '&:hover': { bgcolor: '#fff7ed', borderColor: '#ea580c' } }}
                  >
                    Inspect Shortfall Items ({kpis?.purchaseAuthority?.shortfallItemsCount || 0})
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                    onClick={() => navigate('/dashboard/reports/pending-po?tab=2')}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.76rem', bgcolor: '#ea580c', '&:hover': { bgcolor: '#c2410c' } }}
                  >
                    Fulfillment Report & Order PI
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 2: Sales Authority - Pending Orders & Ready to Dispatch */}
          <Grid item xs={12} lg={6}>
            <Card sx={{ 
              borderRadius: 3, 
              boxShadow: '0 2px 10px rgba(15, 59, 102, 0.06)',
              border: '1px solid #bfdbfe',
              borderTop: '4px solid #0F3B66',
              bgcolor: '#ffffff',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { 
                transform: 'translateY(-3px)',
                boxShadow: '0 8px 24px rgba(15, 59, 102, 0.12)' 
              }
            }}>
              <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } }, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                      <Chip 
                        icon={<LocalShipping sx={{ fontSize: '15px !important', color: '#0F3B66 !important' }} />}
                        label="Sales Authority" 
                        size="small" 
                        sx={{ bgcolor: '#eff6ff', color: '#0F3B66', fontWeight: 800, fontSize: '0.74rem', height: 24, border: '1px solid #dbeafe' }} 
                      />
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                        Order Dispatch & Stock Fulfillment
                      </Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F3B66', fontSize: { xs: '1.6rem', sm: '2rem' } }}>
                      {loading ? <Skeleton width={140} /> : (
                        <>
                          {kpis?.salesAuthority?.pendingOrderItemsCount || 0}{' '}
                          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#64748b' }}>
                            Pending Order Items
                          </span>
                        </>
                      )}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: '#eff6ff', color: '#0F3B66', width: 46, height: 46, borderRadius: 2 }}>
                    <LocalShipping sx={{ fontSize: 24 }} />
                  </Avatar>
                </Box>

                {/* Readiness Progress Bar */}
                <Box sx={{ mb: 1.5, p: 1.25, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155' }}>
                      Dispatch Readiness Rate
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: (kpis?.salesAuthority?.readinessPercentage || 0) === 100 ? '#15803d' : '#0F3B66' }}>
                      {kpis?.salesAuthority?.readinessPercentage || 0}% Ready to Ship
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={kpis?.salesAuthority?.readinessPercentage || 0} 
                    sx={{ 
                      height: 8, 
                      borderRadius: 4, 
                      bgcolor: '#e2e8f0',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: (kpis?.salesAuthority?.readinessPercentage || 0) >= 80 ? '#10b981' : (kpis?.salesAuthority?.readinessPercentage || 0) >= 40 ? '#f59e0b' : '#ef4444'
                      }
                    }} 
                  />
                </Box>

                {/* 2x2 Metrics Box */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, my: 1, flexGrow: 1 }}>
                  {/* Metric 1: Ready to Dispatch Qty */}
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.3 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Ready to Dispatch
                      </Typography>
                      <CheckCircle sx={{ fontSize: 16, color: '#16a34a' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 900, color: '#15803d' }}>
                      {loading ? <Skeleton width={70} /> : `${(kpis?.salesAuthority?.readyToDispatchQty || 0).toLocaleString()} PCS`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#166534', fontSize: '0.7rem' }}>
                      In-hand stock ready for immediate delivery
                    </Typography>
                  </Box>

                  {/* Metric 2: Sales Shortfall Qty */}
                  <Box sx={{ 
                    p: 1.5, 
                    borderRadius: 2, 
                    bgcolor: (kpis?.salesAuthority?.shortfallQty || 0) > 0 ? '#fff7ed' : '#f8fafc', 
                    border: '1px solid',
                    borderColor: (kpis?.salesAuthority?.shortfallQty || 0) > 0 ? '#fed7aa' : '#e2e8f0'
                  }}>
                    <Typography variant="caption" sx={{ 
                      fontWeight: 700, 
                      color: (kpis?.salesAuthority?.shortfallQty || 0) > 0 ? '#c2410c' : '#475569', 
                      textTransform: 'uppercase', 
                      letterSpacing: 0.4, 
                      display: 'block', 
                      mb: 0.3 
                    }}>
                      Shortfall Qty
                    </Typography>
                    <Typography variant="h6" sx={{ 
                      fontWeight: 900, 
                      color: (kpis?.salesAuthority?.shortfallQty || 0) > 0 ? '#ea580c' : '#64748b' 
                    }}>
                      {loading ? <Skeleton width={70} /> : `${(kpis?.salesAuthority?.shortfallQty || 0).toLocaleString()} PCS`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: (kpis?.salesAuthority?.shortfallQty || 0) > 0 ? '#c2410c' : '#64748b', fontSize: '0.7rem' }}>
                      {(kpis?.salesAuthority?.shortfallQty || 0) > 0 ? 'Awaiting stock replenishment' : 'Zero order backlog'}
                    </Typography>
                  </Box>

                  {/* Metric 3: Total Pending Order Qty */}
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', mb: 0.3 }}>
                      Total Order Demand
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0F3B66' }}>
                      {loading ? <Skeleton width={70} /> : `${(kpis?.salesAuthority?.totalOrderQty || 0).toLocaleString()} PCS`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                      Across {kpis?.salesAuthority?.totalPendingOrdersCount || 0} active Customer POs
                    </Typography>
                  </Box>

                  {/* Metric 4: Item Coverage State */}
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', mb: 0.3 }}>
                      Item Fulfillment Status
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e293b' }}>
                      {loading ? <Skeleton width={70} /> : `${kpis?.salesAuthority?.fullyReadyItemsCount || 0} Ready / ${kpis?.salesAuthority?.partialOrShortfallCount || 0} Partial`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                      Line-item dispatch readiness
                    </Typography>
                  </Box>
                </Box>

                {/* Footer Actions */}
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setSalesOrdersModalOpen(true)}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.76rem', color: '#0F3B66', borderColor: '#bfdbfe', '&:hover': { bgcolor: '#eff6ff', borderColor: '#0F3B66' } }}
                  >
                    Inspect Pending Orders ({kpis?.salesAuthority?.pendingOrderItemsCount || 0})
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                    onClick={() => navigate('/dashboard/outward')}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.76rem', bgcolor: '#0F3B66', '&:hover': { bgcolor: '#F88A01' } }}
                  >
                    Sales Outward Dispatch
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Row 3: Financial Analysis - Receivables & Payables with Bill / Without Bill & Overdue */}
      <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }} sx={{ mb: 4 }}>
        {/* Receivables Card */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ 
            borderRadius: 3, 
            boxShadow: '0 2px 10px rgba(15, 59, 102, 0.06)',
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #3b82f6',
            height: '100%',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': { 
              transform: 'translateY(-3px)',
              boxShadow: '0 8px 24px rgba(15, 59, 102, 0.12)' 
            }
          }}>
            <CardActionArea onClick={() => navigate('/dashboard/reports/receivable')} sx={{ height: '100%', p: 0 }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Chip label="Receivables" size="small" sx={{ bgcolor: '#eff6ff', color: '#2563eb', fontWeight: 700, fontSize: '0.72rem', height: 22 }} />
                      <Typography variant="caption" sx={{ color: '#64748b' }}>Sundry Debtors</Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F3B66', fontSize: { xs: '1.6rem', sm: '2.125rem' } }}>
                      {loading ? <Skeleton width={140} /> : formatCurrency(kpis?.totalReceivable || 0)}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: '#eff6ff', color: '#3b82f6', width: 48, height: 48, borderRadius: 2 }}>
                    <ReceivableIcon sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>

                {/* Split Box: Outstanding vs Overdue */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mt: 1 }}>
                  {/* Current Outstanding */}
                  <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', mb: 0.5 }}>
                      Outstanding Net
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0F3B66', mb: 1 }}>
                      {loading ? <Skeleton width={80} /> : formatCurrency(kpis?.totalReceivable || 0)}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25, borderTop: '1px dashed #e2e8f0' }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>🧾 With Bill:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                        {loading ? <Skeleton width={50} /> : formatCurrency(kpis?.totalReceivableWithBill || 0)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>📋 Without Bill:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#d97706' }}>
                        {loading ? <Skeleton width={50} /> : formatCurrency(kpis?.totalReceivableWithoutBill || 0)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Overdue */}
                  <Box sx={{ 
                    p: 1.75, 
                    borderRadius: 2, 
                    bgcolor: (kpis?.totalReceivableOverdue || 0) > 0 ? '#fff7ed' : '#f8fafc', 
                    border: '1px solid',
                    borderColor: (kpis?.totalReceivableOverdue || 0) > 0 ? '#fed7aa' : '#e2e8f0'
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ 
                        fontWeight: 700, 
                        color: (kpis?.totalReceivableOverdue || 0) > 0 ? '#c2410c' : '#475569', 
                        textTransform: 'uppercase', 
                        letterSpacing: 0.4 
                      }}>
                        Total Overdue
                      </Typography>
                      <Chip 
                        label={(kpis?.totalReceivableOverdue || 0) > 0 ? 'Due Past Terms' : 'No Overdue'} 
                        size="small" 
                        sx={{ 
                          height: 18, 
                          fontSize: '0.65rem', 
                          fontWeight: 700, 
                          bgcolor: (kpis?.totalReceivableOverdue || 0) > 0 ? '#fee2e2' : '#f1f5f9', 
                          color: (kpis?.totalReceivableOverdue || 0) > 0 ? '#ef4444' : '#64748b' 
                        }} 
                      />
                    </Box>
                    <Typography variant="subtitle1" sx={{ 
                      fontWeight: 800, 
                      color: (kpis?.totalReceivableOverdue || 0) > 0 ? '#ef4444' : '#1e293b', 
                      mb: 1 
                    }}>
                      {loading ? <Skeleton width={80} /> : formatCurrency(kpis?.totalReceivableOverdue || 0)}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25, borderTop: '1px dashed #fed7aa' }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>🧾 With Bill Overdue:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: (kpis?.totalReceivableOverdueWithBill || 0) > 0 ? '#ef4444' : '#64748b' }}>
                        {loading ? <Skeleton width={50} /> : formatCurrency(kpis?.totalReceivableOverdueWithBill || 0)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>📋 Without Bill Overdue:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: (kpis?.totalReceivableOverdueWithoutBill || 0) > 0 ? '#ea580c' : '#64748b' }}>
                        {loading ? <Skeleton width={50} /> : formatCurrency(kpis?.totalReceivableWithoutBill || 0)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        {/* Payables Card */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ 
            borderRadius: 3, 
            boxShadow: '0 2px 10px rgba(15, 59, 102, 0.06)',
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #ef4444',
            height: '100%',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': { 
              transform: 'translateY(-3px)',
              boxShadow: '0 8px 24px rgba(15, 59, 102, 0.12)' 
            }
          }}>
            <CardActionArea onClick={() => navigate('/dashboard/reports/payable')} sx={{ height: '100%', p: 0 }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Chip label="Payables" size="small" sx={{ bgcolor: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: '0.72rem', height: 22 }} />
                      <Typography variant="caption" sx={{ color: '#64748b' }}>Sundry Creditors & Vendors</Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F3B66', fontSize: { xs: '1.6rem', sm: '2.125rem' } }}>
                      {loading ? <Skeleton width={140} /> : formatCurrency(kpis?.totalPayable || 0)}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: '#fef2f2', color: '#ef4444', width: 48, height: 48, borderRadius: 2 }}>
                    <PayableIcon sx={{ fontSize: 28 }} />
                  </Avatar>
                </Box>

                {/* Split Box: Outstanding vs Overdue */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mt: 1 }}>
                  {/* Current Outstanding */}
                  <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', mb: 0.5 }}>
                      Outstanding Net
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0F3B66', mb: 1 }}>
                      {loading ? <Skeleton width={80} /> : formatCurrency(kpis?.totalPayable || 0)}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25, borderTop: '1px dashed #e2e8f0' }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>🧾 With Bill:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                        {loading ? <Skeleton width={50} /> : formatCurrency(kpis?.totalPayableWithBill || 0)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>📋 Without Bill:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#d97706' }}>
                        {loading ? <Skeleton width={50} /> : formatCurrency(kpis?.totalPayableWithoutBill || 0)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Overdue */}
                  <Box sx={{ 
                    p: 1.75, 
                    borderRadius: 2, 
                    bgcolor: (kpis?.totalPayableOverdue || 0) > 0 ? '#fff7ed' : '#f8fafc', 
                    border: '1px solid',
                    borderColor: (kpis?.totalPayableOverdue || 0) > 0 ? '#fed7aa' : '#e2e8f0'
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ 
                        fontWeight: 700, 
                        color: (kpis?.totalPayableOverdue || 0) > 0 ? '#c2410c' : '#475569', 
                        textTransform: 'uppercase', 
                        letterSpacing: 0.4 
                      }}>
                        Total Overdue
                      </Typography>
                      <Chip 
                        label={(kpis?.totalPayableOverdue || 0) > 0 ? 'Due Past Terms' : 'No Overdue'} 
                        size="small" 
                        sx={{ 
                          height: 18, 
                          fontSize: '0.65rem', 
                          fontWeight: 700, 
                          bgcolor: (kpis?.totalPayableOverdue || 0) > 0 ? '#fee2e2' : '#f1f5f9', 
                          color: (kpis?.totalPayableOverdue || 0) > 0 ? '#ef4444' : '#64748b' 
                        }} 
                      />
                    </Box>
                    <Typography variant="subtitle1" sx={{ 
                      fontWeight: 800, 
                      color: (kpis?.totalPayableOverdue || 0) > 0 ? '#ef4444' : '#1e293b', 
                      mb: 1 
                    }}>
                      {loading ? <Skeleton width={80} /> : formatCurrency(kpis?.totalPayableOverdue || 0)}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25, borderTop: '1px dashed #fed7aa' }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>🧾 With Bill Overdue:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: (kpis?.totalPayableOverdueWithBill || 0) > 0 ? '#ef4444' : '#64748b' }}>
                        {loading ? <Skeleton width={50} /> : formatCurrency(kpis?.totalPayableOverdueWithBill || 0)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>📋 Without Bill Overdue:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: (kpis?.totalPayableOverdueWithoutBill || 0) > 0 ? '#ea580c' : '#64748b' }}>
                        {loading ? <Skeleton width={50} /> : formatCurrency(kpis?.totalPayableWithoutBill || 0)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>

      {/* Row 3: Analytics Section - Trends & Top Parties */}
      <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }} sx={{ mb: 4 }}>
        {/* Monthly Outward Chart Area */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: 3, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66', mb: 3 }}>
              Monthly Outward Trends (Last 6 Months)
            </Typography>
            
            {loading ? (
              <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 2 }} />
            ) : monthlyData.length > 0 ? (
              <Box sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 250, pt: 2, pb: 1, borderBottom: '1px solid #e2e8f0', minWidth: { xs: 460, sm: 'auto' } }}>
                  {monthlyData.map((data, idx) => {
                    const heightPercent = Math.max((data.totalAmount / maxMonthlyAmount) * 100, 2);
                    return (
                      <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12%', height: '100%', justifyContent: 'flex-end' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#3b82f6', mb: 1, fontSize: '0.72rem' }}>
                          {data.totalAmount > 0 ? formatCurrency(data.totalAmount).split('.')[0] : ''}
                        </Typography>
                        <Box 
                          sx={{ 
                            width: '100%', 
                            height: `${heightPercent}%`, 
                            bgcolor: '#3b82f6', 
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 1s ease-out',
                            opacity: 0.9,
                            '&:hover': { opacity: 1, bgcolor: '#2563eb' }
                          }} 
                        />
                        <Typography variant="caption" sx={{ mt: 1, fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {data.monthLabel}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 8 }}>
                No recent outward data available.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Top 5 Party Area */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: 3, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66', mb: 3 }}>
              Top 5 Parties by Outward
            </Typography>
            
            {loading ? (
              <Box>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Skeleton key={n} variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
                ))}
              </Box>
            ) : topParties.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {topParties.map((party, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #f1f5f9' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, pr: 1 }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: '#10b981', fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0 }}>
                        {idx + 1}
                      </Avatar>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {party.partyName}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#10b981', flexShrink: 0 }}>
                      {formatCurrency(party.totalAmount).split('.')[0]}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 8 }}>
                No party data available.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Row 4: Department-wise Stock */}
      <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: { xs: 2.5, sm: 3, md: 4 }, borderRadius: 3, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66', mb: 3 }}>
              Department-wise Stock
            </Typography>
            {loading ? (
              <Grid container spacing={3}>
                {[1, 2, 3].map((n) => (
                  <Grid item xs={12} sm={6} md={4} key={n}>
                    <Skeleton variant="rectangular" height={90} sx={{ borderRadius: 2 }} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Grid container spacing={3}>
                {kpis?.departmentStocks?.map((dept, idx) => (
                  <Grid item xs={12} sm={6} md={4} key={idx}>
                    <Box 
                      sx={{ 
                        p: 2.5, 
                        borderRadius: 2, 
                        border: '1px solid #e2e8f0', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        transition: 'all 0.2s',
                        '&:hover': { 
                          borderColor: '#3b82f6', 
                          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.08)',
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                          {dept.deptName}
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.5 }}>
                          {dept.totalPcs || 0} Pcs | {Math.round(Number(dept.totalWeight || 0))} KG
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 700, mt: 0.5 }}>
                          Value: {formatCurrency(dept.totalValue || 0)}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
                {(!kpis?.departmentStocks || kpis.departmentStocks.length === 0) && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                      No department stock data available.
                    </Typography>
                  </Grid>
                )}
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Cash & Bank Balances Modal Dialog */}
      <Dialog open={cashBankDialogOpen} onClose={() => setCashBankDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#0F3B66', borderBottom: '1px solid #e2e8f0', pb: 2 }}>
          Cash & Bank Balances
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {cashBankLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
          ) : cashBankLedgers.length === 0 ? (
            <Typography align="center" color="text.secondary" sx={{ py: 3 }}>No Cash or Bank accounts found.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Account Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Account Type</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cashBankLedgers.map((l, index) => (
                    <TableRow key={index} hover>
                      <TableCell>{l.LedgerName}</TableCell>
                      <TableCell>
                        <Chip 
                          label={l.AccountGroupName} 
                          size="small" 
                          color={l.AccountGroupName === 'Cash-in-Hand' ? 'success' : 'primary'}
                          variant="outlined" 
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: (l.ClosingBalance || 0) < 0 ? '#dc2626' : 'inherit' }}>
                        {formatCurrency(l.ClosingBalance || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} align="right" sx={{ fontWeight: 700 }}>Total:</TableCell>
                    <TableCell align="right" sx={{ 
                      fontWeight: 700, 
                      color: cashBankLedgers.reduce((sum, l) => sum + (l.ClosingBalance || 0), 0) < 0 ? '#dc2626' : '#8b5cf6' 
                    }}>
                      {formatCurrency(
                        cashBankLedgers.reduce((sum, l) => sum + (l.ClosingBalance || 0), 0)
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setCashBankDialogOpen(false)} variant="contained" color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Purchase Authority: Shortfall Items Drill-Down Dialog */}
      <Dialog 
        open={purchaseShortfallModalOpen} 
        onClose={() => setPurchaseShortfallModalOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0F3B66', borderBottom: '1px solid #e2e8f0', pb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShoppingCart sx={{ color: '#ea580c' }} />
            <span>Purchase Authority: Shortfall Items ({kpis?.purchaseAuthority?.shortfallItemsCount || 0})</span>
          </Box>
          <Chip 
            label={`Total Shortfall: ${(kpis?.purchaseAuthority?.totalShortfallQty || 0).toLocaleString()} PCS`} 
            size="small" 
            sx={{ bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 800 }} 
          />
        </DialogTitle>
        <DialogContent sx={{ mt: 1.5, p: { xs: 1.5, sm: 2.5 } }}>
          {(!kpis?.purchaseAuthority?.items || kpis.purchaseAuthority.items.length === 0) ? (
            <Alert severity="success" sx={{ my: 2 }}>
              Great news! Zero shortfall items detected. All customer purchase orders are fully covered by stock in hand or active pipeline.
            </Alert>
          ) : (
            <TableContainer component={Paper} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, maxHeight: '60vh' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>Item Code</TableCell>
                    <TableCell sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>Item Name</TableCell>
                    <TableCell sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>Category</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>PO Qty</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>In Hand</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>PI Pipeline</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>Shortfall Qty</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>Est. Value</TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>BOM Breakup</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {kpis.purchaseAuthority.items.map((row, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ fontWeight: 800, color: '#0F3B66' }}>
                        {row.itemCode}{row.subCode ? ` / ${row.subCode}` : ''}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{row.itemName}</TableCell>
                      <TableCell>
                        <Chip label={row.category} size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{row.poPendingQty.toLocaleString()} {row.unit}</TableCell>
                      <TableCell align="right" sx={{ color: '#16a34a', fontWeight: 600 }}>{row.stockInHand.toLocaleString()} {row.unit}</TableCell>
                      <TableCell align="right" sx={{ color: '#0284c7', fontWeight: 600 }}>{row.piPendingQty.toLocaleString()} {row.unit}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: '#dc2626', bgcolor: '#fee2e2' }}>
                        {row.shortfallQty.toLocaleString()} {row.unit}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#c2410c' }}>
                        ₹{row.missingValue.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View BOM child parts stock availability & shortfall">
                          <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            startIcon={<BOMIcon sx={{ fontSize: 14 }} />}
                            onClick={() => {
                              setSelectedBOMItem({
                                itemCode: row.itemCode,
                                subCode: row.subCode || '',
                                itemName: row.itemName,
                                shortfallQty: row.shortfallQty
                              });
                              setBomBreakupModalOpen(true);
                            }}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: '0.68rem',
                              py: 0.2,
                              px: 1,
                              height: 24,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            BOM Breakup
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: '#f8fafc', borderTop: '2px solid #0F3B66' }}>
                    <TableCell colSpan={3} sx={{ fontWeight: 800, textAlign: 'right', color: '#0F3B66' }}>Totals:</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: '#0F3B66' }}>{(kpis?.purchaseAuthority?.totalPOQty || 0).toLocaleString()}</TableCell>
                    <TableCell align="right">-</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: '#0284c7' }}>{(kpis?.purchaseAuthority?.pipelinePIQty || 0).toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, color: '#dc2626' }}>{(kpis?.purchaseAuthority?.totalShortfallQty || 0).toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, color: '#c2410c' }}>₹{Math.round(kpis?.purchaseAuthority?.totalMissingValue || 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell align="right">-</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
          <Button onClick={() => setPurchaseShortfallModalOpen(false)} color="inherit" sx={{ textTransform: 'none' }}>
            Close
          </Button>
          <Button 
            variant="contained" 
            endIcon={<LaunchIcon sx={{ fontSize: 16 }} />}
            onClick={() => {
              setPurchaseShortfallModalOpen(false);
              navigate('/dashboard/reports/pending-po?tab=fulfillment');
            }}
            sx={{ bgcolor: '#ea580c', '&:hover': { bgcolor: '#c2410c' }, textTransform: 'none', fontWeight: 700 }}
          >
            Open Shortfall & Create Proforma Invoice
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sales Authority: Pending Orders & Dispatch Status Drill-Down Dialog */}
      <Dialog 
        open={salesOrdersModalOpen} 
        onClose={() => setSalesOrdersModalOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0F3B66', borderBottom: '1px solid #e2e8f0', pb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalShipping sx={{ color: '#0F3B66' }} />
            <span>Sales Authority: Pending Orders & Dispatch Readiness ({kpis?.salesAuthority?.pendingOrderItemsCount || 0})</span>
          </Box>
          <Chip 
            label={`${kpis?.salesAuthority?.readinessPercentage || 0}% Ready to Ship`} 
            size="small" 
            sx={{ bgcolor: '#eff6ff', color: '#1e40af', fontWeight: 800 }} 
          />
        </DialogTitle>
        <DialogContent sx={{ mt: 1.5, p: { xs: 1.5, sm: 2.5 } }}>
          {(!kpis?.salesAuthority?.items || kpis.salesAuthority.items.length === 0) ? (
            <Alert severity="info" sx={{ my: 2 }}>
              No pending customer purchase orders. All orders have been completed and dispatched.
            </Alert>
          ) : (
            <TableContainer component={Paper} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, maxHeight: '60vh' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>Item Code</TableCell>
                    <TableCell sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>Item Name</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>Total Order Qty</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>Stock in Hand</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>Ready to Dispatch</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>Shortfall Qty</TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>Status</TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#0F3B66', color: '#fff', fontWeight: 700 }}>BOM Breakup</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {kpis.salesAuthority.items.map((row, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ fontWeight: 800, color: '#0F3B66' }}>
                        {row.itemCode}{row.subCode ? ` / ${row.subCode}` : ''}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{row.itemName}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                        {row.poPendingQty.toLocaleString()} {row.unit}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#475569' }}>
                        {row.stockInHand.toLocaleString()} {row.unit}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: '#16a34a', bgcolor: '#f0fdf4' }}>
                        {row.readyToDispatchQty.toLocaleString()} {row.unit}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: row.shortfallQty > 0 ? '#ea580c' : '#94a3b8' }}>
                        {row.shortfallQty > 0 ? `${row.shortfallQty.toLocaleString()} ${row.unit}` : '-'}
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={row.status} 
                          size="small" 
                          sx={{ 
                            height: 22, 
                            fontSize: '0.68rem', 
                            fontWeight: 700,
                            bgcolor: row.shortfallQty === 0 ? '#dcfce7' : row.readyToDispatchQty > 0 ? '#fff7ed' : '#fee2e2',
                            color: row.shortfallQty === 0 ? '#15803d' : row.readyToDispatchQty > 0 ? '#c2410c' : '#dc2626'
                          }} 
                        />
                      </TableCell>
                      <TableCell align="center">
                        {row.shortfallQty > 0 ? (
                          <Tooltip title="View BOM child parts shortfall to fulfill this order">
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              startIcon={<BOMIcon sx={{ fontSize: 14 }} />}
                              onClick={() => {
                                setSelectedBOMItem({
                                  itemCode: row.itemCode,
                                  subCode: row.subCode || '',
                                  itemName: row.itemName,
                                  shortfallQty: row.shortfallQty
                                });
                                setBomBreakupModalOpen(true);
                              }}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: '0.68rem',
                                py: 0.2,
                                px: 0.8,
                                height: 24,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              BOM Breakup
                            </Button>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 600 }}>Ready</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: '#f8fafc', borderTop: '2px solid #0F3B66' }}>
                    <TableCell colSpan={2} sx={{ fontWeight: 800, textAlign: 'right', color: '#0F3B66' }}>Totals:</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: '#0F3B66' }}>{(kpis?.salesAuthority?.totalOrderQty || 0).toLocaleString()}</TableCell>
                    <TableCell align="right">-</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, color: '#15803d' }}>{(kpis?.salesAuthority?.readyToDispatchQty || 0).toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, color: '#ea580c' }}>{(kpis?.salesAuthority?.shortfallQty || 0).toLocaleString()}</TableCell>
                    <TableCell align="center">
                      <Chip label={`${kpis?.salesAuthority?.readinessPercentage || 0}% Ready`} size="small" color="primary" sx={{ fontWeight: 700 }} />
                    </TableCell>
                    <TableCell align="right">-</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
          <Button onClick={() => setSalesOrdersModalOpen(false)} color="inherit" sx={{ textTransform: 'none' }}>
            Close
          </Button>
          <Button 
            variant="contained" 
            endIcon={<LaunchIcon sx={{ fontSize: 16 }} />}
            onClick={() => {
              setSalesOrdersModalOpen(false);
              navigate('/dashboard/outward');
            }}
            sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#F88A01' }, textTransform: 'none', fontWeight: 700 }}
          >
            Proceed to Sales Outward
          </Button>
        </DialogActions>
      </Dialog>

      {/* BOM Shortfall Breakup Detailed Dialog */}
      <BOMShortfallModal
        open={bomBreakupModalOpen}
        onClose={() => setBomBreakupModalOpen(false)}
        parentCode={selectedBOMItem?.itemCode}
        parentSubCode={selectedBOMItem?.subCode}
        parentName={selectedBOMItem?.itemName}
        shortfallQty={selectedBOMItem?.shortfallQty}
        onNavigateToPI={() => {
          setBomBreakupModalOpen(false);
          setPurchaseShortfallModalOpen(false);
          setSalesOrdersModalOpen(false);
          navigate('/dashboard/reports/pending-po?tab=fulfillment');
        }}
        onOpenBOMMaster={() => {
          setBomBreakupModalOpen(false);
          setPurchaseShortfallModalOpen(false);
          setSalesOrdersModalOpen(false);
          navigate('/dashboard/masters/bom');
        }}
      />
    </Box>
  );
};

export default DashboardHome;
