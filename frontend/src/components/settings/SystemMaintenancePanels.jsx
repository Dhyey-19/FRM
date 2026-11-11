import { useState, useEffect } from 'react';
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
  TextField
} from '@mui/material';
import {
  Storage as StorageIcon,
  CloudDownload as DownloadIcon,
  Backup as BackupIcon,
  Delete as DeleteIcon,
  SystemUpdateAlt as UpdateIcon,
  CheckCircle as CheckCircleIcon,
  Sync as SyncIcon,
  Code as CodeIcon,
  Security as SecurityIcon,
  VpnKey as TokenIcon
} from '@mui/icons-material';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Four KPI summary cards displaying database engine, migrations, git version, and backup counts.
 */
export const SystemStatusCards = ({ status, backupsCount = 0 }) => (
  <Grid container spacing={2} sx={{ mb: 3 }}>
    <Grid item xs={12} sm={6} md={3}>
      <Card sx={{ borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', height: '100%' }}>
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
      <Card sx={{ borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', height: '100%' }}>
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
      <Card sx={{ borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', height: '100%' }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
          <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: '#faf5ff', color: '#9333ea' }}>
            <CodeIcon fontSize="large" />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              App Version {status?.deployMode === 'package' ? '(Package)' : ''}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
              {status?.currentCommit && status.currentCommit !== 'Unknown'
                ? status.currentCommit
                : (status?.appVersion ? `v${status.appVersion}` : 'Production')}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              {status?.commitDate && status.commitDate !== 'Unknown' ? status.commitDate : 'Production Build'}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Grid>

    <Grid item xs={12} sm={6} md={3}>
      <Card sx={{ borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', height: '100%' }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
          <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: '#fff7ed', color: '#ea580c' }}>
            <BackupIcon fontSize="large" />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Backup Files
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
              {status?.backupCount ?? backupsCount} Saved
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              {status?.latestBackupTime ? new Date(status.latestBackupTime).toLocaleDateString() : 'Ready'}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

/**
 * MS SQL Server backup snapshot list, create, download, and delete panel.
 */
export const SqlBackupPanel = ({ backups, loadingBackups, onRefresh, onSuccess, onError }) => {
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState(null);
  const [deletingBackup, setDeletingBackup] = useState(false);

  const handleCreateBackup = async () => {
    try {
      setCreatingBackup(true);
      if (onError) onError('');
      if (onSuccess) onSuccess('');
      const res = await fetch(`${API_BASE}/system/backup`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        if (onSuccess) onSuccess(`✓ Backup created successfully: ${data.filename} (${data.size})`);
        if (onRefresh) onRefresh();
      } else if (onError) {
        onError(data.message || 'Failed to create database backup');
      }
    } catch (err) {
      if (onError) onError('Error triggering backup: ' + err.message);
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
        if (onSuccess) onSuccess(`Backup ${backupToDelete} removed.`);
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        if (onError) onError(data.message || 'Failed to delete backup');
      }
    } catch (err) {
      if (onError) onError('Error deleting backup: ' + err.message);
    } finally {
      setDeletingBackup(false);
      setBackupToDelete(null);
    }
  };

  return (
    <>
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
                <TableCell sx={{ fontWeight: 600, color: '#0F3B66' }}>{b.filename}</TableCell>
                <TableCell>{new Date(b.createdAt).toLocaleString()}</TableCell>
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

      <Dialog open={Boolean(backupToDelete)} onClose={() => setBackupToDelete(null)} maxWidth="xs" fullWidth>
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
    </>
  );
};

/**
 * GitHub / schema migration update check and execution panel.
 */
export const AppUpdatePanel = ({ onRefreshStatus, onSuccess, onError }) => {
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updateLogs, setUpdateLogs] = useState('');
  const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false);
  const [showTokenConfig, setShowTokenConfig] = useState(false);
  const [githubRepoInput, setGithubRepoInput] = useState('Dhyey-19/FRM');
  const [githubTokenInput, setGithubTokenInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const handleCheckUpdates = async () => {
    try {
      setCheckingUpdate(true);
      if (onError) onError('');
      const res = await fetch(`${API_BASE}/system/check-updates`);
      const data = await res.json();
      if (res.ok) {
        setUpdateInfo(data);
        if (data.githubRepo) setGithubRepoInput(data.githubRepo);
      } else if (onError) {
        onError(data.message || 'Failed to check for updates');
      }
    } catch (err) {
      if (onError) onError('Failed to check for updates: ' + err.message);
    } finally {
      setCheckingUpdate(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/system/check-updates`);
        const data = await res.json();
        if (active && res.ok) {
          setUpdateInfo(data);
          if (data.githubRepo) setGithubRepoInput(data.githubRepo);
        }
      } catch (err) {
        console.error('Update check notice:', err);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSaveUpdateConfig = async (e) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      if (onError) onError('');
      if (onSuccess) onSuccess('');
      const res = await fetch(`${API_BASE}/system/update-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubRepo: githubRepoInput.trim() || 'Dhyey-19/FRM',
          githubToken: githubTokenInput.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setGithubTokenInput('');
        setShowTokenConfig(false);
        if (onSuccess) onSuccess('GitHub update settings saved! Checking for updates...');
        if (onRefreshStatus) onRefreshStatus();
        await handleCheckUpdates();
      } else if (onError) {
        onError(data.message || 'Failed to save GitHub update settings.');
      }
    } catch (err) {
      if (onError) onError('Error saving GitHub settings: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleApplyUpdate = async () => {
    setConfirmUpdateOpen(false);
    try {
      setUpdating(true);
      setUpdateLogs('Connecting to GitHub to download & install updates...\nPlease do not close this window.');
      if (onError) onError('');
      const res = await fetch(`${API_BASE}/system/apply-update`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setUpdateLogs(data.logs || 'Update successfully installed!');
        if (data.restartRequired) {
          if (onSuccess) onSuccess('Server updated and restarting cleanly! Page will reload in 4 seconds...');
          setTimeout(() => {
            window.location.reload();
          }, 4000);
        } else {
          if (onSuccess) onSuccess('Application and database updated successfully! Please reload your browser.');
          if (onRefreshStatus) onRefreshStatus();
          handleCheckUpdates();
        }
      } else {
        setUpdateLogs(data.logs || ('Failed: ' + data.message));
        if (onError) onError(data.message || 'Update failed');
      }
    } catch (err) {
      if (onError) onError('Error applying update: ' + err.message);
      setUpdateLogs((prev) => prev + '\nError: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const isPackageMode = updateInfo?.deployMode === 'package';
  const showSourceSetup = isPackageMode && (showTokenConfig || updateInfo?.needsToken || updateInfo?.tokenInvalid);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66' }}>
            Application & Database Updates
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            {isPackageMode
              ? 'Check GitHub releases and install updated web/backend code + database migrations in 1 click without copying ZIPs.'
              : 'Check for new features, bug fixes, and database migrations from GitHub without affecting your live data.'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {isPackageMode && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<TokenIcon />}
              onClick={() => setShowTokenConfig((v) => !v)}
              disabled={checkingUpdate || updating}
              sx={{ fontWeight: 600 }}
            >
              {updateInfo?.hasGithubToken ? 'GitHub Token Settings' : 'Connect GitHub Token'}
            </Button>
          )}
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
      </Box>

      {showSourceSetup && (
        <Paper
          component="form"
          onSubmit={handleSaveUpdateConfig}
          variant="outlined"
          sx={{ p: 2.5, mb: 3, borderRadius: 2, backgroundColor: '#fffbeb', borderColor: '#fde68a' }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#92400e', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TokenIcon fontSize="small" /> GitHub Auto-Update Connection (One-Time Setup)
          </Typography>
          <Typography variant="body2" sx={{ color: '#78350f', mb: 2 }}>
            {updateInfo?.configNotice || 'Enter a fine-grained Read-Only GitHub Token (Contents: Read on Dhyey-19/FRM) so this server can download updates directly from GitHub.'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              label="GitHub Repository"
              size="small"
              value={githubRepoInput}
              onChange={(e) => setGithubRepoInput(e.target.value)}
              sx={{ minWidth: 200, bgcolor: '#ffffff' }}
            />
            <TextField
              label={updateInfo?.hasGithubToken ? 'New GitHub Token (leave blank to keep)' : 'GitHub Personal Access Token (Read-Only)'}
              size="small"
              type="password"
              value={githubTokenInput}
              onChange={(e) => setGithubTokenInput(e.target.value)}
              sx={{ flex: 1, minWidth: 260, bgcolor: '#ffffff' }}
            />
            <Button type="submit" variant="contained" disabled={savingConfig} sx={{ bgcolor: '#0F3B66', fontWeight: 600 }}>
              {savingConfig ? 'Saving...' : 'Save & Check Updates'}
            </Button>
          </Box>
        </Paper>
      )}

      {updateInfo && (
        <Box sx={{ mb: 3 }}>
          {updateInfo.configNotice && !updateInfo.hasUpdate && (
            <Alert severity={updateInfo.needsToken || updateInfo.tokenInvalid ? 'warning' : 'info'} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                GitHub Auto-Update Notice
              </Typography>
              <Typography variant="body2">
                {updateInfo.configNotice}
              </Typography>
            </Alert>
          )}

          {updateInfo.hasUpdate ? (
            <Alert severity="warning" icon={<UpdateIcon />} sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    New Updates Available! {updateInfo.remoteCommit ? `(${updateInfo.remoteCommit})` : ''}
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
          ) : !updateInfo.configNotice && (
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Your Application & Database Are Fully Up to Date! ({updateInfo.currentCommit || 'Latest'})
              </Typography>
              <Typography variant="body2">
                Running the latest version with no pending database migrations.
              </Typography>
            </Alert>
          )}
        </Box>
      )}

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

      <Dialog open={confirmUpdateOpen} onClose={() => setConfirmUpdateOpen(false)} maxWidth="sm" fullWidth>
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
              {isPackageMode ? (
                <>
                  1. Download latest server release package from GitHub over HTTPS.<br />
                  2. Update web app, backend code, and apply pending <code>FRM_DB</code> SQL migrations.<br />
                  3. Automatically restart the FRM server (keeping `.env`, SSL certs &amp; live data untouched).
                </>
              ) : (
                <>
                  1. Pull latest code from GitHub.<br />
                  2. Apply any pending SQL Server migrations to <code>FRM_DB</code>.<br />
                  3. Recompile frontend bundles.<br />
                  4. All existing customer data and vouchers will remain 100% safe.
                </>
              )}
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
    </>
  );
};
