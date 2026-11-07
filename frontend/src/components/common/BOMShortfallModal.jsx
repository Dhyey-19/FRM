import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Chip, IconButton
} from '@mui/material';
import {
  Close as CloseIcon,
  AccountTree as BOMIcon,
  ShoppingCartCheckout as OrderIcon,
  Launch as LaunchIcon
} from '@mui/icons-material';
import BOMShortfallView from './BOMShortfallView';

const BOMShortfallModal = ({
  open,
  onClose,
  parentCode,
  parentSubCode = '',
  parentName = '',
  shortfallQty = 1,
  onOrderChildPart,
  onOpenBOMMaster,
  onNavigateToPI
}) => {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2.5,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle
        sx={{
          bgcolor: '#0F3B66',
          color: '#ffffff',
          py: 1.8,
          px: 2.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BOMIcon sx={{ fontSize: 28, color: '#93c5fd' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              BOM Component Breakup & Stock Shortfall
            </Typography>
            <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
              Detailed bill of materials child parts availability for FG Shortfall: <strong>{shortfallQty} units</strong>
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#ffffff' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 1.5, sm: 2.5 }, bgcolor: '#f8fafc' }}>
        <BOMShortfallView
          parentCode={parentCode}
          parentSubCode={parentSubCode}
          parentName={parentName}
          shortfallQty={shortfallQty}
          onOrderChildPart={onOrderChildPart}
          onOpenBOMMaster={onOpenBOMMaster}
        />
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: 'none', fontWeight: 600 }}>
          Close
        </Button>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {onNavigateToPI && (
            <Button
              variant="contained"
              color="warning"
              endIcon={<LaunchIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                onClose();
                onNavigateToPI();
              }}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Open PO Fulfillment & PI Planning
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default BOMShortfallModal;

