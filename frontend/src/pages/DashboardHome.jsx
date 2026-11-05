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
  IconButton
} from '@mui/material';
import {
  AccountBalanceWallet as ValueIcon,
  CallReceived as ReceivableIcon,
  CallMade as PayableIcon,
  Inventory as AssetIcon,
  Receipt as TransactionIcon,
  List as ListIcon,
  Build as AssemblyIcon,
  Assessment as ReportsIcon,
  Storefront as StockIcon,
  CalendarMonth as CalendarMonthIcon,
  Refresh as RefreshIcon,
  QrCode2 as QrCodeIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { hasMenuAccess } from '../utils/auth';

const DashboardHome = () => {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState([]);
  const [payables, setPayables] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  
  const [cashBankDialogOpen, setCashBankDialogOpen] = useState(false);
  const [cashBankLedgers, setCashBankLedgers] = useState([]);
  const [cashBankLoading, setCashBankLoading] = useState(false);

  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};

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

  const fetchDueReports = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      
      // Fetch Receivables
      const recRes = await fetch(`${baseUrl}/ledgers/invoice-wise-receivable`);
      if (recRes.ok) {
        const recData = await recRes.json();
        const sortedRec = recData
          .filter(inv => inv.outstandingAmount > 0)
          .sort((a, b) => a.dueDays - b.dueDays)
          .slice(0, 10);
        setReceivables(sortedRec);
      }

      // Fetch Payables
      const payRes = await fetch(`${baseUrl}/ledgers/invoice-wise-payable`);
      if (payRes.ok) {
        const payData = await payRes.json();
        const sortedPay = payData
          .filter(inv => inv.outstandingAmount > 0)
          .sort((a, b) => a.dueDays - b.dueDays)
          .slice(0, 10);
        setPayables(sortedPay);
      }
    } catch (error) {
      console.error('Error fetching due reports for dashboard:', error);
    } finally {
      setReportsLoading(false);
    }
  };

  const renderDueStatus = (dueDays) => {
    if (dueDays < 0) {
      return (
        <Chip 
          label={`Overdue by ${Math.abs(dueDays)} days`} 
          size="small" 
          sx={{ 
            bgcolor: '#fef2f2', 
            color: '#ef4444', 
            fontWeight: 700, 
            fontSize: '0.75rem',
            border: '1px solid #fee2e2'
          }} 
        />
      );
    } else if (dueDays === 0) {
      return (
        <Chip 
          label="Due Today" 
          size="small" 
          sx={{ 
            bgcolor: '#fff7ed', 
            color: '#ea580c', 
            fontWeight: 700, 
            fontSize: '0.75rem',
            border: '1px solid #ffedd5'
          }} 
        />
      );
    } else {
      return (
        <Chip 
          label={`${dueDays} days left`} 
          size="small" 
          sx={{ 
            bgcolor: '#eff6ff', 
            color: '#3b82f6', 
            fontWeight: 700, 
            fontSize: '0.75rem',
            border: '1px solid #dbeafe'
          }} 
        />
      );
    }
  };

  useEffect(() => {
    fetchKPIs();
    fetchDueReports();
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(value || 0));
  };

  const kpiCards = [
    {
      title: 'Total Stock Valuation',
      subtitle: 'Closing Stock * Costing',
      value: formatCurrency(kpis?.totalValue || 0),
      icon: <StockIcon sx={{ fontSize: 40 }} />,
      color: '#10b981', // Emerald
      bgColor: '#d1fae5',
      link: '/dashboard/reports/stock'
    },
    {
      title: 'Total Turnover',
      subtitle: 'Total Outward Value',
      value: formatCurrency(kpis?.totalTurnover || 0),
      icon: <ValueIcon sx={{ fontSize: 40 }} />,
      color: '#f59e0b', // Amber
      bgColor: '#fef3c7',
      link: '/dashboard/reports/outward'
    },
    {
      title: 'Total Receivable',
      subtitle: 'Combined Net',
      value: formatCurrency(kpis?.totalReceivable || 0),
      breakdown: {
        withBill: kpis?.totalReceivableWithBill || 0,
        withoutBill: kpis?.totalReceivableWithoutBill || 0
      },
      icon: <ReceivableIcon sx={{ fontSize: 40 }} />,
      color: '#3b82f6', // Blue
      bgColor: '#eff6ff',
      link: '/dashboard/reports/receivable'
    },
    {
      title: 'Total Payable',
      subtitle: 'Combined Net',
      value: formatCurrency(kpis?.totalPayable || 0),
      breakdown: {
        withBill: kpis?.totalPayableWithBill || 0,
        withoutBill: kpis?.totalPayableWithoutBill || 0
      },
      icon: <PayableIcon sx={{ fontSize: 40 }} />,
      color: '#ef4444', // Red
      bgColor: '#fef2f2',
      link: '/dashboard/reports/payable'
    },
    {
      title: 'Cash & Bank',
      subtitle: (kpis?.cashBankBalance || 0) < 0 ? 'Overdrawn / Negative' : 'Liquid Assets',
      value: formatCurrency(kpis?.cashBankBalance || 0),
      valueColor: (kpis?.cashBankBalance || 0) < 0 ? '#dc2626' : '#1e293b',
      icon: <ValueIcon sx={{ fontSize: 40 }} />,
      color: (kpis?.cashBankBalance || 0) < 0 ? '#ef4444' : '#8b5cf6',
      bgColor: (kpis?.cashBankBalance || 0) < 0 ? '#fef2f2' : '#f3e8ff',
      onClick: fetchCashBankLedgers
    },
    {
      title: 'Total Asset Value',
      subtitle: 'Sum of Total Value of Assets',
      value: formatCurrency(kpis?.totalAssetValue || 0),
      icon: <AssetIcon sx={{ fontSize: 40 }} />,
      color: '#0d9488', // Teal
      bgColor: '#ccfbf1',
      link: '/dashboard/assets'
    }
  ];

  const monthlyData = kpis?.monthlyOutward || [];
  const maxMonthlyAmount = monthlyData.length > 0 ? Math.max(...monthlyData.map(d => d.totalAmount)) : 1;
  const topParties = kpis?.topParties || [];

  return (
    <Box>
      {/* Sleek Operations Header Bar */}
      <Box sx={{ mb: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F3B66', letterSpacing: -0.5 }}>
            Operations Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
            Real-time overview of manufacturing workflows, stock valuation, and finances.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
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
          <Tooltip title="Refresh Dashboard Data">
            <IconButton 
              onClick={() => { setLoading(true); fetchKPIs(); fetchDueReports(); }}
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
          <Button
            variant="outlined"
            startIcon={<QrCodeIcon />}
            onClick={() => navigate('/dashboard/payment-qr')}
            sx={{
              color: '#0F3B66',
              borderColor: '#cbd5e1',
              bgcolor: '#ffffff',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              px: 2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              '&:hover': { borderColor: '#F88A01', color: '#F88A01', bgcolor: 'rgba(248, 138, 1, 0.05)' }
            }}
          >
            Payment QRs
          </Button>
        </Box>
      </Box>

      {/* Quick Action Navigation Buttons */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3.5, overflowX: 'auto', pb: 0.5 }}>
        {[
          { label: 'New Inward', path: '/dashboard/inwards', icon: <TransactionIcon fontSize="small" /> },
          { label: 'New Outward', path: '/dashboard/outwards', icon: <TransactionIcon fontSize="small" /> },
          { label: 'Job Work In', path: '/dashboard/jobwork-ins', icon: <ListIcon fontSize="small" /> },
          { label: 'Job Work Out', path: '/dashboard/jobwork-outs', icon: <ListIcon fontSize="small" /> },
          { label: 'Assembly', path: '/dashboard/assembly', icon: <AssemblyIcon fontSize="small" /> },
          { label: 'Stock Journal', path: '/dashboard/stock-journal', icon: <ReportsIcon fontSize="small" /> }
        ].filter(action => hasMenuAccess(action.path))
        .map((action, index) => (
          <Button
            key={index}
            variant="contained"
            startIcon={action.icon}
            onClick={() => navigate(action.path)}
            sx={{
              bgcolor: '#ffffff',
              color: '#0F3B66',
              border: '1px solid #e2e8f0',
              fontWeight: 600,
              fontSize: '0.84rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              borderRadius: 2,
              px: 2.2,
              py: 0.85,
              whiteSpace: 'nowrap',
              textTransform: 'none',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: '#0F3B66',
                color: '#ffffff',
                borderColor: '#0F3B66',
                boxShadow: '0 4px 12px rgba(15, 59, 102, 0.2)'
              }
            }}
          >
            {action.label}
          </Button>
        ))}
      </Box>

      {/* KPI Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {kpiCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card sx={{ 
              borderRadius: 3, 
              boxShadow: '0 2px 10px rgba(15, 59, 102, 0.06)',
              border: '1px solid #e2e8f0',
              borderTop: `4px solid ${card.color}`,
              height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { 
                transform: 'translateY(-3px)',
                boxShadow: '0 8px 24px rgba(15, 59, 102, 0.12)' 
              }
            }}>
              <CardActionArea onClick={() => card.onClick ? card.onClick() : navigate(card.link)} sx={{ height: '100%', p: 0 }}>
                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 }, height: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 600, mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {card.title}
                      </Typography>
                      {loading ? (
                        <Skeleton variant="text" width={120} height={50} />
                      ) : (
                        <>
                          <Typography variant="h4" sx={{ fontWeight: 700, color: card.valueColor || '#1e293b' }}>
                            {card.value}
                          </Typography>
                          {card.subtitle && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, fontStyle: 'italic', textTransform: 'none' }}>
                              {card.subtitle}
                            </Typography>
                          )}
                          {card.breakdown && (
                            <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                                  🧾 With Bill:
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#0F3B66', fontSize: '0.85rem' }}>
                                  {formatCurrency(card.breakdown.withBill || 0)}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                                  📋 Without Bill:
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#d97706', fontSize: '0.85rem' }}>
                                  {formatCurrency(card.breakdown.withoutBill || 0)}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                        </>
                      )}
                    </Box>
                    <Avatar sx={{ 
                      bgcolor: card.bgColor, 
                      color: card.color, 
                      width: 56, 
                      height: 56, 
                      borderRadius: 2,
                      ml: 1.5,
                      flexShrink: 0
                    }}>
                      {card.icon}
                    </Avatar>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Analytics Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Monthly Outward Chart Area */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66', mb: 3 }}>
              Monthly Outward Trends (Last 6 Months)
            </Typography>
            
            {loading ? (
              <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 2 }} />
            ) : monthlyData.length > 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 250, pt: 2, pb: 1, borderBottom: '1px solid #e2e8f0' }}>
                {monthlyData.map((data, idx) => {
                  const heightPercent = Math.max((data.totalAmount / maxMonthlyAmount) * 100, 2); // min 2% height for visibility
                  return (
                    <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12%', height: '100%', justifyContent: 'flex-end' }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: '#3b82f6', mb: 1 }}>
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
                      <Typography variant="caption" sx={{ mt: 1, fontWeight: 600, color: 'text.secondary' }}>
                        {data.monthLabel}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 8 }}>
                No recent outward data available.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Top 5 Party Area */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', height: '100%' }}>
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        {idx + 1}
                      </Avatar>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                        {party.partyName}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#10b981' }}>
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

      {/* Overdue / Due Reports */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Receivables */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66', mb: 3 }}>
              Outward Receivables (Top 10 Overdue / Due Soonest)
            </Typography>
            <TableContainer sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#0f3b66', color: '#fff', fontSize: '0.8rem', py: 1 }}>Party</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#0f3b66', color: '#fff', fontSize: '0.8rem', py: 1 }}>Invoice Details</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#0f3b66', color: '#fff', fontSize: '0.8rem', py: 1, textAlign: 'right' }}>Amount</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#0f3b66', color: '#fff', fontSize: '0.8rem', py: 1, textAlign: 'center' }}>Due Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportsLoading ? (
                    [1, 2, 3].map((n) => (
                      <TableRow key={n}>
                        <TableCell><Skeleton variant="text" /></TableCell>
                        <TableCell><Skeleton variant="text" /></TableCell>
                        <TableCell><Skeleton variant="text" /></TableCell>
                        <TableCell><Skeleton variant="text" /></TableCell>
                      </TableRow>
                    ))
                  ) : receivables.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No outstanding receivables found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    receivables.map((row) => (
                      <TableRow key={row.RowId} hover>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.825rem' }}>{row.partyName}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                          <div style={{ fontWeight: 500 }}>No: {row.outwardNo}</div>
                          <div>Date: {row.outwardDate ? new Date(row.outwardDate).toLocaleDateString() : ''}</div>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.825rem', textAlign: 'right', color: '#10b981' }}>
                          {formatCurrency(row.outstandingAmount).split('.')[0]}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          {renderDueStatus(row.dueDays)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Payables */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66', mb: 3 }}>
              Inward Payables (Top 10 Overdue / Due Soonest)
            </Typography>
            <TableContainer sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#0f3b66', color: '#fff', fontSize: '0.8rem', py: 1 }}>Vendor</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#0f3b66', color: '#fff', fontSize: '0.8rem', py: 1 }}>Invoice Details</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#0f3b66', color: '#fff', fontSize: '0.8rem', py: 1, textAlign: 'right' }}>Amount</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#0f3b66', color: '#fff', fontSize: '0.8rem', py: 1, textAlign: 'center' }}>Due Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportsLoading ? (
                    [1, 2, 3].map((n) => (
                      <TableRow key={n}>
                        <TableCell><Skeleton variant="text" /></TableCell>
                        <TableCell><Skeleton variant="text" /></TableCell>
                        <TableCell><Skeleton variant="text" /></TableCell>
                        <TableCell><Skeleton variant="text" /></TableCell>
                      </TableRow>
                    ))
                  ) : payables.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No outstanding payables found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payables.map((row) => (
                      <TableRow key={row.RowId} hover>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.825rem' }}>{row.vendorName}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                          <div style={{ fontWeight: 500 }}>No: {row.inwardNo}</div>
                          <div>Date: {row.inwardDate ? new Date(row.inwardDate).toLocaleDateString() : ''}</div>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.825rem', textAlign: 'right', color: '#ef4444' }}>
                          {formatCurrency(row.outstandingAmount).split('.')[0]}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          {renderDueStatus(row.dueDays)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Department-wise Stock */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
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
