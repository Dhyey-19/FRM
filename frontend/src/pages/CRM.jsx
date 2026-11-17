import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Tooltip,
  CircularProgress,
  Tabs,
  Tab,
  Snackbar,
  Alert,
  Menu,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Card,
  CardContent,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
  Print as PrintIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  TableChart as TableChartIcon,
  TrendingUp as TrendingUpIcon,
  ArrowForward as ArrowForwardIcon,
  Close as CloseIcon,
  Clear as ClearIcon,
  MoreVert as MoreVertIcon,
  MonetizationOn as MonetizationOnIcon,
  Timeline as TimelineIcon,
  ArrowDropDown as ArrowDropDownIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toExcelNum, ensureNumericWorksheet } from '../utils/excelHelper';
import { getLoggedUser, hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const STAGES = [
  'New',
  'Contacted',
  'Qualified',
  'Sample',
  'Quotation',
  'Negotiation',
  'Won',
  'Lost'
];

const STAGE_COLORS = {
  New: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  Contacted: { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc' },
  Qualified: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
  Sample: { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
  Quotation: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  Negotiation: { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
  Won: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
  Lost: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' }
};

const STATUS_BADGES = {
  '🔴 OVERDUE': { label: '🔴 OVERDUE', bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
  '🟠 DUE TODAY': { label: '🟠 DUE TODAY', bg: '#ffedd5', text: '#ea580c', border: '#fdba74' },
  '🟣 STUCK': { label: '🟣 STUCK', bg: '#f3e8ff', text: '#9333ea', border: '#e9d5ff' },
  '🟢 ON TRACK': { label: '🟢 ON TRACK', bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  '⚪ NO NEXT ACTION': { label: '⚪ NO NEXT ACTION', bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  '✅ WON': { label: '✅ WON', bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  '❌ LOST': { label: '❌ LOST', bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' }
};

const INITIAL_FORM_DATA = {
  DateAdded: new Date().toISOString().split('T')[0],
  Customer: '',
  Country: 'India',
  Contact: '',
  ItemCode: '',
  ProductRequirement: '',
  Stage: 'New',
  NextAction: '',
  FollowUpDate: '',
  DealValue: '',
  QtyAsked: '',
  OurPrice: '',
  TargetPrice: '',
  Source: '',
  BuyerType: '',
  CanWeMake: '',
  LostReason: '',
  Remarks: ''
};

const CRM = ({ initialTab = 0 }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [leads, setLeads] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [itemsList, setItemsList] = useState([]);
  const [ledgersList, setLedgersList] = useState([]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [quotedFilter, setQuotedFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialog State (Create / Edit Lead)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLeadId, setEditLeadId] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete Confirm Dialog
  const [deleteId, setDeleteId] = useState(null);

  // Quick Stage Change Menu
  const [stageMenuAnchor, setStageMenuAnchor] = useState(null);
  const [stageTargetLead, setStageTargetLead] = useState(null);

  // Snackbar Toast
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // File Input Ref for Excel Import
  const fileInputRef = useRef(null);

  // Fetch leads
  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/crm/leads`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data || []);
      } else {
        setSnackbar({ open: true, message: 'Failed to fetch leads from server', severity: 'error' });
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
      setSnackbar({ open: true, message: 'Server connection error', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch Dashboard
  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/crm/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error('Error fetching CRM dashboard:', err);
    }
  };

  // Fetch Items & Ledgers for dropdowns
  const fetchDropdownLookups = async () => {
    try {
      const [itemsRes, ledgersRes] = await Promise.all([
        fetch(`${API_BASE}/items`),
        fetch(`${API_BASE}/ledgers`)
      ]);
      if (itemsRes.ok) {
        const items = await itemsRes.json();
        setItemsList(Array.isArray(items) ? items : []);
      }
      if (ledgersRes.ok) {
        const ledgers = await ledgersRes.json();
        setLedgersList(Array.isArray(ledgers) ? ledgers : []);
      }
    } catch (err) {
      console.error('Error fetching lookups:', err);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchDashboard();
    fetchDropdownLookups();
  }, []);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(item => {
      // Search
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches = (
          (item.Customer || '').toLowerCase().includes(q) ||
          (item.Country || '').toLowerCase().includes(q) ||
          (item.Contact || '').toLowerCase().includes(q) ||
          (item.ProductRequirement || '').toLowerCase().includes(q) ||
          (item.ItemCode || '').toLowerCase().includes(q) ||
          (item.ItemName || '').toLowerCase().includes(q) ||
          (item.Remarks || '').toLowerCase().includes(q) ||
          (item.NextAction || '').toLowerCase().includes(q) ||
          (item.Source || '').toLowerCase().includes(q)
        );
        if (!matches) return false;
      }

      // Stage
      if (stageFilter !== 'ALL' && (item.Stage || '').toLowerCase() !== stageFilter.toLowerCase()) {
        return false;
      }

      // Status
      if (statusFilter !== 'ALL' && item.Status !== statusFilter) {
        return false;
      }

      // Quoted
      if (quotedFilter !== 'ALL' && item.Quoted !== quotedFilter) {
        return false;
      }

      // Source
      if (sourceFilter !== 'ALL' && (item.Source || '').toLowerCase() !== sourceFilter.toLowerCase()) {
        return false;
      }

      // Date Range
      if (startDate && item.DateAdded && item.DateAdded < startDate) {
        return false;
      }
      if (endDate && item.DateAdded && item.DateAdded > endDate) {
        return false;
      }

      return true;
    });
  }, [leads, searchTerm, stageFilter, statusFilter, quotedFilter, sourceFilter, startDate, endDate]);

  // Distinct Sources for filter dropdown
  const uniqueSources = useMemo(() => {
    const set = new Set();
    leads.forEach(l => {
      if (l.Source && l.Source.trim()) set.add(l.Source.trim());
    });
    return Array.from(set).sort();
  }, [leads]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setStageFilter('ALL');
    setStatusFilter('ALL');
    setQuotedFilter('ALL');
    setSourceFilter('ALL');
    setStartDate('');
    setEndDate('');
    setPage(0);
  };

  // Open Create Dialog
  const handleOpenCreate = () => {
    setFormData(INITIAL_FORM_DATA);
    setEditLeadId(null);
    setDialogOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (lead) => {
    setFormData({
      DateAdded: lead.DateAdded || new Date().toISOString().split('T')[0],
      Customer: lead.Customer || '',
      Country: lead.Country || 'India',
      Contact: lead.Contact || '',
      ItemCode: lead.ItemCode || '',
      ProductRequirement: lead.ProductRequirement || '',
      Stage: lead.Stage || 'New',
      NextAction: lead.NextAction || '',
      FollowUpDate: lead.FollowUpDate || '',
      DealValue: lead.DealValue ?? '',
      QtyAsked: lead.QtyAsked ?? '',
      OurPrice: lead.OurPrice ?? '',
      TargetPrice: lead.TargetPrice ?? '',
      Source: lead.Source || '',
      BuyerType: lead.BuyerType || '',
      CanWeMake: lead.CanWeMake || '',
      LostReason: lead.LostReason || '',
      Remarks: lead.Remarks || ''
    });
    setEditLeadId(lead.LeadID);
    setDialogOpen(true);
  };

  // Save Form (Create / Update)
  const handleSaveLead = async (e) => {
    if (e) e.preventDefault();
    if (!formData.Customer || !formData.Customer.trim()) {
      setSnackbar({ open: true, message: 'Customer name is required', severity: 'warning' });
      return;
    }

    setFormSubmitting(true);
    try {
      const user = getLoggedUser();
      const payload = {
        ...formData,
        User: user.FullName || user.username || 'System'
      };

      const url = editLeadId ? `${API_BASE}/crm/leads/${editLeadId}` : `${API_BASE}/crm/leads`;
      const method = editLeadId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSnackbar({
          open: true,
          message: editLeadId ? 'Inquiry updated successfully!' : 'New Inquiry added to CRM pipeline!',
          severity: 'success'
        });
        setDialogOpen(false);
        fetchLeads();
        fetchDashboard();
      } else {
        const errData = await res.json().catch(() => ({}));
        setSnackbar({ open: true, message: errData.message || 'Failed to save lead', severity: 'error' });
      }
    } catch (err) {
      console.error('Error saving lead:', err);
      setSnackbar({ open: true, message: 'Server error saving lead', severity: 'error' });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Lead
  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`${API_BASE}/crm/leads/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        setSnackbar({ open: true, message: 'Lead deleted successfully', severity: 'success' });
        setDeleteId(null);
        fetchLeads();
        fetchDashboard();
      } else {
        setSnackbar({ open: true, message: 'Failed to delete lead', severity: 'error' });
      }
    } catch (err) {
      console.error('Error deleting lead:', err);
      setSnackbar({ open: true, message: 'Error deleting lead', severity: 'error' });
    }
  };

  // Quick Stage Change
  const handleQuickStageClick = (e, lead) => {
    e.stopPropagation();
    setStageMenuAnchor(e.currentTarget);
    setStageTargetLead(lead);
  };

  const handleSelectQuickStage = async (newStage) => {
    setStageMenuAnchor(null);
    if (!stageTargetLead || stageTargetLead.Stage === newStage) return;

    try {
      const user = getLoggedUser();
      const res = await fetch(`${API_BASE}/crm/leads/${stageTargetLead.LeadID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...stageTargetLead,
          Stage: newStage,
          User: user.FullName || user.username || 'System'
        })
      });

      if (res.ok) {
        setSnackbar({
          open: true,
          message: `Stage updated to "${newStage}"`,
          severity: 'success'
        });
        fetchLeads();
        fetchDashboard();
      } else {
        setSnackbar({ open: true, message: 'Failed to update stage', severity: 'error' });
      }
    } catch (err) {
      console.error('Error updating stage:', err);
      setSnackbar({ open: true, message: 'Error updating stage', severity: 'error' });
    }
  };

  // Export to Excel (matching SALES for ERP format)
  const handleExportExcel = () => {
    try {
      const exportData = filteredLeads.map((item, idx) => ({
        '#': idx + 1,
        'Date Added': item.DateAdded,
        'Customer': item.Customer,
        'Country': item.Country,
        'Contact': item.Contact,
        'Product / Requirement': item.ProductRequirement,
        'Item Code': item.ItemCode,
        'Item Name': item.ItemName || '',
        'Stage': item.Stage,
        'Next Action': item.NextAction,
        'Follow-up Date': item.FollowUpDate,
        'Value (Rs)': toExcelNum(item.DealValue, 2),
        'Remarks': item.Remarks,
        'Status': item.Status,
        'Quoted?': item.Quoted,
        'Source': item.Source,
        'Qty Asked': toExcelNum(item.QtyAsked, 2),
        'Our Price (Rs)': toExcelNum(item.OurPrice, 2),
        'Target Price (Rs)': toExcelNum(item.TargetPrice, 2),
        'Buyer Type': item.BuyerType,
        'Can We Make?': item.CanWeMake,
        'Lost Reason': item.LostReason
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      ensureNumericWorksheet(ws);

      // Auto-fit column widths
      ws['!cols'] = [
        { wch: 4 },
        { wch: 12 },
        { wch: 25 },
        { wch: 10 },
        { wch: 22 },
        { wch: 28 },
        { wch: 14 },
        { wch: 24 },
        { wch: 12 },
        { wch: 26 },
        { wch: 14 },
        { wch: 14 },
        { wch: 28 },
        { wch: 18 },
        { wch: 10 },
        { wch: 14 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CRM Pipeline');
      XLSX.writeFile(wb, `FRM_Sales_CRM_Pipeline_${new Date().toISOString().split('T')[0]}.xlsx`);
      setSnackbar({ open: true, message: 'Exported leads successfully!', severity: 'success' });
    } catch (err) {
      console.error('Error exporting leads:', err);
      setSnackbar({ open: true, message: 'Failed to export Excel file', severity: 'error' });
    }
  };

  // Import from Excel (reads file and pushes to bulk API)
  const handleImportFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target.result;
          const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
          // Find sheet name: prefer 'CRM' or take the first sheet
          const sheetName = wb.SheetNames.find(s => s.trim().toUpperCase() === 'CRM') || wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

          if (!rawRows || rawRows.length === 0) {
            setSnackbar({ open: true, message: 'No records found in uploaded file', severity: 'warning' });
            setLoading(false);
            return;
          }

          const user = getLoggedUser();
          const payload = {
            items: rawRows.map(r => ({ ...r, CreatedBy: user.FullName || user.username || 'Excel Import' }))
          };

          const res = await fetch(`${API_BASE}/crm/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            const result = await res.json();
            setSnackbar({
              open: true,
              message: `Import complete! Added: ${result.added}, Skipped: ${result.skipped}`,
              severity: 'success'
            });
            fetchLeads();
            fetchDashboard();
          } else {
            const errData = await res.json().catch(() => ({}));
            setSnackbar({ open: true, message: errData.message || 'Import failed on server', severity: 'error' });
          }
        } catch (innerErr) {
          console.error('Error parsing Excel data:', innerErr);
          setSnackbar({ open: true, message: 'Invalid Excel file format', severity: 'error' });
        } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      console.error('Error reading file:', err);
      setSnackbar({ open: true, message: 'Error reading file', severity: 'error' });
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Export to PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(16);
      doc.text('FRM - Sales CRM & Leads Pipeline Report', 14, 15);
      doc.setFontSize(9);
      doc.text(`Generated on: ${new Date().toLocaleString()} | Total Filtered Leads: ${filteredLeads.length}`, 14, 22);

      const tableData = filteredLeads.map((item, idx) => [
        idx + 1,
        item.DateAdded || '',
        item.Customer || '',
        item.Country || '',
        item.Contact || '',
        item.ProductRequirement || item.ItemCode || '',
        item.Stage || '',
        item.NextAction || '',
        item.FollowUpDate || '',
        Number(item.DealValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        item.Status || '',
        item.Quoted || ''
      ]);

      autoTable(doc, {
        head: [['#', 'Date', 'Customer', 'Country', 'Contact', 'Requirement', 'Stage', 'Next Action', 'Follow-up', 'Value (₹)', 'Status', 'Quoted']],
        body: tableData,
        startY: 26,
        theme: 'striped',
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] }
      });

      doc.save(`FRM_Sales_CRM_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setSnackbar({ open: true, message: 'Failed to generate PDF', severity: 'error' });
    }
  };

  // KPI aggregates from filteredLeads
  const totalPipelineValue = useMemo(() => {
    return filteredLeads
      .filter(l => !['won', 'lost'].includes((l.Stage || '').toLowerCase()))
      .reduce((sum, l) => sum + (Number(l.DealValue) || 0), 0);
  }, [filteredLeads]);

  const overdueCount = useMemo(() => {
    return leads.filter(l => l.Status === '🔴 OVERDUE').length;
  }, [leads]);

  const dueTodayCount = useMemo(() => {
    return leads.filter(l => l.Status === '🟠 DUE TODAY').length;
  }, [leads]);

  const stuckCount = useMemo(() => {
    return leads.filter(l => l.Status === '🟣 STUCK').length;
  }, [leads]);

  const noNextActionCount = useMemo(() => {
    return leads.filter(l => l.Status === '⚪ NO NEXT ACTION').length;
  }, [leads]);

  const wonCount = useMemo(() => {
    return leads.filter(l => (l.Stage || '').toLowerCase() === 'won').length;
  }, [leads]);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      {/* Hidden file input for Excel Import */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".xlsx,.xls"
        onChange={handleImportFileChange}
      />

      {/* Header Bar */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          mb: 2.5,
          borderRadius: 2,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 1.5,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#fff'
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon sx={{ color: '#38bdf8', fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: -0.5 }}>
              Sales CRM & Funnel Management
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
            Interactive pipeline tracking, customer inquiries, quotes & executive performance dashboard
          </Typography>
        </Box>

        {/* Global Action Buttons */}
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          {hasAddPermission() && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
              sx={{
                bgcolor: '#0284c7',
                '&:hover': { bgcolor: '#0369a1' },
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 1.5
              }}
            >
              New Inquiry
            </Button>
          )}

          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            sx={{
              color: '#38bdf8',
              borderColor: '#38bdf8',
              '&:hover': { borderColor: '#7dd3fc', bgcolor: 'rgba(56,189,248,0.08)' },
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 1.5
            }}
          >
            Import Excel
          </Button>

          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportExcel}
            sx={{
              color: '#4ade80',
              borderColor: '#4ade80',
              '&:hover': { borderColor: '#86efac', bgcolor: 'rgba(74,222,128,0.08)' },
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 1.5
            }}
          >
            Export Excel
          </Button>

          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handleExportPDF}
            sx={{
              color: '#cbd5e1',
              borderColor: '#64748b',
              '&:hover': { borderColor: '#94a3b8', bgcolor: 'rgba(255,255,255,0.05)' },
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 1.5
            }}
          >
            PDF
          </Button>

          <IconButton
            onClick={() => {
              fetchLeads();
              fetchDashboard();
            }}
            sx={{ color: '#94a3b8', '&:hover': { color: '#fff' } }}
            title="Refresh Data"
          >
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Paper>

      {/* Main Tabs: 0 -> Pipeline Table, 1 -> Executive Dashboard */}
      <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2.5, bgcolor: 'transparent' }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              minHeight: 48
            }
          }}
        >
          <Tab
            icon={<TableChartIcon />}
            iconPosition="start"
            label={`Inquiries Pipeline (${leads.length})`}
          />
          <Tab
            icon={<AssessmentIcon />}
            iconPosition="start"
            label="Executive Sales Dashboard"
          />
        </Tabs>
      </Paper>

      {/* ========================================================================= */}
      {/* TAB 0: INQUIRIES PIPELINE TABLE VIEW */}
      {/* ========================================================================= */}
      {activeTab === 0 && (
        <Box>
          {/* Quick Filter KPI Chips Bar */}
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={6} sm={4} md={2}>
              <Paper
                onClick={() => setStatusFilter('ALL')}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: statusFilter === 'ALL' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  bgcolor: statusFilter === 'ALL' ? '#eff6ff' : '#fff',
                  transition: 'all 0.2s',
                  '&:hover': { boxShadow: 2 }
                }}
              >
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  TOTAL PIPELINE
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                  {leads.length}
                </Typography>
                <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 600 }}>
                  ₹ {totalPipelineValue.toLocaleString('en-IN')}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={4} md={2}>
              <Paper
                onClick={() => setStatusFilter(statusFilter === '🔴 OVERDUE' ? 'ALL' : '🔴 OVERDUE')}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: statusFilter === '🔴 OVERDUE' ? '2px solid #dc2626' : '1px solid #fee2e2',
                  bgcolor: statusFilter === '🔴 OVERDUE' ? '#fef2f2' : '#fff',
                  transition: 'all 0.2s',
                  '&:hover': { boxShadow: 2 }
                }}
              >
                <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 600 }}>
                  🔴 OVERDUE
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#dc2626' }}>
                  {overdueCount}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Requires urgent action
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={4} md={2}>
              <Paper
                onClick={() => setStatusFilter(statusFilter === '🟠 DUE TODAY' ? 'ALL' : '🟠 DUE TODAY')}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: statusFilter === '🟠 DUE TODAY' ? '2px solid #ea580c' : '1px solid #ffedd5',
                  bgcolor: statusFilter === '🟠 DUE TODAY' ? '#fff7ed' : '#fff',
                  transition: 'all 0.2s',
                  '&:hover': { boxShadow: 2 }
                }}
              >
                <Typography variant="caption" sx={{ color: '#ea580c', fontWeight: 600 }}>
                  🟠 DUE TODAY
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#ea580c' }}>
                  {dueTodayCount}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Follow-up today
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={4} md={2}>
              <Paper
                onClick={() => setStatusFilter(statusFilter === '🟣 STUCK' ? 'ALL' : '🟣 STUCK')}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: statusFilter === '🟣 STUCK' ? '2px solid #9333ea' : '1px solid #f3e8ff',
                  bgcolor: statusFilter === '🟣 STUCK' ? '#faf5ff' : '#fff',
                  transition: 'all 0.2s',
                  '&:hover': { boxShadow: 2 }
                }}
              >
                <Typography variant="caption" sx={{ color: '#9333ea', fontWeight: 600 }}>
                  🟣 STUCK (&gt;21d)
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#9333ea' }}>
                  {stuckCount}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Awaiting movement
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={4} md={2}>
              <Paper
                onClick={() => setStatusFilter(statusFilter === '⚪ NO NEXT ACTION' ? 'ALL' : '⚪ NO NEXT ACTION')}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: statusFilter === '⚪ NO NEXT ACTION' ? '2px solid #64748b' : '1px solid #e2e8f0',
                  bgcolor: statusFilter === '⚪ NO NEXT ACTION' ? '#f8fafc' : '#fff',
                  transition: 'all 0.2s',
                  '&:hover': { boxShadow: 2 }
                }}
              >
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  ⚪ NO NEXT ACTION
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#475569' }}>
                  {noNextActionCount}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Assign next step
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={4} md={2}>
              <Paper
                onClick={() => setStageFilter(stageFilter === 'Won' ? 'ALL' : 'Won')}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: stageFilter === 'Won' ? '2px solid #16a34a' : '1px solid #dcfce7',
                  bgcolor: stageFilter === 'Won' ? '#f0fdf4' : '#fff',
                  transition: 'all 0.2s',
                  '&:hover': { boxShadow: 2 }
                }}
              >
                <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 600 }}>
                  ✅ ORDERS WON
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#16a34a' }}>
                  {wonCount}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Closed deals
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Search & Filter Controls Card */}
          <Paper elevation={1} sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
            <Grid container spacing={1.5} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search customer, item, contact..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: searchTerm ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearchTerm('')}>
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null
                  }}
                />
              </Grid>

              <Grid item xs={6} sm={3} md={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Stage</InputLabel>
                  <Select
                    value={stageFilter}
                    label="Stage"
                    onChange={(e) => setStageFilter(e.target.value)}
                  >
                    <MenuItem value="ALL">All Stages</MenuItem>
                    {STAGES.map(s => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6} sm={3} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    label="Status"
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <MenuItem value="ALL">All Statuses</MenuItem>
                    {Object.keys(STATUS_BADGES).map(k => (
                      <MenuItem key={k} value={k}>{k}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6} sm={3} md={1.2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Quoted?</InputLabel>
                  <Select
                    value={quotedFilter}
                    label="Quoted?"
                    onChange={(e) => setQuotedFilter(e.target.value)}
                  >
                    <MenuItem value="ALL">All</MenuItem>
                    <MenuItem value="Yes">Yes</MenuItem>
                    <MenuItem value="No">No</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6} sm={3} md={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Source</InputLabel>
                  <Select
                    value={sourceFilter}
                    label="Source"
                    onChange={(e) => setSourceFilter(e.target.value)}
                  >
                    <MenuItem value="ALL">All Sources</MenuItem>
                    {uniqueSources.map(s => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6} sm={3} md={1.4}>
                <TextField
                  fullWidth
                  size="small"
                  label="From Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={6} sm={3} md={1.4}>
                <TextField
                  fullWidth
                  size="small"
                  label="To Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={12} md="auto">
                <Button
                  variant="text"
                  color="secondary"
                  size="small"
                  onClick={handleResetFilters}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Reset
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Leads Table */}
          <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            {loading ? (
              <Box sx={{ p: 5, textAlign: 'center' }}>
                <CircularProgress size={36} />
                <Typography variant="body2" sx={{ mt: 1.5, color: '#64748b' }}>
                  Loading inquiries pipeline...
                </Typography>
              </Box>
            ) : filteredLeads.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <Typography variant="h6" sx={{ color: '#64748b', fontWeight: 600 }}>
                  No Inquiries Match Your Filter Criteria
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5, mb: 2 }}>
                  Try adjusting your search keywords, stage, or date filters.
                </Typography>
                <Button variant="outlined" size="small" onClick={handleResetFilters}>
                  Clear All Filters
                </Button>
              </Box>
            ) : (
              <>
                <TableContainer sx={{ maxHeight: 'calc(100vh - 360px)', minHeight: 380 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700, fontSize: '0.8rem', color: '#334155' } }}>
                        <TableCell width={90}>Date</TableCell>
                        <TableCell minWidth={140}>Customer</TableCell>
                        <TableCell width={80}>Country</TableCell>
                        <TableCell minWidth={110}>Contact</TableCell>
                        <TableCell minWidth={160}>Product / Requirement</TableCell>
                        <TableCell width={110}>Stage</TableCell>
                        <TableCell minWidth={140}>Next Action</TableCell>
                        <TableCell width={100}>Follow-up</TableCell>
                        <TableCell align="right" width={110}>Value (₹)</TableCell>
                        <TableCell width={135}>Auto Status</TableCell>
                        <TableCell align="center" width={75}>Quoted</TableCell>
                        <TableCell align="center" width={85}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredLeads
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((row) => {
                          const stageStyle = STAGE_COLORS[row.Stage] || { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
                          const statusStyle = STATUS_BADGES[row.Status] || { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };

                          return (
                            <TableRow
                              key={row.LeadID}
                              hover
                              sx={{
                                '&:last-child td, &:last-child th': { border: 0 },
                                transition: 'background-color 0.15s'
                              }}
                            >
                              <TableCell sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                {row.DateAdded}
                              </TableCell>

                              <TableCell sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.82rem' }}>
                                {row.Customer}
                                {row.Source && (
                                  <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontSize: '0.7rem' }}>
                                    via {row.Source}
                                  </Typography>
                                )}
                              </TableCell>

                              <TableCell sx={{ fontSize: '0.78rem' }}>
                                {row.Country}
                              </TableCell>

                              <TableCell sx={{ fontSize: '0.78rem', color: '#334155' }}>
                                {row.Contact || '—'}
                              </TableCell>

                              <TableCell sx={{ fontSize: '0.78rem', maxWidth: 220 }}>
                                <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: 500, lineHeight: 1.3 }}>
                                  {row.ProductRequirement || (row.ItemName ? `${row.ItemCode}: ${row.ItemName}` : row.ItemCode) || '—'}
                                </Typography>
                                {row.QtyAsked ? (
                                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                                    Qty: {Number(row.QtyAsked).toLocaleString()}
                                  </Typography>
                                ) : null}
                              </TableCell>

                              {/* Interactive Stage Chip with Dropdown */}
                              <TableCell>
                                <Chip
                                  label={row.Stage}
                                  size="small"
                                  onClick={(e) => handleQuickStageClick(e, row)}
                                  onDelete={(e) => handleQuickStageClick(e, row)}
                                  deleteIcon={<ArrowDropDownIcon sx={{ fontSize: 18 }} />}
                                  sx={{
                                    bgcolor: stageStyle.bg,
                                    color: stageStyle.text,
                                    border: `1px solid ${stageStyle.border}`,
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    height: 24,
                                    cursor: 'pointer',
                                    '& .MuiChip-deleteIcon': {
                                      color: stageStyle.text,
                                      marginRight: '2px',
                                      '&:hover': { color: stageStyle.text }
                                    }
                                  }}
                                />
                              </TableCell>

                              <TableCell sx={{ fontSize: '0.78rem', color: '#334155' }}>
                                {row.NextAction ? (
                                  <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
                                    {row.NextAction}
                                  </Typography>
                                ) : (
                                  <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                    Not assigned
                                  </Typography>
                                )}
                              </TableCell>

                              <TableCell sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                {row.FollowUpDate ? (
                                  <Box
                                    component="span"
                                    sx={{
                                      color: row.Status === '🔴 OVERDUE' ? '#dc2626' : row.Status === '🟠 DUE TODAY' ? '#ea580c' : 'inherit',
                                      fontWeight: (row.Status === '🔴 OVERDUE' || row.Status === '🟠 DUE TODAY') ? 700 : 400
                                    }}
                                  >
                                    {row.FollowUpDate}
                                  </Box>
                                ) : (
                                  '—'
                                )}
                              </TableCell>

                              <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
                                {Number(row.DealValue) > 0 ? (
                                  `₹ ${Number(row.DealValue).toLocaleString('en-IN')}`
                                ) : (
                                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>—</Typography>
                                )}
                              </TableCell>

                              {/* Status Badge */}
                              <TableCell>
                                <Box
                                  sx={{
                                    display: 'inline-block',
                                    px: 1,
                                    py: 0.3,
                                    borderRadius: 1,
                                    bgcolor: statusStyle.bg,
                                    color: statusStyle.text,
                                    border: `1px solid ${statusStyle.border}`,
                                    fontWeight: 700,
                                    fontSize: '0.7rem',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {row.Status}
                                </Box>
                              </TableCell>

                              {/* Quoted? */}
                              <TableCell align="center">
                                <Chip
                                  label={row.Quoted}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    bgcolor: row.Quoted === 'Yes' ? '#dcfce7' : '#f1f5f9',
                                    color: row.Quoted === 'Yes' ? '#15803d' : '#64748b'
                                  }}
                                />
                              </TableCell>

                              {/* Actions */}
                              <TableCell align="center">
                                <Stack direction="row" spacing={0.5} justifyContent="center">
                                  {hasEditPermission() && (
                                    <IconButton
                                      size="small"
                                      onClick={() => handleOpenEdit(row)}
                                      sx={{ color: '#0284c7', p: 0.5 }}
                                      title="Edit Lead"
                                    >
                                      <EditIcon fontSize="small" sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  )}
                                  {hasDeletePermission() && (
                                    <IconButton
                                      size="small"
                                      onClick={() => setDeleteId(row.LeadID)}
                                      sx={{ color: '#ef4444', p: 0.5 }}
                                      title="Delete Lead"
                                    >
                                      <DeleteIcon fontSize="small" sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  )}
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Footer Toolbar: Summary & Pagination */}
                <Box
                  sx={{
                    p: 1.5,
                    borderTop: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 1
                  }}
                >
                  <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.8rem' }}>
                    Showing <strong>{filteredLeads.length}</strong> of <strong>{leads.length}</strong> inquiries | Filtered Open Value: <strong style={{ color: '#0284c7' }}>₹ {totalPipelineValue.toLocaleString('en-IN')}</strong>
                  </Typography>

                  <TablePagination
                    component="div"
                    count={filteredLeads.length}
                    page={page}
                    onPageChange={(e, p) => setPage(p)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setRowsPerPage(parseInt(e.target.value, 10));
                      setPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    sx={{ borderBottom: 0 }}
                  />
                </Box>
              </>
            )}
          </Paper>
        </Box>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: EXECUTIVE SALES DASHBOARD ("NEEL - SALES DASHBOARD") */}
      {/* ========================================================================= */}
      {activeTab === 1 && (
        <Box>
          {/* Dashboard Header Banner with Period Anchors */}
          <Paper
            elevation={1}
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
              color: '#fff'
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2 }}>
              <Box>
                <Typography variant="overline" sx={{ color: '#a5b4fc', letterSpacing: 1.5, fontWeight: 700 }}>
                  EXECUTIVE SALES REPORTING
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                  NEEL - SALES DASHBOARD
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
                  Sales Funnel Cohorts, Pipeline Velocity, Conversion Rates & Activity Tracking
                </Typography>
              </Box>

              {dashboardData?.anchors && (
                <Stack direction="row" spacing={1.5} sx={{ bgcolor: 'rgba(255,255,255,0.06)', p: 1.5, borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>TODAY</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#38bdf8' }}>{dashboardData.anchors.today}</Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>WEEK START</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#cbd5e1' }}>{dashboardData.anchors.weekStart}</Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>MONTH START</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#cbd5e1' }}>{dashboardData.anchors.monthStart}</Typography>
                  </Box>
                </Stack>
              )}
            </Box>
          </Paper>

          {/* Section: RIGHT NOW */}
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScheduleIcon sx={{ color: '#2563eb' }} /> RIGHT NOW — Pipeline Health
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderRadius: 2, border: '1px solid #bfdbfe', bgcolor: '#eff6ff', height: '100%' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ color: '#1d4ed8', fontWeight: 700, letterSpacing: 0.5 }}>
                    CURRENT OPEN PIPELINE
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e3a8a', my: 0.5 }}>
                    {dashboardData?.rightNow?.currentOpenPipeline ?? 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#2563eb', fontWeight: 600 }}>
                    Active Inquiries in Flight
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card
                onClick={() => {
                  setStatusFilter('🔴 OVERDUE');
                  setActiveTab(0);
                }}
                sx={{ borderRadius: 2, border: '1px solid #fecaca', bgcolor: '#fef2f2', height: '100%', cursor: 'pointer', transition: 'transform 0.15s', '&:hover': { transform: 'translateY(-2px)' } }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 700, letterSpacing: 0.5 }}>
                    OVERDUE FOLLOW-UPS
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#dc2626', my: 0.5 }}>
                    {dashboardData?.rightNow?.overdueFollowups ?? 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#991b1b', fontWeight: 600 }}>
                    Click to view overdue leads &rarr;
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card
                onClick={() => {
                  setStatusFilter('🟠 DUE TODAY');
                  setActiveTab(0);
                }}
                sx={{ borderRadius: 2, border: '1px solid #fed7aa', bgcolor: '#fff7ed', height: '100%', cursor: 'pointer', transition: 'transform 0.15s', '&:hover': { transform: 'translateY(-2px)' } }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ color: '#c2410c', fontWeight: 700, letterSpacing: 0.5 }}>
                    DUE TODAY
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#ea580c', my: 0.5 }}>
                    {dashboardData?.rightNow?.dueToday ?? 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9a3412', fontWeight: 600 }}>
                    Requires follow-up today &rarr;
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card
                onClick={() => {
                  setStatusFilter('⚪ NO NEXT ACTION');
                  setActiveTab(0);
                }}
                sx={{ borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f8fafc', height: '100%', cursor: 'pointer', transition: 'transform 0.15s', '&:hover': { transform: 'translateY(-2px)' } }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, letterSpacing: 0.5 }}>
                    MISSING NEXT ACTION
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#334155', my: 0.5 }}>
                    {dashboardData?.rightNow?.missingNextAction ?? 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
                    Assign follow-up plan &rarr;
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Section: SALES FUNNEL & ACTIVITY (Side by Side on desktop) */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Sales Funnel Grid */}
            <Grid item xs={12} md={7}>
              <Paper elevation={1} sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimelineIcon sx={{ color: '#0284c7' }} /> SALES FUNNEL
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700, color: '#334155' } }}>
                        <TableCell>Funnel Stage</TableCell>
                        <TableCell align="center" width={90}>Today</TableCell>
                        <TableCell align="center" width={100}>This Week</TableCell>
                        <TableCell align="center" width={105}>This Month</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow hover>
                        <TableCell sx={{ color: '#64748b' }}>Opening Inquiries</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.today?.openingInquiries ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.week?.openingInquiries ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.month?.openingInquiries ?? 0}</TableCell>
                      </TableRow>

                      <TableRow hover sx={{ bgcolor: 'rgba(59,130,246,0.04)' }}>
                        <TableCell sx={{ fontWeight: 600, color: '#2563eb' }}>+ New Inquiries</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{dashboardData?.funnel?.today?.newInquiries ?? 0}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{dashboardData?.funnel?.week?.newInquiries ?? 0}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{dashboardData?.funnel?.month?.newInquiries ?? 0}</TableCell>
                      </TableRow>

                      <TableRow hover>
                        <TableCell sx={{ pl: 4 }}>Qualified</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.today?.qualified ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.week?.qualified ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.month?.qualified ?? 0}</TableCell>
                      </TableRow>

                      <TableRow hover>
                        <TableCell sx={{ pl: 4 }}>Sample</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.today?.sample ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.week?.sample ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.month?.sample ?? 0}</TableCell>
                      </TableRow>

                      <TableRow hover sx={{ bgcolor: 'rgba(245,158,11,0.04)' }}>
                        <TableCell sx={{ pl: 4, fontWeight: 600, color: '#b45309' }}>Quotations Sent</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>{dashboardData?.funnel?.today?.quotationsSent ?? 0}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>{dashboardData?.funnel?.week?.quotationsSent ?? 0}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>{dashboardData?.funnel?.month?.quotationsSent ?? 0}</TableCell>
                      </TableRow>

                      <TableRow hover>
                        <TableCell sx={{ pl: 4 }}>Negotiation</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.today?.negotiation ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.week?.negotiation ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.month?.negotiation ?? 0}</TableCell>
                      </TableRow>

                      <TableRow hover sx={{ bgcolor: 'rgba(22,163,74,0.06)' }}>
                        <TableCell sx={{ fontWeight: 600, color: '#16a34a' }}>- Inquiries Won</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#16a34a' }}>{dashboardData?.funnel?.today?.inquiriesWon ?? 0}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#16a34a' }}>{dashboardData?.funnel?.week?.inquiriesWon ?? 0}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#16a34a' }}>{dashboardData?.funnel?.month?.inquiriesWon ?? 0}</TableCell>
                      </TableRow>

                      <TableRow hover sx={{ bgcolor: 'rgba(220,38,38,0.04)' }}>
                        <TableCell sx={{ fontWeight: 600, color: '#dc2626' }}>- Inquiries Lost</TableCell>
                        <TableCell align="center" sx={{ color: '#dc2626' }}>{dashboardData?.funnel?.today?.inquiriesLost ?? 0}</TableCell>
                        <TableCell align="center" sx={{ color: '#dc2626' }}>{dashboardData?.funnel?.week?.inquiriesLost ?? 0}</TableCell>
                        <TableCell align="center" sx={{ color: '#dc2626' }}>{dashboardData?.funnel?.month?.inquiriesLost ?? 0}</TableCell>
                      </TableRow>

                      <TableRow sx={{ bgcolor: '#f1f5f9', '& td': { fontWeight: 700, borderTop: 2, borderColor: '#cbd5e1' } }}>
                        <TableCell sx={{ color: '#0f172a' }}>= Current Open Inquiries</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.today?.currentOpenInquiries ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.week?.currentOpenInquiries ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.funnel?.month?.currentOpenInquiries ?? 0}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>

            {/* Activity Table */}
            <Grid item xs={12} md={5}>
              <Paper elevation={1} sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUpIcon sx={{ color: '#8b5cf6' }} /> ACTIVITY TRACKING
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700, color: '#334155' } }}>
                        <TableCell>Sales Activity</TableCell>
                        <TableCell align="center" width={70}>Today</TableCell>
                        <TableCell align="center" width={80}>Week</TableCell>
                        <TableCell align="center" width={80}>Month</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow hover>
                        <TableCell sx={{ fontWeight: 500 }}>New Leads Added</TableCell>
                        <TableCell align="center">{dashboardData?.activity?.today?.newLeadsAdded ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.activity?.week?.newLeadsAdded ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.activity?.month?.newLeadsAdded ?? 0}</TableCell>
                      </TableRow>

                      <TableRow hover>
                        <TableCell sx={{ fontWeight: 500 }}>Customers Contacted</TableCell>
                        <TableCell align="center">{dashboardData?.activity?.today?.customersContacted ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.activity?.week?.customersContacted ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.activity?.month?.customersContacted ?? 0}</TableCell>
                      </TableRow>

                      <TableRow hover>
                        <TableCell sx={{ fontWeight: 500 }}>Quotations Sent</TableCell>
                        <TableCell align="center">{dashboardData?.activity?.today?.quotationsSent ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.activity?.week?.quotationsSent ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.activity?.month?.quotationsSent ?? 0}</TableCell>
                      </TableRow>

                      <TableRow hover>
                        <TableCell sx={{ fontWeight: 500 }}>Follow-ups Pending</TableCell>
                        <TableCell align="center">{dashboardData?.activity?.today?.followupsPending ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.activity?.week?.followupsPending ?? 0}</TableCell>
                        <TableCell align="center">{dashboardData?.activity?.month?.followupsPending ?? 0}</TableCell>
                      </TableRow>

                      <TableRow hover sx={{ bgcolor: 'rgba(220,38,38,0.04)' }}>
                        <TableCell sx={{ fontWeight: 600, color: '#dc2626' }}>Overdue Follow-ups</TableCell>
                        <TableCell align="center" sx={{ color: '#dc2626', fontWeight: 700 }}>{dashboardData?.activity?.today?.overdueFollowups ?? 0}</TableCell>
                        <TableCell align="center" sx={{ color: '#dc2626', fontWeight: 700 }}>{dashboardData?.activity?.week?.overdueFollowups ?? 0}</TableCell>
                        <TableCell align="center" sx={{ color: '#dc2626', fontWeight: 700 }}>{dashboardData?.activity?.month?.overdueFollowups ?? 0}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>

          {/* Section: RESULTS & PERFORMANCE METRICS */}
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
            <MonetizationOnIcon sx={{ color: '#16a34a' }} /> RESULTS & CONVERSION METRICS
          </Typography>

          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 2 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700, color: '#334155' } }}>
                    <TableCell>Result / Conversion Metric</TableCell>
                    <TableCell align="right" width={140}>Today</TableCell>
                    <TableCell align="right" width={160}>This Week</TableCell>
                    <TableCell align="right" width={160}>This Month</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 600, color: '#0f172a' }}>Orders Won</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#16a34a' }}>
                      {dashboardData?.results?.today?.ordersWon ?? 0}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#16a34a' }}>
                      {dashboardData?.results?.week?.ordersWon ?? 0}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#16a34a' }}>
                      {dashboardData?.results?.month?.ordersWon ?? 0}
                    </TableCell>
                  </TableRow>

                  <TableRow hover sx={{ bgcolor: 'rgba(22,163,74,0.04)' }}>
                    <TableCell sx={{ fontWeight: 700, color: '#16a34a' }}>Sales Value (₹)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#16a34a' }}>
                      ₹ {Number(dashboardData?.results?.today?.salesValue || 0).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#16a34a' }}>
                      ₹ {Number(dashboardData?.results?.week?.salesValue || 0).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#16a34a' }}>
                      ₹ {Number(dashboardData?.results?.month?.salesValue || 0).toLocaleString('en-IN')}
                    </TableCell>
                  </TableRow>

                  <TableRow hover>
                    <TableCell sx={{ color: '#475569' }}>Average Order Value (₹)</TableCell>
                    <TableCell align="right">
                      ₹ {Math.round(dashboardData?.results?.today?.averageOrderValue || 0).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell align="right">
                      ₹ {Math.round(dashboardData?.results?.week?.averageOrderValue || 0).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell align="right">
                      ₹ {Math.round(dashboardData?.results?.month?.averageOrderValue || 0).toLocaleString('en-IN')}
                    </TableCell>
                  </TableRow>

                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 600, color: '#2563eb' }}>
                      Win Rate (Won / Won+Lost)
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#2563eb' }}>
                      {((dashboardData?.results?.today?.winRate || 0) * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#2563eb' }}>
                      {((dashboardData?.results?.week?.winRate || 0) * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#2563eb' }}>
                      {((dashboardData?.results?.month?.winRate || 0) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>

                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 600, color: '#7c3aed' }}>
                      Quote-to-Order Conversion (Won / Quoted)
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#7c3aed' }}>
                      {((dashboardData?.results?.today?.quoteToOrderConversion || 0) * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#7c3aed' }}>
                      {((dashboardData?.results?.week?.quoteToOrderConversion || 0) * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#7c3aed' }}>
                      {((dashboardData?.results?.month?.quoteToOrderConversion || 0) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>

                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 600, color: '#0284c7' }}>
                      Inquiry-to-Order Conversion (Won / New Leads)
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#0284c7' }}>
                      {((dashboardData?.results?.today?.inquiryToOrderConversion || 0) * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#0284c7' }}>
                      {((dashboardData?.results?.week?.inquiryToOrderConversion || 0) * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#0284c7' }}>
                      {((dashboardData?.results?.month?.inquiryToOrderConversion || 0) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* ========================================================================= */}
      {/* DIALOG: CREATE / EDIT INQUIRY */}
      {/* ========================================================================= */}
      <Dialog
        open={dialogOpen}
        onClose={() => !formSubmitting && setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{editLeadId ? `Edit Inquiry (Lead #${editLeadId})` : 'New Sales Inquiry / Lead'}</span>
          <IconButton size="small" onClick={() => setDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <form onSubmit={handleSaveLead}>
          <DialogContent sx={{ pt: 2.5 }}>
            <Grid container spacing={2}>
              {/* Section 1: Customer & Contact */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0284c7', mb: 0.5 }}>
                  1. CUSTOMER & INQUIRY ORIGIN
                </Typography>
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  required
                  size="small"
                  label="Date Added"
                  type="date"
                  value={formData.DateAdded}
                  onChange={(e) => setFormData({ ...formData, DateAdded: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={8}>
                <Autocomplete
                  freeSolo
                  options={ledgersList.map(l => l.LedgerName || '')}
                  value={formData.Customer}
                  onInputChange={(e, val) => setFormData({ ...formData, Customer: val })}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      required
                      size="small"
                      label="Customer / Buyer Company Name"
                      placeholder="e.g. Customer Name"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Country"
                  value={formData.Country}
                  onChange={(e) => setFormData({ ...formData, Country: e.target.value })}
                  placeholder="e.g. India, USA, Germany"
                />
              </Grid>

              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  size="small"
                  label="Contact Person & Phone / Email"
                  value={formData.Contact}
                  onChange={(e) => setFormData({ ...formData, Contact: e.target.value })}
                  placeholder="e.g. Rajesh Kumar (+91 98250 12345 / rajesh@gmail.com)"
                />
              </Grid>

              {/* Section 2: Product & Commercials */}
              <Grid item xs={12} sx={{ mt: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0284c7', mb: 0.5 }}>
                  2. PRODUCT REQUIREMENT & COMMERCIALS
                </Typography>
              </Grid>

              <Grid item xs={12} sm={5}>
                <Autocomplete
                  freeSolo
                  options={itemsList}
                  getOptionLabel={(opt) => typeof opt === 'string' ? opt : `${opt.ItemCode} - ${opt.ItemName || ''}`}
                  value={itemsList.find(i => i.ItemCode === formData.ItemCode) || formData.ItemCode}
                  onChange={(e, val) => {
                    if (val && typeof val === 'object') {
                      setFormData({
                        ...formData,
                        ItemCode: val.ItemCode,
                        ProductRequirement: formData.ProductRequirement || val.ItemName || ''
                      });
                    } else {
                      setFormData({ ...formData, ItemCode: val || '' });
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      label="Item Code (Catalog Lookup)"
                      placeholder="e.g. FG-BT01"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={7}>
                <TextField
                  fullWidth
                  size="small"
                  label="Product / Requirement Details"
                  value={formData.ProductRequirement}
                  onChange={(e) => setFormData({ ...formData, ProductRequirement: e.target.value })}
                  placeholder="e.g. 5000 pcs CNC Turned Brass Spindle 15mm"
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Quantity Asked"
                  type="number"
                  value={formData.QtyAsked}
                  onChange={(e) => setFormData({ ...formData, QtyAsked: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Our Price (₹/pc)"
                  type="number"
                  value={formData.OurPrice}
                  onChange={(e) => setFormData({ ...formData, OurPrice: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Target Price (₹/pc)"
                  type="number"
                  value={formData.TargetPrice}
                  onChange={(e) => setFormData({ ...formData, TargetPrice: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Total Value (₹)"
                  type="number"
                  value={formData.DealValue}
                  onChange={(e) => setFormData({ ...formData, DealValue: e.target.value })}
                  placeholder="Deal total ₹"
                />
              </Grid>

              {/* Section 3: Pipeline & Action */}
              <Grid item xs={12} sx={{ mt: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0284c7', mb: 0.5 }}>
                  3. PIPELINE STAGE & NEXT ACTION
                </Typography>
              </Grid>

              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Pipeline Stage</InputLabel>
                  <Select
                    value={formData.Stage}
                    label="Pipeline Stage"
                    onChange={(e) => setFormData({ ...formData, Stage: e.target.value })}
                  >
                    {STAGES.map(s => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  size="small"
                  label="Next Action"
                  value={formData.NextAction}
                  onChange={(e) => setFormData({ ...formData, NextAction: e.target.value })}
                  placeholder="e.g. Send revised quote, Call for specs"
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Follow-up Date"
                  type="date"
                  value={formData.FollowUpDate}
                  onChange={(e) => setFormData({ ...formData, FollowUpDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Inquiry Source"
                  value={formData.Source}
                  onChange={(e) => setFormData({ ...formData, Source: e.target.value })}
                  placeholder="Indiamart, Direct, Referral, Website..."
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Buyer Type"
                  value={formData.BuyerType}
                  onChange={(e) => setFormData({ ...formData, BuyerType: e.target.value })}
                  placeholder="Manufacturer, Trader, End User, OEM..."
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Can We Make?"
                  value={formData.CanWeMake}
                  onChange={(e) => setFormData({ ...formData, CanWeMake: e.target.value })}
                  placeholder="Yes, Pending Tech Review, Need Tooling..."
                />
              </Grid>

              {formData.Stage === 'Lost' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Lost Reason"
                    value={formData.LostReason}
                    onChange={(e) => setFormData({ ...formData, LostReason: e.target.value })}
                    placeholder="Price high, Delivery timeline, Competitor, No response..."
                  />
                </Grid>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                  label="Remarks & Discussion Notes"
                  value={formData.Remarks}
                  onChange={(e) => setFormData({ ...formData, Remarks: e.target.value })}
                  placeholder="Additional notes from customer call or meeting..."
                />
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, borderTop: 1, borderColor: 'divider' }}>
            <Button onClick={() => setDialogOpen(false)} disabled={formSubmitting} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={formSubmitting}
              sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, textTransform: 'none', fontWeight: 600, px: 3 }}
            >
              {formSubmitting ? 'Saving...' : editLeadId ? 'Update Inquiry' : 'Add Inquiry'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* QUICK STAGE POPUP MENU */}
      {/* ========================================================================= */}
      <Menu
        anchorEl={stageMenuAnchor}
        open={Boolean(stageMenuAnchor)}
        onClose={() => setStageMenuAnchor(null)}
      >
        <Typography variant="caption" sx={{ px: 2, py: 0.5, color: '#64748b', fontWeight: 700, display: 'block' }}>
          CHANGE STAGE TO:
        </Typography>
        <Divider />
        {STAGES.map(s => (
          <MenuItem
            key={s}
            onClick={() => handleSelectQuickStage(s)}
            selected={stageTargetLead?.Stage === s}
            sx={{ fontSize: '0.82rem', py: 0.75 }}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: STAGE_COLORS[s]?.text || '#64748b',
                mr: 1.5
              }}
            />
            {s}
          </MenuItem>
        ))}
      </Menu>

      {/* ========================================================================= */}
      {/* DELETE CONFIRM DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete this sales inquiry? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" sx={{ textTransform: 'none', fontWeight: 600 }}>
            Delete Lead
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* SNACKBAR NOTIFICATION */}
      {/* ========================================================================= */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%', fontWeight: 500 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CRM;
