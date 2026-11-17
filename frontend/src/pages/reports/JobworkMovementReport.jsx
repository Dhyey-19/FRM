import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Box, Typography, Button, Paper, CircularProgress, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Autocomplete,
  Card, CardContent, Grid, Chip, Divider, Tooltip,
  FormControl, InputLabel, Select, MenuItem,
  Tabs, Tab, Alert
} from '@mui/material';
import { 
  PictureAsPdf, Visibility, TableView,
  Refresh, Factory, History, CheckCircle,
  WarningAmber, ArrowForward
} from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ensureNumericWorksheet } from '../../utils/excelHelper';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Error Boundary to prevent blank screen if any render error occurs
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('JobworkMovementReport ErrorBoundary caught an error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4 }}>
          <Alert 
            severity="error" 
            action={
              <Button color="inherit" size="small" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            }
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              An error occurred while loading the Sub-Contract Movement Report.
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {this.state.error?.message || String(this.state.error)}
            </Typography>
          </Alert>
        </Box>
      );
    }
    return this.props.children;
  }
}

const JobworkMovementReportContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const localUser = (() => {
    try {
      const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })();

  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Active Tab: 0 = Summary (Party & Item Balances), 1 = Detailed Movement Statement
  const [activeTab, setActiveTab] = useState(0);

  // PDF Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // Dropdown list states
  const [partiesList, setPartiesList] = useState([]);
  const [itemsList, setItemsList] = useState([]);

  // Selected Filter States
  const [selectedParty, setSelectedParty] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'settled'
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [searchText, setSearchText] = useState('');

  // Report Data State
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch report data
  const fetchReport = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const formatDate = (date) => {
        if (!date) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      const params = new URLSearchParams();
      if (selectedParty?.id) params.append('partyId', selectedParty.id);
      if (selectedItem?.itemCode) {
        params.append('itemCode', selectedItem.itemCode);
        if (selectedItem.subCode !== undefined && selectedItem.subCode !== null) {
          params.append('subCode', selectedItem.subCode);
        }
      }
      if (startDate) params.append('startDate', formatDate(startDate));
      if (endDate) params.append('endDate', formatDate(endDate));
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);

      const res = await fetch(`${baseUrl}/jobwork-ins/movement-report?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to fetch jobwork movement report');
      }

      const data = await res.json();
      setReportData(data);

      if (data.parties && (!partiesList.length || partiesList.length !== data.parties.length)) {
        setPartiesList(data.parties);
      }
      if (data.items && (!itemsList.length || itemsList.length !== data.items.length)) {
        setItemsList(data.items);
      }
    } catch (err) {
      console.error('Error fetching jobwork movement report:', err);
      setErrorMsg(err.message || 'Server error loading report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedParty, selectedItem, startDate, endDate, statusFilter]);

  // Quick Date Presets
  const applyPreset = (preset) => {
    const today = new Date();
    if (preset === 'today') {
      setDateRange([today, today]);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setDateRange([firstDay, lastDay]);
    } else if (preset === 'lastMonth') {
      const prevFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevLast = new Date(today.getFullYear(), today.getMonth(), 0);
      setDateRange([prevFirst, prevLast]);
    } else if (preset === 'fy') {
      const currentYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      const fyStart = new Date(currentYear, 3, 1);
      const fyEnd = new Date(currentYear + 1, 2, 31);
      setDateRange([fyStart, fyEnd]);
    } else if (preset === 'all') {
      setDateRange([null, null]);
    }
  };

  // Switch to Movement Register with pre-selected party and item
  const handleDrilldown = (partyId, partyName, itemCode, subCode, itemName) => {
    const party = partiesList.find(p => String(p.id) === String(partyId)) || { id: partyId, name: partyName };
    const item = itemsList.find(i => i.itemCode === itemCode && (i.subCode || '') === (subCode || '')) || { itemCode, subCode, itemName };
    setSelectedParty(party);
    setSelectedItem(item);
    setActiveTab(1);
  };

  // Filtered Summary List based on search query
  const filteredSummary = useMemo(() => {
    if (!reportData?.partyItemSummary) return [];
    if (!searchText.trim()) return reportData.partyItemSummary;
    const q = searchText.toLowerCase();
    return reportData.partyItemSummary.filter(row => 
      (row.partyName || '').toLowerCase().includes(q) ||
      (row.itemCode || '').toLowerCase().includes(q) ||
      (row.subCode || '').toLowerCase().includes(q) ||
      (row.itemName || '').toLowerCase().includes(q)
    );
  }, [reportData, searchText]);

  // Filtered Movement Transactions based on search query
  const filteredTransactions = useMemo(() => {
    if (!reportData?.movementTransactions) return [];
    if (!searchText.trim()) return reportData.movementTransactions;
    const q = searchText.toLowerCase();
    return reportData.movementTransactions.filter(row => 
      (row.partyName || '').toLowerCase().includes(q) ||
      (row.itemCode || '').toLowerCase().includes(q) ||
      (row.subCode || '').toLowerCase().includes(q) ||
      (row.itemName || '').toLowerCase().includes(q) ||
      (row.docNo || '').toLowerCase().includes(q) ||
      (row.process || '').toLowerCase().includes(q) ||
      (row.remark || '').toLowerCase().includes(q) ||
      (row.createdBy || '').toLowerCase().includes(q)
    );
  }, [reportData, searchText]);

  // Export to Excel
  const handleExportExcel = () => {
    if (!reportData) return;

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Summary Balances
    const summaryRows = (reportData.partyItemSummary || []).map((r, i) => ({
      'Sr. No': i + 1,
      'Sub-Contractor (Party)': r.partyName,
      'Item Code': r.itemCode,
      'Sub Code': r.subCode || '-',
      'Item Name': r.itemName,
      'Unit': r.unit,
      'Sent Qty (Out)': Number(r.outQty || 0),
      'Sent Wt (KG)': Number(r.outWt || 0),
      'Received Qty (In)': Number(r.inQty || 0),
      'Received Wt (KG)': Number(r.inWt || 0),
      'Scrap Pcs': Number(r.scrapQty || 0),
      'Scrap Wt (KG)': Number(r.scrapWt || 0),
      'Balance Qty (Outs)': Number(r.balQty || 0),
      'Balance Wt (KG)': Number(r.balWt || 0),
      'Last Movement Date': r.lastDate ? new Date(r.lastDate).toLocaleDateString('en-GB') : '-'
    }));

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    ensureNumericWorksheet(wsSummary);
    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Sub-Contract Balances Summary');

    // Sheet 2: Detailed Movement Register
    const movementRows = (reportData.movementTransactions || []).map((t, i) => ({
      'Sr. No': i + 1,
      'Date': t.date ? new Date(t.date).toLocaleDateString('en-GB') : '-',
      'Time': t.entryTime || '',
      'Challan No': t.docNo || '-',
      'Ref Out Challan': t.refDocNo || '-',
      'Movement Type': t.type,
      'Sub-Contractor (Party)': t.partyName,
      'Item Code': t.itemCode,
      'Sub Code': t.subCode || '-',
      'Item Name': t.itemName,
      'Process': t.process || '-',
      'Sent Qty (+)': (t.outQty || 0) > 0 ? Number(t.outQty) : null,
      'Sent Wt KG (+)': (t.outWt || 0) > 0 ? Number(t.outWt) : null,
      'Received Qty (-)': (t.inQty || 0) > 0 ? Number(t.inQty) : null,
      'Received Wt KG (-)': (t.inWt || 0) > 0 ? Number(t.inWt) : null,
      'Scrap Pcs': (t.scrapQty || 0) > 0 ? Number(t.scrapQty) : null,
      'Scrap Wt KG': (t.scrapWt || 0) > 0 ? Number(t.scrapWt) : null,
      'Running Bal Qty': Number(t.runningBalQty || 0),
      'Running Bal Wt (KG)': Number(t.runningBalWt || 0),
      'Remarks': t.remark || '',
      'Entered By': t.createdBy || ''
    }));

    const wsMovement = XLSX.utils.json_to_sheet(movementRows);
    ensureNumericWorksheet(wsMovement);
    XLSX.utils.book_append_sheet(workbook, wsMovement, 'Detailed Movement Register');

    const fileName = `Jobwork_Movement_${selectedParty ? selectedParty.name.replace(/\s+/g, '_') : 'All_Parties'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Export / Preview PDF
  const handleExportPDF = async (action = 'preview') => {
    if (!reportData) return;

    let compProfile = null;
    try {
      const pRes = await fetch(`${baseUrl}/company-profile`);
      if (pRes.ok) compProfile = await pRes.json();
    } catch (e) {
      console.warn('Could not fetch company profile for PDF header', e);
    }

    const doc = new jsPDF('landscape', 'mm', 'a4');

    // 1. Company Banner
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text((compProfile?.CompanyName || localUser.companyName || 'FRM Enterprise').toUpperCase(), 14, 15);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    const addressLine = [compProfile?.Address, compProfile?.City, compProfile?.State, compProfile?.Pincode].filter(Boolean).join(', ');
    if (addressLine) doc.text(addressLine, 14, 20);

    const contactLine = [
      compProfile?.GSTIN ? `GSTIN: ${compProfile.GSTIN}` : null,
      compProfile?.Phone ? `Phone: ${compProfile.Phone}` : null,
      compProfile?.Email ? `Email: ${compProfile.Email}` : null
    ].filter(Boolean).join(' | ');
    if (contactLine) doc.text(contactLine, 14, 24);

    // 2. Report Title & Filter Context Banner
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    const reportTitle = activeTab === 0 ? 'SUB-CONTRACT MOVEMENT & BALANCE SUMMARY' : 'SUB-CONTRACT DETAILED MOVEMENT REGISTER (LEDGER)';
    doc.text(reportTitle, 14, 32);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    const filterCtx = [
      `Party: ${selectedParty ? selectedParty.name : 'All Sub-Contractors'}`,
      `Item: ${selectedItem ? `[${selectedItem.itemCode}] ${selectedItem.itemName}` : 'All Items'}`,
      `Period: ${startDate ? startDate.toLocaleDateString('en-GB') : 'All Time'} to ${endDate ? endDate.toLocaleDateString('en-GB') : 'Present'}`,
      `Status: ${statusFilter.toUpperCase()}`
    ].join('  |  ');
    doc.text(filterCtx, 14, 37);

    // Timestamp
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 240, 37);

    // Decorative line
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.6);
    doc.line(14, 40, 283, 40);

    let startY = 44;

    // 3. KPI Summary Box in PDF
    if (reportData.summary) {
      doc.setFillColor(245, 248, 252);
      doc.roundedRect(14, startY, 269, 12, 1.5, 1.5, 'F');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');

      // Total Sent
      doc.setTextColor(30, 64, 175);
      doc.text(`SENT (OUT): ${Number(reportData.summary.totalOutQty || 0).toLocaleString()} PCS (${Number(reportData.summary.totalOutWt || 0).toFixed(3)} KG)`, 18, startY + 7.5);

      // Total Received Back
      doc.setTextColor(22, 101, 52);
      doc.text(`RECEIVED (IN): ${Number(reportData.summary.totalInQty || 0).toLocaleString()} PCS (${Number(reportData.summary.totalInWt || 0).toFixed(3)} KG)`, 85, startY + 7.5);

      // Scrap
      doc.setTextColor(154, 52, 18);
      doc.text(`SCRAP: ${Number(reportData.summary.totalScrapQty || 0).toLocaleString()} PCS (${Number(reportData.summary.totalScrapWt || 0).toFixed(3)} KG)`, 155, startY + 7.5);

      // Net Balance
      doc.setTextColor(185, 28, 28);
      doc.text(`PENDING BAL: ${Number(reportData.summary.balanceQty || 0).toLocaleString()} PCS (${Number(reportData.summary.balanceWt || 0).toFixed(3)} KG)`, 218, startY + 7.5);

      startY += 16;
    }

    if (activeTab === 0) {
      // Summary Table
      const headers = [['Sr', 'Sub-Contractor (Party)', 'Item Code', 'Item Name', 'Unit', 'Sent Qty', 'Sent Wt', 'Recv Qty', 'Recv Wt', 'Bal Qty', 'Bal Wt (KG)', 'Last Date']];
      const body = filteredSummary.map((r, i) => [
        i + 1,
        r.partyName || '-',
        r.itemCode || '-',
        r.itemName || '-',
        r.unit || 'PCS',
        Number(r.outQty || 0).toLocaleString(),
        Number(r.outWt || 0).toFixed(3),
        Number(r.inQty || 0).toLocaleString(),
        Number(r.inWt || 0).toFixed(3),
        Number(r.balQty || 0).toLocaleString(),
        Number(r.balWt || 0).toFixed(3),
        r.lastDate ? new Date(r.lastDate).toLocaleDateString('en-GB') : '-'
      ]);

      autoTable(doc, {
        head: headers,
        body: body,
        startY: startY,
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { cellWidth: 46 },
          2: { cellWidth: 26, fontStyle: 'bold' },
          3: { cellWidth: 50 },
          4: { halign: 'center', cellWidth: 14 },
          5: { halign: 'right', cellWidth: 18, textColor: [37, 99, 235] },
          6: { halign: 'right', cellWidth: 18 },
          7: { halign: 'right', cellWidth: 18, textColor: [22, 163, 74] },
          8: { halign: 'right', cellWidth: 18 },
          9: { halign: 'right', cellWidth: 20, fontStyle: 'bold', textColor: [185, 28, 28] },
          10: { halign: 'right', cellWidth: 20, fontStyle: 'bold', textColor: [185, 28, 28] },
          11: { halign: 'center', cellWidth: 21 }
        },
        margin: { left: 14, right: 14 }
      });
    } else {
      // Detailed Movement Table
      const headers = [['Sr', 'Date', 'Challan', 'Ref Out', 'Type', 'Sub-Contractor', 'Item Code & Name', 'Process', 'Sent Qty', 'Sent Wt', 'Recv Qty', 'Recv Wt', 'Run Bal Qty', 'Run Bal Wt']];
      const body = filteredTransactions.map((t, i) => [
        i + 1,
        t.date ? new Date(t.date).toLocaleDateString('en-GB') : '-',
        `#${t.docNo || '-'}`,
        t.refDocNo ? `#${t.refDocNo}` : '-',
        t.type || '-',
        t.partyName || '-',
        `[${t.itemCode}] ${t.itemName || ''}`,
        t.process || '-',
        (t.outQty || 0) > 0 ? `+${t.outQty}` : '-',
        (t.outWt || 0) > 0 ? `+${Number(t.outWt).toFixed(3)}` : '-',
        (t.inQty || 0) > 0 ? `-${t.inQty}` : '-',
        (t.inWt || 0) > 0 ? `-${Number(t.inWt).toFixed(3)}` : '-',
        t.runningBalQty != null ? t.runningBalQty : 0,
        Number(t.runningBalWt || 0).toFixed(3)
      ]);

      autoTable(doc, {
        head: headers,
        body: body,
        startY: startY,
        styles: { fontSize: 7, cellPadding: 1.8, overflow: 'linebreak' },
        headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { cellWidth: 18 },
          2: { cellWidth: 18, fontStyle: 'bold' },
          3: { cellWidth: 16 },
          4: { cellWidth: 18, fontStyle: 'bold' },
          5: { cellWidth: 38 },
          6: { cellWidth: 44 },
          7: { cellWidth: 20 },
          8: { halign: 'right', cellWidth: 16, textColor: [37, 99, 235] },
          9: { halign: 'right', cellWidth: 16 },
          10: { halign: 'right', cellWidth: 16, textColor: [22, 163, 74] },
          11: { halign: 'right', cellWidth: 16 },
          12: { halign: 'right', cellWidth: 18, fontStyle: 'bold', textColor: [185, 28, 28] },
          13: { halign: 'right', cellWidth: 18, fontStyle: 'bold', textColor: [185, 28, 28] }
        },
        margin: { left: 14, right: 14 }
      });
    }

    if (action === 'preview') {
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPreviewUrl(blobUrl);
      setPreviewTitle(`Sub-Contract Movement Report - ${selectedParty ? selectedParty.name : 'All Parties'}`);
      setPreviewOpen(true);
    } else {
      const safeName = (selectedParty?.name || 'All_Parties').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Jobwork_Movement_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`);
    }
  };

  return (
    <Box sx={{ width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 1. Header & Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1, bgcolor: '#e0f2fe', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Factory sx={{ color: '#0F3B66', fontSize: 30 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F3B66', letterSpacing: -0.5 }}>
              Sub-Contract Movement
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.8rem' }}>
              Track Outward Sent vs Inward Received materials with outstanding balance at each Sub-Contractor
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Refresh />}
            onClick={fetchReport}
            disabled={loading}
            sx={{ borderColor: '#cbd5e1', color: '#475569', fontWeight: 600, textTransform: 'none' }}
          >
            Refresh
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<TableView />}
            onClick={handleExportExcel}
            disabled={!reportData}
            sx={{ borderColor: '#10b981', color: '#059669', fontWeight: 600, textTransform: 'none' }}
          >
            Export Excel
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<Visibility />}
            onClick={() => handleExportPDF('preview')}
            disabled={!reportData}
            sx={{ borderColor: '#0F3B66', color: '#0F3B66', fontWeight: 600, textTransform: 'none' }}
          >
            Preview PDF
          </Button>

          <Button
            variant="contained"
            size="small"
            startIcon={<PictureAsPdf />}
            onClick={() => handleExportPDF('download')}
            disabled={!reportData}
            sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#092542' }, fontWeight: 700, textTransform: 'none' }}
          >
            Download PDF
          </Button>
        </Box>
      </Box>

      {/* 2. Top Filter Controls Toolbar */}
      <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        <Grid container spacing={2} alignItems="center">
          {/* Party Name Filter (Job Worker) - Expanded Width & Wide Popup */}
          <Grid item xs={12} md={5}>
            <Autocomplete
              fullWidth
              options={partiesList}
              getOptionLabel={(option) => option?.name || ''}
              value={selectedParty}
              onChange={(e, val) => setSelectedParty(val)}
              isOptionEqualToValue={(option, value) => String(option?.id) === String(value?.id)}
              slotProps={{
                popper: {
                  sx: {
                    minWidth: { xs: '100%', sm: 400, md: 520 },
                    maxWidth: '95vw',
                    width: 'fit-content',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    borderRadius: 2,
                    zIndex: 1300
                  }
                }
              }}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                return (
                  <Box component="li" key={key || option.id} {...otherProps} sx={{ py: 1, px: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                      {option.name}
                    </Typography>
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  fullWidth
                  label="Filter by Party (Sub-Contractor)" 
                  size="small" 
                  placeholder="Select or search Sub-Contractor..."
                  InputLabelProps={{ shrink: true }}
                />
              )}
            />
          </Grid>

          {/* Item Filter (Expanded for Full Item Code & Description Readability) */}
          <Grid item xs={12} md={7}>
            <Autocomplete
              fullWidth
              options={itemsList}
              getOptionLabel={(option) => {
                if (!option) return '';
                const codePart = `${option.itemCode || ''}${option.subCode ? ` / ${option.subCode}` : ''}`;
                return `[${codePart}]  ${option.itemName || ''}`;
              }}
              value={selectedItem}
              onChange={(e, val) => setSelectedItem(val)}
              isOptionEqualToValue={(option, value) => option?.itemCode === value?.itemCode && (option?.subCode || '') === (value?.subCode || '')}
              slotProps={{
                popper: {
                  sx: {
                    minWidth: { xs: '100%', sm: 550, md: 720 },
                    maxWidth: '95vw',
                    width: 'fit-content',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                    borderRadius: 2,
                    zIndex: 1300
                  }
                }
              }}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                return (
                  <Box component="li" key={key || `${option.itemCode}_${option.subCode || ''}`} {...otherProps} sx={{ py: 1, px: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                        [{option.itemCode}{option.subCode ? ` / ${option.subCode}` : ''}]
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#475569', display: 'block', fontSize: '0.78rem' }}>
                        {option.itemName}
                      </Typography>
                    </Box>
                    <Chip label={option.unit || 'PCS'} size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#f1f5f9', flexShrink: 0 }} />
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  fullWidth
                  label="Filter by Item" 
                  size="small" 
                  placeholder="Select or search Item..."
                  InputLabelProps={{ shrink: true }}
                />
              )}
            />
          </Grid>

          {/* Date Range Picker */}
          <Grid item xs={12} sm={6} md={5}>
            <DatePicker
              portalId="root"
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update) => setDateRange(update)}
              isClearable={true}
              dateFormat="dd/MM/yyyy"
              customInput={
                <TextField 
                  label="Statement Period" 
                  size="small" 
                  InputLabelProps={{ shrink: true }} 
                  fullWidth 
                  placeholder={(!startDate && !endDate) ? "All Time (Full History)" : "DD/MM/YYYY - DD/MM/YYYY"}
                />
              }
            />
          </Grid>

          {/* Balance Status Filter - Generous width to comfortably fit full text */}
          <Grid item xs={12} sm={6} md={7}>
            <FormControl fullWidth size="small">
              <InputLabel shrink>Stock Balance Status</InputLabel>
              <Select
                value={statusFilter}
                label="Stock Balance Status"
                onChange={(e) => setStatusFilter(e.target.value)}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      minWidth: 360,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      borderRadius: 2
                    }
                  }
                }}
                sx={{
                  '& .MuiSelect-select': {
                    fontSize: '0.86rem'
                  }
                }}
              >
                <MenuItem value="all">All Movements</MenuItem>
                <MenuItem value="pending">Pending Outstanding Only (Out &gt; In)</MenuItem>
                <MenuItem value="settled">Settled / Nil Balance Only</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Date Presets Row & Reset */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5, pt: 1.5, borderTop: '1px dashed #e2e8f0', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mr: 0.5 }}>
              Quick Presets:
            </Typography>
            <Button size="small" variant={!startDate && !endDate ? "contained" : "outlined"} onClick={() => applyPreset('all')} sx={{ py: 0.2, px: 1, fontSize: '0.72rem', textTransform: 'none' }}>
              All Time
            </Button>
            <Button size="small" variant="outlined" onClick={() => applyPreset('today')} sx={{ py: 0.2, px: 1, fontSize: '0.72rem', textTransform: 'none' }}>
              Today
            </Button>
            <Button size="small" variant="outlined" onClick={() => applyPreset('thisMonth')} sx={{ py: 0.2, px: 1, fontSize: '0.72rem', textTransform: 'none' }}>
              This Month
            </Button>
            <Button size="small" variant="outlined" onClick={() => applyPreset('lastMonth')} sx={{ py: 0.2, px: 1, fontSize: '0.72rem', textTransform: 'none' }}>
              Last Month
            </Button>
            <Button size="small" variant="outlined" onClick={() => applyPreset('fy')} sx={{ py: 0.2, px: 1, fontSize: '0.72rem', textTransform: 'none' }}>
              Financial Year
            </Button>
          </Box>

          {(selectedParty || selectedItem || startDate || endDate || statusFilter !== 'all') && (
            <Button 
              size="small" 
              onClick={() => {
                setSelectedParty(null);
                setSelectedItem(null);
                setDateRange([null, null]);
                setStatusFilter('all');
                setSearchText('');
              }}
              sx={{ color: '#dc2626', textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
            >
              Clear All Filters
            </Button>
          )}
        </Box>
      </Paper>

      {/* 3. KPI Summary Metric Cards */}
      {reportData?.summary && (
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          {/* Card 1: Sent (Jobwork Out) */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 2, border: '1px solid #bfdbfe', bgcolor: '#eff6ff', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Total Material Sent (Out)
                  </Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e3a8a', my: 0.5 }}>
                  {Number(reportData.summary.totalOutQty || 0).toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>PCS</span>
                </Typography>
                <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 600 }}>
                  Weight: {Number(reportData.summary.totalOutWt || 0).toFixed(3)} KG
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 2: Received (Jobwork In) */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 2, border: '1px solid #bbf7d0', bgcolor: '#f0fdf4', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Total Received Back (In)
                  </Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#14532d', my: 0.5 }}>
                  {Number(reportData.summary.totalInQty || 0).toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>PCS</span>
                </Typography>
                <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 600 }}>
                  Weight: {Number(reportData.summary.totalInWt || 0).toFixed(3)} KG
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 3: Scrap Received */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 2, border: '1px solid #fed7aa', bgcolor: '#fff7ed', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#9a3412', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Scrap Accounted
                  </Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#7c2d12', my: 0.5 }}>
                  {Number(reportData.summary.totalScrapQty || 0).toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>PCS</span>
                </Typography>
                <Typography variant="caption" sx={{ color: '#c2410c', fontWeight: 600 }}>
                  Weight: {Number(reportData.summary.totalScrapWt || 0).toFixed(3)} KG
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 4: Net Outstanding Balance at Jobworker */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              borderRadius: 2, 
              border: '2px solid',
              borderColor: (reportData.summary.balanceQty || 0) > 0 ? '#f97316' : '#10b981',
              bgcolor: (reportData.summary.balanceQty || 0) > 0 ? '#fffbeb' : '#f0fdf4',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
            }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: (reportData.summary.balanceQty || 0) > 0 ? '#b45309' : '#15803d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Pending Balance at Party
                  </Typography>
                  {(reportData.summary.balanceQty || 0) > 0 ? (
                    <WarningAmber sx={{ color: '#d97706', fontSize: 22 }} />
                  ) : (
                    <CheckCircle sx={{ color: '#16a34a', fontSize: 22 }} />
                  )}
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: (reportData.summary.balanceQty || 0) > 0 ? '#b45309' : '#15803d', my: 0.5 }}>
                  {Number(reportData.summary.balanceQty || 0).toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>PCS</span>
                </Typography>
                <Typography variant="caption" sx={{ color: (reportData.summary.balanceQty || 0) > 0 ? '#92400e' : '#166534', fontWeight: 700 }}>
                  Outstanding Wt: {Number(reportData.summary.balanceWt || 0).toFixed(3)} KG
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* 4. Tabs Navigation & Search Row */}
      <Paper sx={{ mb: 2, borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', px: 2, flexWrap: 'wrap', gap: 1 }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, val) => setActiveTab(val)}
            textColor="primary"
            indicatorColor="primary"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.92rem',
                minHeight: 48,
                px: 2.5
              }
            }}
          >
            <Tab 
              icon={<Factory sx={{ fontSize: 18 }} />} 
              iconPosition="start" 
              label={`Party & Item Balances (${filteredSummary.length})`} 
            />
            <Tab 
              icon={<History sx={{ fontSize: 18 }} />} 
              iconPosition="start" 
              label={`Detailed Movement Register (${filteredTransactions.length})`} 
            />
          </Tabs>

          <Box sx={{ py: 1 }}>
            <TextField
              size="small"
              placeholder={activeTab === 0 ? "Search party, item code or name..." : "Search date, doc no, process, remarks..."}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              sx={{ borderRadius: 1.5, fontSize: '0.85rem', width: { xs: 240, sm: 340, md: 400 }, bgcolor: '#ffffff' }}
            />
          </Box>
        </Box>

        {/* Tab 0: Summary View (Party & Item Balances Matrix) */}
        {activeTab === 0 && (
          <TableContainer sx={{ maxHeight: '65vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#0F3B66', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', py: 1.2 } }}>
                  <TableCell sx={{ color: '#ffffff', width: 50, textAlign: 'center' }}>Sr</TableCell>
                  <TableCell sx={{ color: '#ffffff', minWidth: 180 }}>Sub-Contractor (Party)</TableCell>
                  <TableCell sx={{ color: '#ffffff', minWidth: 110 }}>Item Code</TableCell>
                  <TableCell sx={{ color: '#ffffff', minWidth: 200 }}>Item Name</TableCell>
                  <TableCell sx={{ color: '#ffffff', width: 70, textAlign: 'center' }}>Unit</TableCell>
                  <TableCell sx={{ color: '#ffffff', textAlign: 'right', minWidth: 110 }}>Sent Qty (Out)</TableCell>
                  <TableCell sx={{ color: '#ffffff', textAlign: 'right', minWidth: 110 }}>Sent Wt (KG)</TableCell>
                  <TableCell sx={{ color: '#ffffff', textAlign: 'right', minWidth: 110 }}>Recv Qty (In)</TableCell>
                  <TableCell sx={{ color: '#ffffff', textAlign: 'right', minWidth: 110 }}>Recv Wt (KG)</TableCell>
                  <TableCell sx={{ color: '#ffffff', textAlign: 'right', minWidth: 120 }}>Bal Qty (Outs)</TableCell>
                  <TableCell sx={{ color: '#ffffff', textAlign: 'right', minWidth: 120 }}>Bal Wt (KG)</TableCell>
                  <TableCell sx={{ color: '#ffffff', textAlign: 'center', width: 110 }}>Last Movement</TableCell>
                  <TableCell sx={{ color: '#ffffff', textAlign: 'center', width: 100 }}>Action</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={13} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={32} sx={{ color: '#0F3B66' }} />
                      <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>
                        Loading Sub-Contract balances...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredSummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} align="center" sx={{ py: 6 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: '#475569' }}>
                        No Sub-Contract records found matching your filter criteria.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSummary.map((row, idx) => {
                    const hasPending = (row.balQty || 0) > 0 || (row.balWt || 0) > 0;
                    return (
                      <TableRow 
                        key={`${row.ledgerId}_${row.itemCode}_${row.subCode || ''}_${idx}`} 
                        hover
                        sx={{ 
                          '&:nth-of-type(even)': { bgcolor: '#fafafa' },
                          bgcolor: hasPending ? '#fffdfa' : '#ffffff'
                        }}
                      >
                        <TableCell align="center" sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {idx + 1}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#0F3B66', fontSize: '0.85rem' }}>
                          {row.partyName || '-'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, color: '#1e293b', fontSize: '0.85rem' }}>
                          {row.itemCode || '-'}{row.subCode ? ` / ${row.subCode}` : ''}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.85rem', color: '#334155' }}>
                          {row.itemName || '-'}
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={row.unit || 'PCS'} size="small" sx={{ fontSize: '0.68rem', height: 20, bgcolor: '#f1f5f9' }} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: '#2563eb' }}>
                          {Number(row.outQty || 0).toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#475569' }}>
                          {Number(row.outWt || 0).toFixed(3)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: '#16a34a' }}>
                          {Number(row.inQty || 0).toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#475569' }}>
                          {Number(row.inWt || 0).toFixed(3)}
                        </TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={`${Number(row.balQty || 0).toLocaleString()} ${row.unit || 'PCS'}`} 
                            size="small"
                            sx={{ 
                              fontWeight: 800,
                              fontSize: '0.78rem',
                              bgcolor: hasPending ? '#fee2e2' : '#f0fdf4',
                              color: hasPending ? '#b91c1c' : '#15803d'
                            }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: hasPending ? '#b91c1c' : '#15803d' }}>
                          {Number(row.balWt || 0).toFixed(3)} KG
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {row.lastDate ? new Date(row.lastDate).toLocaleDateString('en-GB') : '-'}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="View Chronological Movement Register for this Party and Item">
                            <Button
                              size="small"
                              variant="outlined"
                              endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
                              onClick={() => handleDrilldown(row.ledgerId, row.partyName, row.itemCode, row.subCode, row.itemName)}
                              sx={{
                                py: 0.2,
                                px: 1,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                textTransform: 'none',
                                borderColor: '#0F3B66',
                                color: '#0F3B66',
                                '&:hover': { bgcolor: '#0F3B66', color: '#ffffff' }
                              }}
                            >
                              Ledger
                            </Button>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Tab 1: Detailed Movement Register View */}
        {activeTab === 1 && (
          <TableContainer sx={{ maxHeight: '65vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#0F3B66', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', py: 1.2 } }}>
                  <TableCell sx={{ color: '#ffffff', minWidth: 100 }}>Date & Time</TableCell>
                  <TableCell sx={{ color: '#ffffff', minWidth: 90 }}>Challan No</TableCell>
                  <TableCell sx={{ color: '#ffffff', minWidth: 120 }}>Movement Type</TableCell>
                  <TableCell sx={{ color: '#ffffff', minWidth: 160 }}>Sub-Contractor (Party)</TableCell>
                  <TableCell sx={{ color: '#ffffff', minWidth: 150 }}>Item Details</TableCell>
                  <TableCell sx={{ color: '#ffffff', minWidth: 100 }}>Process</TableCell>
                  <TableCell sx={{ color: '#ffffff', textAlign: 'right', minWidth: 100 }}>Sent (+)</TableCell>
                  <TableCell sx={{ color: '#ffffff', textAlign: 'right', minWidth: 105 }}>Sent Wt (+)</TableCell>
                  <TableCell sx={{ color: '#ffffff', textAlign: 'right', minWidth: 100 }}>Recv (-)</TableCell>
                  <TableCell sx={{ color: '#ffffff', textAlign: 'right', minWidth: 105 }}>Recv Wt (-)</TableCell>
                  <TableCell sx={{ color: '#ffffff', textAlign: 'right', minWidth: 110 }}>Bal Qty (Outs)</TableCell>
                  <TableCell sx={{ color: '#ffffff', textAlign: 'right', minWidth: 110 }}>Bal Wt (KG)</TableCell>
                  <TableCell sx={{ color: '#ffffff', minWidth: 140 }}>Remarks & Entry</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={13} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={32} sx={{ color: '#0F3B66' }} />
                      <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>
                        Loading movement register...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} align="center" sx={{ py: 6 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: '#475569' }}>
                        No transactions found for the selected filter combination.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx, idx) => {
                    const isOut = tx.direction === 'OUT';
                    return (
                      <TableRow 
                        key={tx.id || `tx_${idx}`} 
                        hover
                        sx={{ 
                          '&:nth-of-type(even)': { bgcolor: '#fafafa' },
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        {/* Date & Entry Time */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.82rem' }}>
                            {tx.date ? new Date(tx.date).toLocaleDateString('en-GB') : '-'}
                          </Typography>
                          {tx.entryTime && (
                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>
                              {tx.entryTime}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Challan / Doc No */}
                        <TableCell sx={{ fontWeight: 800, color: '#0F3B66', fontSize: '0.85rem' }}>
                          #{tx.docNo || '-'}
                          {tx.refDocNo && (
                            <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontSize: '0.68rem' }}>
                              Ref: #{tx.refDocNo}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Movement Type */}
                        <TableCell>
                          <Chip 
                            label={tx.type || '-'} 
                            size="small"
                            sx={{ 
                              fontSize: '0.72rem', 
                              fontWeight: 700,
                              bgcolor: isOut ? '#dbeafe' : '#dcfce7',
                              color: isOut ? '#1e40af' : '#15803d'
                            }}
                          />
                        </TableCell>

                        {/* Party Name */}
                        <TableCell sx={{ fontWeight: 600, color: '#334155', fontSize: '0.82rem' }}>
                          {tx.partyName || '-'}
                        </TableCell>

                        {/* Item Details */}
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66', fontSize: '0.82rem' }}>
                            [{tx.itemCode || '-'}{tx.subCode ? ` / ${tx.subCode}` : ''}]
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem' }}>
                            {tx.itemName || '-'}
                          </Typography>
                        </TableCell>

                        {/* Process */}
                        <TableCell sx={{ fontSize: '0.8rem', color: '#475569' }}>
                          {tx.process || '-'}
                        </TableCell>

                        {/* Out Qty (+) */}
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#2563eb' }}>
                          {(tx.outQty || 0) > 0 ? `+${tx.outQty}` : '-'}
                        </TableCell>

                        {/* Out Wt (+) */}
                        <TableCell align="right" sx={{ color: '#3b82f6' }}>
                          {(tx.outWt || 0) > 0 ? `+${Number(tx.outWt).toFixed(3)}` : '-'}
                        </TableCell>

                        {/* In Qty (-) */}
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#16a34a' }}>
                          {(tx.inQty || 0) > 0 ? `-${tx.inQty}` : '-'}
                        </TableCell>

                        {/* In Wt (-) */}
                        <TableCell align="right" sx={{ color: '#15803d' }}>
                          {(tx.inWt || 0) > 0 ? `-${Number(tx.inWt).toFixed(3)}` : '-'}
                        </TableCell>

                        {/* Running Balance Qty */}
                        <TableCell 
                          align="right" 
                          sx={{ 
                            fontWeight: 800, 
                            fontSize: '0.85rem',
                            bgcolor: '#f8fafc',
                            color: (tx.runningBalQty || 0) > 0 ? '#b91c1c' : '#15803d'
                          }}
                        >
                          {tx.runningBalQty != null ? tx.runningBalQty : 0}
                        </TableCell>

                        {/* Running Balance Wt */}
                        <TableCell 
                          align="right" 
                          sx={{ 
                            fontWeight: 800, 
                            fontSize: '0.85rem',
                            bgcolor: '#f8fafc',
                            color: (tx.runningBalWt || 0) > 0 ? '#b91c1c' : '#15803d'
                          }}
                        >
                          {Number(tx.runningBalWt || 0).toFixed(3)}
                        </TableCell>

                        {/* Remarks & Created By */}
                        <TableCell sx={{ fontSize: '0.75rem', color: '#64748b', maxWidth: 180 }}>
                          {tx.remark || '-'}
                          {tx.createdBy && (
                            <Typography variant="caption" sx={{ display: 'block', color: '#94a3b8', fontSize: '0.66rem' }}>
                              By: {tx.createdBy}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        pdfUrl={previewUrl}
        title={previewTitle}
      />
    </Box>
  );
};

const JobworkMovementReport = () => (
  <ErrorBoundary>
    <JobworkMovementReportContent />
  </ErrorBoundary>
);

export default JobworkMovementReport;
