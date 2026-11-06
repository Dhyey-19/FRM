import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Paper, 
  Tabs, 
  Tab 
} from '@mui/material';
import { 
  CallReceived as JwInIcon, 
  CallMade as JwOutIcon,
  PrecisionManufacturing as SubcontractIcon
} from '@mui/icons-material';
import JobworkInEntry from './JobworkInEntry';
import JobworkOutEntry from './JobworkOutEntry';

const Subcontract = ({ initialTab = 0 }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine initial tab from props or URL query (?tab=out or ?tab=1 or ?tab=in or ?tab=0)
  const tabParam = searchParams.get('tab');
  const getInitialTabIndex = () => {
    if (tabParam === 'out' || tabParam === '1') return 1;
    if (tabParam === 'in' || tabParam === '0') return 0;
    return initialTab;
  };

  const [activeTab, setActiveTab] = useState(getInitialTabIndex);

  useEffect(() => {
    if (tabParam === 'out' || tabParam === '1') {
      setActiveTab(1);
    } else if (tabParam === 'in' || tabParam === '0') {
      setActiveTab(0);
    }
  }, [tabParam]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setSearchParams({ tab: newValue === 1 ? 'out' : 'in' });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F3B66', display: 'flex', alignItems: 'center', gap: 1 }}>
            <SubcontractIcon sx={{ color: '#0F3B66' }} /> Sub-Contract
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
            Unified management for Subcontract IN and Subcontract OUT operations
          </Typography>
        </Box>
      </Box>

      {/* Tabs navigation */}
      <Paper sx={{ mb: 2.5, borderRadius: 2, bgcolor: '#ffffff', boxShadow: '0 2px 8px rgba(15, 59, 102, 0.06)' }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          textColor="inherit"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            px: { xs: 1, sm: 2 },
            borderBottom: '1px solid #e2e8f0',
            '& .MuiTabs-indicator': {
              backgroundColor: '#F88A01',
              height: 3,
              borderRadius: '3px 3px 0 0'
            },
            '& .MuiTab-root': {
              fontWeight: 700,
              fontSize: { xs: '0.84rem', sm: '0.92rem' },
              textTransform: 'none',
              py: { xs: 1.2, sm: 1.6 },
              px: { xs: 2, sm: 3 },
              minHeight: 48,
              color: '#64748b',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              '&.Mui-selected': {
                color: '#0F3B66'
              },
              '&:hover': {
                color: '#0F3B66',
                bgcolor: 'rgba(15, 59, 102, 0.03)'
              }
            }
          }}
        >
          <Tab 
            icon={<JwInIcon sx={{ color: activeTab === 0 ? '#10b981' : 'inherit' }} />} 
            iconPosition="start" 
            label="1: Subcontract IN" 
          />
          <Tab 
            icon={<JwOutIcon sx={{ color: activeTab === 1 ? '#3b82f6' : 'inherit' }} />} 
            iconPosition="start" 
            label="2: Subcontract OUT" 
          />
        </Tabs>
      </Paper>

      {/* Tab Panels: keep both mounted to preserve state/search across tab switches */}
      <Box sx={{ display: activeTab === 0 ? 'block' : 'none' }}>
        <JobworkInEntry hideTitle title="Subcontract IN" />
      </Box>
      <Box sx={{ display: activeTab === 1 ? 'block' : 'none' }}>
        <JobworkOutEntry hideTitle title="Subcontract OUT" />
      </Box>
    </Box>
  );
};

export default Subcontract;

