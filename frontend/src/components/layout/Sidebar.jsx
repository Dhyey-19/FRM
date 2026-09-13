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
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { MENU_STRUCTURE } from '../../config/menuConfig';

const Sidebar = ({ user, isCollapsed, toggleSidebar, drawerWidth = 300 }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState('');
  const [openSurrenderDialog, setOpenSurrenderDialog] = useState(false);
  const [surrenderInput, setSurrenderInput] = useState('');
  const [surrenderError, setSurrenderError] = useState('');
  const [surrendering, setSurrendering] = useState(false);

  const userRole = String(user?.role || user?.UserRole || '').toUpperCase();
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

  const handleBackup = async () => {
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
        let filename = 'Factory Flow Backup.xlsx';
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
      } else {
        alert('Failed to download backup');
      }
    } catch (err) {
      console.error('Backup error:', err);
      alert('Failed to connect to server for backup');
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

  const isSelected = (path) => location.pathname === path;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        transition: 'width 0.3s ease',
        whiteSpace: 'nowrap',
        [`& .MuiDrawer-paper`]: { 
          width: drawerWidth, 
          transition: 'width 0.3s ease',
          boxSizing: 'border-box', 
          backgroundColor: '#051322', // Deep Navy Dark Theme
          color: '#ffffff', // White text
          borderRight: 'none', 
          display: 'flex', 
          flexDirection: 'column',
          overflowX: 'hidden'
        },
      }}
    >
      <Box sx={{ py: 0.5, overflow: 'auto', flex: 1 }}>
        
        {/* Company Branding */}
        <Box sx={{ p: isCollapsed ? 1 : 3, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {isCollapsed ? (
            <img 
              src={user.companyLogo || appLogo} 
              alt="Logo" 
              style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid white' }} 
            />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <img 
                src={user.companyLogo || appLogo} 
                alt="Logo" 
                style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid white' }} 
              />
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                {user.companyName ? user.companyName.replace(' ERP', '') : 'FactoryFlow'}
              </Typography>
            </Box>
          )}
        </Box>

        {/* User Card */}
        <Box sx={{ p: isCollapsed ? 1 : 2, display: 'flex', flexDirection: isCollapsed ? 'column' : 'row', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <AccountCircleIcon sx={{ fontSize: isCollapsed ? 32 : 40, color: '#F88A01' }} />
          {!isCollapsed ? (
            <>
              <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.username || 'Dhyey Shah'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                  {user.role || 'Administrator'}
                </Typography>
              </Box>
              <IconButton onClick={toggleSidebar} sx={{ color: 'white', p: 0.5 }}>
                <MenuOpenIcon fontSize="small" />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={() => {
                  localStorage.removeItem('user');
                  sessionStorage.removeItem('user');
                  navigate('/');
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
              if (isAdmin) return true;
              if (!path || path === '/dashboard') return true;
              
              const menus = (user?.AllowedMenus !== undefined && user?.AllowedMenus !== null)
                ? user.AllowedMenus
                : (JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {}).AllowedMenus;

              if (!menus) return false;
              
              const allowed = Array.isArray(menus)
                ? menus
                : String(menus).split(',').map(p => p.trim());
                
              return allowed.includes(path);
            };

            const renderMenuItem = (item, level = 0) => {
              if (item.adminOnly && !isAdmin) return null;
              if (item.path && !hasMenuAccess(item.path)) return null;

              const isSel = isSelected(item.path);

              return (
                <ListItemButton 
                  key={item.path || item.title}
                  selected={isSel} 
                  onClick={() => item.path ? navigate(item.path) : null}
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
                  {!isCollapsed && item.path && (
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

              if (!isAdmin && !section.path && visibleChildren.length === 0 && section.id !== 'admin') {
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
                          <ListItemButton onClick={handleBackup} sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                            <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: '#4caf50' }}><BackupIcon /></ListItemIcon>
                            <ListItemText primary="Backup Database" primaryTypographyProps={{ color: '#4caf50', fontWeight: 500 }} />
                          </ListItemButton>
                          <ListItemButton onClick={() => setOpenSurrenderDialog(true)} sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,138,138,0.15)', color: '#ff8a8a' } }}>
                            <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: '#ff8a8a' }}><KeyOffIcon /></ListItemIcon>
                            <ListItemText primary="Surrender License" primaryTypographyProps={{ color: '#ff8a8a', fontWeight: 500 }} />
                          </ListItemButton>
                        </>
                      )}

                      {section.groups && section.groups.map(group => {
                        const visibleGroupChildren = group.children.filter(child => isAdmin || hasMenuAccess(child.path));
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

      {/* Surrender License Confirmation Dialog */}
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
    </Drawer>
  );
};

export default Sidebar;
