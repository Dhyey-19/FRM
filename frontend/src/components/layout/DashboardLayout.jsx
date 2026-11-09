import React, { useState, useEffect } from 'react';
import appLogo from '../../assets/app_logo.jpeg';
import { 
  Box, 
  CssBaseline, 
  ThemeProvider, 
  createTheme, 
  Paper, 
  Tooltip, 
  IconButton, 
  Breadcrumbs, 
  Typography, 
  Button,
  useMediaQuery 
} from '@mui/material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowBack, 
  ArrowForward, 
  Home, 
  GetApp as InstallIcon,
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  SystemUpdateAlt as UpdateIcon
} from '@mui/icons-material';
import Sidebar from './Sidebar';
import ErrorBoundary from '../common/ErrorBoundary';

// Create a custom MUI theme matching the requested colors
const theme = createTheme({
  palette: {
    primary: {
      main: '#0F3B66',
    },
    secondary: {
      main: '#F88A01',
    },
    background: {
      default: '#f4f7f9',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiIconButton: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'transparent',
          },
        },
      },
    },
    MuiListItemButton: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'transparent',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          height: '32px',
          minHeight: '32px',
          '&.MuiTableRow-head': {
            height: '34px',
            minHeight: '34px',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '3px 8px',
          fontSize: '0.84rem',
        },
        head: {
          padding: '5px 8px',
          fontWeight: 700,
          fontSize: '0.85rem',
        },
        sizeSmall: {
          padding: '2px 8px',
          fontSize: '0.83rem',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          '&.MuiInputLabel-shrink': {
            backgroundColor: '#ffffff',
            padding: '0 4px',
            zIndex: 2,
            borderRadius: '2px'
          }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& input[type="date"]': {
            minHeight: '1.4375em'
          }
        }
      }
    },
    MuiDataGrid: {
      defaultProps: {
        rowHeight: 32,
        columnHeaderHeight: 34,
      },
      styleOverrides: {
        root: {
          fontSize: '0.84rem',
          '& .MuiDataGrid-row': {
            minHeight: '32px !important',
            maxHeight: '32px !important',
            height: '32px !important',
          },
          '& .MuiDataGrid-cell': {
            padding: '0 8px',
            lineHeight: '32px',
            minHeight: '32px !important',
            maxHeight: '32px !important',
          },
          '& .MuiDataGrid-columnHeader': {
            padding: '0 8px',
            minHeight: '34px !important',
            maxHeight: '34px !important',
            height: '34px !important',
          },
        },
      },
    },
  },
});

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [localUser, setLocalUser] = useState(() => JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const drawerWidth = isCollapsed ? 70 : 300;

  useEffect(() => {
    const handleStorage = () => {
      setLocalUser(JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {});
    };
    window.addEventListener('storage', handleStorage);

    const fetchCompany = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/company-profile`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.CompanyName) {
            const current = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
            if (current.companyName !== data.CompanyName) {
              current.companyName = data.CompanyName;
              if (localStorage.getItem('user')) {
                localStorage.setItem('user', JSON.stringify(current));
              } else if (sessionStorage.getItem('user')) {
                sessionStorage.setItem('user', JSON.stringify(current));
              }
              setLocalUser(current);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching company profile in layout:', err);
      }
    };
    fetchCompany();

    // Sync logged in user permissions from backend to make sure menu and access permissions are always up to date
    const syncUser = async () => {
      try {
        const current = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
        if (current.UserId) {
          const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/users/${current.UserId}`);
          if (res.ok) {
            const freshUser = await res.json();
            if (freshUser && freshUser.UserId) {
              const merged = { ...current, ...freshUser };
              if (localStorage.getItem('user')) {
                localStorage.setItem('user', JSON.stringify(merged));
              } else if (sessionStorage.getItem('user')) {
                sessionStorage.setItem('user', JSON.stringify(merged));
              }
              setLocalUser(merged);
            }
          }
        }
      } catch (err) {
        console.error('Error syncing user permissions:', err);
      }
    };
    syncUser();

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // PWA Installation prompt listener
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('[PWA] App installed successfully');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  const user = {
    ...localUser,
    username: localUser.Username || localUser.username || 'Dhyey Shah',
    role: localUser.UserRole || localUser.role || 'Administrator',
    AllowedMenus: localUser.AllowedMenus,
    companyName: localUser.companyName || 'FRM',
    companyLogo: localUser.companyLogo || appLogo
  };

  const formatSegment = (seg) => {
    return seg
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  const pathParts = location.pathname.split('/').filter(Boolean).filter(p => p !== 'dashboard');

  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleDrawerToggle = () => setMobileOpen(prev => !prev);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
        <CssBaseline />
        
        {/* Side Navigation Drawer */}
        <Sidebar 
          user={user} 
          isCollapsed={isCollapsed} 
          toggleSidebar={() => setIsCollapsed(!isCollapsed)} 
          drawerWidth={drawerWidth}
          isMobile={isMobile}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        
        {/* Main Content */}
        <Box 
          component="main" 
          sx={{ 
            flexGrow: 1, 
            p: { xs: 1.5, sm: 2, md: 3 }, 
            width: { xs: '100%', md: isCollapsed ? 'calc(100% - 68px)' : `calc(100% - ${drawerWidth}px)` }, 
            maxWidth: '100vw',
            overflowX: 'hidden',
            transition: 'width 0.3s ease, margin 0.3s ease' 
          }}
        >
          {/* Top Navigation Bar with Back & Forward buttons */}
          <Paper 
            elevation={0}
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              px: { xs: 1.5, sm: 2 }, 
              py: 0.85, 
              mb: { xs: 2, sm: 2.5 }, 
              borderRadius: 2, 
              bgcolor: '#ffffff', 
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, overflow: 'hidden' }}>
              {/* Mobile Hamburger Menu Toggle */}
              <Tooltip title="Navigation Menu">
                <IconButton 
                  size="small" 
                  onClick={handleDrawerToggle}
                  sx={{ 
                    display: { xs: 'flex', md: 'none' },
                    color: '#0F3B66', 
                    bgcolor: '#f1f5f9', 
                    border: '1px solid #cbd5e1',
                    borderRadius: 1.5,
                    p: 0.7,
                    '&:hover': { bgcolor: '#e2e8f0', color: '#F88A01' } 
                  }}
                  aria-label="Open navigation menu"
                >
                  <MenuIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              {/* Mobile Logo Brand */}
              <Box 
                onClick={() => navigate('/dashboard')}
                sx={{ 
                  display: { xs: 'flex', md: 'none' }, 
                  alignItems: 'center', 
                  gap: 0.8, 
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <img 
                  src={user.companyLogo || appLogo} 
                  alt="FRM" 
                  style={{ width: 26, height: 26, borderRadius: '50%' }} 
                />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F3B66', letterSpacing: 0.5 }}>
                  FRM
                </Typography>
              </Box>

              {/* Desktop / Tablet Back & Forward buttons */}
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
                <Tooltip title="Back">
                  <span>
                    <IconButton 
                      size="small" 
                      onClick={() => navigate(-1)}
                      sx={{ 
                        color: '#0F3B66', 
                        bgcolor: '#f1f5f9', 
                        border: '1px solid #cbd5e1',
                        borderRadius: 1.5,
                        p: 0.7,
                        '&:hover': { bgcolor: '#e2e8f0', color: '#0F3B66' } 
                      }}
                    >
                      <ArrowBack fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip title="Forward">
                  <span>
                    <IconButton 
                      size="small" 
                      onClick={() => navigate(1)}
                      sx={{ 
                        color: '#0F3B66', 
                        bgcolor: '#f1f5f9', 
                        border: '1px solid #cbd5e1',
                        borderRadius: 1.5,
                        p: 0.7,
                        '&:hover': { bgcolor: '#e2e8f0', color: '#0F3B66' } 
                      }}
                    >
                      <ArrowForward fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              {/* Mobile Compact Page Title */}
              <Box sx={{ display: { xs: 'block', sm: 'none' }, overflow: 'hidden' }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F3B66', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                  {pathParts.length > 0 ? formatSegment(pathParts[pathParts.length - 1]) : 'Dashboard'}
                </Typography>
              </Box>

              {/* Tablet & Desktop Breadcrumb Navigation */}
              <Breadcrumbs 
                separator="›" 
                aria-label="breadcrumb" 
                sx={{ 
                  fontSize: '0.85rem',
                  display: { xs: 'none', sm: 'flex' } 
                }}
              >
                <Box 
                  onClick={() => navigate('/dashboard')} 
                  sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748b', '&:hover': { color: '#0F3B66' } }}
                >
                  <Home sx={{ fontSize: 16 }} /> Dashboard
                </Box>
                {pathParts.map((part, index) => {
                  const isLast = index === pathParts.length - 1;
                  return isLast ? (
                    <Typography key={part} sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F3B66' }}>
                      {formatSegment(part)}
                    </Typography>
                  ) : (
                    <Typography key={part} sx={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {formatSegment(part)}
                    </Typography>
                  );
                })}
              </Breadcrumbs>
            </Box>

            {/* Top Bar Right Actions: Global Alerts Bell & PWA Install Button */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Application Update & Backup">
                <IconButton 
                  size="small" 
                  onClick={() => navigate('/dashboard/system-maintenance')}
                  sx={{ 
                    color: '#0F3B66', 
                    bgcolor: '#f1f5f9', 
                    border: '1px solid #cbd5e1',
                    borderRadius: 1.5,
                    p: 0.7,
                    '&:hover': { bgcolor: '#e2e8f0', color: '#F88A01' } 
                  }}
                >
                  <UpdateIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Notifications & Alert Logs">
                <IconButton 
                  size="small" 
                  onClick={() => navigate('/dashboard/logs')}
                  sx={{ 
                    color: '#0F3B66', 
                    bgcolor: '#f1f5f9', 
                    border: '1px solid #cbd5e1',
                    borderRadius: 1.5,
                    p: 0.7,
                    '&:hover': { bgcolor: '#e2e8f0', color: '#F88A01' } 
                  }}
                >
                  <NotificationsIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              {isInstallable && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<InstallIcon fontSize="small" />}
                  onClick={handleInstallClick}
                  sx={{
                    bgcolor: '#0F3B66',
                    color: '#ffffff',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    borderRadius: 1.5,
                    px: { xs: 1.2, sm: 1.8 },
                    py: 0.6,
                    boxShadow: '0 2px 4px rgba(15, 59, 102, 0.2)',
                    '&:hover': {
                      bgcolor: '#F88A01',
                      boxShadow: '0 3px 6px rgba(248, 138, 1, 0.3)'
                    }
                  }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Install App</Box>
                  <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Install</Box>
                </Button>
              )}
            </Box>
          </Paper>

          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default DashboardLayout;
