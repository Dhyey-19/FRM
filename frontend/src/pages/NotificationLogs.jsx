import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { 
  Notifications as NotificationsIcon,
  WarningAmber as WarningIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Inventory as InventoryIcon,
  CallReceived as ReceivableIcon,
  CallMade as PayableIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as HealthyIcon,
  LocalShipping as ShippingIcon,
  Close as CloseIcon,
  TaskAlt as ClosedIcon,
  Assignment as TaskIcon,
  AccessTime as AccessTimeIcon,
  TrendingUp as TrendingUpIcon,
  Delete as DeleteIcon,
  DeleteSweep as DeleteSweepIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const NotificationLogs = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    closed: 0,
    reorder: 0,
    receivables: 0,
    payables: 0,
    overduePod: 0,
    shortfall: 0,
    dispatchReady: 0,
    tasks: 0,
    crm: 0,
    critical: 0,
    warning: 0
  });
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open'); // 'open' | 'closed' | 'all'
  const [searchTerm, setSearchTerm] = useState('');

  // Close Confirmation Dialog state
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [closingInProgress, setClosingInProgress] = useState(false);

  // Delete Single Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDeleteNotif, setSelectedDeleteNotif] = useState(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  // Delete All Dialog state
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deleteAllScopeAll, setDeleteAllScopeAll] = useState(false);
  const [deletingAllInProgress, setDeletingAllInProgress] = useState(false);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

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

  const handleOpenCloseDialog = (item, e) => {
    if (e) e.stopPropagation();
    setSelectedNotif(item);
    setConfirmInput('');
    setCloseDialogOpen(true);
  };

  const handleConfirmClose = async () => {
    if (!selectedNotif) return;
    if (confirmInput.trim().toLowerCase() !== 'close') return;

    setClosingInProgress(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/dashboard/notifications/${encodeURIComponent(selectedNotif.id)}/close`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: selectedNotif.type,
            title: selectedNotif.title,
            message: selectedNotif.message
          })
        }
      );

      if (response.ok) {
        setSnackbar({ open: true, message: `Notification "${selectedNotif.title}" closed successfully.`, severity: 'success' });
        setCloseDialogOpen(false);
        setSelectedNotif(null);
        setConfirmInput('');
        await fetchLogs();
      } else {
        const errData = await response.json().catch(() => ({}));
        setSnackbar({ open: true, message: errData.message || 'Failed to close notification.', severity: 'error' });
      }
    } catch (err) {
      console.error('Error closing notification:', err);
      setSnackbar({ open: true, message: 'Server connection error.', severity: 'error' });
    } finally {
      setClosingInProgress(false);
    }
  };

  // Open Delete Single dialog
  const handleOpenDeleteDialog = (item, e) => {
    if (e) e.stopPropagation();
    setSelectedDeleteNotif(item);
    setDeleteDialogOpen(true);
  };

  // Confirm Delete Single notification
  const handleConfirmDeleteSingle = async () => {
    if (!selectedDeleteNotif) return;
    setDeletingInProgress(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/dashboard/notifications/${encodeURIComponent(selectedDeleteNotif.id)}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: selectedDeleteNotif.type,
            title: selectedDeleteNotif.title,
            message: selectedDeleteNotif.message
          })
        }
      );

      if (response.ok) {
        setSnackbar({ open: true, message: `Notification "${selectedDeleteNotif.title}" deleted.`, severity: 'success' });
        setDeleteDialogOpen(false);
        setSelectedDeleteNotif(null);
        await fetchLogs();
      } else {
        const errData = await response.json().catch(() => ({}));
        setSnackbar({ open: true, message: errData.message || 'Failed to delete notification.', severity: 'error' });
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      setSnackbar({ open: true, message: 'Server connection error.', severity: 'error' });
    } finally {
      setDeletingInProgress(false);
    }
  };

  // Open Delete All dialog
  const handleOpenDeleteAllDialog = () => {
    setDeleteAllScopeAll(false);
    setDeleteAllDialogOpen(true);
  };

  // Confirm Delete All notifications
  const handleConfirmDeleteAll = async () => {
    setDeletingAllInProgress(true);
    try {
      const payload = deleteAllScopeAll
        ? { scope: 'all' }
        : { ids: filteredNotifications.map(n => n.id) };

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/dashboard/notifications/delete-all`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (response.ok) {
        const result = await response.json();
        setSnackbar({ open: true, message: result.message || 'Notifications deleted successfully.', severity: 'success' });
        setDeleteAllDialogOpen(false);
        await fetchLogs();
      } else {
        const errData = await response.json().catch(() => ({}));
        setSnackbar({ open: true, message: errData.message || 'Failed to delete notifications.', severity: 'error' });
      }
    } catch (err) {
      console.error('Error deleting notifications:', err);
      setSnackbar({ open: true, message: 'Server error.', severity: 'error' });
    } finally {
      setDeletingAllInProgress(false);
    }
  };

  // Filter by status first to compute category counts for visible tabs
  const statusFilteredList = notifications.filter(item => {
    const itemStatus = (item.status || 'Open').toLowerCase();
    if (statusFilter === 'open' && itemStatus === 'closed') return false;
    if (statusFilter === 'closed' && itemStatus !== 'closed') return false;
    return true;
  });

  const categoryCounts = {
    all: statusFilteredList.length,
    crm: statusFilteredList.filter(n => (n.type || '').startsWith('crm_')).length,
    tasks: statusFilteredList.filter(n => n.type === 'task_notification').length,
    reorder: statusFilteredList.filter(n => n.type === 'reorder').length,
    overdue_pod: statusFilteredList.filter(n => n.type === 'overdue_pod').length,
    shortfall: statusFilteredList.filter(n => n.type === 'shortfall').length,
    dispatch_ready: statusFilteredList.filter(n => n.type === 'dispatch_ready').length,
    receivables: statusFilteredList.filter(n => n.type === 'receivable_overdue').length,
    payables: statusFilteredList.filter(n => n.type === 'payable_overdue').length,
  };

  // If currently selected tab no longer has any alerts (> 0), auto switch back to 'all'
  useEffect(() => {
    if (currentTab !== 'all' && (!categoryCounts[currentTab] || categoryCounts[currentTab] === 0)) {
      setCurrentTab('all');
    }
  }, [categoryCounts, currentTab]);

  const filteredNotifications = statusFilteredList.filter(item => {
    // Type tab filter
    if (currentTab === 'crm' && !(item.type || '').startsWith('crm_')) return false;
    if (currentTab === 'task_notification' && item.type !== 'task_notification') return false;
    if (currentTab === 'reorder' && item.type !== 'reorder') return false;
    if (currentTab === 'overdue_pod' && item.type !== 'overdue_pod') return false;
    if (currentTab === 'shortfall' && item.type !== 'shortfall') return false;
    if (currentTab === 'dispatch_ready' && item.type !== 'dispatch_ready') return false;
    if (currentTab === 'receivables' && item.type !== 'receivable_overdue') return false;
    if (currentTab === 'payables' && item.type !== 'payable_overdue') return false;

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchTitle = (item.title || '').toLowerCase().includes(term);
      const matchMsg = (item.message || '').toLowerCase().includes(term);
      const matchItem = (item.itemName || '').toLowerCase().includes(term) || (item.itemCode || '').toLowerCase().includes(term);
      const matchParty = (item.partyName || item.vendorName || item.customer || '').toLowerCase().includes(term);
      const matchOutward = (item.outwardNo || '').toLowerCase().includes(term);
      return matchTitle || matchMsg || matchItem || matchParty || matchOutward;
    }

    return true;
  });

  const formatDateTime = (dateVal) => {
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return String(dateVal);
    }
  };

  const getTabLabelName = () => {
    switch (currentTab) {
      case 'crm': return 'CRM Alerts';
      case 'task_notification': return 'Task Alerts';
      case 'reorder': return 'Low Stock Alerts';
      case 'overdue_pod': return 'Overdue POD Alerts';
      case 'shortfall': return 'PO Shortfall Alerts';
      case 'dispatch_ready': return 'Ready to Dispatch Alerts';
      case 'receivables': return 'Overdue Receivables';
      case 'payables': return 'Overdue Payables';
      default: return 'All Alerts';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F3B66', letterSpacing: -0.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <NotificationsIcon sx={{ fontSize: 36, color: '#0F3B66' }} /> Notification & Alert Logs
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.4 }}>
            Real-time activity log tracking CRM leads & follow-ups, low stock reorders, overdue receivables, and payment obligations.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
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

      {/* Main Container */}
      <Paper sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(15, 59, 102, 0.04)', overflow: 'hidden' }}>
        {/* Type Tabs */}
        <Box sx={{ px: { xs: 1.5, sm: 3 }, pt: 1.5, borderBottom: '1px solid #e2e8f0' }}>
          <Tabs 
            value={currentTab} 
            onChange={(e, val) => setCurrentTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              '& .MuiTabs-indicator': { backgroundColor: '#F88A01', height: 3 },
              '& .MuiTab-root': {
                fontWeight: 700,
                fontSize: { xs: '0.82rem', sm: '0.88rem' },
                textTransform: 'none',
                minHeight: 46,
                color: '#64748b',
                whiteSpace: 'nowrap',
                '&.Mui-selected': { color: '#0F3B66' }
              }
            }}
          >
            <Tab label={`All (${categoryCounts.all || 0})`} value="all" />
            {categoryCounts.crm > 0 && (
              <Tab 
                label={`CRM Alerts (${categoryCounts.crm})`} 
                value="crm"
                icon={<TrendingUpIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
              />
            )}
            {categoryCounts.tasks > 0 && (
              <Tab label={`Task Alerts (${categoryCounts.tasks})`} value="task_notification" />
            )}
            {categoryCounts.reorder > 0 && (
              <Tab label={`Low Stock (${categoryCounts.reorder})`} value="reorder" />
            )}
            {categoryCounts.overdue_pod > 0 && (
              <Tab label={`Overdue POD (${categoryCounts.overdue_pod})`} value="overdue_pod" />
            )}
            {categoryCounts.shortfall > 0 && (
              <Tab label={`PO Shortfall (${categoryCounts.shortfall})`} value="shortfall" />
            )}
            {categoryCounts.dispatch_ready > 0 && (
              <Tab label={`Ready to Dispatch (${categoryCounts.dispatch_ready})`} value="dispatch_ready" />
            )}
            {categoryCounts.receivables > 0 && (
              <Tab label={`Overdue Receivables (${categoryCounts.receivables})`} value="receivables" />
            )}
            {categoryCounts.payables > 0 && (
              <Tab label={`Overdue Payables (${categoryCounts.payables})`} value="payables" />
            )}
          </Tabs>
        </Box>

        {/* Status Filter & Search & Delete All Toolbar */}
        <Box sx={{ px: { xs: 1.5, sm: 3 }, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          {/* Status Toggle Buttons (Open / Closed / All) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Status Filter:
            </Typography>
            <ToggleButtonGroup
              size="small"
              value={statusFilter}
              exclusive
              onChange={(e, newStatus) => {
                if (newStatus !== null) setStatusFilter(newStatus);
              }}
              sx={{
                bgcolor: '#ffffff',
                '& .MuiToggleButton-root': {
                  px: 1.8,
                  py: 0.5,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  color: '#64748b',
                  borderColor: '#cbd5e1',
                  '&.Mui-selected': {
                    bgcolor: '#0F3B66',
                    color: '#ffffff',
                    '&:hover': { bgcolor: '#0d3257' }
                  }
                }
              }}
            >
              <ToggleButton value="open">
                Open ({summary.open || 0})
              </ToggleButton>
              <ToggleButton value="closed">
                Closed ({summary.closed || 0})
              </ToggleButton>
              <ToggleButton value="all">
                All ({summary.total || 0})
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Right Toolbar: Delete All Button & Search Box */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: { xs: '100%', md: 'auto' }, flexWrap: 'wrap' }}>
            {/* Delete All Option */}
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteSweepIcon />}
              onClick={handleOpenDeleteAllDialog}
              disabled={filteredNotifications.length === 0}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 1.5,
                px: 1.5,
                borderColor: '#fca5a5',
                bgcolor: '#ffffff',
                '&:hover': { bgcolor: '#fef2f2', borderColor: '#ef4444' }
              }}
            >
              Delete All ({filteredNotifications.length})
            </Button>

            {/* Search Box */}
            <Box sx={{ width: { xs: '100%', sm: 240 } }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{ 
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ) 
                }}
                sx={{ bgcolor: '#ffffff', borderRadius: 1.5 }}
              />
            </Box>
          </Box>
        </Box>

        {/* Notifications List */}
        <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : filteredNotifications.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <HealthyIcon sx={{ fontSize: 56, color: '#10b981', mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                {statusFilter === 'closed' ? 'No Closed Notifications' : 'All Clear / No Active Alerts'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {searchTerm 
                  ? 'No notifications match your search query.' 
                  : (statusFilter === 'open' 
                      ? 'There are currently no open notifications. All items, CRM inquiries, PODs, and payments are up to date!' 
                      : 'No notifications in this view.')}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredNotifications.map((item) => {
                const isCritical = item.severity === 'critical';
                const isReorder = item.type === 'reorder';
                const isCrm = (item.type || '').startsWith('crm_');
                const isClosed = (item.status || '').toLowerCase() === 'closed';
                
                return (
                  <Paper 
                    key={item.id}
                    sx={{ 
                      p: 2.5, 
                      borderRadius: 2.5, 
                      border: '1px solid',
                      borderColor: isClosed ? '#cbd5e1' : (isCritical ? '#fecaca' : (isCrm ? '#bfdbfe' : (isReorder ? '#fed7aa' : '#e2e8f0'))),
                      bgcolor: isClosed ? '#f8fafc' : (isCritical ? '#fffbfa' : (isCrm ? '#f8fafc' : (isReorder ? '#fffdfa' : '#ffffff'))),
                      transition: 'all 0.2s ease',
                      opacity: isClosed ? 0.85 : 1,
                      '&:hover': {
                        boxShadow: '0 4px 16px rgba(15, 59, 102, 0.08)',
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flex: 1, minWidth: 280 }}>
                        <Avatar 
                          sx={{ 
                            bgcolor: isClosed 
                              ? '#e2e8f0' 
                              : (isCritical 
                                ? '#fee2e2' 
                                : (isCrm 
                                  ? (item.type === 'crm_today' ? '#ffedd5' : '#eff6ff') 
                                  : (isReorder ? '#ffedd5' : '#eff6ff'))), 
                            color: isClosed 
                              ? '#64748b' 
                              : (isCritical 
                                ? '#ef4444' 
                                : (isCrm 
                                  ? (item.type === 'crm_today' ? '#ea580c' : '#2563eb') 
                                  : (isReorder ? '#ea580c' : '#2563eb'))), 
                            width: 44, 
                            height: 44, 
                            borderRadius: 2,
                            flexShrink: 0
                          }}
                        >
                          {isClosed ? (
                            <ClosedIcon />
                          ) : isCrm ? (
                            <TrendingUpIcon />
                          ) : item.type === 'task_notification' ? (
                            <TaskIcon />
                          ) : isReorder ? (
                            <InventoryIcon />
                          ) : item.type === 'overdue_pod' ? (
                            <ShippingIcon />
                          ) : item.type === 'receivable_overdue' ? (
                            <ReceivableIcon />
                          ) : (
                            <PayableIcon />
                          )}
                        </Avatar>

                        <Box sx={{ flex: 1 }}>
                          {/* Badges: Category, Severity, Status (OPEN / CLOSED), and Generated DateTime */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8, flexWrap: 'wrap' }}>
                            <Chip 
                              label={item.category} 
                              size="small" 
                              sx={{ 
                                height: 22, 
                                fontSize: '0.72rem', 
                                fontWeight: 700,
                                bgcolor: isClosed ? '#e2e8f0' : (isCritical ? '#fee2e2' : (isCrm ? '#e0f2fe' : (isReorder ? '#ffedd5' : '#eff6ff'))),
                                color: isClosed ? '#475569' : (isCritical ? '#dc2626' : (isCrm ? '#0369a1' : (isReorder ? '#c2410c' : '#1d4ed8')))
                              }} 
                            />
                            
                            {!isClosed && (
                              <Chip 
                                label={isCritical ? 'CRITICAL' : (item.severity === 'info' ? 'INFO' : 'WARNING')} 
                                size="small" 
                                sx={{ 
                                  height: 20, 
                                  fontSize: '0.65rem', 
                                  fontWeight: 800,
                                  bgcolor: isCritical ? '#dc2626' : (item.severity === 'info' ? '#6366f1' : '#f59e0b'),
                                  color: '#ffffff'
                                }} 
                              />
                            )}

                            {/* Status Chip: OPEN (Green) or CLOSED (Gray) */}
                            {isClosed ? (
                              <Chip 
                                label="CLOSED" 
                                size="small" 
                                sx={{ 
                                  height: 22, 
                                  fontSize: '0.72rem', 
                                  fontWeight: 800, 
                                  bgcolor: '#f1f5f9', 
                                  color: '#475569',
                                  border: '1px solid #cbd5e1'
                                }} 
                              />
                            ) : (
                              <Chip 
                                label="OPEN" 
                                size="small" 
                                sx={{ 
                                  height: 22, 
                                  fontSize: '0.72rem', 
                                  fontWeight: 800, 
                                  bgcolor: '#dcfce7', 
                                  color: '#15803d',
                                  border: '1px solid #86efac'
                                }} 
                              />
                            )}

                            {/* Date & Time Generated */}
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, ml: { xs: 0, sm: 0.5 } }}>
                              <AccessTimeIcon sx={{ fontSize: 14, color: '#64748b' }} />
                              <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                                <strong>Generated:</strong> {formatDateTime(item.generatedAt || item.timestamp)}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Title */}
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: isClosed ? '#64748b' : '#1e293b', mb: 0.5 }}>
                            {item.title}
                          </Typography>

                          {/* Message */}
                          <Typography variant="body2" sx={{ color: isClosed ? '#64748b' : '#475569', lineHeight: 1.5 }}>
                            {item.message}
                          </Typography>

                          {/* Closed Details Banner */}
                          {isClosed && (
                            <Box sx={{ mt: 1, p: 0.8, bgcolor: '#f1f5f9', borderRadius: 1.5, display: 'inline-block' }}>
                              <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic' }}>
                                ✓ Closed on {formatDateTime(item.closedAt)}{item.closedBy ? ` by ${item.closedBy}` : ''}
                                {item.closedReason ? ` (${item.closedReason})` : ''}
                              </Typography>
                            </Box>
                          )}

                          {/* CRM Details */}
                          {isCrm && !isClosed && (
                            <Box sx={{ display: 'flex', gap: 2, mt: 1.5, pt: 1, borderTop: '1px dashed #e2e8f0', flexWrap: 'wrap', alignItems: 'center' }}>
                              {item.customer && (
                                <Typography variant="caption" sx={{ color: '#0F3B66', fontWeight: 700 }}>
                                  Customer: <strong>{item.customer}</strong>
                                </Typography>
                              )}
                              {item.stage && (
                                <Typography variant="caption" sx={{ color: '#475569' }}>
                                  Stage: <strong>{item.stage}</strong>
                                </Typography>
                              )}
                              {Number(item.dealValue) > 0 && (
                                <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 700 }}>
                                  Deal Value: ₹{Number(item.dealValue).toLocaleString('en-IN')}
                                </Typography>
                              )}
                              {item.followUpDate && (
                                <Typography variant="caption" sx={{ color: item.type === 'crm_overdue' ? '#dc2626' : '#ea580c', fontWeight: 600 }}>
                                  Follow-up: {item.followUpDate} {item.overdueDays ? `(${item.overdueDays}d overdue)` : ''}
                                </Typography>
                              )}
                              {item.nextAction && (
                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                  Next Action: <em>{item.nextAction}</em>
                                </Typography>
                              )}
                            </Box>
                          )}

                          {/* Reorder Details */}
                          {isReorder && !isClosed && (
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

                          {/* Overdue POD Details */}
                          {item.type === 'overdue_pod' && !isClosed && (
                            <Box sx={{ display: 'flex', gap: 2, mt: 1.5, pt: 1, borderTop: '1px dashed #e2e8f0', flexWrap: 'wrap', alignItems: 'center' }}>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                Invoice Amount: <strong style={{ color: '#0F3B66' }}>₹{(item.amount || 0).toLocaleString('en-IN')}</strong>
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                Expected Delivery: <strong>{item.expectedDeliveryDate ? item.expectedDeliveryDate.split('-').reverse().join('/') : '—'}</strong>
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 700 }}>
                                Overdue: {item.overdueDays} Days Late
                              </Typography>
                              {item.courierCompany && (
                                <Typography variant="caption" sx={{ color: '#2563eb' }}>
                                  Transporter: <strong>{item.courierCompany}</strong>
                                </Typography>
                              )}
                              {item.awbNo && (
                                <Typography variant="caption" sx={{ color: '#475569' }}>
                                  AWB: <strong>{item.awbNo}</strong>
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Box>
                      </Box>

                      {/* Right Action Buttons: View Link + Close + Delete */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', alignSelf: { xs: 'stretch', sm: 'center' } }}>
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
                              '&:hover': { bgcolor: '#F88A01' }
                            }}
                          >
                            {isCrm 
                              ? 'View in CRM' 
                              : (isReorder 
                                ? 'Manage Item' 
                                : (item.type === 'overdue_pod' 
                                  ? 'Enter POD' 
                                  : (item.type === 'task_notification' ? 'View Task' : 'View Invoices')))}
                          </Button>
                        )}

                        {!isClosed ? (
                          <Button 
                            variant="outlined" 
                            size="small"
                            color="warning"
                            startIcon={<CloseIcon fontSize="small" />}
                            onClick={(e) => handleOpenCloseDialog(item, e)}
                            sx={{ 
                              borderColor: '#fed7aa',
                              color: '#ea580c', 
                              textTransform: 'none', 
                              fontWeight: 700,
                              borderRadius: 2,
                              px: 1.5,
                              '&:hover': { 
                                borderColor: '#ea580c',
                                bgcolor: '#fff7ed' 
                              }
                            }}
                          >
                            Close
                          </Button>
                        ) : (
                          <Chip 
                            icon={<ClosedIcon fontSize="small" />}
                            label="Closed"
                            size="small"
                            variant="outlined"
                            sx={{ borderColor: '#cbd5e1', color: '#64748b', fontWeight: 600 }}
                          />
                        )}

                        {/* Individual Delete Option */}
                        <Tooltip title="Delete this notification">
                          <IconButton
                            size="small"
                            onClick={(e) => handleOpenDeleteDialog(item, e)}
                            sx={{
                              color: '#dc2626',
                              border: '1px solid #fee2e2',
                              borderRadius: 2,
                              p: 0.7,
                              '&:hover': { bgcolor: '#fef2f2', borderColor: '#fca5a5' }
                            }}
                          >
                            <DeleteIcon fontSize="small" sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Confirmation Dialog to Close Notification */}
      <Dialog
        open={closeDialogOpen}
        onClose={() => !closingInProgress && setCloseDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon sx={{ color: '#dc2626' }} /> Close Notification
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: '#334155', mb: 1.5 }}>
            Are you sure you want to mark this notification as closed?
          </Typography>

          <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
              {selectedNotif?.title}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
              Category: <strong>{selectedNotif?.category}</strong>
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
              Generated: <strong>{formatDateTime(selectedNotif?.generatedAt || selectedNotif?.timestamp)}</strong>
            </Typography>
          </Box>

          <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 600, mb: 1 }}>
            To confirm closing, please type <strong style={{ color: '#dc2626', textDecoration: 'underline' }}>close</strong> in the box below:
          </Typography>

          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder='Type "close" to confirm'
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && confirmInput.trim().toLowerCase() === 'close' && !closingInProgress) {
                handleConfirmClose();
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, bgcolor: '#f8fafc' }}>
          <Button 
            onClick={() => setCloseDialogOpen(false)}
            disabled={closingInProgress}
            sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleConfirmClose}
            disabled={confirmInput.trim().toLowerCase() !== 'close' || closingInProgress}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              px: 2.5
            }}
          >
            {closingInProgress ? <CircularProgress size={20} color="inherit" /> : 'Confirm Close'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog to Delete Single Notification */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deletingInProgress && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon sx={{ color: '#dc2626' }} /> Delete Notification
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: '#334155', mb: 1.5 }}>
            Are you sure you want to permanently delete this notification?
          </Typography>

          <Box sx={{ p: 1.5, bgcolor: '#fef2f2', borderRadius: 2, border: '1px solid #fee2e2', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#991b1b' }}>
              {selectedDeleteNotif?.title}
            </Typography>
            <Typography variant="caption" sx={{ color: '#7f1d1d', display: 'block', mt: 0.5 }}>
              Category: <strong>{selectedDeleteNotif?.category}</strong>
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
              {selectedDeleteNotif?.message}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, bgcolor: '#f8fafc' }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deletingInProgress}
            sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDeleteSingle}
            disabled={deletingInProgress}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              px: 2.5
            }}
          >
            {deletingInProgress ? <CircularProgress size={20} color="inherit" /> : 'Delete Notification'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog to Delete All Notifications */}
      <Dialog
        open={deleteAllDialogOpen}
        onClose={() => !deletingAllInProgress && setDeleteAllDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteSweepIcon sx={{ color: '#dc2626' }} /> Delete All Notifications
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1" sx={{ color: '#1e293b', fontWeight: 600, mb: 1.5 }}>
            You are about to delete {deleteAllScopeAll ? `all ${summary.total}` : `${filteredNotifications.length}`} notification(s).
          </Typography>

          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            {!deleteAllScopeAll 
              ? `This will remove all ${filteredNotifications.length} notifications currently visible in "${getTabLabelName()}" (${statusFilter.toUpperCase()}).`
              : `This will clear and delete all open and closed notifications across the entire system.`}
          </Typography>

          <Paper sx={{ p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={deleteAllScopeAll}
                  onChange={(e) => setDeleteAllScopeAll(e.target.checked)}
                  color="error"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 600, color: deleteAllScopeAll ? '#dc2626' : '#334155' }}>
                  Delete ALL alerts across all categories ({summary.total} total)
                </Typography>
              }
            />
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, bgcolor: '#f8fafc' }}>
          <Button 
            onClick={() => setDeleteAllDialogOpen(false)}
            disabled={deletingAllInProgress}
            sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDeleteAll}
            disabled={deletingAllInProgress}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              px: 2.5
            }}
          >
            {deletingAllInProgress ? <CircularProgress size={20} color="inherit" /> : 'Confirm Delete All'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%', borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default NotificationLogs;
