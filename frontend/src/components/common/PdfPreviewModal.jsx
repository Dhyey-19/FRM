import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Box, Typography, Button } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

const PdfPreviewModal = ({ open, onClose, pdfUrl, title = 'Document Preview' }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ backgroundColor: '#0F3B66', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button 
            variant="contained" 
            size="small"
            sx={{ mr: 2, backgroundColor: 'white', color: '#0F3B66', fontWeight: 600, '&:hover': { backgroundColor: '#e2e8f0' } }}
            onClick={() => {
              const iframe = document.getElementById('pdf-preview-iframe');
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.print();
              }
            }}
          >
            Print
          </Button>
          <IconButton onClick={onClose} sx={{ color: 'white' }} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0, height: '80vh', backgroundColor: '#f1f5f9' }}>
        {pdfUrl ? (
          <iframe 
            id="pdf-preview-iframe"
            src={pdfUrl} 
            width="100%" 
            height="100%" 
            style={{ border: 'none' }}
            title="PDF Preview"
          />
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography>No PDF content to preview</Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PdfPreviewModal;
