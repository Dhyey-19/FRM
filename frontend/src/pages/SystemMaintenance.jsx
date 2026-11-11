import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import {
  Backup as BackupIcon,
  SystemUpdateAlt as UpdateIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useSystemMaintenanceData } from '../hooks/useSystemMaintenanceData';
import {
  SystemStatusCards,
  SqlBackupPanel,
  AppUpdatePanel
} from '../components/settings/SystemMaintenancePanels';

const SystemMaintenance = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabIndex = searchParams.get('tab') === 'updates' ? 1 : 0;
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { status, backups, loadingBackups, fetchStatus, fetchBackups } = useSystemMaintenanceData();

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
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

      <SystemStatusCards status={status} backupsCount={backups.length} />

      <Paper sx={{ borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <Tabs
          value={tabIndex}
          onChange={(e, val) => {
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

        {tabIndex === 0 && (
          <Box sx={{ p: 3 }}>
            <SqlBackupPanel
              backups={backups}
              loadingBackups={loadingBackups}
              onRefresh={() => { fetchBackups(); fetchStatus(); }}
              onSuccess={setSuccessMsg}
              onError={setErrorMsg}
            />
          </Box>
        )}

        {tabIndex === 1 && (
          <Box sx={{ p: 3 }}>
            <AppUpdatePanel
              onRefreshStatus={fetchStatus}
              onSuccess={setSuccessMsg}
              onError={setErrorMsg}
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default SystemMaintenance;
