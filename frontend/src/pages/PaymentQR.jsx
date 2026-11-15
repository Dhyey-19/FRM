import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Snackbar,
  Alert,
  CircularProgress,
  Divider,
  Tab,
  Tabs
} from '@mui/material';
import {
  QrCode2 as QrCodeIcon,
  Add as AddIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Fullscreen as FullscreenIcon,
  Print as PrintIcon,
  AccountBalance as BankIcon,
  Storefront as StoreIcon,
  Verified as VerifiedIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import frmLogo from '../assets/frm_logo.svg';

const PaymentQR = () => {
  const [qrs, setQrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrImages, setQrImages] = useState({});
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [editingQr, setEditingQr] = useState(null);
  const [fullscreenQr, setFullscreenQr] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const standeeRefs = useRef({});

  // Form State for Adding / Editing QR
  const [formData, setFormData] = useState({
    label: '',
    upiId: '',
    payeeName: '',
    bankName: '',
    accountNo: '',
    ifsc: '',
    isPrimary: false
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Fetch Payment QRs from Backend
  const fetchQRs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/payment-qr`);
      if (res.ok) {
        const data = await res.json();
        setQrs(data);
        generateAllQRCodes(data);
      } else {
        showToast('Failed to load payment QRs', 'error');
      }
    } catch (err) {
      console.error('Error fetching payment QRs:', err);
      showToast('Network error loading payment QRs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQRs();
  }, []);

  // Generate QR Code data URLs for each item
  const generateAllQRCodes = async (items) => {
    const images = {};
    for (const item of items) {
      try {
        const payee = encodeURIComponent(item.payeeName || item.label || 'FRM');
        // Standard NPCI UPI URI Scheme
        const upiPayload = `upi://pay?pa=${encodeURIComponent(item.upiId)}&pn=${payee}&cu=INR`;
        const dataUrl = await QRCode.toDataURL(upiPayload, {
          width: 320,
          margin: 1,
          color: {
            dark: '#05192D',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'H'
        });
        images[item.id] = dataUrl;
      } catch (e) {
        console.error('Failed to generate QR for:', item.upiId, e);
      }
    }
    setQrImages(images);
  };

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
  };

  const handleCopyUPI = (upiId) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(upiId);
      showToast(`Copied UPI ID: ${upiId}`);
    } else {
      showToast('Clipboard not supported', 'warning');
    }
  };

  const handleOpenAdd = () => {
    setEditingQr(null);
    setFormData({
      label: '',
      upiId: '',
      payeeName: '',
      bankName: '',
      accountNo: '',
      ifsc: '',
      isPrimary: false
    });
    setFormError('');
    setOpenAddDialog(true);
  };

  const handleOpenEdit = (item) => {
    setEditingQr(item);
    setFormData({
      label: item.label,
      upiId: item.upiId,
      payeeName: item.payeeName || '',
      bankName: item.bankName || '',
      accountNo: item.accountNo || '',
      ifsc: item.ifsc || '',
      isPrimary: Boolean(item.isPrimary)
    });
    setFormError('');
    setOpenAddDialog(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSaveQR = async (e) => {
    e.preventDefault();
    if (!formData.label.trim()) {
      setFormError('QR Label is required (e.g. Counter 1, Billing Desk).');
      return;
    }
    if (!formData.upiId.trim() || !formData.upiId.includes('@')) {
      setFormError('Please enter a valid UPI ID (e.g. company@sbi, merchant@upi).');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const url = editingQr
        ? `${baseUrl}/payment-qr/${editingQr.id}`
        : `${baseUrl}/payment-qr`;
      const method = editingQr ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        showToast(editingQr ? 'Payment QR updated successfully!' : 'Payment QR added successfully!');
        setOpenAddDialog(false);
        fetchQRs();
      } else {
        const data = await res.json();
        setFormError(data.message || 'Failed to save Payment QR.');
      }
    } catch (err) {
      console.error('Error saving Payment QR:', err);
      setFormError('Network error while saving. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQR = async (id, label) => {
    if (!window.confirm(`Are you sure you want to delete "${label}" Payment QR?`)) {
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/payment-qr/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast(`Payment QR "${label}" deleted.`);
        fetchQRs();
      } else {
        showToast('Failed to delete payment QR', 'error');
      }
    } catch (err) {
      console.error('Error deleting QR:', err);
      showToast('Error deleting payment QR', 'error');
    }
  };

  // Download Standee Canvas as High-Res PNG
  const handleDownloadStandee = (item) => {
    const cardEl = standeeRefs.current[item.id];
    if (!cardEl) return;

    const qrImg = qrImages[item.id];
    if (!qrImg) return;

    // Render high quality standee canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 840;

    // 1. Standee Background Outer Border
    ctx.fillStyle = '#f4f7f9';
    ctx.fillRect(0, 0, 600, 840);

    // 2. Card Shell (Rounded Top)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(24, 24, 552, 792, 28);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    ctx.fill();
    ctx.restore();

    // 3. Top Banner (Deep Navy Gradient)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(24, 24, 552, 160, [28, 28, 0, 0]);
    const grad = ctx.createLinearGradient(0, 24, 600, 184);
    grad.addColorStop(0, '#0F3B66');
    grad.addColorStop(1, '#05192D');
    ctx.fillStyle = grad;
    ctx.fill();

    // Top Orange Accent Stripe
    ctx.fillStyle = '#F88A01';
    ctx.fillRect(24, 24, 552, 6);

    // FRM-BBP Logo text / Brand
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FRM-BBP PAY', 300, 75);

    // Subtitle Pill
    ctx.fillStyle = '#F88A01';
    ctx.beginPath();
    ctx.roundRect(140, 98, 320, 34, 17);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText('SCAN & PAY WITH ANY UPI APP', 300, 120);
    ctx.restore();

    // 4. Merchant Info
    ctx.fillStyle = '#0F3B66';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.payeeName || 'FRM Precision Manufacturing', 300, 226);

    // Label Badge
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(170, 244, 260, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText(item.label.toUpperCase(), 300, 262);

    // 5. Draw QR Code
    const img = new Image();
    img.onload = () => {
      // Draw white QR card
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(130, 286, 340, 340, 20);
      ctx.shadowColor = 'rgba(15, 59, 102, 0.12)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 4;
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw QR Image
      ctx.drawImage(img, 150, 306, 300, 300);

      // Draw Center FRM Icon Badge in QR
      ctx.beginPath();
      ctx.arc(300, 456, 26, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#F88A01';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(300, 456, 22, 0, Math.PI * 2);
      ctx.fillStyle = '#0F3B66';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FRM', 300, 460);

      // 6. UPI ID Pill
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.roundRect(100, 646, 400, 44, 22);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#0F3B66';
      ctx.font = 'bold 15px Inter, monospace';
      ctx.fillText(`UPI ID: ${item.upiId}`, 300, 674);

      // 7. Footer: Accepted Apps
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText('ACCEPTED ON ALL UPI APPS', 300, 722);

      ctx.fillStyle = '#0F3B66';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText('Google Pay  •  PhonePe  •  Paytm  •  BHIM  •  Any Bank UPI', 300, 750);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText('Instant Settlement  •  Zero Convenience Fee  •  Verified Merchant', 300, 778);

      // Download
      const cleanName = (item.label || 'FRM-QR').replace(/[^a-zA-Z0-9]/g, '_');
      const link = document.createElement('a');
      link.download = `${cleanName}_Standee.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Standee image downloaded!');
    };
    img.src = qrImg;
  };

  const handleShare = async (item) => {
    const payee = item.payeeName || item.label;
    const shareText = `Pay to ${payee} via UPI:\nUPI ID: ${item.upiId}\nPay Link: upi://pay?pa=${encodeURIComponent(item.upiId)}&pn=${encodeURIComponent(payee)}&cu=INR`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${payee} - UPI Payment QR`,
          text: shareText
        });
        showToast('Shared successfully!');
      } catch (e) {
        handleCopyUPI(item.upiId);
      }
    } else {
      handleCopyUPI(item.upiId);
    }
  };

  // Filter QRs by active Tab
  const filteredQrs = qrs.filter(item => {
    if (activeTab === 'company') return item.source === 'company';
    if (activeTab === 'ledger') return item.source === 'ledger';
    if (activeTab === 'custom') return item.source === 'custom';
    return true;
  });

  return (
    <Box sx={{ pb: 6 }}>
      {/* Sleek Operations Header Bar */}
      <Box sx={{ mb: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#F88A01', letterSpacing: 1, textTransform: 'uppercase' }}>
              Administration • Payment Gateway
            </Typography>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F3B66', letterSpacing: -0.5 }}>
            Payment QR Codes
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
            Manage branded UPI QR codes for billing counters, store collections, and bank accounts.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Chip
            icon={<QrCodeIcon sx={{ fontSize: '16px !important', color: '#0F3B66 !important' }} />}
            label={`${qrs.length} Active ${qrs.length === 1 ? 'QR' : 'QRs'}`}
            sx={{
              bgcolor: '#ffffff',
              color: '#0F3B66',
              fontWeight: 600,
              border: '1px solid #cbd5e1',
              px: 0.5,
              py: 0.5,
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          />

          <Tooltip title="Refresh Payment QRs">
            <IconButton
              onClick={fetchQRs}
              sx={{
                bgcolor: '#ffffff',
                color: '#0F3B66',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                '&:hover': { bgcolor: '#f1f5f9', color: '#F88A01', borderColor: '#F88A01' }
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAdd}
            sx={{
              bgcolor: '#0F3B66',
              color: '#ffffff',
              fontWeight: 600,
              px: 2.5,
              py: 0.9,
              borderRadius: 2,
              boxShadow: '0 2px 8px rgba(15, 59, 102, 0.2)',
              textTransform: 'none',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: '#F88A01',
                boxShadow: '0 4px 14px rgba(248, 138, 1, 0.35)'
              }
            }}
          >
            Add Payment QR
          </Button>
        </Box>
      </Box>

      {/* Filter Tabs */}
      <Box sx={{ mb: 3.5, borderBottom: '1px solid #e2e8f0' }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: { xs: '0.84rem', sm: '0.9rem' },
              minHeight: 44,
              whiteSpace: 'nowrap',
              color: '#64748b',
              '&.Mui-selected': { color: '#0F3B66' }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#F88A01',
              height: 3,
              borderRadius: '3px 3px 0 0'
            }
          }}
        >
          <Tab label={`All QRs (${qrs.length})`} value="all" />
          <Tab label={`Company Profile (${qrs.filter(q => q.source === 'company').length})`} value="company" />
          {qrs.some(q => q.source === 'ledger') && (
            <Tab label={`Bank Accounts (${qrs.filter(q => q.source === 'ledger').length})`} value="ledger" />
          )}
          <Tab label={`Custom Counters (${qrs.filter(q => q.source === 'custom').length})`} value="custom" />
        </Tabs>
      </Box>

      {/* Loading State */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress sx={{ color: '#0F3B66' }} />
        </Box>
      ) : filteredQrs.length === 0 ? (
        /* Clean Empty State */
        <Paper
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 3,
            bgcolor: '#ffffff',
            border: '1px dashed #cbd5e1',
            boxShadow: '0 2px 8px rgba(15, 59, 102, 0.04)'
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: 'rgba(15, 59, 102, 0.06)',
              color: '#0F3B66',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2
            }}
          >
            <QrCodeIcon sx={{ fontSize: 36 }} />
          </Box>
          <Typography variant="h6" sx={{ color: '#0F3B66', fontWeight: 700, mb: 0.5 }}>
            No Payment QR Codes in This Category
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 3, maxWidth: 460, mx: 'auto' }}>
            Add your UPI ID along with a label (e.g. "Counter 1", "Accounts Desk", "Dispatch") to generate a clean, scannable QR code.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAdd}
            sx={{
              bgcolor: '#0F3B66',
              color: '#ffffff',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: '#F88A01' }
            }}
          >
            Add New Payment QR
          </Button>
        </Paper>
      ) : (
        /* Clean Dashboard-Themed Cards Grid */
        <Grid container spacing={3}>
          {filteredQrs.map((item) => (
            <Grid item xs={12} sm={6} lg={4} key={item.id}>
              <Card
                ref={el => (standeeRefs.current[item.id] = el)}
                sx={{
                  borderRadius: 3,
                  bgcolor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderTop: item.isPrimary ? '4px solid #F88A01' : '4px solid #0F3B66',
                  boxShadow: '0 2px 10px rgba(15, 59, 102, 0.06)',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 8px 24px rgba(15, 59, 102, 0.12)'
                  }
                }}
              >
                <CardContent sx={{ p: 2.5, pb: 1.5, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Top Header Row: Label Badge, Status Chips, and Action Menu */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        icon={<StoreIcon sx={{ fontSize: '15px !important', color: item.isPrimary ? '#ea580c !important' : '#0F3B66 !important' }} />}
                        label={item.label}
                        size="small"
                        sx={{
                          bgcolor: item.isPrimary ? '#fff7ed' : '#eff6ff',
                          color: item.isPrimary ? '#ea580c' : '#0F3B66',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          border: item.isPrimary ? '1px solid #ffedd5' : '1px solid #dbeafe',
                          borderRadius: 1.5
                        }}
                      />
                      {item.isPrimary && (
                        <Chip
                          label="PRIMARY"
                          size="small"
                          sx={{
                            bgcolor: '#F88A01',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.62rem',
                            height: 20
                          }}
                        />
                      )}
                      {item.source === 'company' && (
                        <Chip
                          label="Profile"
                          size="small"
                          sx={{
                            bgcolor: '#f1f5f9',
                            color: '#475569',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            height: 20
                          }}
                        />
                      )}
                    </Box>

                    {item.canDelete && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Edit QR Details">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEdit(item)}
                            sx={{ color: '#64748b', '&:hover': { color: '#0F3B66', bgcolor: '#f1f5f9' } }}
                          >
                            <EditIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete QR">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteQR(item.id, item.label)}
                            sx={{ color: '#64748b', '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' } }}
                          >
                            <DeleteIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>

                  {/* Merchant / Payee Title */}
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: '#0F3B66',
                      fontSize: '1.05rem',
                      lineHeight: 1.3,
                      mb: 0.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={item.payeeName}
                  >
                    {item.payeeName || 'FRM Precision Manufacturing'}
                  </Typography>

                  {/* Account / Bank Subtitle */}
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#64748b',
                      display: 'block',
                      mb: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {item.bankName
                      ? `${item.bankName}${item.accountNo ? ` • A/C ${item.accountNo.slice(-4).padStart(item.accountNo.length, '•')}` : ''}${item.ifsc ? ` • ${item.ifsc}` : ''}`
                      : 'Verified UPI Merchant Account'}
                  </Typography>

                  {/* Clean Centered QR Code */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 'auto', py: 1 }}>
                    <Box
                      sx={{
                        p: 1.5,
                        bgcolor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 2.5,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: '#cbd5e1',
                          bgcolor: '#ffffff',
                          boxShadow: '0 4px 14px rgba(15, 59, 102, 0.08)'
                        }
                      }}
                    >
                      {qrImages[item.id] ? (
                        <Box sx={{ position: 'relative' }}>
                          <img
                            src={qrImages[item.id]}
                            alt={item.label}
                            style={{ width: 185, height: 185, display: 'block', borderRadius: 6 }}
                          />
                          <Box
                            sx={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              bgcolor: '#ffffff',
                              border: '2px solid #0F3B66',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                            }}
                          >
                            <img src={frmLogo} alt="FRM" style={{ width: 22, height: 22, borderRadius: '50%' }} />
                          </Box>
                        </Box>
                      ) : (
                        <Box sx={{ width: 185, height: 185, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CircularProgress size={28} sx={{ color: '#0F3B66' }} />
                        </Box>
                      )}
                    </Box>
                  </Box>

                  {/* Monospace UPI ID Pill with Copy Button */}
                  <Box
                    sx={{
                      bgcolor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 2,
                      px: 1.5,
                      py: 0.8,
                      mt: 1.5,
                      mb: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#94a3b8',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          display: 'block',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5
                        }}
                      >
                        UPI ID / VPA
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#0F3B66',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {item.upiId}
                      </Typography>
                    </Box>
                    <Tooltip title="Copy UPI ID">
                      <IconButton
                        size="small"
                        onClick={() => handleCopyUPI(item.upiId)}
                        sx={{
                          color: '#0F3B66',
                          bgcolor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          p: 0.6,
                          '&:hover': {
                            bgcolor: '#0F3B66',
                            color: '#ffffff',
                            borderColor: '#0F3B66'
                          }
                        }}
                      >
                        <CopyIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* Clean Accepted Apps text */}
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#94a3b8',
                      fontSize: '0.7rem',
                      textAlign: 'center',
                      display: 'block'
                    }}
                  >
                    Accepted on GPay • PhonePe • Paytm • BHIM • All UPI
                  </Typography>
                </CardContent>

                {/* Footer Action Bar matching Dashboard buttons */}
                <Box
                  sx={{
                    px: 2,
                    py: 1.2,
                    bgcolor: '#f8fafc',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1
                  }}
                >
                  <Button
                    size="small"
                    startIcon={<FullscreenIcon sx={{ fontSize: '18px !important' }} />}
                    onClick={() => setFullscreenQr(item)}
                    sx={{
                      color: '#0F3B66',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      textTransform: 'none',
                      py: 0.5,
                      px: 1.2,
                      borderRadius: 1.5,
                      '&:hover': { bgcolor: '#e2e8f0' }
                    }}
                  >
                    Scan View
                  </Button>

                  <Button
                    size="small"
                    startIcon={<DownloadIcon sx={{ fontSize: '18px !important' }} />}
                    onClick={() => handleDownloadStandee(item)}
                    sx={{
                      color: '#0F3B66',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      textTransform: 'none',
                      py: 0.5,
                      px: 1.2,
                      borderRadius: 1.5,
                      '&:hover': { bgcolor: '#e2e8f0' }
                    }}
                  >
                    Download
                  </Button>

                  <Button
                    size="small"
                    startIcon={<ShareIcon sx={{ fontSize: '18px !important' }} />}
                    onClick={() => handleShare(item)}
                    sx={{
                      color: '#0F3B66',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      textTransform: 'none',
                      py: 0.5,
                      px: 1.2,
                      borderRadius: 1.5,
                      '&:hover': { bgcolor: '#e2e8f0' }
                    }}
                  >
                    Share
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* --- ADD / EDIT QR DIALOG --- */}
      <Dialog
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: '#0F3B66', color: '#ffffff', py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {editingQr ? 'Edit Payment QR' : 'Add New Payment QR'}
            </Typography>
            <IconButton onClick={() => setOpenAddDialog(false)} sx={{ color: '#ffffff' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <form onSubmit={handleSaveQR}>
          <DialogContent sx={{ p: 3, pt: 3 }}>
            {formError && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
                {formError}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="QR Label"
                  name="label"
                  placeholder="e.g. Counter 1, Sales Billing Desk, Factory Gate Collection"
                  value={formData.label}
                  onChange={handleFormChange}
                  helperText="Name or location identifier for this payment standee"
                  size="small"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="UPI ID"
                  name="upiId"
                  placeholder="e.g. company@sbi, merchant@okhdfcbank, 9876543210@paytm"
                  value={formData.upiId}
                  onChange={handleFormChange}
                  helperText="The UPI ID to which payment will be credited"
                  size="small"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Payee / Merchant Display Name"
                  name="payeeName"
                  placeholder="e.g. FRM Precision Manufacturing Ltd"
                  value={formData.payeeName}
                  onChange={handleFormChange}
                  helperText="Name displayed on customer UPI payment screen"
                  size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Bank Name (Optional)"
                  name="bankName"
                  placeholder="e.g. State Bank of India, HDFC Bank"
                  value={formData.bankName}
                  onChange={handleFormChange}
                  size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Account No (Optional)"
                  name="accountNo"
                  placeholder="e.g. 50200012345678"
                  value={formData.accountNo}
                  onChange={handleFormChange}
                  size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="IFSC Code (Optional)"
                  name="ifsc"
                  placeholder="e.g. SBIN0001234"
                  value={formData.ifsc}
                  onChange={handleFormChange}
                  size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isPrimary}
                      onChange={handleFormChange}
                      name="isPrimary"
                      color="primary"
                    />
                  }
                  label="Set as Primary QR"
                />
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions sx={{ p: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <Button onClick={() => setOpenAddDialog(false)} sx={{ color: '#64748b' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              sx={{
                bgcolor: '#0F3B66',
                color: '#ffffff',
                fontWeight: 600,
                px: 3,
                '&:hover': { bgcolor: '#F88A01' }
              }}
            >
              {saving ? <CircularProgress size={20} color="inherit" /> : editingQr ? 'Update QR' : 'Save QR'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* --- FULLSCREEN SCAN MODAL (Clean Dashboard Theme) --- */}
      <Dialog
        open={Boolean(fullscreenQr)}
        onClose={() => setFullscreenQr(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(15, 59, 102, 0.2)',
            border: '1px solid #e2e8f0',
            borderTop: '5px solid #0F3B66'
          }
        }}
      >
        {fullscreenQr && (
          <Box sx={{ bgcolor: '#ffffff' }}>
            {/* Header */}
            <Box
              sx={{
                p: 2.5,
                pb: 2,
                bgcolor: '#ffffff',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                position: 'relative'
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                  <Chip
                    label={fullscreenQr.label}
                    size="small"
                    sx={{
                      bgcolor: '#eff6ff',
                      color: '#0F3B66',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      border: '1px solid #dbeafe',
                      borderRadius: 1.5
                    }}
                  />
                  {fullscreenQr.isPrimary && (
                    <Chip
                      label="PRIMARY"
                      size="small"
                      sx={{ bgcolor: '#F88A01', color: '#fff', fontWeight: 800, fontSize: '0.62rem', height: 20 }}
                    />
                  )}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F3B66', lineHeight: 1.2 }}>
                  {fullscreenQr.payeeName}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.3 }}>
                  {fullscreenQr.bankName ? `${fullscreenQr.bankName} • ` : ''}Instant UPI Settlement
                </Typography>
              </Box>

              <IconButton
                onClick={() => setFullscreenQr(null)}
                sx={{ color: '#94a3b8', '&:hover': { color: '#0F3B66', bgcolor: '#f1f5f9' } }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            {/* QR Center */}
            <Box sx={{ p: 3, textAlign: 'center', bgcolor: '#f8fafc' }}>
              <Box
                sx={{
                  display: 'inline-block',
                  p: 2,
                  bgcolor: '#ffffff',
                  borderRadius: 3,
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 4px 16px rgba(15, 59, 102, 0.08)',
                  mb: 2,
                  position: 'relative'
                }}
              >
                <img
                  src={qrImages[fullscreenQr.id]}
                  alt="QR"
                  style={{ width: 240, height: 240, display: 'block' }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: '#ffffff',
                    border: '2px solid #0F3B66',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                  }}
                >
                  <img src={frmLogo} alt="Logo" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                </Box>
              </Box>

              {/* UPI ID Pill */}
              <Box
                sx={{
                  bgcolor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1.5,
                  maxWidth: '100%'
                }}
              >
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#0F3B66', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                  {fullscreenQr.upiId}
                </Typography>
                <Tooltip title="Copy UPI ID">
                  <IconButton
                    size="small"
                    onClick={() => handleCopyUPI(fullscreenQr.upiId)}
                    sx={{ color: '#0F3B66', bgcolor: '#f1f5f9', p: 0.5, '&:hover': { bgcolor: '#0F3B66', color: '#fff' } }}
                  >
                    <CopyIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>

              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 1.5, fontSize: '0.72rem' }}>
                Scan using Google Pay, PhonePe, Paytm, BHIM, or any UPI app
              </Typography>
            </Box>

            {/* Modal Actions */}
            <Box sx={{ p: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => handleDownloadStandee(fullscreenQr)}
                sx={{ color: '#0F3B66', borderColor: '#cbd5e1', textTransform: 'none', fontWeight: 600 }}
              >
                Download PNG
              </Button>
              <Button
                variant="contained"
                onClick={() => setFullscreenQr(null)}
                sx={{ bgcolor: '#0F3B66', textTransform: 'none', fontWeight: 600, px: 2.5, '&:hover': { bgcolor: '#F88A01' } }}
              >
                Close
              </Button>
            </Box>
          </Box>
        )}
      </Dialog>

      {/* Snackbar Alert */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity} sx={{ borderRadius: 2 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PaymentQR;

