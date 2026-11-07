import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { Refresh as RefreshIcon, Home as HomeIcon, WarningAmber as WarningIcon } from '@mui/icons-material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.hash = '#/dashboard';
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box 
          sx={{ 
            minHeight: '60vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            p: 3
          }}
        >
          <Paper 
            sx={{ 
              maxWidth: 550, 
              width: '100%', 
              p: 4, 
              textAlign: 'center', 
              borderRadius: 3, 
              boxShadow: '0 8px 24px rgba(15, 59, 102, 0.08)',
              border: '1px solid #e2e8f0'
            }}
          >
            <WarningIcon sx={{ fontSize: 64, color: '#ef4444', mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
              Something went wrong
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
              An unexpected error occurred while rendering this page. You can try refreshing the page or navigate back to the dashboard.
            </Typography>

            {this.state.error && (
              <Box 
                sx={{ 
                  p: 1.5, 
                  mb: 3, 
                  bgcolor: '#fef2f2', 
                  borderRadius: 1.5, 
                  border: '1px solid #fee2e2',
                  textAlign: 'left',
                  maxHeight: 120,
                  overflowY: 'auto'
                }}
              >
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#b91c1c', display: 'block', wordBreak: 'break-word' }}>
                  {this.state.error.toString()}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleReload}
                sx={{ 
                  bgcolor: '#0F3B66', 
                  color: '#fff',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#0a2744' }
                }}
              >
                Reload Page
              </Button>
              <Button
                variant="outlined"
                startIcon={<HomeIcon />}
                onClick={this.handleGoHome}
                sx={{ 
                  borderColor: '#0F3B66', 
                  color: '#0F3B66',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#f1f5f9', borderColor: '#0F3B66' }
                }}
              >
                Go to Dashboard
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
