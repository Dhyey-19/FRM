import React, { useState, useEffect } from 'react';
import appLogo from '../../assets/app_logo.jpeg';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Outlet } from 'react-router-dom';
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
  },
});

const DashboardLayout = () => {
  const [localUser, setLocalUser] = useState(() => JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const drawerWidth = isCollapsed ? 70 : 300;

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/company-profile`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.CompanyName) {
            const current = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
            if (current.companyName !== data.CompanyName) {
              current.companyName = data.CompanyName;
              localStorage.setItem('user', JSON.stringify(current));
              setLocalUser(current);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching company profile in layout:', err);
      }
    };
    fetchCompany();
  }, []);

  const user = {
    username: localUser.Username || 'Dhyey Shah',
    role: localUser.UserRole || 'Administrator',
    companyName: localUser.companyName || 'FactoryFlow',
    companyLogo: localUser.companyLogo || appLogo
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <CssBaseline />
        
        {/* Side Navigation Drawer */}
        <Sidebar user={user} isCollapsed={isCollapsed} toggleSidebar={() => setIsCollapsed(!isCollapsed)} drawerWidth={drawerWidth} />
        
        {/* Main Content */}
        <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, transition: 'width 0.3s ease' }}>
          <Outlet />
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default DashboardLayout;
