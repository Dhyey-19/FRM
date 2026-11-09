import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Divider,
  Tabs,
  Tab
} from '@mui/material';
import {
  Storage as StorageIcon,
  CloudDownload as DownloadIcon,
  Backup as BackupIcon,
  Delete as DeleteIcon,
  SystemUpdateAlt as UpdateIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Sync as SyncIcon,
  Code as CodeIcon,
  Security as SecurityIcon
} from '@mui/icons-material';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const SystemMaintenance = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramTab = searchParams.get('tab');
  const [tabIndex, setTabIndex] = useState(paramTab === 'updates' ? 1 : 0);

  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab === 'updates') {
      setTabIndex(1);
    } else if (currentTab === 'backup') {
      setTabIndex(0);
    }
  }, [searchParams]);

  const [status, setStatus] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  
  // Update state
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updateLogs, setUpdateLogs] = useState('');
  const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false);

  // Delete Backup Modal
  const [backupToDelete, setBackupToDelete] = useState(null);
  const [deletingBackup, setDeletingBackup] = useState(false);

  // Success / Error messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await fetch(`${API_BASE}/system/status`);
      const data = await res.json();
      if (res.ok) {
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchBackups = async () => {
    try {
      setLoadingBackups(true);
      const res = await fetch(`${API_BASE}/system/backups`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setBackups(data);
      }
    } catch (err) {
      console.error('Failed to fetch backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    try {
      setCreatingBackup(true);
      setErrorMsg('');
      setSuccessMsg('');
      const res = await fetch(`${API_BASE}/system/backup`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`✓ Backup created successfully: ${data.filename} (${data.size})`);
        fetchBackups();
        fetchStatus();
      } else {
        setErrorMsg(data.message || 'Failed to create database backup');
      }
    } catch (err) {
      setErrorMsg('Error triggering backup: ' + err.message);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = (filename) => {
    window.open(`${API_BASE}/system/backups/download/${encodeURIComponent(filename)}`, '_blank');
  };

  const handleDeleteBackup = async () => {
    if (!backupToDelete) return;
    try {
      setDeletingBackup(true);
      const res = await fetch(`${API_BASE}/system/backups/${encodeURIComponent(backupToDelete)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSuccessMsg(`Backup ${backupToDelete} removed.`);
        fetchBackups();
        fetchStatus();
      } else {
        const data = await res.json();
        setErrorMsg(data.message || 'Failed to delete backup');
      }
    } catch (err) {
      setErrorMsg('Error deleting backup: ' + err.message);
    } finally {
      setDeletingBackup(false);
      setBackupToDelete(null);
    }
  };

  const handleCheckUpdates = async () => {
    try {
      setCheckingUpdate(true);
      setErrorMsg('');
      const res = await fetch(`${API_BASE}/system/check-updates`);
      const data = await res.json();
      if (res.ok) {
        setUpdateInfo(data);
      } else {
        setErrorMsg(data.message || 'Failed to check for updates');
      }
    } catch (err) {
      setErrorMsg('Failed to check for updates: ' + err.message);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    setConfirmUpdateOpen(false);
    try {
      setUpdating(true);
      setUpdateLogs('Connecting to server to pull updates...\nPlease do not close this window.');
      setErrorMsg('');
      const res = await fetch(`${API_BASE}/system/apply-update`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setUpdateLogs(data.logs || 'Update successfully installed!');
        setSuccessMsg('Application and database updated successfully! Please reload your browser.');
        fetchStatus();
        handleCheckUpdates();
      } else {
        setUpdateLogs(data.logs || ('Failed: ' + data.message));
        setErrorMsg(data.message || 'Update failed');
      }
    } catch (err) {
      setErrorMsg('Error applying update: ' + err.message);
      setUpdateLogs(prev => prev + '\nError: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66' }}>
            System Maintenance & Backups
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
            Manage SQL Server database backups, restore points, and seamless 1-click application updates.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => { fetchStatus(); fetchBackups(); }}
          size="small"
        >
          Refresh Status
        </Button>
      </Box>

      {/* Global Alerts */}
      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg('')} sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}
      {errorMsg && (
        <Alert severity="error" onClose={() => setErrorMsg('')} sx={{ mb: 2 }}>
          {errorMsg}
        </Alert>
      )}

      {/* System Status Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: '#eff6ff', color: '#2563eb' }}>
                <StorageIcon fontSize="large" />
              </Box>
              <Box sx={{ overflow: 'hidden' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Database Engine
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {status?.dbName || 'FRM_DB'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CheckCircleIcon sx={{ fontSize: 13 }} /> {status?.dbType || 'MS SQL Server 2022'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                <SecurityIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Live Migrations
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                  {status ? `${status.migrationsCount} Applied` : 'Checking...'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Up-to-Date
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: '#faf5ff', color: '#9333ea' }}>
                <CodeIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  App Version (Git)
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                  {status?.currentCommit || 'Latest'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  {status?.commitDate || 'Stable Build'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: '#fff7ed', color: '#ea580c' }}>
                <BackupIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Backup Files
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                  {status?.backupCount ?? backups.length} Saved
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  {status?.latestBackupTime ? new Date(status.latestBackupTime).toLocaleDateString() : 'Ready'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <Tabs
          value={tabIndex}
          onChange={(e, val) => {
            setTabIndex(val);
            setSearchParams({ tab: val === 1 ? 'updates' : 'backup' });
          }}
          sx={{
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            px: 2
          }}
        >
          <Tab
            icon={<BackupIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Database Backups"
            sx={{ fontWeight: 600, textTransform: 'none', py: 1.5 }}
          />
          <Tab
            icon={<UpdateIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Application & Schema Updates"
            sx={{ fontWeight: 600, textTransform: 'none', py: 1.5 }}
          />
        </Tabs>

        {/* Tab 1: Database Backups */}
        {tabIndex === 0 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                  MS SQL Server Backups (.bak)
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Create full database backup snapshots. Download them anytime to an external drive for disaster recovery.
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="primary"
                startIcon={creatingBackup ? <CircularProgress size={18} color="inherit" /> : <BackupIcon />}
                onClick={handleCreateBackup}
                disabled={creatingBackup}
                sx={{ fontWeight: 600 }}
              >
                {creatingBackup ? 'Creating Backup...' : 'Create Backup Now'}
              </Button>
            </Box>

            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Sr. No.</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Backup Filename</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date & Time</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Download</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Delete</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {backups.map((b, idx) => (
                    <TableRow key={b.filename} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#0F3B66' }}>
                        {b.filename}
                      </TableCell>
                      <TableCell>
                        {new Date(b.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip label={b.size} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          color="primary"
                          size="small"
                          onClick={() => handleDownloadBackup(b.filename)}
                          title="Download Backup"
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          color="error"
                          size="small"
                          onClick={() => setBackupToDelete(b.filename)}
                          title="Delete Backup"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {backups.length === 0 && !loadingBackups && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: '#94a3b8' }}>
                        No backup files yet. Click "Create Backup Now" above to create your first backup snapshot.
                      </TableCell>
                    </TableRow>
                  )}
                  {loadingBackups && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Tab 2: Application & Schema Updates */}
        {tabIndex === 1 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                  Application & Database Updates
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Check for new features, bug fixes, and database migrations from GitHub without affecting your live data.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={checkingUpdate ? <CircularProgress size={18} color="inherit" /> : <SyncIcon />}
                onClick={handleCheckUpdates}
                disabled={checkingUpdate || updating}
                sx={{ fontWeight: 600 }}
              >
                {checkingUpdate ? 'Checking GitHub...' : 'Check for Updates'}
              </Button>
            </Box>

            {/* Update Status Banner */}
            {updateInfo && (
              <Box sx={{ mb: 3 }}>
                {updateInfo.hasUpdate ? (
                  <Alert
                    severity="warning"
                    icon={<UpdateIcon />}
                    sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          New Updates Available!
                        </Typography>
                        <Typography variant="body2">
                          {updateInfo.commitsBehind > 0 && `${updateInfo.commitsBehind} new commit(s) available. `}
                          {updateInfo.latestCommitMessage && `Latest: "${updateInfo.latestCommitMessage}". `}
                          {updateInfo.pendingMigrations?.length > 0 && `${updateInfo.pendingMigrations.length} pending database migration(s).`}
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        color="warning"
                        startIcon={<UpdateIcon />}
                        onClick={() => setConfirmUpdateOpen(true)}
                        disabled={updating}
                        sx={{ fontWeight: 700 }}
                      >
                        Update Now
                      </Button>
                    </Box>
                  </Alert>
                ) : (
                  <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Your Application & Database Are Fully Up to Date!
                    </Typography>
                    <Typography variant="body2">
                      You are running the latest version from GitHub. No pending database migrations found.
                    </Typography>
                  </Alert>
                )}
              </Box>
            )}

            {/* How Updates Work Explanation */}
            <Paper variant="outlined" sx={{ p: 2.5, backgroundColor: '#f8fafc', borderRadius: 2, mb: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <SecurityIcon sx={{ fontSize: 18, color: '#10b981' }} />
                How Non-Destructive Database Updates Work:
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', mb: 0.5 }}>
                • <strong>Zero Data Loss:</strong> Database modifications use sequential migration scripts executed inside safe database transactions.
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', mb: 0.5 }}>
                • <strong>Live Data Untouched:</strong> All existing client ledgers, vouchers, items, attendance records, and passwords remain 100% intact.
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569' }}>
                • <strong>Automated Verification:</strong> The system automatically records executed updates in the <code>_Migrations</code> table to prevent duplicate executions.
              </Typography>
            </Paper>

            {/* Live Progress Logs Terminal */}
            {updateLogs && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Update Process Log:
                </Typography>
                <Paper
                  sx={{
                    p: 2,
                    mt: 0.5,
                    backgroundColor: '#0f172a',
                    color: '#38bdf8',
                    fontFamily: 'Consolas, monospace',
                    fontSize: '0.85rem',
                    borderRadius: 2,
                    maxHeight: 250,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {updateLogs}
                </Paper>
                {updating && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5, color: '#2563eb' }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Applying updates and rebuilding frontend assets... Please wait.
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* Confirmation Dialog: Apply Update */}
      <Dialog
        open={confirmUpdateOpen}
        onClose={() => setConfirmUpdateOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#0F3B66', display: 'flex', alignItems: 'center', gap: 1 }}>
          <UpdateIcon color="primary" /> Confirm Application Update
        </DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ mb: 2, color: '#334155' }}>
            Are you sure you want to update the application and database now?
          </DialogContentText>
          <Box sx={{ p: 2, backgroundColor: '#f1f5f9', borderRadius: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F3B66', mb: 0.5 }}>
              What this will do:
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569' }}>
              1. Pull latest code from GitHub.<br />
              2. Apply any pending SQL Server migrations to <code>FRM_DB</code>.<br />
              3. Recompile frontend bundles.<br />
              4. All existing customer data and vouchers will remain 100% safe.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setConfirmUpdateOpen(false)} color="inherit" disabled={updating}>
            Cancel
          </Button>
          <Button onClick={handleApplyUpdate} variant="contained" color="warning" disabled={updating}>
            Yes, Apply Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog: Delete Backup */}
      <Dialog
        open={Boolean(backupToDelete)}
        onClose={() => setBackupToDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#dc2626' }}>
          Delete Backup File?
        </DialogTitle>
        <DialogContent dividers>
          <DialogContentText>
            Are you sure you want to delete backup file <strong>{backupToDelete}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setBackupToDelete(null)} color="inherit" disabled={deletingBackup}>
            Cancel
          </Button>
          <Button onClick={handleDeleteBackup} variant="contained" color="error" disabled={deletingBackup}>
            {deletingBackup ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SystemMaintenance;
