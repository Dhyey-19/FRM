import React, { useState, useEffect } from 'react';
import appLogo from '../../assets/app_logo.jpeg';
import { Box, CssBaseline, ThemeProvider, createTheme, Paper, Tooltip, IconButton, Breadcrumbs, Typography, Button } from '@mui/material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ArrowBack, ArrowForward, Home, GetApp as InstallIcon } from '@mui/icons-material';
import Sidebar from './Sidebar';

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

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <CssBaseline />
        
        {/* Side Navigation Drawer */}
        <Sidebar user={user} isCollapsed={isCollapsed} toggleSidebar={() => setIsCollapsed(!isCollapsed)} drawerWidth={drawerWidth} />
        
        {/* Main Content */}
        <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, transition: 'width 0.3s ease' }}>
          {/* Top Navigation Bar with Back & Forward buttons */}
          <Paper 
            elevation={0}
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              px: 2, 
              py: 0.85, 
              mb: 2.5, 
              borderRadius: 2, 
              bgcolor: '#ffffff', 
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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

              {/* Breadcrumb Navigation */}
              <Breadcrumbs separator="›" aria-label="breadcrumb" sx={{ fontSize: '0.85rem' }}>
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

            {/* PWA Install Button when browser supports install prompt */}
            {isInstallable && (
              <Button
                variant="contained"
                size="small"
                startIcon={<InstallIcon />}
                onClick={handleInstallClick}
                sx={{
                  bgcolor: '#0F3B66',
                  color: '#ffffff',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  borderRadius: 1.5,
                  px: 1.8,
                  py: 0.6,
                  boxShadow: '0 2px 4px rgba(15, 59, 102, 0.2)',
                  '&:hover': {
                    bgcolor: '#F88A01',
                    boxShadow: '0 3px 6px rgba(248, 138, 1, 0.3)'
                  }
                }}
              >
                Install App
              </Button>
            )}
          </Paper>

          <Outlet />
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default DashboardLayout;
