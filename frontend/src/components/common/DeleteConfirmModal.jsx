import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogContentText, 
  DialogActions, 
  Button, 
  TextField,
  Typography,
  Box
} from '@mui/material';
import { WarningAmber as WarningIcon } from '@mui/icons-material';

const DeleteConfirmModal = ({ open, onClose, onConfirm, title = "Confirm Deletion", itemName = "this item" }) => {
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (open) {
      setConfirmText('');
    }
  }, [open]);

  const isConfirmed = confirmText.trim().toLowerCase() === 'delete';

  const handleConfirm = () => {
    if (isConfirmed) {
      onConfirm();
    }
  };

  return (
    <Dialog open={open} onClose={(event, reason) => { if (reason !== 'backdropClick') onClose(); }} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ backgroundColor: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon /> {title}
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <DialogContentText sx={{ mb: 2, color: '#334155' }}>
          Are you sure you want to delete <strong>{itemName}</strong>? This action cannot be undone.
        </DialogContentText>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#0F3B66' }}>
          Please type <strong style={{ color: '#dc2626' }}>delete</strong> to confirm:
        </Typography>
        <TextField
          autoFocus
          fullWidth
          size="small"
          variant="outlined"
          placeholder="Type 'delete' here..."
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && isConfirmed) {
              handleConfirm();
            }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              '&.Mui-focused fieldset': {
                borderColor: isConfirmed ? '#10b981' : '#dc2626',
              }
            }
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={onClose} color="inherit" sx={{ fontWeight: 600 }}>Cancel</Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained" 
          color="error" 
          disabled={!isConfirmed}
          sx={{ fontWeight: 600 }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmModal;
