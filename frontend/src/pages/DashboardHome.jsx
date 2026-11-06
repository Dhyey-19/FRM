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
  Alert
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
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const DashboardHome = () => {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [cashBankDialogOpen, setCashBankDialogOpen] = useState(false);
  const [cashBankLedgers, setCashBankLedgers] = useState([]);
  const [cashBankLoading, setCashBankLoading] = useState(false);

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

      {/* Row 2: Financial Analysis - Receivables & Payables with Bill / Without Bill & Overdue */}
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
    </Box>
  );
};

export default DashboardHome;
