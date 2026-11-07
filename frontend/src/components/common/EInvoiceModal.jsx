import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, Tabs, Tab, TextField, Alert,
  Chip, CircularProgress, Divider, Paper, IconButton,
  Tooltip, Grid, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  ContentCopy as CopyIcon,
  UploadFile as UploadFileIcon,
  QrCode2 as QrCodeIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  OpenInNew as OpenInNewIcon,
  Cancel as CancelIcon,
  AssignmentTurnedIn as VerifiedIcon
} from '@mui/icons-material';
import QRCode from 'qrcode';

const EInvoiceModal = ({ open, onClose, invoice, onInvoiceUpdated }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exportData, setExportData] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Import form state
  const [importIrn, setImportIrn] = useState('');
  const [importAckNo, setImportAckNo] = useState('');
  const [importAckDate, setImportAckDate] = useState('');
  const [importSignedQRCode, setImportSignedQRCode] = useState('');

  // Cancel dialog state
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('1'); // 1 = Duplicate, 2 = Data Entry Error, 3 = Order Cancelled, 4 = Others
  const [cancelRemarks, setCancelRemarks] = useState('');

  // Canvas for QR display
  const qrCanvasRef = useRef(null);

  const invoiceId = invoice?.ID || invoice?.id || invoice?.OutwardHeaderId;
  const outwardNo = invoice?.OUTWARDNO || invoice?.outwardNo || '';
  const currentStatus = invoice?.EInvoiceStatus || invoice?.einvoiceStatus || (invoice?.IRN ? 'Generated' : 'Pending');

  // Load e-Invoice JSON payload whenever modal opens
  useEffect(() => {
    if (open && invoiceId) {
      fetchEInvoiceJSON();
      // If invoice already has IRN, default to Tab 2 (Details/QR) or Tab 0
      if (invoice?.IRN) {
        setActiveTab(2);
      } else {
        setActiveTab(0);
      }
      setErrorMessage('');
      setSuccessMessage('');
      setImportIrn(invoice?.IRN || '');
      setImportAckNo(invoice?.AckNo || '');
      setImportAckDate(invoice?.AckDate || '');
      setImportSignedQRCode(invoice?.SignedQRCode || '');
    }
  }, [open, invoiceId]);

  // Render QR Code onto canvas when Tab 2 is active or when invoice changes
  useEffect(() => {
    if (activeTab === 2 && qrCanvasRef.current && (invoice?.SignedQRCode || invoice?.IRN)) {
      const qrText = invoice.SignedQRCode || invoice.IRN || `IRN:${invoice.IRN}`;
      QRCode.toCanvas(qrCanvasRef.current, qrText, {
        width: 180,
        margin: 2,
        color: {
          dark: '#0F3B66',
          light: '#FFFFFF'
        }
      }, (error) => {
        if (error) console.error('Error drawing QR Code canvas:', error);
      });
    }
  }, [activeTab, invoice?.SignedQRCode, invoice?.IRN]);

  const fetchEInvoiceJSON = async () => {
    if (!invoiceId) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/einvoice/generate-json/${invoiceId}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to generate e-Invoice JSON');
      }
      setExportData(data);
    } catch (err) {
      console.error('Error generating JSON:', err);
      setErrorMessage(err.message || 'Error communicating with e-Invoice generator');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadJSON = () => {
    if (!exportData?.einvoiceJSON) return;
    const jsonString = JSON.stringify(exportData.einvoiceJSON, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NIC_INV01_${outwardNo || 'Invoice'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    if (!exportData?.einvoiceJSON) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData.einvoiceJSON, null, 2));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        // Handle various NIC response formats
        // Could be direct object { Irn: '...', AckNo: '...', AckDt: '...', SignedQRCode: '...' }
        // Or { response: { ... } } or array [ { ... } ]
        const resObj = Array.isArray(parsed) ? parsed[0] : (parsed.response || parsed.Data || parsed);

        const irn = resObj.Irn || resObj.IRN || resObj.irn || '';
        const ackNo = resObj.AckNo || resObj.ackNo || resObj.Ackno || '';
        const ackDate = resObj.AckDt || resObj.ackDt || resObj.AckDate || resObj.ackDate || '';
        const signedQR = resObj.SignedQRCode || resObj.signedQRCode || resObj.SignedQrCode || '';

        if (irn) setImportIrn(irn);
        if (ackNo) setImportAckNo(String(ackNo));
        if (ackDate) setImportAckDate(String(ackDate));
        if (signedQR) setImportSignedQRCode(signedQR);

        setSuccessMessage('Successfully parsed government response file. Click "Save e-Invoice" below.');
      } catch (err) {
        setErrorMessage('Failed to parse uploaded JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveImport = async () => {
    if (!invoiceId) return;
    if (!importIrn || importIrn.trim().length !== 64) {
      setErrorMessage('IRN must be a valid 64-character hexadecimal hash from the GST portal.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/einvoice/import-response/${invoiceId}`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          irn: importIrn.trim(),
          ackNo: importAckNo.trim(),
          ackDate: importAckDate.trim(),
          signedQRCode: importSignedQRCode.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save e-Invoice details');
      }

      setSuccessMessage('Government e-Invoice successfully saved and attached!');
      if (onInvoiceUpdated) {
        onInvoiceUpdated({
          ...invoice,
          IRN: importIrn.trim(),
          AckNo: importAckNo.trim(),
          AckDate: importAckDate.trim(),
          SignedQRCode: importSignedQRCode.trim(),
          EInvoiceStatus: 'Generated'
        });
      }
      setActiveTab(2); // Jump to details/QR tab
    } catch (err) {
      console.error('Import error:', err);
      setErrorMessage(err.message || 'Error saving e-Invoice details');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/einvoice/cancel/${invoiceId}`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancelReason,
          cancelRemarks
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to cancel e-Invoice');
      }

      setCancelOpen(false);
      setSuccessMessage('e-Invoice marked as Cancelled in ERP.');
      if (onInvoiceUpdated) {
        onInvoiceUpdated({
          ...invoice,
          EInvoiceStatus: 'Cancelled'
        });
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error cancelling e-Invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: '#0F3B66', color: '#fff', py: 1.5, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <QrCodeIcon sx={{ fontSize: 28 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              GST e-Invoice Government Utility (NIC INV-01)
            </Typography>
            <Typography variant="caption" sx={{ color: '#d0e2ff' }}>
              Invoice #{outwardNo} | Status: <Chip size="small" label={currentStatus} color={currentStatus === 'Generated' ? 'success' : currentStatus === 'Cancelled' ? 'error' : 'warning'} sx={{ height: 20, fontSize: '0.7rem', fontWeight: 'bold' }} />
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#fff' }} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#f8fafc', px: 2 }}>
        <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} textColor="primary" indicatorColor="primary">
          <Tab label="1. Export Government JSON" sx={{ fontWeight: 600, textTransform: 'none' }} />
          <Tab label="2. Import IRN & QR Code" sx={{ fontWeight: 600, textTransform: 'none' }} />
          {invoice?.IRN && (
            <Tab label="3. e-Invoice Details & QR" sx={{ fontWeight: 600, textTransform: 'none' }} />
          )}
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage('')}>
            {errorMessage}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
            {successMessage}
          </Alert>
        )}

        {/* TAB 0: EXPORT GOVERNMENT JSON */}
        {activeTab === 0 && (
          <Box>
            {loading ? (
              <Box sx={{ py: 6, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 2 }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">Generating official NIC INV-01 payload...</Typography>
              </Box>
            ) : (
              <Box>
                {/* Validation Status Cards */}
                {exportData && (
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <VerifiedIcon color={exportData.isValid ? 'success' : 'error'} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                        Schema Validation: {exportData.isValid ? 'Ready for Government Portal' : 'Action Required Before Upload'}
                      </Typography>
                    </Box>

                    {exportData.errors && exportData.errors.length > 0 && (
                      <Alert severity="error" sx={{ mb: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Please fix the following schema errors:</Typography>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {exportData.errors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                      </Alert>
                    )}

                    {exportData.warnings && exportData.warnings.length > 0 && (
                      <Alert severity="warning" sx={{ mb: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Notices / Auto-Defaults Applied:</Typography>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {exportData.warnings.map((warn, i) => <li key={i}>{warn}</li>)}
                        </ul>
                      </Alert>
                    )}
                  </Box>
                )}

                {/* Step-by-step instructions */}
                <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f0f7ff', borderColor: '#b3d7ff' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
                    How to Submit to Official GST e-Invoice Portal:
                  </Typography>
                  <Box component="ol" sx={{ pl: 2.5, m: 0, '& li': { mb: 0.5, fontSize: '0.85rem' } }}>
                    <li>Click <strong>Download INV-01 JSON</strong> below to get the official schema file.</li>
                    <li>Open official portal <a href="https://einvoice1.gst.gov.in" target="_blank" rel="noreferrer" style={{ color: '#0F3B66', fontWeight: 600 }}>einvoice1.gst.gov.in</a> and login.</li>
                    <li>Navigate to <strong>e-Invoice &gt; Bulk Upload</strong> and upload this JSON file.</li>
                    <li>The government portal generates the signed <strong>IRN, Ack No, and QR Code</strong>.</li>
                    <li>Switch to the <strong>2. Import IRN & QR Code</strong> tab to attach the response to this invoice!</li>
                  </Box>
                </Paper>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadJSON}
                    disabled={!exportData?.einvoiceJSON}
                    sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#0a2744' }, fontWeight: 600 }}
                  >
                    Download INV-01 JSON
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CopyIcon />}
                    onClick={handleCopyToClipboard}
                    disabled={!exportData?.einvoiceJSON}
                    color={copySuccess ? 'success' : 'primary'}
                    sx={{ fontWeight: 600 }}
                  >
                    {copySuccess ? 'Copied to Clipboard!' : 'Copy JSON Payload'}
                  </Button>
                  <Button
                    variant="text"
                    endIcon={<OpenInNewIcon />}
                    href="https://einvoice1.gst.gov.in"
                    target="_blank"
                    rel="noreferrer"
                    sx={{ color: '#0F3B66', ml: 'auto', fontWeight: 600 }}
                  >
                    Open GST e-Invoice Portal
                  </Button>
                </Box>

                {/* JSON Preview Accordion / Box */}
                {exportData?.einvoiceJSON && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                      Raw INV-01 JSON Preview (NIC Schema 1.1)
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        bgcolor: '#1e1e1e',
                        color: '#d4d4d4',
                        fontFamily: 'Consolas, monospace',
                        fontSize: '0.75rem',
                        maxHeight: 220,
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}
                    >
                      {JSON.stringify(exportData.einvoiceJSON, null, 2)}
                    </Paper>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}

        {/* TAB 1: IMPORT IRN & QR CODE */}
        {activeTab === 1 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload the response JSON downloaded from <strong>einvoice1.gst.gov.in</strong>, or paste the IRN and QR code details returned by the portal:
            </Typography>

            {/* Quick File Drop/Selector */}
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                mb: 3,
                borderStyle: 'dashed',
                borderWidth: 2,
                borderColor: '#90caf9',
                textAlign: 'center',
                bgcolor: '#fafbfc'
              }}
            >
              <UploadFileIcon sx={{ fontSize: 36, color: '#0F3B66', mb: 1 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Upload Portal Response File (.json)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Directly extracts IRN, Ack No, Ack Date, and Signed QR string
              </Typography>
              <Button
                variant="outlined"
                component="label"
                size="small"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Choose File
                <input type="file" accept=".json" hidden onChange={handleFileUpload} />
              </Button>
            </Paper>

            <Divider sx={{ mb: 3 }}>
              <Typography variant="caption" color="text.secondary">OR ENTER / EDIT MANUALLY</Typography>
            </Divider>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Invoice Reference Number (IRN)"
                  placeholder="64-character hash (e.g., 3b8908f7fbe6b0a1...)"
                  value={importIrn}
                  onChange={(e) => setImportIrn(e.target.value)}
                  helperText={`${importIrn.length}/64 characters`}
                  error={importIrn.length > 0 && importIrn.length !== 64}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Acknowledgement No (Ack No)"
                  placeholder="e.g. 112612345678901"
                  value={importAckNo}
                  onChange={(e) => setImportAckNo(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Acknowledgement Date (Ack Date)"
                  placeholder="e.g. 2026-10-18 14:32:00"
                  value={importAckDate}
                  onChange={(e) => setImportAckDate(e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  size="small"
                  label="Signed QR Code String"
                  placeholder="Signed QR text string provided by GST portal..."
                  value={importSignedQRCode}
                  onChange={(e) => setImportSignedQRCode(e.target.value)}
                  helperText="Used to generate official scannable GST QR code on Tax Invoice PDF"
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="contained"
                onClick={handleSaveImport}
                disabled={loading || !importIrn || importIrn.trim().length !== 64}
                sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#0a2744' }, fontWeight: 600, px: 3 }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Save e-Invoice to ERP'}
              </Button>
            </Box>
          </Box>
        )}

        {/* TAB 2: e-INVOICE DETAILS & QR CODE */}
        {activeTab === 2 && invoice?.IRN && (
          <Box>
            <Paper variant="outlined" sx={{ p: 2.5, bgcolor: '#f8fafc', mb: 3 }}>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} sm={4} sx={{ textAlign: 'center' }}>
                  <Box sx={{ p: 1.5, bgcolor: '#fff', display: 'inline-block', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <canvas ref={qrCanvasRef} style={{ display: 'block' }} />
                  </Box>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary', fontWeight: 600 }}>
                    Official Scannable GST QR
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={8}>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                      IRN (Invoice Reference Number)
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'Consolas, monospace',
                        bgcolor: '#eef2f6',
                        p: 1,
                        borderRadius: 1,
                        fontSize: '0.8rem',
                        wordBreak: 'break-all',
                        fontWeight: 600,
                        color: '#0F3B66'
                      }}
                    >
                      {invoice.IRN}
                    </Typography>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Ack No:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {invoice.AckNo || '—'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Ack Date:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {invoice.AckDate || '—'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Status:
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <Chip
                          size="small"
                          label={invoice.EInvoiceStatus || 'Generated'}
                          color={invoice.EInvoiceStatus === 'Cancelled' ? 'error' : 'success'}
                          sx={{ fontWeight: 'bold' }}
                        />
                      </Box>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </Paper>

            {invoice.EInvoiceStatus !== 'Cancelled' && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={() => setCancelOpen(true)}
                  sx={{ fontWeight: 600 }}
                >
                  Cancel e-Invoice
                </Button>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Close
        </Button>
      </DialogActions>

      {/* Cancel e-Invoice Subdialog */}
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: '#d32f2f', fontWeight: 'bold' }}>
          Cancel e-Invoice
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Are you sure you want to cancel e-Invoice for <strong>#{outwardNo}</strong>?
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Cancellation Reason</InputLabel>
            <Select
              value={cancelReason}
              label="Cancellation Reason"
              onChange={(e) => setCancelReason(e.target.value)}
            >
              <MenuItem value="1">1 - Duplicate Entry</MenuItem>
              <MenuItem value="2">2 - Data Entry Error</MenuItem>
              <MenuItem value="3">3 - Order Cancelled</MenuItem>
              <MenuItem value="4">4 - Others</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            size="small"
            label="Remarks (optional)"
            value={cancelRemarks}
            onChange={(e) => setCancelRemarks(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOpen(false)}>Back</Button>
          <Button onClick={handleConfirmCancel} variant="contained" color="error">
            Confirm Cancellation
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default EInvoiceModal;
