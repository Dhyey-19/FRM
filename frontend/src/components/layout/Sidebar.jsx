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
  Divider,
  IconButton,
  Tooltip
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
import TypedConfirmActionDialog from '../settings/TypedConfirmActionDialog';
import { downloadExcelBackup, surrenderSoftwareLicense } from '../../utils/systemActions';

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
  const [surrenderError, setSurrenderError] = useState('');
  const [surrendering, setSurrendering] = useState(false);

  const [openBackupDialog, setOpenBackupDialog] = useState(false);
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
    setBackupError('');
  };

  const handleCloseBackupDialog = () => {
    if (backupDownloading) return;
    setOpenBackupDialog(false);
    setBackupError('');
  };

  const handleConfirmBackup = async () => {
    setBackupDownloading(true);
    setBackupError('');
    try {
      await downloadExcelBackup();
      setOpenBackupDialog(false);
    } catch (err) {
      console.error('Backup error:', err);
      setBackupError(err.message || 'Failed to connect to server for backup.');
    } finally {
      setBackupDownloading(false);
    }
  };

  const handleCloseSurrenderDialog = () => {
    if (surrendering) return;
    setOpenSurrenderDialog(false);
    setSurrenderError('');
  };

  const handleConfirmSurrender = async () => {
    setSurrendering(true);
    setSurrenderError('');
    try {
      await surrenderSoftwareLicense();
    } catch (err) {
      console.error('Surrender error:', err);
      setSurrenderError(err.message || 'Failed to contact the backend server.');
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
          <Tooltip title="Expand Sidebar" placement="right" arrow>
            <IconButton onClick={toggleSidebar} sx={{ color: 'white', p: 0.5 }}>
              <MenuIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

        {/* Navigation Menu */}
        <List sx={{ py: 0.5, px: isCollapsed && !isMobile ? 0.8 : 2, pt: 1, overflowX: 'hidden' }}>
          {(() => {
            const hasMenuAccess = (path) => {
              if (!path || path === '/dashboard' || path === '/dashboard/tasks' || path === '/dashboard/settings') return true;

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
              const collapsedMode = isCollapsed && !isMobile;

              const buttonContent = (
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
                    px: collapsedMode ? 1 : 1.5,
                    pl: collapsedMode ? 1 : (level > 0 ? 4 : 1.5), 
                    justifyContent: collapsedMode ? 'center' : 'flex-start',
                    mb: level > 0 ? 0.1 : 0.2, 
                    borderRadius: 2,
                    '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                  }}
                >
                  <ListItemIcon sx={{ 
                    py: 0.5, 
                    minWidth: collapsedMode ? 'unset' : (level > 0 ? 32 : 40), 
                    justifyContent: 'center',
                    color: isSel ? '#ffffff' : 'rgba(255,255,255,0.6)' 
                  }}>
                    {item.icon}
                  </ListItemIcon>
                  {!collapsedMode && (
                    <ListItemText 
                      primary={item.title} 
                      primaryTypographyProps={{ 
                        fontSize: level > 0 ? '0.85rem' : '1rem',
                        fontWeight: isSel ? 600 : 400 
                      }} 
                    />
                  )}
                  {!collapsedMode && item.path && (
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); window.open('/#' + item.path, '_blank'); }} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#ffffff' } }} title="Open in new window">
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  )}
                </ListItemButton>
              );

              if (collapsedMode) {
                return (
                  <Tooltip key={item.path || item.title} title={item.title} placement="right" arrow>
                    {buttonContent}
                  </Tooltip>
                );
              }

              return buttonContent;
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
                  <React.Fragment key={section.title}>
                    {section.path === '/dashboard/settings' && (
                      <Divider sx={{ my: 0.75, borderColor: 'rgba(255,255,255,0.12)' }} />
                    )}
                    <ListItem disablePadding sx={{ py: 0.5, mb: 0.2 }}>
                      {renderMenuItem(section)}
                    </ListItem>
                  </React.Fragment>
                );
              }

              const collapsedMode = isCollapsed && !isMobile;

              const sectionButton = (
                <ListItemButton 
                  onClick={() => handleMenuClick(section.id)} 
                  sx={{ 
                    py: 0.5, 
                    px: collapsedMode ? 1 : 1.5,
                    justifyContent: collapsedMode ? 'center' : 'flex-start',
                    borderRadius: 2 
                  }}
                >
                  <ListItemIcon sx={{ 
                    py: 0.5, 
                    minWidth: collapsedMode ? 'unset' : 40, 
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.7)' 
                  }}>
                    {section.icon}
                  </ListItemIcon>
                  {!collapsedMode && <ListItemText primary={section.title} />}
                  {!collapsedMode && (openMenu === section.id ? <ExpandLess sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }} /> : <ExpandMore sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }} />)}
                </ListItemButton>
              );

              return (
                <React.Fragment key={section.id}>
                  <ListItem disablePadding sx={{ py: 0.5, mb: 0.2 }}>
                    {collapsedMode ? (
                      <Tooltip title={section.title} placement="right" arrow>
                        {sectionButton}
                      </Tooltip>
                    ) : (
                      sectionButton
                    )}
                  </ListItem>
                  
                  {!collapsedMode && (
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
                  )}
                </React.Fragment>
              );
            };

            return MENU_STRUCTURE.map(renderSection);
          })()}
        </List>
      </Box>
  );

  const surrenderDialog = (
    <TypedConfirmActionDialog
      open={openSurrenderDialog}
      onClose={handleCloseSurrenderDialog}
      onConfirm={handleConfirmSurrender}
      loading={surrendering}
      error={surrenderError}
      title="Surrender Software License"
      icon={<KeyOffIcon />}
      description="Warning: You are surrendering the software license from this device. Once surrendered, you will not be able to use the application without registering it again."
      confirmWord="surrender"
      confirmLabel="Surrender"
      loadingLabel="Surrendering..."
      headerBg="#fee2e2"
      titleColor="#b91c1c"
      accentColor="#dc2626"
      hoverColor="#b91c1c"
    />
  );

  const backupDialog = (
    <TypedConfirmActionDialog
      open={openBackupDialog}
      onClose={handleCloseBackupDialog}
      onConfirm={handleConfirmBackup}
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
