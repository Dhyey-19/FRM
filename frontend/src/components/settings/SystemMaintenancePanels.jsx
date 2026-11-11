import { useState, useRef } from 'react';
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
  DialogActions
} from '@mui/material';
import {
  Storage as StorageIcon,
  CloudDownload as DownloadIcon,
  Backup as BackupIcon,
  Delete as DeleteIcon,
  SystemUpdateAlt as UpdateIcon,
  CheckCircle as CheckCircleIcon,
  UploadFile as UploadFileIcon,
  Code as CodeIcon,
  Security as SecurityIcon
} from '@mui/icons-material';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Four KPI summary cards displaying database engine, migrations, app version, and backup counts.
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
              App Version
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
              {status?.appVersion ? `v${status.appVersion}` : 'Production'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              {status?.buildDate || 'Production Build'}
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
 * Offline compiled server update package (.zip) uploader and installer panel.
 */
export const AppUpdatePanel = ({ onSuccess, onError }) => {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updateLogs, setUpdateLogs] = useState('');
  const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      if (onError) onError('Please select a valid .zip update package (FRM-Server-Package.zip).');
      e.target.value = '';
      return;
    }
    if (onError) onError('');
    setSelectedFile(file);
  };

  const handleApplyUpdate = async () => {
    setConfirmUpdateOpen(false);
    if (!selectedFile) return;

    try {
      setUpdating(true);
      setUpdateLogs(`Uploading ${selectedFile.name} to server...\nPlease do not close this window.`);
      if (onError) onError('');
      if (onSuccess) onSuccess('');

      const formData = new FormData();
      formData.append('updatePackage', selectedFile);

      const res = await fetch(`${API_BASE}/system/upload-update`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        setUpdateLogs(data.logs || 'Update successfully installed!');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (onSuccess) onSuccess('Update installed and server restarting cleanly! Reloading page in 4 seconds...');
        if (data.restartRequired) {
          setTimeout(() => {
            window.location.reload();
          }, 4000);
        }
      } else {
        setUpdateLogs(data.logs || ('Failed: ' + (data.message || 'Update failed')));
        if (onError) onError(data.message || 'Update failed');
      }
    } catch (err) {
      if (onError) onError('Error uploading update package: ' + err.message);
      setUpdateLogs((prev) => prev + '\nError: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66' }}>
          Application & Database Package Update
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b' }}>
          Upload a compiled update package (<code>FRM-Server-Package.zip</code>) directly from this browser. No Git, GitHub, or manual file copying needed.
        </Typography>
      </Box>

      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 2,
          backgroundColor: '#f8fafc',
          borderColor: '#cbd5e1'
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
          Select Compiled Update Package (.zip)
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={updating}
            sx={{ fontWeight: 600, bgcolor: '#ffffff' }}
          >
            Choose .zip File
          </Button>

          {selectedFile ? (
            <Chip
              label={`${selectedFile.name} (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)`}
              onDelete={updating ? undefined : () => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600, bgcolor: '#ffffff' }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              No package selected yet.
            </Typography>
          )}

          <Button
            variant="contained"
            color="warning"
            startIcon={updating ? <CircularProgress size={18} color="inherit" /> : <UpdateIcon />}
            onClick={() => setConfirmUpdateOpen(true)}
            disabled={!selectedFile || updating}
            sx={{ fontWeight: 700, ml: { sm: 'auto' } }}
          >
            {updating ? 'Installing Update...' : 'Install Update'}
          </Button>
        </Box>
      </Paper>

      <Alert severity="info" icon={<SecurityIcon />} sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Safe, Compiled, Zero-Data-Loss Updates
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          • <strong>Zero Source Code:</strong> Only compiled frontend assets and minified backend runtime are installed.<br />
          • <strong>Database & Config Protected:</strong> Live <code>FRM_DB</code> data, <code>.env</code>, SSL certificates, and backups remain 100% intact while pending SQL migrations apply in safe transactions.<br />
          • <strong>All Devices Updated Automatically:</strong> Once installed, Windows, Mac, Android, and iOS devices see the new version on refresh.
        </Typography>
      </Alert>

      {updateLogs && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Update Installation Log:
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
        </Box>
      )}

      <Dialog open={confirmUpdateOpen} onClose={() => setConfirmUpdateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#0F3B66', display: 'flex', alignItems: 'center', gap: 1 }}>
          <UpdateIcon color="warning" /> Install Update Package?
        </DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ mb: 2, color: '#334155' }}>
            Install compiled package <strong>{selectedFile?.name}</strong> on this server now?
          </DialogContentText>
          <Box sx={{ p: 2, backgroundColor: '#f1f5f9', borderRadius: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F3B66', mb: 0.5 }}>
              What this will do:
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569' }}>
              1. Extract verified compiled web &amp; backend bundles.<br />
              2. Preserve <code>.env</code>, SSL certificates, and <code>.bak</code> backups.<br />
              3. Apply any pending SQL Server migrations safely to <code>FRM_DB</code>.<br />
              4. Automatically restart the FRM server (~2 seconds downtime).
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setConfirmUpdateOpen(false)} color="inherit" disabled={updating}>
            Cancel
          </Button>
          <Button onClick={handleApplyUpdate} variant="contained" color="warning" disabled={updating}>
            Yes, Install Update
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
