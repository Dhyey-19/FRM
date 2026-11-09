import React, { useState, useEffect } from 'react';
import appLogo from '../../assets/app_logo.jpeg';
import { 
  Drawer, 
  Box, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Collapse,
  Typography,
  Avatar,
  Divider,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField
} from '@mui/material';
import { 
  Dashboard as DashboardIcon, 
  AdminPanelSettings as AdminIcon, 
  People as PeopleIcon,
  Inventory as InventoryIcon,
  BrandingWatermark as BrandIcon,
  Category as ItemIcon,
  Straighten as UnitIcon,
  AccountTree as BOMIcon,
  AccountBalanceWallet as AccountGroupIcon,
  Assessment as ReportsIcon,
  List as ListIcon,
  Receipt as TransactionIcon,
  Business as DepartmentIcon,
  Build as AssemblyIcon,
  Settings as SettingsIcon,
  ExpandLess, 
  ExpandMore,
  Logout,
  SaveAlt as BackupIcon,
  KeyOff as KeyOffIcon,
  Menu as MenuIcon,
  MenuOpen as MenuOpenIcon,
  AccountCircle as AccountCircleIcon,
  OpenInNew as OpenInNewIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { MENU_STRUCTURE } from '../../config/menuConfig';

const Sidebar = ({ 
  user, 
  isCollapsed, 
  toggleSidebar, 
  drawerWidth = 300,
  isMobile = false,
  mobileOpen = false,
  onMobileClose 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(user);
  const [openMenu, setOpenMenu] = useState('');
  const [openSurrenderDialog, setOpenSurrenderDialog] = useState(false);
  const [surrenderInput, setSurrenderInput] = useState('');
  const [surrenderError, setSurrenderError] = useState('');
  const [surrendering, setSurrendering] = useState(false);

  const [openBackupDialog, setOpenBackupDialog] = useState(false);
  const [backupInput, setBackupInput] = useState('');
  const [backupError, setBackupError] = useState('');
  const [backupDownloading, setBackupDownloading] = useState(false);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  // Listen for user access permissions update to refresh drawer dynamically
  useEffect(() => {
    const handleAccessUpdate = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
        if (stored && stored.UserId) {
          setCurrentUser(stored);
        }
      } catch (e) {
        console.error('Error syncing user state:', e);
      }
    };

    window.addEventListener('user_access_updated', handleAccessUpdate);
    window.addEventListener('storage', handleAccessUpdate);
    return () => {
      window.removeEventListener('user_access_updated', handleAccessUpdate);
      window.removeEventListener('storage', handleAccessUpdate);
    };
  }, []);

  const activeUser = currentUser || user || {};
  const userRole = String(activeUser?.role || activeUser?.UserRole || '').toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userRole === 'ADMINISTRATOR';

  useEffect(() => {
    if (isCollapsed) {
      setOpenMenu('');
    }
  }, [isCollapsed]);

  const handleMenuClick = (menuName) => {
    if (isCollapsed) {
      toggleSidebar();
      setOpenMenu(menuName);
    } else {
      setOpenMenu(openMenu === menuName ? '' : menuName);
    }
  };

  const handleOpenBackupDialog = () => {
    setOpenBackupDialog(true);
    setBackupInput('');
    setBackupError('');
  };

  const handleCloseBackupDialog = () => {
    if (backupDownloading) return;
    setOpenBackupDialog(false);
    setBackupInput('');
    setBackupError('');
  };

  const handleConfirmBackup = async () => {
    if (backupInput.trim().toLowerCase() !== 'backup') {
      setBackupError("Please type 'backup' to confirm.");
      return;
    }
    setBackupDownloading(true);
    setBackupError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/backup`, {
        method: 'GET'
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'FRM Backup.xlsx';
        if (contentDisposition && contentDisposition.includes('filename=')) {
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (filenameMatch && filenameMatch.length > 1) {
            filename = filenameMatch[1];
          }
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        setOpenBackupDialog(false);
        setBackupInput('');
        setBackupError('');
      } else {
        setBackupError('Failed to download backup file from server.');
      }
    } catch (err) {
      console.error('Backup error:', err);
      setBackupError('Failed to connect to server for backup.');
    } finally {
      setBackupDownloading(false);
    }
  };

  const handleCloseSurrenderDialog = () => {
    setOpenSurrenderDialog(false);
    setSurrenderInput('');
    setSurrenderError('');
  };

  const handleConfirmSurrender = async () => {
    if (surrenderInput.toLowerCase() !== 'surrender') {
      setSurrenderError("Please type 'surrender' to confirm.");
      return;
    }

    setSurrendering(true);
    setSurrenderError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/surrender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        localStorage.removeItem('isAppRegistered');
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        handleCloseSurrenderDialog();
        window.location.href = '#/';
        window.location.reload();
      } else {
        const data = await response.json();
        setSurrenderError(data.message || 'Failed to surrender license.');
      }
    } catch (err) {
      console.error('Surrender error:', err);
      setSurrenderError('Failed to contact the backend server.');
    } finally {
      setSurrendering(false);
    }
  };

  const isSelected = (path) => {
    if (location.pathname === path) return true;
    if (path === '/dashboard/subcontract') {
      return location.pathname === '/dashboard/jobwork-ins' || location.pathname === '/dashboard/jobwork-outs';
    }
    return false;
  };

  const drawerContent = (
    <Box sx={{ py: 0.5, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
      
      {/* Company Branding */}
      <Box sx={{ 
        p: isCollapsed && !isMobile ? 1 : 2.2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: isCollapsed && !isMobile ? 'center' : 'space-between', 
        borderBottom: '1px solid rgba(255,255,255,0.1)' 
      }}>
        {isCollapsed && !isMobile ? (
          <img 
            src={activeUser.companyLogo || user.companyLogo || appLogo} 
            alt="FRM" 
            style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid white' }} 
          />
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 0.5 }}>
              <img 
                src={activeUser.companyLogo || user.companyLogo || appLogo} 
                alt="FRM" 
                style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid white', flexShrink: 0 }} 
              />
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 1.2, whiteSpace: 'nowrap', color: '#ffffff' }}>
                FRM
              </Typography>
            </Box>
            {isMobile && (
              <IconButton onClick={onMobileClose} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#ffffff' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </>
        )}
      </Box>

      {/* User Card */}
      <Box sx={{ p: isCollapsed && !isMobile ? 1 : 2, display: 'flex', flexDirection: isCollapsed && !isMobile ? 'column' : 'row', alignItems: 'center', justifyContent: isCollapsed && !isMobile ? 'center' : 'flex-start', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <AccountCircleIcon sx={{ fontSize: isCollapsed && !isMobile ? 32 : 40, color: '#F88A01' }} />
        {(!isCollapsed || isMobile) ? (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.username || 'Dhyey Shah'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                {user.role || 'Administrator'}
              </Typography>
            </Box>
            {!isMobile && (
              <IconButton onClick={toggleSidebar} sx={{ color: 'white', p: 0.5 }}>
                <MenuOpenIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton 
              size="small" 
              onClick={() => {
                localStorage.removeItem('user');
                sessionStorage.removeItem('user');
                navigate('/');
                if (isMobile && onMobileClose) onMobileClose();
              }}
              sx={{ color: '#ff8a8a', p: 0.5, '&:hover': { bgcolor: 'rgba(255,138,138,0.1)' } }}
              title="Logout"
            >
              <Logout fontSize="small" />
            </IconButton>
          </>
        ) : (
          <IconButton onClick={toggleSidebar} sx={{ color: 'white', p: 0.5 }}>
            <MenuIcon />
          </IconButton>
        )}
      </Box>

        {/* Navigation Menu */}
        <List sx={{ py: 0.5, px: 2, pt: 1 }}>
          {(() => {
            const hasMenuAccess = (path) => {
              if (!path || path === '/dashboard') return true;

              const cleanPath = path.split('?')[0];

              // Always ensure Admin has access to critical management routes
              if (isAdmin && (cleanPath === '/dashboard/user-access' || cleanPath === '/dashboard/users' || cleanPath === '/dashboard/company-profile' || cleanPath === '/dashboard/system-maintenance')) {
                return true;
              }

              const storedUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
              const current = activeUser || storedUser || {};
              const rawMenus = (current?.AllowedMenus !== undefined && current?.AllowedMenus !== null)
                ? current.AllowedMenus
                : storedUser.AllowedMenus;

              // Wildcard or unconfigured Admin default
              if (rawMenus === '*') return true;
              if (isAdmin && (!rawMenus || String(rawMenus).trim() === '')) return true;
              if (!rawMenus || String(rawMenus).trim() === '') return false;

              const allowed = Array.isArray(rawMenus)
                ? rawMenus
                : String(rawMenus).split(',').map(p => p.trim());

              if (cleanPath === '/dashboard/subcontract') {
                return allowed.includes('/dashboard/subcontract') || 
                       allowed.includes('/dashboard/jobwork-ins') || 
                       allowed.includes('/dashboard/jobwork-outs');
              }

              if (cleanPath === '/dashboard/jobwork-ins' || cleanPath === '/dashboard/jobwork-outs') {
                return allowed.includes(cleanPath) || allowed.includes('/dashboard/subcontract');
              }

              return allowed.includes(path) || allowed.includes(cleanPath);
            };

            const renderMenuItem = (item, level = 0) => {
              if (item.adminOnly && !isAdmin) return null;
              if (item.path && !hasMenuAccess(item.path)) return null;

              const isSel = isSelected(item.path);

              return (
                <ListItemButton 
                  key={item.path || item.title}
                  selected={isSel} 
                  onClick={() => {
                    if (item.path) {
                      navigate(item.path);
                      if (isMobile && onMobileClose) onMobileClose();
                    }
                  }}
                  sx={{ 
                    py: level > 0 ? 0.3 : 0.5, 
                    pl: level > 0 ? 4 : 0, 
                    mb: level > 0 ? 0.1 : 0.2, 
                    borderRadius: 2,
                    '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                  }}
                >
                  <ListItemIcon sx={{ py: 0.5, minWidth: level > 0 ? 32 : 40, color: isSel ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.title} 
                    primaryTypographyProps={{ 
                      fontSize: level > 0 ? '0.85rem' : '1rem',
                      fontWeight: isSel ? 600 : 400 
                    }} 
                  />
                  {!isCollapsed && !isMobile && item.path && (
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); window.open('/#' + item.path, '_blank'); }} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#ffffff' } }} title="Open in new window">
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  )}
                </ListItemButton>
              );
            };

            const renderSection = (section) => {
              if (section.adminOnly && !isAdmin) return null;

              let visibleChildren = [];
              if (section.children) {
                visibleChildren = section.children.filter(child => hasMenuAccess(child.path));
              } else if (section.groups) {
                section.groups.forEach(group => {
                  group.children.forEach(child => {
                    if (hasMenuAccess(child.path)) visibleChildren.push(child);
                  });
                });
              }

              if (!section.path && visibleChildren.length === 0 && section.id !== 'admin') {
                return null;
              }

              if (section.path) {
                return (
                  <ListItem disablePadding sx={{ py: 0.5, mb: 0.2 }} key={section.title}>
                    {renderMenuItem(section)}
                  </ListItem>
                );
              }

              return (
                <React.Fragment key={section.id}>
                  <ListItem disablePadding sx={{ py: 0.5, mb: 0.2 }}>
                    <ListItemButton onClick={() => handleMenuClick(section.id)} sx={{ py: 0.5, borderRadius: 2 }}>
                      <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: 'rgba(255,255,255,0.7)' }}>
                        {section.icon}
                      </ListItemIcon>
                      <ListItemText primary={section.title} />
                      {openMenu === section.id ? <ExpandLess sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }} /> : <ExpandMore sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }} />}
                    </ListItemButton>
                  </ListItem>
                  
                  <Collapse in={openMenu === section.id} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding sx={{ pb: section.groups ? 2 : 0 }}>
                      {section.children && section.children.map(child => renderMenuItem(child, 1))}
                      
                      {section.id === 'admin' && isAdmin && (
                        <>
                          <ListItemButton onClick={handleOpenBackupDialog} sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2, '&:hover': { bgcolor: 'rgba(16,185,129,0.15)' } }}>
                            <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: '#10b981' }}><BackupIcon /></ListItemIcon>
                            <ListItemText primary="Excel Backup" primaryTypographyProps={{ color: '#10b981', fontWeight: 600 }} />
                          </ListItemButton>
                          <ListItemButton onClick={() => setOpenSurrenderDialog(true)} sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,138,138,0.15)', color: '#ff8a8a' } }}>
                            <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: '#ff8a8a' }}><KeyOffIcon /></ListItemIcon>
                            <ListItemText primary="Surrender License" primaryTypographyProps={{ color: '#ff8a8a', fontWeight: 500 }} />
                          </ListItemButton>
                        </>
                      )}

                      {section.groups && section.groups.map(group => {
                        const visibleGroupChildren = group.children.filter(child => hasMenuAccess(child.path));
                        if (visibleGroupChildren.length === 0) return null;
                        return (
                          <React.Fragment key={group.groupTitle}>
                            <Box sx={{ px: 3, pt: 1.5, pb: 0.5 }}>
                              <Typography variant="caption" sx={{ color: '#F88A01', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
                                {group.groupTitle}
                              </Typography>
                            </Box>
                            {visibleGroupChildren.map(child => renderMenuItem(child, 1))}
                          </React.Fragment>
                        );
                      })}
                    </List>
                  </Collapse>
                </React.Fragment>
              );
            };

            return MENU_STRUCTURE.map(renderSection);
          })()}
        </List>
      </Box>
  );

  const surrenderDialog = (
    <Dialog 
      open={openSurrenderDialog} 
      onClose={(e, reason) => { if (reason !== 'backdropClick') handleCloseSurrenderDialog(); }} 
      maxWidth="xs" 
      fullWidth
    >
      <DialogTitle sx={{ backgroundColor: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
        <KeyOffIcon /> Surrender Software License
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <DialogContentText sx={{ mb: 2, color: '#334155' }}>
          Warning: You are surrendering the software license from this device. Once surrendered, you will not be able to use the application without registering it again.
        </DialogContentText>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#0F3B66' }}>
          Please type <strong style={{ color: '#dc2626' }}>surrender</strong> to confirm:
        </Typography>
        <TextField
          autoFocus
          fullWidth
          size="small"
          variant="outlined"
          placeholder="Type 'surrender'"
          value={surrenderInput}
          onChange={(e) => setSurrenderInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && surrenderInput.toLowerCase() === 'surrender' && !surrendering) {
              handleConfirmSurrender();
            }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              '&.Mui-focused fieldset': {
                borderColor: surrenderInput.toLowerCase() === 'surrender' ? '#10b981' : '#dc2626',
              }
            }
          }}
        />
        {surrenderError && (
          <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '8px', fontWeight: '500' }}>
            {surrenderError}
          </div>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <Button 
          onClick={handleCloseSurrenderDialog} 
          color="inherit" 
          sx={{ fontWeight: 600 }}
          disabled={surrendering}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleConfirmSurrender} 
          variant="contained" 
          color="error" 
          disabled={surrenderInput.toLowerCase() !== 'surrender' || surrendering}
          sx={{ fontWeight: 600 }}
        >
          {surrendering ? 'Surrendering...' : 'Surrender'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  const backupDialog = (
    <Dialog 
      open={openBackupDialog} 
      onClose={(e, reason) => { if (reason !== 'backdropClick') handleCloseBackupDialog(); }} 
      maxWidth="xs" 
      fullWidth
    >
      <DialogTitle sx={{ backgroundColor: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
        <BackupIcon /> Download Database Excel Backup
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <DialogContentText sx={{ mb: 2, color: '#334155' }}>
          Export all system tables, configurations, and records into a Microsoft Excel (.xlsx) spreadsheet backup file.
        </DialogContentText>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#0F3B66' }}>
          Please type <strong style={{ color: '#059669' }}>backup</strong> to confirm:
        </Typography>
        <TextField
          autoFocus
          fullWidth
          size="small"
          variant="outlined"
          placeholder="Type 'backup'"
          value={backupInput}
          onChange={(e) => {
            setBackupInput(e.target.value);
            if (backupError) setBackupError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && backupInput.trim().toLowerCase() === 'backup' && !backupDownloading) {
              handleConfirmBackup();
            }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              '&.Mui-focused fieldset': {
                borderColor: backupInput.trim().toLowerCase() === 'backup' ? '#10b981' : '#0F3B66',
              }
            }
          }}
        />
        {backupError && (
          <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '8px', fontWeight: '500' }}>
            {backupError}
          </div>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <Button 
          onClick={handleCloseBackupDialog} 
          color="inherit" 
          sx={{ fontWeight: 600 }}
          disabled={backupDownloading}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleConfirmBackup} 
          variant="contained" 
          disabled={backupInput.trim().toLowerCase() !== 'backup' || backupDownloading}
          sx={{ 
            fontWeight: 600,
            bgcolor: '#10b981',
            '&:hover': { bgcolor: '#059669' },
            '&.Mui-disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' }
          }}
        >
          {backupDownloading ? 'Downloading...' : 'Download Backup'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onMobileClose}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 280,
              backgroundColor: '#051322',
              color: '#ffffff',
              borderRight: 'none',
              display: 'flex',
              flexDirection: 'column',
              overflowX: 'hidden'
            }
          }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            width: isCollapsed ? 68 : drawerWidth,
            flexShrink: 0,
            transition: 'width 0.3s ease',
            whiteSpace: 'nowrap',
            [`& .MuiDrawer-paper`]: { 
              width: isCollapsed ? 68 : drawerWidth, 
              transition: 'width 0.3s ease',
              boxSizing: 'border-box', 
              backgroundColor: '#051322',
              color: '#ffffff',
              borderRight: 'none', 
              display: 'flex', 
              flexDirection: 'column',
              overflowX: 'hidden'
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}
      {surrenderDialog}
      {backupDialog}
    </>
  );
};

export default Sidebar;
