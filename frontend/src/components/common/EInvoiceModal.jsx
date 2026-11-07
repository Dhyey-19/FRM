import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, Tabs, Tab, TextField, Alert,
  Chip, CircularProgress, Divider, Paper, IconButton,
  Tooltip, Grid, FormControl, InputLabel, Select, MenuItem,
  RadioGroup, FormControlLabel, Radio
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
  AssignmentTurnedIn as VerifiedIcon,
  ElectricBolt as BoltIcon,
  Settings as SettingsIcon,
  CloudDone as CloudDoneIcon,
  Send as SendIcon,
  Key as KeyIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import QRCode from 'qrcode';

const EInvoiceModal = ({ open, onClose, invoice, onInvoiceUpdated }) => {
  const [activeTab, setActiveTab] = useState(0); // 0: 1-Click Auto, 1: Manual JSON Export/Import, 2: IRN Details & QR, 3: Credentials Settings
  const [loading, setLoading] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  
  const [exportData, setExportData] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Settings State
  const [settings, setSettings] = useState({
    Environment: 'simulation',
    Gstin: '',
    ClientId: '',
    ClientSecret: '',
    Username: '',
    Password: '',
    BaseUrl: 'https://einv-apisandbox.nic.in/eivital/v1.03'
  });
  const [settingsStatus, setSettingsStatus] = useState(null);

  // Manual Import Form State
  const [importIrn, setImportIrn] = useState('');
  const [importAckNo, setImportAckNo] = useState('');
  const [importAckDate, setImportAckDate] = useState('');
  const [importSignedQRCode, setImportSignedQRCode] = useState('');

  // Cancel Dialog State
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('1'); // 1 = Duplicate, 2 = Data Entry Error, 3 = Order Cancelled, 4 = Others
  const [cancelRemarks, setCancelRemarks] = useState('');

  // Canvas for QR display
  const qrCanvasRef = useRef(null);

  const invoiceId = invoice?.ID || invoice?.id || invoice?.OutwardHeaderId;
  const outwardNo = invoice?.OUTWARDNO || invoice?.outwardNo || '';
  const currentStatus = invoice?.EInvoiceStatus || invoice?.einvoiceStatus || (invoice?.IRN ? 'Generated' : 'Pending');

  // Load Invoice data and Settings whenever modal opens
  useEffect(() => {
    if (open && invoiceId) {
      fetchEInvoiceJSON();
      fetchSettings();
      setErrorMessage('');
      setSuccessMessage('');
      setSettingsStatus(null);

      // If invoice already has IRN, default to Details tab (2), otherwise 1-Click Auto tab (0)
      if (invoice?.IRN && invoice?.EInvoiceStatus !== 'Cancelled') {
        setActiveTab(2);
      } else {
        setActiveTab(0);
      }

      setImportIrn(invoice?.IRN || '');
      setImportAckNo(invoice?.AckNo || '');
      setImportAckDate(invoice?.AckDate || '');
      setImportSignedQRCode(invoice?.SignedQRCode || '');
    }
  }, [open, invoiceId]);

  // Render QR Code onto canvas when Details Tab (2) is active or invoice changes
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

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/einvoice/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({
          ...prev,
          ...data,
          Environment: data.Environment || 'simulation'
        }));
      }
    } catch (err) {
      console.error('Error loading e-Invoice settings:', err);
    }
  };

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

  // 1-Click Automatic Generation via NIC API
  const handleAutoGenerateIRN = async () => {
    if (!invoiceId) return;
    setAutoGenerating(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/einvoice/auto-generate/${invoiceId}`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to auto-generate IRN from NIC gateway');
      }

      setSuccessMessage(data.message || 'Government e-Invoice successfully generated!');
      const updatedInvoice = {
        ...invoice,
        IRN: data.irn,
        AckNo: data.ackNo,
        AckDate: data.ackDate,
        SignedQRCode: data.signedQRCode,
        EInvoiceStatus: 'Generated'
      };

      if (onInvoiceUpdated) {
        onInvoiceUpdated(updatedInvoice);
      }

      // Switch to Tab 2 to preview QR Code & IRN
      setActiveTab(2);
    } catch (err) {
      console.error('Auto generate error:', err);
      setErrorMessage(err.message || 'Network error communicating with NIC e-Invoice Gateway');
    } finally {
      setAutoGenerating(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/einvoice/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save settings');
      setSuccessMessage('e-Invoice API configuration saved successfully!');
      fetchSettings();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  // Test Connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setSettingsStatus(null);
    setErrorMessage('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/einvoice/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gateway connection failed');
      setSettingsStatus({
        success: true,
        message: data.message || 'Connection verified successfully!'
      });
    } catch (err) {
      setSettingsStatus({
        success: false,
        message: err.message || 'Gateway connection error.'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Manual Download JSON
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

  // Copy to Clipboard
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

  // Manual File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const resObj = Array.isArray(parsed) ? parsed[0] : (parsed.response || parsed.Data || parsed);

        const irn = resObj.Irn || resObj.IRN || resObj.irn || '';
        const ackNo = resObj.AckNo || resObj.ackNo || resObj.Ackno || '';
        const ackDate = resObj.AckDt || resObj.ackDt || resObj.AckDate || resObj.ackDate || '';
        const signedQR = resObj.SignedQRCode || resObj.signedQRCode || resObj.SignedQrCode || '';

        if (irn) setImportIrn(irn);
        if (ackNo) setImportAckNo(String(ackNo));
        if (ackDate) setImportAckDate(String(ackDate));
        if (signedQR) setImportSignedQRCode(signedQR);

        setSuccessMessage('Successfully parsed portal response file. Click "Save e-Invoice" below.');
      } catch (err) {
        setErrorMessage('Failed to parse uploaded JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Save Manual Import
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

  // 1-Click Cancel via API
  const handleConfirmCancel = async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/einvoice/auto-cancel/${invoiceId}`;
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
      setSuccessMessage('e-Invoice successfully marked as Cancelled.');
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
              GST e-Invoice Gateway (NIC IRP INV-01)
            </Typography>
            <Typography variant="caption" sx={{ color: '#d0e2ff' }}>
              Invoice #{outwardNo} | Status: <Chip size="small" label={currentStatus} color={currentStatus === 'Generated' ? 'success' : currentStatus === 'Cancelled' ? 'error' : 'warning'} sx={{ height: 20, fontSize: '0.7rem', fontWeight: 'bold' }} />
              &nbsp;| Mode: <strong>{settings.Environment.toUpperCase()}</strong>
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#fff' }} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#f8fafc', px: 2 }}>
        <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} textColor="primary" indicatorColor="primary">
          <Tab 
            icon={<BoltIcon sx={{ fontSize: 18 }} />} 
            iconPosition="start" 
            label="1-Click Auto IRN" 
            sx={{ fontWeight: 700, textTransform: 'none' }} 
          />
          <Tab 
            icon={<DownloadIcon sx={{ fontSize: 18 }} />} 
            iconPosition="start" 
            label="Manual Upload / Import" 
            sx={{ fontWeight: 600, textTransform: 'none' }} 
          />
          {invoice?.IRN && (
            <Tab 
              icon={<QrCodeIcon sx={{ fontSize: 18 }} />} 
              iconPosition="start" 
              label="IRN & Scannable QR" 
              sx={{ fontWeight: 600, textTransform: 'none' }} 
            />
          )}
          <Tab 
            icon={<SettingsIcon sx={{ fontSize: 18 }} />} 
            iconPosition="start" 
            label="NIC Credentials & Settings" 
            sx={{ fontWeight: 600, textTransform: 'none', ml: 'auto' }} 
          />
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

        {/* TAB 0: 1-CLICK AUTOMATIC NIC IRP GENERATION */}
        {activeTab === 0 && (
          <Box>
            {/* Status & Gateway Connection Badge */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f0fdf4', borderColor: '#bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CloudDoneIcon color="success" sx={{ fontSize: 28 }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#166534' }}>
                    NIC IRP Gateway Connected ({settings.Environment === 'simulation' ? 'Testing Simulation Engine' : settings.Environment === 'sandbox' ? 'NIC Sandbox Portal' : 'Live Production einvoice1.gst.gov.in'})
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#15803d' }}>
                    GSTIN: <strong>{settings.Gstin || '24AAACF1234K1Z5'}</strong> {settings.Username ? `| User: ${settings.Username}` : ''}
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={<SettingsIcon />}
                onClick={() => setActiveTab(3)}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Change Credentials
              </Button>
            </Paper>

            {/* Invoice Pre-flight Summary Card */}
            {exportData?.invoiceSummary && (
              <Paper variant="outlined" sx={{ p: 2.5, mb: 3, bgcolor: '#f8fafc' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1.5 }}>
                  Invoice Details Ready for Government Submission:
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Invoice No</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>{outwardNo}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Party / Buyer</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{exportData.einvoiceJSON?.BuyerDtls?.LglNm || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Buyer GSTIN & State</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {exportData.einvoiceJSON?.BuyerDtls?.Gstin || 'URP'} (Code: {exportData.einvoiceJSON?.BuyerDtls?.Stcd || '-'})
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Total Invoice Value</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>
                      ₹{parseFloat(exportData.invoiceSummary?.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Grid>
                </Grid>

                {exportData.warnings && exportData.warnings.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" sx={{ color: '#d97706', fontWeight: 600, display: 'block' }}>
                      Auto-Applied Notice:
                    </Typography>
                    {exportData.warnings.map((w, idx) => (
                      <Typography key={idx} variant="caption" sx={{ color: '#b45309', display: 'block' }}>
                        • {w}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Paper>
            )}

            {/* Action Box */}
            <Box sx={{ textAlign: 'center', py: 2 }}>
              {currentStatus === 'Generated' ? (
                <Box>
                  <Alert severity="success" sx={{ mb: 2, display: 'inline-flex', textAlign: 'left' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      e-Invoice is already active with IRN:
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'Consolas, monospace', display: 'block' }}>
                      {invoice.IRN}
                    </Typography>
                  </Alert>
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1 }}>
                    <Button variant="contained" startIcon={<QrCodeIcon />} onClick={() => setActiveTab(2)} sx={{ bgcolor: '#0F3B66' }}>
                      View IRN & QR Code
                    </Button>
                    <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={() => setCancelOpen(true)}>
                      Cancel e-Invoice
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box>
                  <Button
                    variant="contained"
                    size="large"
                    disabled={autoGenerating}
                    startIcon={autoGenerating ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : <BoltIcon sx={{ fontSize: 26 }} />}
                    onClick={handleAutoGenerateIRN}
                    sx={{
                      bgcolor: '#0F3B66',
                      '&:hover': { bgcolor: '#0a2744' },
                      px: 5,
                      py: 1.6,
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      borderRadius: 2,
                      boxShadow: '0 4px 14px rgba(15, 59, 102, 0.35)'
                    }}
                  >
                    {autoGenerating ? 'Connecting to NIC IRP & Signing IRN...' : '⚡ 1-Click Generate e-Invoice'}
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                    Connects directly to the government IRP, encrypts with RSA & AES-256, generates 64-char IRN hash, and saves scannable QR Code automatically.
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* TAB 1: MANUAL UPLOAD / IMPORT (OPTION A - KEPT AS REQUESTED!) */}
        {activeTab === 1 && (
          <Box>
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f0f7ff', borderColor: '#b3d7ff' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
                Offline Government JSON Workflow (Free Fallback):
              </Typography>
              <Box component="ol" sx={{ pl: 2.5, m: 0, '& li': { mb: 0.5, fontSize: '0.85rem' } }}>
                <li>Download the generated <strong>INV-01 JSON</strong> below.</li>
                <li>Upload to <a href="https://einvoice1.gst.gov.in" target="_blank" rel="noreferrer" style={{ color: '#0F3B66', fontWeight: 600 }}>einvoice1.gst.gov.in</a> under <strong>e-Invoice &gt; Bulk Upload</strong>.</li>
                <li>Download the signed portal response file and upload it below to attach the IRN & QR Code.</li>
              </Box>
            </Paper>

            {/* Export JSON Actions */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
              Step A: Export Official Government Payload
            </Typography>
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

            <Divider sx={{ my: 3 }} />

            {/* Import Portal Response */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
              Step B: Import Government Portal Response / IRN
            </Typography>

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 2.5,
                borderStyle: 'dashed',
                borderWidth: 2,
                borderColor: '#90caf9',
                textAlign: 'center',
                bgcolor: '#fafbfc'
              }}
            >
              <UploadFileIcon sx={{ fontSize: 32, color: '#0F3B66', mb: 0.5 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Drop or Select Government Response JSON File
              </Typography>
              <Button
                variant="outlined"
                component="label"
                size="small"
                sx={{ textTransform: 'none', fontWeight: 600, mt: 1 }}
              >
                Choose File (.json)
                <input type="file" accept=".json" hidden onChange={handleFileUpload} />
              </Button>
            </Paper>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="IRN (64-Character Hexadecimal Hash)"
                  placeholder="3b8908f7fbe6b0a1a3b8d54238e833440eec920b72a6bc89c7d413b1ab063683"
                  value={importIrn}
                  onChange={(e) => setImportIrn(e.target.value)}
                  error={importIrn.length > 0 && importIrn.length !== 64}
                  helperText={`${importIrn.length}/64 characters`}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Ack No"
                  placeholder="112612345678901"
                  value={importAckNo}
                  onChange={(e) => setImportAckNo(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Ack Date"
                  placeholder="2026-10-18 14:32:00"
                  value={importAckDate}
                  onChange={(e) => setImportAckDate(e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                  label="Signed QR Code String"
                  placeholder="Signed QR text string provided by GST portal..."
                  value={importSignedQRCode}
                  onChange={(e) => setImportSignedQRCode(e.target.value)}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={handleSaveImport}
                disabled={loading || !importIrn || importIrn.trim().length !== 64}
                sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#0a2744' }, fontWeight: 600, px: 3 }}
              >
                Save e-Invoice to ERP
              </Button>
            </Box>
          </Box>
        )}

        {/* TAB 2: IRN DETAILS & SCANNABLE QR CODE */}
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
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={() => setCancelOpen(true)}
                  sx={{ fontWeight: 600 }}
                >
                  1-Click Cancel e-Invoice
                </Button>
              </Box>
            )}
          </Box>
        )}

        {/* TAB 3: NIC IRP CREDENTIALS & SETTINGS */}
        {activeTab === 3 && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
              Official NIC IRP Gateway Configuration
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Enter the credentials generated from <strong>einvoice1.gst.gov.in</strong> under API Registration.
            </Typography>

            {settingsStatus && (
              <Alert severity={settingsStatus.success ? 'success' : 'error'} sx={{ mb: 2 }}>
                {settingsStatus.message}
              </Alert>
            )}

            <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
                SELECT ENVIRONMENT:
              </Typography>
              <RadioGroup
                row
                value={settings.Environment}
                onChange={(e) => {
                  const env = e.target.value;
                  let url = settings.BaseUrl;
                  if (env === 'sandbox') url = 'https://einv-apisandbox.nic.in/eivital/v1.03';
                  if (env === 'production') url = 'https://api.einvoice1.gst.gov.in/eivital/v1.03';
                  setSettings(prev => ({ ...prev, Environment: env, BaseUrl: url }));
                }}
                sx={{ mb: 2.5 }}
              >
                <FormControlLabel value="simulation" control={<Radio size="small" />} label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Simulation Engine (Safe Demo Testing)</Typography>} />
                <FormControlLabel value="sandbox" control={<Radio size="small" />} label={<Typography variant="body2" sx={{ fontWeight: 600 }}>NIC Sandbox (Testing Portal)</Typography>} />
                <FormControlLabel value="production" control={<Radio size="small" />} label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Live Production (einvoice1.gst.gov.in)</Typography>} />
              </RadioGroup>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="GSTIN"
                    value={settings.Gstin}
                    onChange={(e) => setSettings({ ...settings, Gstin: e.target.value.toUpperCase() })}
                    helperText="15-digit Registered Taxpayer GSTIN"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="API Username"
                    value={settings.Username}
                    onChange={(e) => setSettings({ ...settings, Username: e.target.value })}
                    helperText="Username created in e-Invoice portal API Registration"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="password"
                    label="API Password"
                    placeholder="Enter API password"
                    value={settings.Password}
                    onChange={(e) => setSettings({ ...settings, Password: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Client ID"
                    value={settings.ClientId}
                    onChange={(e) => setSettings({ ...settings, ClientId: e.target.value })}
                    helperText="Issued by NIC upon API integration"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="password"
                    label="Client Secret"
                    placeholder="Enter Client Secret"
                    value={settings.ClientSecret}
                    onChange={(e) => setSettings({ ...settings, ClientSecret: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Gateway Base URL"
                    value={settings.BaseUrl}
                    onChange={(e) => setSettings({ ...settings, BaseUrl: e.target.value })}
                  />
                </Grid>
              </Grid>
            </Paper>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Button
                variant="outlined"
                color="info"
                disabled={testingConnection}
                startIcon={testingConnection ? <CircularProgress size={18} /> : <SecurityIcon />}
                onClick={handleTestConnection}
                sx={{ fontWeight: 600 }}
              >
                {testingConnection ? 'Testing Gateway Handshake...' : 'Test Connection'}
              </Button>

              <Button
                variant="contained"
                disabled={loading}
                onClick={handleSaveSettings}
                sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#0a2744' }, fontWeight: 700, px: 3 }}
              >
                Save Credentials
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Close
        </Button>
      </DialogActions>

      {/* Cancel e-Invoice Dialog */}
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: '#d32f2f', fontWeight: 'bold' }}>
          Cancel e-Invoice
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Are you sure you want to cancel e-Invoice for <strong>#{outwardNo}</strong> on NIC Gateway?
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
            Confirm 1-Click Cancellation
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default EInvoiceModal;
