import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Typography,
  Button,
  Box
} from '@mui/material';

/**
 * Reusable typed-phrase confirmation modal (e.g. type "backup" or "surrender").
 */
const TypedConfirmActionDialog = ({
  open,
  onClose,
  onConfirm,
  loading = false,
  error = '',
  title,
  icon,
  description,
  confirmWord,
  confirmLabel,
  loadingLabel,
  headerBg = '#f8fafc',
  titleColor = '#0F3B66',
  accentColor = '#0F3B66',
  hoverColor
}) => {
  const [inputValue, setInputValue] = useState('');
  const [localError, setLocalError] = useState('');

  const target = String(confirmWord || '').trim().toLowerCase();
  const isMatch = inputValue.trim().toLowerCase() === target;
  const displayError = localError || error;

  const resetFields = () => {
    setInputValue('');
    setLocalError('');
  };

  const handleClose = () => {
    if (loading) return;
    resetFields();
    onClose();
  };

  const handleSubmit = () => {
    if (!isMatch) {
      setLocalError(`Please type '${confirmWord}' to confirm.`);
      return;
    }
    setLocalError('');
    onConfirm();
  };

  return (
    <Dialog
      open={open}
      onClose={(e, reason) => {
        if (reason !== 'backdropClick') handleClose();
      }}
      slotProps={{ transition: { onExited: resetFields } }}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle
        sx={{
          backgroundColor: headerBg,
          color: titleColor,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          fontWeight: 'bold'
        }}
      >
        {icon} {title}
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <DialogContentText sx={{ mb: 2, color: '#334155' }}>
          {description}
        </DialogContentText>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#0F3B66' }}>
          Please type <strong style={{ color: accentColor }}>{confirmWord}</strong> to confirm:
        </Typography>
        <TextField
          autoFocus
          fullWidth
          size="small"
          variant="outlined"
          placeholder={`Type '${confirmWord}'`}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (localError) setLocalError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && isMatch && !loading) {
              handleSubmit();
            }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              '&.Mui-focused fieldset': {
                borderColor: isMatch ? '#10b981' : accentColor
              }
            }
          }}
        />
        {displayError && (
          <Box sx={{ color: '#ef4444', fontSize: '0.85rem', mt: 1, fontWeight: 500 }}>
            {displayError}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={handleClose} color="inherit" sx={{ fontWeight: 600 }} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isMatch || loading}
          sx={{
            fontWeight: 600,
            bgcolor: accentColor,
            '&:hover': { bgcolor: hoverColor || accentColor },
            '&.Mui-disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' }
          }}
        >
          {loading ? (loadingLabel || 'Processing...') : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TypedConfirmActionDialog;
