import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Chip,
  IconButton,
  Button,
  Switch,
  TextField,
  InputAdornment,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
  Divider,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  Avatar,
  Badge
} from '@mui/material';
import {
  ManageAccounts as UserAccessIcon,
  Search as SearchIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  SelectAll as SelectAllIcon,
  Deselect as DeselectIcon,
  AccountCircle as AccountCircleIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Lock as LockIcon,
  Check as CheckSimpleIcon
} from '@mui/icons-material';
import { getAllFormSections, getAllMenuPaths } from '../config/menuConfig';

const UserAccess = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [allowedPaths, setAllowedPaths] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const [isDirty, setIsDirty] = useState(false);

  // All application form sections
  const formSections = getAllFormSections();
  const allAvailablePaths = getAllMenuPaths().filter(p => p && p !== '/dashboard');

  // Fetch users from backend
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        if (data.length > 0 && !selectedUserId) {
          // Default to first user or currently logged in user
          const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
          const matched = data.find(u => u.UserId === localUser.UserId) || data[0];
          setSelectedUserId(matched.UserId);
        }
      } else {
        showToast('Failed to load user list', 'error');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      showToast('Network error loading users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // When selected user changes, parse their AllowedMenus
  useEffect(() => {
    if (!selectedUserId) return;
    const user = users.find(u => String(u.UserId) === String(selectedUserId));
    if (!user) return;

    const raw = user.AllowedMenus;
    let initialPaths = [];

    if (raw === '*') {
      initialPaths = [...allAvailablePaths];
    } else if (raw && typeof raw === 'string') {
      const parts = raw.split(',').map(p => p.trim());
      // Check if parts are actual paths
      const exactPaths = parts.filter(p => p.startsWith('/dashboard/'));
      
      // If user had jobwork-ins or jobwork-outs allowed in database, map to subcontract
      if (parts.includes('/dashboard/jobwork-ins') || parts.includes('/dashboard/jobwork-outs')) {
        if (!exactPaths.includes('/dashboard/subcontract')) {
          exactPaths.push('/dashboard/subcontract');
        }
      }
      
      // Also handle legacy keyword mappings if present
      formSections.forEach(sec => {
        sec.forms.forEach(f => {
          if (parts.includes(f.path)) {
            if (!exactPaths.includes(f.path)) exactPaths.push(f.path);
          }
          // Legacy keywords
          if (parts.includes('Masters') && sec.id.toLowerCase().includes('master')) {
            if (!exactPaths.includes(f.path)) exactPaths.push(f.path);
          }
          if (parts.includes('Entries') && (sec.id.includes('transaction') || sec.id.includes('voucher'))) {
            if (!exactPaths.includes(f.path)) exactPaths.push(f.path);
          }
          if (parts.includes('Reports') && sec.id.toLowerCase().includes('report')) {
            if (!exactPaths.includes(f.path)) exactPaths.push(f.path);
          }
        });
      });
      initialPaths = exactPaths;
    } else if (user.UserRole === 'ADMIN') {
      // Default full access for admin if unconfigured
      initialPaths = [...allAvailablePaths];
    } else {
      initialPaths = [];
    }

    setAllowedPaths(initialPaths);
    setIsDirty(false);
  }, [selectedUserId, users]);

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
  };

  const selectedUser = users.find(u => String(u.UserId) === String(selectedUserId));

  // Save changes to backend
  const saveUserAccess = async (pathsToSave, showSuccessToast = true) => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const pathsStr = pathsToSave.length === allAvailablePaths.length ? '*' : pathsToSave.join(',');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/users/${selectedUserId}/access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedMenus: pathsStr })
      });

      if (res.ok) {
        setIsDirty(false);
        // Update user in local state
        setUsers(prev => prev.map(u => {
          if (String(u.UserId) === String(selectedUserId)) {
            return { ...u, AllowedMenus: pathsStr };
          }
          return u;
        }));

        // If the modified user is currently logged in, sync localStorage and notify sidebar
        const currentStored = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
        if (String(currentStored.UserId) === String(selectedUserId)) {
          currentStored.AllowedMenus = pathsStr;
          if (localStorage.getItem('user')) {
            localStorage.setItem('user', JSON.stringify(currentStored));
          }
          if (sessionStorage.getItem('user')) {
            sessionStorage.setItem('user', JSON.stringify(currentStored));
          }
          window.dispatchEvent(new Event('user_access_updated'));
        }

        if (showSuccessToast) {
          showToast(`Access rights saved for ${selectedUser?.Username || 'user'}`);
        }
      } else {
        const err = await res.json();
        showToast(err.message || 'Failed to save access rights', 'error');
      }
    } catch (err) {
      console.error('Error saving user access:', err);
      showToast('Network error saving user access', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Toggle single form visibility
  const handleToggleForm = (path, formTitle) => {
    let newPaths;
    const isCurrentlyAllowed = allowedPaths.includes(path);
    if (isCurrentlyAllowed) {
      newPaths = allowedPaths.filter(p => p !== path);
      if (path === '/dashboard/subcontract') {
        newPaths = newPaths.filter(p => p !== '/dashboard/jobwork-ins' && p !== '/dashboard/jobwork-outs');
      }
    } else {
      newPaths = [...allowedPaths, path];
      if (path === '/dashboard/subcontract') {
        newPaths = Array.from(new Set([...newPaths, '/dashboard/jobwork-ins', '/dashboard/jobwork-outs']));
      }
    }
    setAllowedPaths(newPaths);
    setIsDirty(true);

    if (autoSave) {
      saveUserAccess(newPaths, false);
      showToast(
        isCurrentlyAllowed
          ? `"${formTitle}" hidden from ${selectedUser?.Username}'s drawer`
          : `"${formTitle}" visible in ${selectedUser?.Username}'s drawer`
      );
    }
  };

  // Section master toggle
  const handleToggleSection = (sectionForms, enable) => {
    const sectionPaths = sectionForms.map(f => f.path);
    let newPaths;
    if (enable) {
      newPaths = Array.from(new Set([...allowedPaths, ...sectionPaths]));
    } else {
      newPaths = allowedPaths.filter(p => !sectionPaths.includes(p));
    }
    setAllowedPaths(newPaths);
    setIsDirty(true);

    if (autoSave) {
      saveUserAccess(newPaths, true);
    }
  };

  // Grant All
  const handleGrantAll = () => {
    const newPaths = [...allAvailablePaths];
    setAllowedPaths(newPaths);
    setIsDirty(true);
    if (autoSave) {
      saveUserAccess(newPaths, true);
    }
  };

  // Revoke All
  const handleRevokeAll = () => {
    const newPaths = [];
    setAllowedPaths(newPaths);
    setIsDirty(true);
    if (autoSave) {
      saveUserAccess(newPaths, true);
    }
  };

  // Filter sections by search query
  const filteredSections = formSections.map(sec => {
    const matchingForms = sec.forms.filter(f =>
      f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sec.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.path.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return { ...sec, forms: matchingForms };
  }).filter(sec => sec.forms.length > 0);

  const totalVisibleCount = allowedPaths.length;
  const totalAvailableCount = allAvailablePaths.length;
  const accessPercentage = totalAvailableCount > 0 ? Math.round((totalVisibleCount / totalAvailableCount) * 100) : 0;

  return (
    <Box sx={{ pb: 6 }}>
      {/* Sleek Operations Header */}
      <Box sx={{ mb: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#F88A01', letterSpacing: 1, textTransform: 'uppercase' }}>
              Administration • Security
            </Typography>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F3B66', letterSpacing: -0.5 }}>
            User Menu Access
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
            Configure granular drawer menu and form visibility rights for each user in your organization.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Tooltip title="Refresh User & Access State">
            <IconButton
              onClick={fetchUsers}
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

          {isDirty && !autoSave && (
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => saveUserAccess(allowedPaths, true)}
              disabled={saving}
              sx={{
                bgcolor: '#F88A01',
                color: '#ffffff',
                fontWeight: 600,
                px: 2.5,
                py: 0.9,
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(248, 138, 1, 0.25)',
                textTransform: 'none',
                '&:hover': { bgcolor: '#ea580c' }
              }}
            >
              {saving ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
            </Button>
          )}
        </Box>
      </Box>

      {/* User Selection & Overview Card */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3.5,
          borderRadius: 3,
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderTop: '4px solid #0F3B66',
          boxShadow: '0 2px 10px rgba(15, 59, 102, 0.06)'
        }}
      >
        <Grid container spacing={3} alignItems="center">
          {/* User Dropdown Selector */}
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="user-select-label" sx={{ fontWeight: 600, color: '#0F3B66' }}>
                Select User from User Master
              </InputLabel>
              <Select
                labelId="user-select-label"
                value={selectedUserId}
                label="Select User from User Master"
                onChange={(e) => setSelectedUserId(e.target.value)}
                sx={{
                  borderRadius: 2,
                  bgcolor: '#f8fafc',
                  fontWeight: 600,
                  color: '#0F3B66'
                }}
              >
                {users.map(u => (
                  <MenuItem key={u.UserId} value={u.UserId}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      <Avatar
                        sx={{
                          width: 26,
                          height: 26,
                          fontSize: '0.75rem',
                          bgcolor: u.UserRole === 'ADMIN' ? '#0F3B66' : '#F88A01'
                        }}
                      >
                        {u.Username.charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                        {u.Username}
                      </Typography>
                      <Chip
                        label={u.UserRole}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          bgcolor: u.UserRole === 'ADMIN' ? '#eff6ff' : '#fff7ed',
                          color: u.UserRole === 'ADMIN' ? '#0F3B66' : '#ea580c',
                          border: u.UserRole === 'ADMIN' ? '1px solid #dbeafe' : '1px solid #ffedd5'
                        }}
                      />
                      {!u.IsActive && (
                        <Chip label="Inactive" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#fee2e2', color: '#b91c1c' }} />
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* User Details & Access Ratio */}
          <Grid item xs={12} md={5}>
            {selectedUser ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66', lineHeight: 1.2 }}>
                    {selectedUser.Username}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Role: <strong>{selectedUser.UserRole}</strong> {selectedUser.MobileNo ? `• Mobile: ${selectedUser.MobileNo}` : ''}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    icon={<VisibilityIcon sx={{ fontSize: '15px !important', color: '#10b981 !important' }} />}
                    label={`${totalVisibleCount} of ${totalAvailableCount} Forms Visible (${accessPercentage}%)`}
                    sx={{
                      bgcolor: '#f0fdf4',
                      color: '#15803d',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      border: '1px solid #bbf7d0'
                    }}
                  />
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Please select a user to configure permissions.
              </Typography>
            )}
          </Grid>

          {/* Global Quick Action Buttons */}
          <Grid item xs={12} md={3} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1, alignItems: 'center' }}>
            <Tooltip title="Grant access to all forms for this user">
              <Button
                size="small"
                variant="outlined"
                startIcon={<SelectAllIcon />}
                onClick={handleGrantAll}
                sx={{
                  color: '#0F3B66',
                  borderColor: '#cbd5e1',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  '&:hover': { borderColor: '#0F3B66', bgcolor: '#f1f5f9' }
                }}
              >
                Grant All
              </Button>
            </Tooltip>

            <Tooltip title="Revoke access to all forms for this user">
              <Button
                size="small"
                variant="outlined"
                startIcon={<DeselectIcon />}
                onClick={handleRevokeAll}
                sx={{
                  color: '#dc2626',
                  borderColor: '#fca5a5',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  '&:hover': { borderColor: '#dc2626', bgcolor: '#fef2f2' }
                }}
              >
                Revoke All
              </Button>
            </Tooltip>
          </Grid>
        </Grid>

        {/* Filter and Instant Save Switch Bar */}
        <Divider sx={{ my: 2.5 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <TextField
            size="small"
            placeholder="Search forms by title, route, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{
              width: { xs: '100%', sm: 380 },
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: '#f8fafc'
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                </InputAdornment>
              )
            }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
              Auto-Save on Toggle:
            </Typography>
            <Switch
              size="small"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              color="primary"
            />
            <Chip
              label={autoSave ? 'INSTANT SYNC ACTIVE' : 'MANUAL SAVE'}
              size="small"
              sx={{
                bgcolor: autoSave ? '#eff6ff' : '#f8fafc',
                color: autoSave ? '#0F3B66' : '#64748b',
                border: '1px solid #cbd5e1',
                fontSize: '0.62rem',
                fontWeight: 700
              }}
            />
          </Box>
        </Box>
      </Paper>

      {/* Forms & Modules Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress sx={{ color: '#0F3B66' }} />
        </Box>
      ) : filteredSections.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, bgcolor: '#ffffff', border: '1px dashed #cbd5e1' }}>
          <Typography variant="h6" sx={{ color: '#0F3B66', fontWeight: 700, mb: 0.5 }}>
            No Matching Forms Found
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            No forms match the search term "{searchTerm}". Clear the search to see all modules.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredSections.map((section) => {
            const sectionTotal = section.forms.length;
            const sectionVisible = section.forms.filter(f => allowedPaths.includes(f.path)).length;
            const allSectionEnabled = sectionTotal > 0 && sectionVisible === sectionTotal;

            return (
              <Grid item xs={12} md={6} key={section.id}>
                <Card
                  sx={{
                    borderRadius: 3,
                    bgcolor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderTop: allSectionEnabled ? '4px solid #10b981' : sectionVisible > 0 ? '4px solid #F88A01' : '4px solid #94a3b8',
                    boxShadow: '0 2px 8px rgba(15, 59, 102, 0.05)',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'box-shadow 0.2s',
                    '&:hover': {
                      boxShadow: '0 6px 18px rgba(15, 59, 102, 0.09)'
                    }
                  }}
                >
                  {/* Section Header */}
                  <Box
                    sx={{
                      p: 2,
                      px: 2.5,
                      bgcolor: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ color: '#0F3B66', display: 'flex', alignItems: 'center' }}>
                        {section.icon}
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66', fontSize: '0.98rem' }}>
                          {section.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                          {sectionVisible} of {sectionTotal} forms visible in drawer
                        </Typography>
                      </Box>
                    </Box>

                    {/* Section Switch & Quick Action */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Tooltip title={allSectionEnabled ? 'Hide all forms in this section' : 'Show all forms in this section'}>
                        <Button
                          size="small"
                          onClick={() => handleToggleSection(section.forms, !allSectionEnabled)}
                          sx={{
                            color: allSectionEnabled ? '#dc2626' : '#0F3B66',
                            textTransform: 'none',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            py: 0.3,
                            px: 1,
                            bgcolor: allSectionEnabled ? '#fee2e2' : '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: 1.5,
                            '&:hover': {
                              bgcolor: allSectionEnabled ? '#fecaca' : '#f1f5f9'
                            }
                          }}
                        >
                          {allSectionEnabled ? 'Disable All' : 'Enable All'}
                        </Button>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Forms Rows */}
                  <CardContent sx={{ p: 0, flexGrow: 1 }}>
                    {section.forms.map((form, idx) => {
                      const isAllowed = allowedPaths.includes(form.path);

                      return (
                        <Box
                          key={form.path}
                          sx={{
                            p: 1.8,
                            px: 2.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: idx < section.forms.length - 1 ? '1px solid #f1f5f9' : 'none',
                            bgcolor: isAllowed ? 'transparent' : 'rgba(241, 245, 249, 0.4)',
                            transition: 'background-color 0.15s ease',
                            '&:hover': {
                              bgcolor: '#f8fafc'
                            }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flexGrow: 1, mr: 2 }}>
                            <Box
                              sx={{
                                width: 34,
                                height: 34,
                                borderRadius: 2,
                                bgcolor: isAllowed ? '#eff6ff' : '#f1f5f9',
                                color: isAllowed ? '#0F3B66' : '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              {form.icon}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: isAllowed ? 700 : 500,
                                  color: isAllowed ? '#0F3B66' : '#64748b',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {form.title}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: '#94a3b8',
                                  fontSize: '0.68rem',
                                  fontFamily: 'monospace',
                                  display: 'block',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {form.path}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Visibility Status & Switch */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                            <Chip
                              label={isAllowed ? 'Visible' : 'Hidden'}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                bgcolor: isAllowed ? '#f0fdf4' : '#f1f5f9',
                                color: isAllowed ? '#15803d' : '#94a3b8',
                                border: isAllowed ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                                minWidth: 62
                              }}
                            />

                            <Switch
                              checked={isAllowed}
                              onChange={() => handleToggleForm(form.path, form.title)}
                              sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': {
                                  color: '#F88A01'
                                },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                  backgroundColor: '#F88A01'
                                }
                              }}
                            />
                          </Box>
                        </Box>
                      );
                    })}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Manual Save Floating Bar if Auto-Save is OFF and changes exist */}
      {!autoSave && isDirty && (
        <Paper
          elevation={4}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            p: 2,
            px: 3,
            bgcolor: '#0F3B66',
            color: '#ffffff',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            boxShadow: '0 10px 30px rgba(15, 59, 102, 0.35)',
            zIndex: 1000
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Unsaved changes for {selectedUser?.Username} ({allowedPaths.length} forms visible)
          </Typography>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={() => saveUserAccess(allowedPaths, true)}
            disabled={saving}
            sx={{
              bgcolor: '#F88A01',
              color: '#ffffff',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 2,
              '&:hover': { bgcolor: '#ea580c' }
            }}
          >
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Save Changes'}
          </Button>
        </Paper>
      )}

      {/* Toast Feedback */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity} sx={{ borderRadius: 2, boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserAccess;

