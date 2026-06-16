import React, { useState } from 'react';
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
  KeyOff as KeyOffIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 300;

const Sidebar = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState('');
  const [openSurrenderDialog, setOpenSurrenderDialog] = useState(false);
  const [surrenderInput, setSurrenderInput] = useState('');
  const [surrenderError, setSurrenderError] = useState('');
  const [surrendering, setSurrendering] = useState(false);

  const userRole = String(user?.role || '').toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userRole === 'ADMINISTRATOR';

  const handleAdminClick = () => {
    setOpenMenu(openMenu === 'admin' ? '' : 'admin');
  };

  const handleReportsClick = () => {
    setOpenMenu(openMenu === 'reports' ? '' : 'reports');
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
        [`& .MuiDrawer-paper`]: { 
          width: drawerWidth, 
          boxSizing: 'border-box', 
          backgroundColor: '#051322', // Deep Navy Dark Theme
          color: '#ffffff', // White text
          borderRight: 'none', 
          display: 'flex', 
          flexDirection: 'column' 
        },
      }}
    >
      <Box sx={{ py: 0.5, overflow: 'auto', flex: 1 }}>
        
        {/* Company Branding */}
        <Box sx={{ py: 0.5, p: 3, display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <img 
            src={user.companyLogo || appLogo} 
            alt="Logo" 
            style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid white' }} 
          />
          <Typography variant="h6" sx={{ py: 0.5, fontWeight: 700, letterSpacing: 0.5 }}>
            {user.companyName ? user.companyName.replace(' ERP', '') : 'FactoryFlow'}
          </Typography>
        </Box>

        {/* User Card */}
        <Box sx={{ py: 0.5, p: 2, display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Avatar sx={{ py: 0.5, width: 40, height: 40, bgcolor: '#F88A01', color: 'white', fontWeight: 600 }}>
            {(user.username || 'D')[0].toUpperCase()}
          </Avatar>
          <Box sx={{ py: 0.5, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <Typography variant="subtitle2" sx={{ py: 0.5, fontWeight: 600, lineHeight: 1.2 }}>
              {user.username || 'Dhyey Shah'}
            </Typography>
            <Typography variant="caption" sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }}>
              {user.role || 'Administrator'}
            </Typography>
          </Box>
          <IconButton 
            size="small" 
            onClick={() => {
              localStorage.removeItem('user');
              sessionStorage.removeItem('user');
              navigate('/');
            }}
            sx={{ color: '#ff8a8a', '&:hover': { bgcolor: 'rgba(255,138,138,0.1)' } }}
            title="Logout"
          >
            <Logout fontSize="small" />
          </IconButton>
        </Box>

        {/* Navigation Menu */}
        <List sx={{ py: 0.5, px: 2, pt: 1 }}>
          {/* Home */}
          <ListItem disablePadding sx={{ py: 0.5, mb: 0.2 }}>
            <ListItemButton 
              selected={isSelected('/dashboard')} 
              onClick={() => navigate('/dashboard')}
              sx={{ py: 0.5, borderRadius: 2, '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' } }}
            >
              <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                <DashboardIcon />
              </ListItemIcon>
              <ListItemText primary="Dashboard" primaryTypographyProps={{ fontWeight: isSelected('/dashboard') ? 600 : 400 }} />
            </ListItemButton>
          </ListItem>

          {/* Admin Nested Menu */}
          {isAdmin && (
            <>
              <ListItem disablePadding sx={{ py: 0.5, mb: 0.2 }}>
                <ListItemButton onClick={() => setOpenMenu(openMenu === 'admin' ? '' : 'admin')} sx={{ py: 0.5, borderRadius: 2 }}>
                  <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: 'rgba(255,255,255,0.7)' }}>
                    <AdminIcon />
                  </ListItemIcon>
                  <ListItemText primary="Administration" />
                  {openMenu === 'admin' ? <ExpandLess sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }} /> : <ExpandMore sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }} />}
                </ListItemButton>
              </ListItem>
              
              <Collapse in={openMenu === 'admin'} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  <ListItemButton 
                    selected={isSelected('/dashboard/company-profile')} 
                    onClick={() => navigate('/dashboard/company-profile')}
                    sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                      '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                    }}
                  >
                    <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/company-profile') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                      <SettingsIcon />
                    </ListItemIcon>
                    <ListItemText primary="Company Profile" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/company-profile') ? 600 : 400 }} />
                  </ListItemButton>

                  <ListItemButton 
                    selected={isSelected('/dashboard/users')} 
                    onClick={() => navigate('/dashboard/users')}
                    sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                      '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                    }}
                  >
                    <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/users') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                      <PeopleIcon />
                    </ListItemIcon>
                    <ListItemText primary="User Master" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/users') ? 600 : 400 }} />
                  </ListItemButton>

                  <ListItemButton 
                    selected={isSelected('/dashboard/assets')} 
                    onClick={() => navigate('/dashboard/assets')}
                    sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                      '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                    }}
                  >
                    <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/assets') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                      <InventoryIcon />
                    </ListItemIcon>
                    <ListItemText primary="Assets" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/assets') ? 600 : 400 }} />
                  </ListItemButton>

                  <ListItemButton 
                    onClick={() => setOpenSurrenderDialog(true)}
                    sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                      '&:hover': { bgcolor: 'rgba(255,138,138,0.15)', color: '#ff8a8a' }
                    }}
                  >
                    <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: '#ff8a8a' }}>
                      <KeyOffIcon />
                    </ListItemIcon>
                    <ListItemText primary="Surrender License" primaryTypographyProps={{ color: '#ff8a8a', fontWeight: 500 }} />
                  </ListItemButton>
                </List>
              </Collapse>
            </>
          )}

          {/* Inventory Masters Menu */}
          <ListItem disablePadding sx={{ py: 0.5, mb: 0.2 }}>
            <ListItemButton onClick={() => setOpenMenu(openMenu === 'inventoryMasters' ? '' : 'inventoryMasters')} sx={{ py: 0.5, borderRadius: 2 }}>
              <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: 'rgba(255,255,255,0.7)' }}>
                <InventoryIcon />
              </ListItemIcon>
              <ListItemText primary="Inventory Masters" />
              {openMenu === 'inventoryMasters' ? <ExpandLess sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }} /> : <ExpandMore sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }} />}
            </ListItemButton>
          </ListItem>
          
          <Collapse in={openMenu === 'inventoryMasters'} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              <ListItemButton 
                selected={isSelected('/dashboard/brands')} 
                onClick={() => navigate('/dashboard/brands')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/brands') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <BrandIcon />
                </ListItemIcon>
                <ListItemText primary="Series Master" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/brands') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/units')} 
                onClick={() => navigate('/dashboard/units')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/units') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <UnitIcon />
                </ListItemIcon>
                <ListItemText primary="Unit Master" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/units') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/item-types')} 
                onClick={() => navigate('/dashboard/item-types')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/item-types') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ItemIcon />
                </ListItemIcon>
                <ListItemText primary="Item Type" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/item-types') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/items')} 
                onClick={() => navigate('/dashboard/items')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/items') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ItemIcon />
                </ListItemIcon>
                <ListItemText primary="Item Master" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/items') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/bom')} 
                onClick={() => navigate('/dashboard/bom')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/bom') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <BOMIcon />
                </ListItemIcon>
                <ListItemText primary="BOM" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/bom') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/departments')} 
                onClick={() => navigate('/dashboard/departments')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/departments') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <DepartmentIcon />
                </ListItemIcon>
                <ListItemText primary="Departments" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/departments') ? 600 : 400 }} />
              </ListItemButton>
            </List>
          </Collapse>

          {/* Transactions Nested Menu */}
          <ListItem disablePadding sx={{ py: 0.5, mb: 0.2 }}>
            <ListItemButton onClick={() => setOpenMenu(openMenu === 'transactions' ? '' : 'transactions')} sx={{ py: 0.5, borderRadius: 2 }}>
              <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: 'rgba(255,255,255,0.7)' }}>
                <TransactionIcon />
              </ListItemIcon>
              <ListItemText primary="Transactions" />
              {openMenu === 'transactions' ? <ExpandLess sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }} /> : <ExpandMore sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }} />}
            </ListItemButton>
          </ListItem>
          
          <Collapse in={openMenu === 'transactions'} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              <ListItemButton 
                selected={isSelected('/dashboard/inwards')} 
                onClick={() => navigate('/dashboard/inwards')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/inwards') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ListIcon />
                </ListItemIcon>
                <ListItemText primary="Inward" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/inwards') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/outwards')} 
                onClick={() => navigate('/dashboard/outwards')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/outwards') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ListIcon />
                </ListItemIcon>
                <ListItemText primary="Outward" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/outwards') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/jobwork-outs')} 
                onClick={() => navigate('/dashboard/jobwork-outs')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/jobwork-outs') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ListIcon />
                </ListItemIcon>
                <ListItemText primary="Job Work Out" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/jobwork-outs') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/jobwork-ins')} 
                onClick={() => navigate('/dashboard/jobwork-ins')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/jobwork-ins') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ListIcon />
                </ListItemIcon>
                <ListItemText primary="Job Work In" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/jobwork-ins') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/stock-journal')} 
                onClick={() => navigate('/dashboard/stock-journal')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/stock-journal') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ListIcon />
                </ListItemIcon>
                <ListItemText primary="Stock Journal" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/stock-journal') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/stock-transfer')} 
                onClick={() => navigate('/dashboard/stock-transfer')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/stock-transfer') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ListIcon />
                </ListItemIcon>
                <ListItemText primary="Stock Transfer" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/stock-transfer') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/assembly')} 
                onClick={() => navigate('/dashboard/assembly')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/assembly') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <AssemblyIcon />
                </ListItemIcon>
                <ListItemText primary="Assembly" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/assembly') ? 600 : 400 }} />
              </ListItemButton>
            </List>
          </Collapse>

          {/* Accounts Nested Menu */}
          <ListItem disablePadding sx={{ py: 0.5, mb: 0.2 }}>
            <ListItemButton onClick={() => setOpenMenu(openMenu === 'accounts' ? '' : 'accounts')} sx={{ py: 0.5, borderRadius: 2 }}>
              <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: 'rgba(255,255,255,0.7)' }}>
                <AccountGroupIcon />
              </ListItemIcon>
              <ListItemText primary="Accounts & Finance" />
              {openMenu === 'accounts' ? <ExpandLess sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }} /> : <ExpandMore sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }} />}
            </ListItemButton>
          </ListItem>
          
          <Collapse in={openMenu === 'accounts'} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              <ListItemButton 
                selected={isSelected('/dashboard/account-groups')} 
                onClick={() => navigate('/dashboard/account-groups')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/account-groups') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <AccountGroupIcon />
                </ListItemIcon>
                <ListItemText primary="Account Group" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/account-groups') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/ledgers')} 
                onClick={() => navigate('/dashboard/ledgers')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/ledgers') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <PeopleIcon /> 
                </ListItemIcon>
                <ListItemText primary="Account Ledger" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/ledgers') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/vouchers')} 
                onClick={() => navigate('/dashboard/vouchers')}
                sx={{ py: 0.5, pl: 4, mb: 0.2, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: isSelected('/dashboard/vouchers') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <TransactionIcon /> 
                </ListItemIcon>
                <ListItemText primary="Vouchers" primaryTypographyProps={{ fontWeight: isSelected('/dashboard/vouchers') ? 600 : 400 }} />
              </ListItemButton>
            </List>
          </Collapse>

          {/* Reports Nested Menu */}
          <ListItem disablePadding sx={{ py: 0.5, mb: 0.2 }}>
            <ListItemButton onClick={() => setOpenMenu(openMenu === 'reports' ? '' : 'reports')} sx={{ py: 0.5, borderRadius: 2 }}>
              <ListItemIcon sx={{ py: 0.5, minWidth: 40, color: 'rgba(255,255,255,0.7)' }}>
                <ReportsIcon />
              </ListItemIcon>
              <ListItemText primary="Reports" />
              {openMenu === 'reports' ? <ExpandLess sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }} /> : <ExpandMore sx={{ py: 0.5, color: 'rgba(255,255,255,0.7)' }} />}
            </ListItemButton>
          </ListItem>
          
          <Collapse in={openMenu === 'reports'} timeout="auto" unmountOnExit>
            <List component="div" disablePadding sx={{ pb: 2 }}>
              
              {/* Category: Master Lists */}
              <Box sx={{ px: 3, pt: 1.5, pb: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#F88A01', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
                  Master Lists
                </Typography>
              </Box>
              
              <ListItemButton 
                selected={isSelected('/dashboard/reports/brands')} 
                onClick={() => navigate('/dashboard/reports/brands')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/brands') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ListIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Series List" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/brands') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/items')} 
                onClick={() => navigate('/dashboard/reports/items')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/items') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ListIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Item List" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/items') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/prices')} 
                onClick={() => navigate('/dashboard/reports/prices')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/prices') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ListIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Price" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/prices') ? 600 : 400 }} />
              </ListItemButton>

              {/* Category: Inventory & Production */}
              <Box sx={{ px: 3, pt: 1.5, pb: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#F88A01', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
                  Inventory & Production
                </Typography>
              </Box>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/stock')} 
                onClick={() => navigate('/dashboard/reports/stock')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/stock') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ListIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Stock" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/stock') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/bom')} 
                onClick={() => navigate('/dashboard/reports/bom')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/bom') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <BOMIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="BOM" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/bom') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/assembly')} 
                onClick={() => navigate('/dashboard/reports/assembly')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/assembly') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <AssemblyIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Assembly" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/assembly') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/stock-journal')} 
                onClick={() => navigate('/dashboard/reports/stock-journal')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/stock-journal') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ReportsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Stock Journal" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/stock-journal') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/jobwork-out')} 
                onClick={() => navigate('/dashboard/reports/jobwork-out')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/jobwork-out') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ReportsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Job Work Out" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/jobwork-out') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/jobwork-in')} 
                onClick={() => navigate('/dashboard/reports/jobwork-in')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/jobwork-in') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ReportsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Job Work In" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/jobwork-in') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/jobwork-stock')} 
                onClick={() => navigate('/dashboard/reports/jobwork-stock')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/jobwork-stock') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ReportsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Job Work Stock" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/jobwork-stock') ? 600 : 400 }} />
              </ListItemButton>

              {/* Category: Logistical Transactions */}
              <Box sx={{ px: 3, pt: 1.5, pb: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#F88A01', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
                  Purchase & Sales Log
                </Typography>
              </Box>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/inward')} 
                onClick={() => navigate('/dashboard/reports/inward')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/inward') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ReportsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Inward Log" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/inward') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/outward')} 
                onClick={() => navigate('/dashboard/reports/outward')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/outward') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ReportsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Outward Log" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/outward') ? 600 : 400 }} />
              </ListItemButton>

              {/* Category: Financial Statements */}
              <Box sx={{ px: 3, pt: 1.5, pb: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#F88A01', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
                  Financial Statements
                </Typography>
              </Box>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/account-ledger')} 
                onClick={() => navigate('/dashboard/reports/account-ledger')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/account-ledger') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ReportsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Account Ledger" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/account-ledger') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/trial-balance')} 
                onClick={() => navigate('/dashboard/reports/trial-balance')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/trial-balance') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ReportsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Trial Balance" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/trial-balance') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/receivable')} 
                onClick={() => navigate('/dashboard/reports/receivable')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/receivable') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ReportsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Receivable Summary" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/receivable') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/payable')} 
                onClick={() => navigate('/dashboard/reports/payable')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/payable') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ReportsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Payable Summary" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/payable') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/invoice-payable')} 
                onClick={() => navigate('/dashboard/reports/invoice-payable')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/invoice-payable') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ReportsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Inward Payable" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/invoice-payable') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/invoice-receivable')} 
                onClick={() => navigate('/dashboard/reports/invoice-receivable')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/invoice-receivable') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ReportsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Outward Receivable" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/invoice-receivable') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/profit-loss')} 
                onClick={() => navigate('/dashboard/reports/profit-loss')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/profit-loss') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ReportsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Profit & Loss" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/profit-loss') ? 600 : 400 }} />
              </ListItemButton>

              <ListItemButton 
                selected={isSelected('/dashboard/reports/balance-sheet')} 
                onClick={() => navigate('/dashboard/reports/balance-sheet')}
                sx={{ py: 0.3, pl: 4, mb: 0.1, borderRadius: 2,
                  '&.Mui-selected': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected('/dashboard/reports/balance-sheet') ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
                  <ReportsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Balance Sheet" primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected('/dashboard/reports/balance-sheet') ? 600 : 400 }} />
              </ListItemButton>
            </List>
          </Collapse>
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
