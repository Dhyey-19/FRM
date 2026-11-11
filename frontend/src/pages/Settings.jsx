import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Alert,
  Tabs,
  Tab,
  TextField,
  Chip,
  Divider,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Settings as SettingsIcon,
  AccountCircle as AccountIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Dns as ServerIcon,
  Backup as BackupIcon,
  SystemUpdateAlt as UpdateIcon,
  VerifiedUser as LicenseIcon,
  KeyOff as KeyOffIcon,
  TableView as ExcelIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useSystemMaintenanceData } from '../hooks/useSystemMaintenanceData';
import {
  SystemStatusCards,
  SqlBackupPanel,
  AppUpdatePanel
} from '../components/settings/SystemMaintenancePanels';
import TypedConfirmActionDialog from '../components/settings/TypedConfirmActionDialog';
import { downloadExcelBackup, surrenderSoftwareLicense } from '../utils/systemActions';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}') || {};
  } catch {
    return {};
  }
}

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentUser, setCurrentUser] = useState(getStoredUser);

  const userRole = String(currentUser?.UserRole || currentUser?.role || '').toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userRole === 'ADMINISTRATOR';

  // Sync user state on permission updates
  useEffect(() => {
    const syncStored = () => setCurrentUser(getStoredUser());
    window.addEventListener('user_access_updated', syncStored);
    window.addEventListener('storage', syncStored);
    return () => {
      window.removeEventListener('user_access_updated', syncStored);
      window.removeEventListener('storage', syncStored);
    };
  }, []);

  const availableTabs = useMemo(() => {
    const base = [
      { id: 'account', label: 'Account & Security', icon: <AccountIcon fontSize="small" /> },
      { id: 'server', label: 'App & Server', icon: <ServerIcon fontSize="small" /> }
    ];
    if (isAdmin) {
      base.push(
        { id: 'backups', label: 'Backups (SQL & Excel)', icon: <BackupIcon fontSize="small" /> },
        { id: 'updates', label: 'App Updates', icon: <UpdateIcon fontSize="small" /> },
        { id: 'license', label: 'License & Activation', icon: <LicenseIcon fontSize="small" /> }
      );
    }
    return base;
  }, [isAdmin]);

  const requestedTab = searchParams.get('tab');
  const resolvedTabId = availableTabs.some((t) => t.id === requestedTab) ? requestedTab : 'account';

  const handleTabChange = (e, newId) => {
    setSearchParams({ tab: newId });
    setSuccessMsg('');
    setErrorMsg('');
  };

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // System status & backups (only fetch backups when Admin)
  const { status, backups, loadingBackups, fetchStatus, fetchBackups } = useSystemMaintenanceData({
    loadBackups: isAdmin
  });

  // Change Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState({ current: false, next: false, confirm: false });
  const [savingPassword, setSavingPassword] = useState(false);

  // Registration / License info (Admin)
  const [regStatus, setRegStatus] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetch(`${API_BASE}/auth/registration-status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setRegStatus(data);
      })
      .catch((err) => console.error('Could not load registration status:', err));
  }, [isAdmin]);

  // Excel Backup & Surrender License modals (Admin)
  const [openBackupDialog, setOpenBackupDialog] = useState(false);
  const [backupDownloading, setBackupDownloading] = useState(false);
  const [backupError, setBackupError] = useState('');

  const [openSurrenderDialog, setOpenSurrenderDialog] = useState(false);
  const [surrendering, setSurrendering] = useState(false);
  const [surrenderError, setSurrenderError] = useState('');

  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMsg('Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 4 || newPassword.length > 50) {
      setErrorMsg('New password must be between 4 and 50 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    try {
      setSavingPassword(true);
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setErrorMsg(data.message || 'Failed to update password.');
      }
    } catch (err) {
      setErrorMsg('Could not reach server to update password: ' + err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleConfirmExcelBackup = async () => {
    setBackupDownloading(true);
    setBackupError('');
    try {
      const filename = await downloadExcelBackup();
      setOpenBackupDialog(false);
      setSuccessMsg(`Excel backup downloaded: ${filename}`);
    } catch (err) {
      setBackupError(err.message || 'Failed to download backup file from server.');
    } finally {
      setBackupDownloading(false);
    }
  };

  const handleConfirmSurrender = async () => {
    setSurrendering(true);
    setSurrenderError('');
    try {
      await surrenderSoftwareLicense();
    } catch (err) {
      setSurrenderError(err.message || 'Failed to surrender license.');
      setSurrendering(false);
    }
  };

  const allowedMenuItems = useMemo(() => {
    const raw = currentUser?.AllowedMenus;
    if (raw === '*' || (isAdmin && (!raw || String(raw).trim() === ''))) return ['*'];
    if (!raw || String(raw).trim() === '') return [];
    return Array.isArray(raw) ? raw : String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  }, [currentUser, isAdmin]);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: '#eff6ff', color: '#0F3B66', display: 'flex' }}>
            <SettingsIcon fontSize="medium" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66' }}>
              Settings
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              {isAdmin
                ? 'Manage your account, server details, database/Excel backups, updates, and license.'
                : 'Manage your account password and view server & access details.'}
            </Typography>
          </Box>
        </Box>
        {isAdmin && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => { fetchStatus(); fetchBackups(); }}
          >
            Refresh Status
          </Button>
        )}
      </Box>

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

      <Paper sx={{ borderRadius: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Tabs
          value={resolvedTabId}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            px: { xs: 1, sm: 2 }
          }}
        >
          {availableTabs.map((t) => (
            <Tab
              key={t.id}
              value={t.id}
              icon={t.icon}
              iconPosition="start"
              label={t.label}
              sx={{ fontWeight: 600, textTransform: 'none', py: 1.5, minHeight: 52 }}
            />
          ))}
        </Tabs>

        {/* Tab 1: Account & Security (All Users) */}
        {resolvedTabId === 'account' && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66', mb: 2 }}>
                      My Account Profile
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Username</Typography>
                        <Typography variant="body2" fontWeight={700} color="#0F3B66">
                          {currentUser.Username || currentUser.username || '-'}
                        </Typography>
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Full Name</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {currentUser.FullName || currentUser.Username || '-'}
                        </Typography>
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Role</Typography>
                        <Chip
                          label={currentUser.UserRole || currentUser.role || 'OPERATOR'}
                          size="small"
                          color={isAdmin ? 'primary' : 'default'}
                          sx={{ fontWeight: 700 }}
                        />
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Mobile No</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {currentUser.MobileNo || 'Not set'}
                        </Typography>
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Department / Designation</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {[currentUser.Department, currentUser.Designation].filter(Boolean).join(' • ') || '-'}
                        </Typography>
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">Action Permissions</Typography>
                        <Box sx={{ display: 'flex', gap: 0.8 }}>
                          <Chip
                            label="Add"
                            size="small"
                            color={isAdmin || currentUser.IsAdd ? 'success' : 'default'}
                            variant={isAdmin || currentUser.IsAdd ? 'filled' : 'outlined'}
                          />
                          <Chip
                            label="Edit"
                            size="small"
                            color={isAdmin || currentUser.IsEdit ? 'success' : 'default'}
                            variant={isAdmin || currentUser.IsEdit ? 'filled' : 'outlined'}
                          />
                          <Chip
                            label="Delete"
                            size="small"
                            color={isAdmin || currentUser.IsDelete ? 'success' : 'default'}
                            variant={isAdmin || currentUser.IsDelete ? 'filled' : 'outlined'}
                          />
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LockIcon fontSize="small" /> Change Password
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                      Update your login password anytime.
                    </Typography>

                    <Box component="form" onSubmit={handlePasswordSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        label="Current Password"
                        size="small"
                        fullWidth
                        type={showPasswords.current ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => setShowPasswords((p) => ({ ...p, current: !p.current }))}
                                edge="end"
                              >
                                {showPasswords.current ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                              </IconButton>
                            </InputAdornment>
                          )
                        }}
                      />
                      <TextField
                        label="New Password (min 4 characters)"
                        size="small"
                        fullWidth
                        type={showPasswords.next ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => setShowPasswords((p) => ({ ...p, next: !p.next }))}
                                edge="end"
                              >
                                {showPasswords.next ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                              </IconButton>
                            </InputAdornment>
                          )
                        }}
                      />
                      <TextField
                        label="Confirm New Password"
                        size="small"
                        fullWidth
                        type={showPasswords.confirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))}
                                edge="end"
                              >
                                {showPasswords.confirm ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                              </IconButton>
                            </InputAdornment>
                          )
                        }}
                      />
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={savingPassword}
                        sx={{ bgcolor: '#0F3B66', fontWeight: 600, alignSelf: 'flex-start', px: 3 }}
                      >
                        {savingPassword ? 'Updating...' : 'Update Password'}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Tab 2: App & Server Info (All Users) */}
        {resolvedTabId === 'server' && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {isAdmin && <SystemStatusCards status={status} backupsCount={backups.length} />}

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66', mb: 2 }}>
                      Connection & Application Info
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">Server URL</Typography>
                        <Typography variant="body2" fontWeight={700} color="#0F3B66">
                          {typeof window !== 'undefined' ? window.location.origin : '-'}
                        </Typography>
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Display Mode</Typography>
                        <Chip
                          label={isStandalone ? 'Installed PWA App' : 'Web Browser'}
                          size="small"
                          color={isStandalone ? 'success' : 'primary'}
                          variant="outlined"
                        />
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Database Engine</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {status?.dbType || 'MS SQL Server 2022'} ({status?.dbName || 'FRM_DB'})
                        </Typography>
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Schema Status</Typography>
                        <Typography variant="body2" fontWeight={600} color="#10b981">
                          {status ? `${status.migrationsCount} Migrations Applied` : 'Connected'}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
                      Permitted Screens
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Modules currently enabled for your user account (Dashboard, Task Manager, and Settings are always available).
                    </Typography>
                    {allowedMenuItems.includes('*') ? (
                      <Alert severity="info" icon={<CheckCircleIcon />}>
                        <strong>Full Administrator Access</strong> — All modules, reports, and system settings are enabled.
                      </Alert>
                    ) : allowedMenuItems.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Only default workspace screens (Dashboard, Task Manager, Settings) are assigned. Contact Admin to grant module access.
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                        {allowedMenuItems.map((menuPath) => (
                          <Chip
                            key={menuPath}
                            label={menuPath.replace('/dashboard/', '')}
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 600 }}
                          />
                        ))}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Tab 3: Backups - SQL & Excel (Admin Only) */}
        {isAdmin && resolvedTabId === 'backups' && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                mb: 3,
                borderRadius: 2,
                backgroundColor: '#f0fdf4',
                borderColor: '#bbf7d0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 2
              }}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ExcelIcon /> Export Entire Database to Excel (.xlsx)
                </Typography>
                <Typography variant="body2" sx={{ color: '#065f46' }}>
                  Download every table and transaction record as a multi-sheet Microsoft Excel spreadsheet.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<ExcelIcon />}
                onClick={() => {
                  setBackupError('');
                  setOpenBackupDialog(true);
                }}
                sx={{ bgcolor: '#10b981', fontWeight: 600, '&:hover': { bgcolor: '#059669' } }}
              >
                Excel Backup
              </Button>
            </Paper>

            <SqlBackupPanel
              backups={backups}
              loadingBackups={loadingBackups}
              onRefresh={() => { fetchBackups(); fetchStatus(); }}
              onSuccess={setSuccessMsg}
              onError={setErrorMsg}
            />
          </Box>
        )}

        {/* Tab 4: Application Updates (Admin Only) */}
        {isAdmin && resolvedTabId === 'updates' && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <AppUpdatePanel
              onRefreshStatus={fetchStatus}
              onSuccess={setSuccessMsg}
              onError={setErrorMsg}
            />
          </Box>
        )}

        {/* Tab 5: License & Activation (Admin Only) */}
        {isAdmin && resolvedTabId === 'license' && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66', mb: 2 }}>
                      Server License Status
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Activation Status</Typography>
                        <Chip
                          label={regStatus?.isRegistered ? 'Activated' : 'Checking...'}
                          color={regStatus?.isRegistered ? 'success' : 'default'}
                          size="small"
                          sx={{ fontWeight: 700 }}
                        />
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Device Verification No.</Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ letterSpacing: 1 }}>
                          {regStatus?.randomNumber || '-'}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ borderRadius: 2, borderColor: '#fecaca', bgcolor: '#fef2f2' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#b91c1c', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <KeyOffIcon /> Surrender Software License
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#7f1d1d', mb: 2 }}>
                      Deactivate the FRM license on this server machine. The application will require a new Activation Key before users can log in again.
                    </Typography>
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<KeyOffIcon />}
                      onClick={() => {
                        setSurrenderError('');
                        setOpenSurrenderDialog(true);
                      }}
                      sx={{ fontWeight: 600 }}
                    >
                      Surrender License
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Excel Backup Confirmation */}
      <TypedConfirmActionDialog
        open={openBackupDialog}
        onClose={() => setOpenBackupDialog(false)}
        onConfirm={handleConfirmExcelBackup}
        loading={backupDownloading}
        error={backupError}
        title="Download Database Excel Backup"
        icon={<BackupIcon />}
        description="Export all system tables, configurations, and records into a Microsoft Excel (.xlsx) spreadsheet backup file."
        confirmWord="backup"
        confirmLabel="Download Backup"
        loadingLabel="Downloading..."
        headerBg="#ecfdf5"
        titleColor="#047857"
        accentColor="#10b981"
        hoverColor="#059669"
      />

      {/* Surrender License Confirmation */}
      <TypedConfirmActionDialog
        open={openSurrenderDialog}
        onClose={() => setOpenSurrenderDialog(false)}
        onConfirm={handleConfirmSurrender}
        loading={surrendering}
        error={surrenderError}
        title="Surrender Software License"
        icon={<KeyOffIcon />}
        description="Are you sure you want to surrender your active software license? You will need a new Activation Key to unlock and use this device again."
        confirmWord="surrender"
        confirmLabel="Surrender"
        loadingLabel="Surrendering..."
        headerBg="#fee2e2"
        titleColor="#b91c1c"
        accentColor="#dc2626"
        hoverColor="#b91c1c"
      />
    </Box>
  );
};

export default Settings;
