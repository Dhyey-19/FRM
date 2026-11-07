import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  Chip, 
  IconButton, 
  Button, 
  TextField, 
  InputAdornment, 
  Tabs, 
  Tab, 
  Avatar, 
  CircularProgress,
  Tooltip,
  Divider,
  Alert
} from '@mui/material';
import { 
  Notifications as NotificationsIcon,
  WarningAmber as WarningIcon,
  Error as CriticalIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Inventory as InventoryIcon,
  CallReceived as ReceivableIcon,
  CallMade as PayableIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as HealthyIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const NotificationLogs = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    reorder: 0,
    receivables: 0,
    payables: 0,
    critical: 0,
    warning: 0
  });
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/dashboard/notifications`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('Error fetching notification logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredNotifications = notifications.filter(item => {
    // Tab filter
    if (currentTab === 'reorder' && item.type !== 'reorder') return false;
    if (currentTab === 'shortfall' && item.type !== 'shortfall') return false;
    if (currentTab === 'dispatch_ready' && item.type !== 'dispatch_ready') return false;
    if (currentTab === 'receivables' && item.type !== 'receivable_overdue') return false;
    if (currentTab === 'payables' && item.type !== 'payable_overdue') return false;

    // Severity filter
    if (severityFilter !== 'all' && item.severity !== severityFilter) return false;

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchTitle = (item.title || '').toLowerCase().includes(term);
      const matchMsg = (item.message || '').toLowerCase().includes(term);
      const matchItem = (item.itemName || '').toLowerCase().includes(term) || (item.itemCode || '').toLowerCase().includes(term);
      const matchParty = (item.partyName || item.vendorName || '').toLowerCase().includes(term);
      return matchTitle || matchMsg || matchItem || matchParty;
    }

    return true;
  });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F3B66', letterSpacing: -0.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <NotificationsIcon sx={{ fontSize: 36, color: '#0F3B66' }} /> Notification & Alert Logs
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.4 }}>
            Real-time activity log tracking low stock reorder thresholds, overdue receivables, and payment obligations.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/dashboard')}
            sx={{
              color: '#0F3B66',
              borderColor: '#cbd5e1',
              bgcolor: '#ffffff',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2
            }}
          >
            Back to Dashboard
          </Button>
          <Tooltip title="Refresh Notification Logs">
            <IconButton 
              onClick={fetchLogs}
              sx={{ 
                bgcolor: '#ffffff', 
                color: '#0F3B66', 
                border: '1px solid #cbd5e1', 
                '&:hover': { bgcolor: '#f1f5f9', color: '#F88A01' } 
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary KPI Badges */}
      <Grid container spacing={{ xs: 2, sm: 2.5 }} sx={{ mb: 3.5 }}>
        <Grid item xs={12} sm={6} md={6} lg={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(15, 59, 102, 0.04)' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                    Total Active Alerts
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: summary.total > 0 ? '#0F3B66' : '#10b981', mt: 0.5 }}>
                    {summary.total}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: summary.total > 0 ? '#fff7ed' : '#d1fae5', color: summary.total > 0 ? '#ea580c' : '#10b981', width: 44, height: 44, borderRadius: 2 }}>
                  {summary.total > 0 ? <WarningIcon /> : <HealthyIcon />}
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={6} lg={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(15, 59, 102, 0.04)' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                    Low Stock (Reorder)
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: summary.reorder > 0 ? '#ef4444' : '#1e293b', mt: 0.5 }}>
                    {summary.reorder}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: summary.reorder > 0 ? '#fee2e2' : '#f1f5f9', color: summary.reorder > 0 ? '#ef4444' : '#64748b', width: 44, height: 44, borderRadius: 2 }}>
                  <InventoryIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={6} lg={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(15, 59, 102, 0.04)' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                    Overdue Receivables
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: summary.receivables > 0 ? '#2563eb' : '#1e293b', mt: 0.5 }}>
                    {summary.receivables}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: summary.receivables > 0 ? '#eff6ff' : '#f1f5f9', color: summary.receivables > 0 ? '#2563eb' : '#64748b', width: 44, height: 44, borderRadius: 2 }}>
                  <ReceivableIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={6} lg={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(15, 59, 102, 0.04)' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                    Overdue Payables
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: summary.payables > 0 ? '#dc2626' : '#1e293b', mt: 0.5 }}>
                    {summary.payables}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: summary.payables > 0 ? '#fef2f2' : '#f1f5f9', color: summary.payables > 0 ? '#dc2626' : '#64748b', width: 44, height: 44, borderRadius: 2 }}>
                  <PayableIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Container */}
      <Paper sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(15, 59, 102, 0.04)', overflow: 'hidden' }}>
        {/* Tabs & Search Filter Bar */}
        <Box sx={{ px: { xs: 1.5, sm: 3 }, pt: 2, pb: 1, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Tabs 
            value={currentTab} 
            onChange={(e, val) => setCurrentTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              maxWidth: { xs: '100%', md: 'calc(100% - 240px)' },
              '& .MuiTabs-indicator': { backgroundColor: '#F88A01', height: 3 },
              '& .MuiTab-root': {
                fontWeight: 700,
                fontSize: { xs: '0.82rem', sm: '0.9rem' },
                textTransform: 'none',
                minHeight: 46,
                color: '#64748b',
                whiteSpace: 'nowrap',
                '&.Mui-selected': { color: '#0F3B66' }
              }
            }}
          >
            <Tab label={`All (${summary.total})`} value="all" />
            <Tab label={`Low Stock (${summary.reorder || 0})`} value="reorder" />
            <Tab label={`PO Shortfall (${summary.shortfall || 0})`} value="shortfall" />
            <Tab label={`Ready to Dispatch (${summary.dispatchReady || 0})`} value="dispatch_ready" />
            <Tab label={`Overdue Receivables (${summary.receivables || 0})`} value="receivables" />
            <Tab label={`Overdue Payables (${summary.payables || 0})`} value="payables" />
          </Tabs>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
            <TextField
              size="small"
              placeholder="Search in logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" fontSize="small" /></InputAdornment> }}
              sx={{ width: { xs: '100%', sm: 220 } }}
            />
          </Box>
        </Box>

        {/* Notifications List */}
        <Box sx={{ p: 3 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : filteredNotifications.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <HealthyIcon sx={{ fontSize: 56, color: '#10b981', mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                All Systems Operational
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {searchTerm ? 'No notifications match your search query.' : 'There are no active alerts, low stock warnings, or overdue payments.'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredNotifications.map((item) => {
                const isCritical = item.severity === 'critical';
                const isReorder = item.type === 'reorder';
                
                return (
                  <Paper 
                    key={item.id}
                    onClick={() => item.actionLink && navigate(item.actionLink)}
                    sx={{ 
                      p: 2.5, 
                      borderRadius: 2.5, 
                      border: '1px solid',
                      borderColor: isCritical ? '#fecaca' : (isReorder ? '#fed7aa' : '#e2e8f0'),
                      bgcolor: isCritical ? '#fffbfa' : (isReorder ? '#fffdfa' : '#ffffff'),
                      cursor: item.actionLink ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        boxShadow: '0 4px 16px rgba(15, 59, 102, 0.08)',
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                        <Avatar 
                          sx={{ 
                            bgcolor: isCritical ? '#fee2e2' : (isReorder ? '#ffedd5' : '#eff6ff'), 
                            color: isCritical ? '#ef4444' : (isReorder ? '#ea580c' : '#2563eb'), 
                            width: 44, 
                            height: 44, 
                            borderRadius: 2,
                            flexShrink: 0
                          }}
                        >
                          {isReorder ? <InventoryIcon /> : (item.type === 'receivable_overdue' ? <ReceivableIcon /> : <PayableIcon />)}
                        </Avatar>

                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                            <Chip 
                              label={item.category} 
                              size="small" 
                              sx={{ 
                                height: 22, 
                                fontSize: '0.72rem', 
                                fontWeight: 700,
                                bgcolor: isCritical ? '#fee2e2' : (isReorder ? '#ffedd5' : '#eff6ff'),
                                color: isCritical ? '#dc2626' : (isReorder ? '#c2410c' : '#1d4ed8')
                              }} 
                            />
                            <Chip 
                              label={isCritical ? 'CRITICAL' : 'WARNING'} 
                              size="small" 
                              sx={{ 
                                height: 20, 
                                fontSize: '0.65rem', 
                                fontWeight: 800,
                                bgcolor: isCritical ? '#dc2626' : '#f59e0b',
                                color: '#ffffff'
                              }} 
                            />
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                              {new Date(item.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Box>

                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                            {item.title}
                          </Typography>

                          <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.5 }}>
                            {item.message}
                          </Typography>

                          {isReorder && (
                            <Box sx={{ display: 'flex', gap: 2, mt: 1.5, pt: 1, borderTop: '1px dashed #e2e8f0', flexWrap: 'wrap' }}>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                Current Stock: <strong style={{ color: item.currentStock <= 0 ? '#dc2626' : '#ea580c' }}>{item.currentStock} {item.unit}</strong>
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                Reorder Level: <strong>{item.reorderLevel} {item.unit}</strong>
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                Shortfall: <strong style={{ color: '#dc2626' }}>{item.deficit} {item.unit}</strong>
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>

                      {item.actionLink && (
                        <Button 
                          variant="contained" 
                          size="small"
                          endIcon={<ArrowForwardIcon fontSize="small" />}
                          onClick={() => navigate(item.actionLink)}
                          sx={{ 
                            bgcolor: '#0F3B66', 
                            color: '#ffffff', 
                            textTransform: 'none', 
                            fontWeight: 600,
                            borderRadius: 2,
                            px: 2,
                            width: { xs: '100%', sm: 'auto' },
                            '&:hover': { bgcolor: '#F88A01' }
                          }}
                        >
                          {isReorder ? 'Manage Item' : 'View Invoices'}
                        </Button>
                      )}
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default NotificationLogs;
