import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, Typography, Button, Paper, CircularProgress, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, InputAdornment, Toolbar, TableSortLabel,
  ToggleButton, ToggleButtonGroup,
  FormControl, InputLabel, Select, MenuItem, Tooltip,
  IconButton, Collapse, Chip, Card, CardContent, Grid,
  Divider, Alert, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, TablePagination
} from '@mui/material';
import { 
  PictureAsPdf, Visibility, TableView, Share, 
  Search as SearchIcon, KeyboardArrowDown, KeyboardArrowUp,
  Inventory, Business, Factory, Layers, UnfoldMore, UnfoldLess,
  WarningAmber, Edit as EditIcon, Refresh as RefreshIcon, EventBusy as EventBusyIcon, AccessTime
} from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ensureNumericWorksheet } from '../../utils/excelHelper';

// Error Boundary to catch render exceptions and prevent blank page
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('StockReport ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4 }}>
          <Alert 
            severity="error" 
            action={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button color="inherit" size="small" onClick={() => this.setState({ hasError: false, error: null })}>
                  Try Again
                </Button>
                <Button color="inherit" size="small" onClick={() => window.location.reload()}>
                  Reload Page
                </Button>
              </Box>
            }
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              An error occurred while displaying the Stock Report.
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

const StockReportContent = () => {
  const navigate = useNavigate();
  const localUser = (() => {
    try {
      const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  // Report Type: 'combined', 'item', 'department', 'jobwork'
  const [reportType, setReportType] = useState('combined');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [typeFilter, setTypeFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [jwFilter, setJwFilter] = useState('All');
  const [scopeFilter, setScopeFilter] = useState('WithStock'); // 'All', 'WithStock', 'MainStock', 'DeptStock', 'JwStock', 'NegativeStock'
  const [negativeOnly, setNegativeOnly] = useState(false);
  
  // Expanded rows map for Combined view
  const [expandedRows, setExpandedRows] = useState({});

  // Sorting states
  const [orderBy, setOrderBy] = useState('ItemCode');
  const [order, setOrder] = useState('asc');

  // Main Tab State: 0 = Current Stock Report, 1 = Dead Stock Report
  const [mainTab, setMainTab] = useState(0);

  // Dead Stock States
  const [deadStockData, setDeadStockData] = useState([]);
  const [deadStockSummary, setDeadStockSummary] = useState({
    totalDeadStockItems: 0,
    totalDeadStockQty: 0,
    totalDeadStockValue: 0,
    autoCount: 0,
    manualCount: 0
  });
  const [deadStockLoading, setDeadStockLoading] = useState(false);
  
  // Dead Stock Filters & Search
  const [deadStockSearch, setDeadStockSearch] = useState('');
  const [deadStockTypeFilter, setDeadStockTypeFilter] = useState('All'); // 'All', 'Auto', 'Manual'
  const [deadStockCategoryFilter, setDeadStockCategoryFilter] = useState('All'); // 'All', 'SubContract', 'Inhouse', 'BOP'
  const [deadStockWarehouseFilter, setDeadStockWarehouseFilter] = useState('All');

  // Dead Stock Sort & Pagination
  const [deadStockOrderBy, setDeadStockOrderBy] = useState('DaysInactive');
  const [deadStockOrder, setDeadStockOrder] = useState('desc');
  const [dsPage, setDsPage] = useState(0);
  const [dsRowsPerPage, setDsRowsPerPage] = useState(25);

  // Quick Edit Modal in Dead Stock
  const [dsModalOpen, setDsModalOpen] = useState(false);
  const [selectedDsItem, setSelectedDsItem] = useState(null);
  const [dsModalType, setDsModalType] = useState('Auto');
  const [dsModalDays, setDsModalDays] = useState('');
  const [dsModalLoading, setDsModalLoading] = useState(false);

  const fetchDeadStock = async () => {
    setDeadStockLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${baseUrl}/items/dead-stock`);
      if (!res.ok) throw new Error('Failed to fetch dead stock report');
      const json = await res.json();
      setDeadStockData(Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []));
      setDeadStockSummary(json?.summary || {
        totalDeadStockItems: 0,
        totalDeadStockQty: 0,
        totalDeadStockValue: 0,
        autoCount: 0,
        manualCount: 0
      });
    } catch (err) {
      console.error('Error fetching dead stock report:', err);
    } finally {
      setDeadStockLoading(false);
    }
  };

  useEffect(() => {
    fetchDeadStock();
  }, []);

  useEffect(() => {
    if (mainTab === 1) {
      fetchDeadStock();
    }
  }, [mainTab]);

  useEffect(() => {
    fetchData();
  }, [reportType]);

  const fetchData = async () => {
    setLoading(true);
    setExpandedRows({});
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      let endpoint = `${baseUrl}/items/combined-stock`;
      if (reportType === 'item') {
        endpoint = `${baseUrl}/items`;
      } else if (reportType === 'department') {
        endpoint = `${baseUrl}/departments/stock`;
      } else if (reportType === 'jobwork') {
        endpoint = `${baseUrl}/jobwork-ins/stock-report`;
      }
      
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch stock report');
      const result = await response.json();
      const mapped = Array.isArray(result) ? result.map(r => {
        if (reportType === 'item') {
          const val = Math.round(((parseFloat(r.ClosingStock) || 0) * (parseFloat(r.Costing) || 0)) * 100) / 100;
          return { ...r, Valuation: val };
        }
        return r;
      }) : [];
      setData(mapped);
    } catch (error) {
      console.error('Error fetching stock report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReportTypeChange = (event, newType) => {
    if (newType !== null) {
      setReportType(newType);
      setSearchTerm('');
      setTypeFilter('All');
      setBrandFilter('All');
      setDeptFilter('All');
      setJwFilter('All');
      setScopeFilter(newType === 'combined' ? 'WithStock' : 'All');
      setNegativeOnly(false);
      
      let defaultOrder = 'ItemCode';
      if (newType === 'department') defaultOrder = 'DeptName';
      else if (newType === 'jobwork') defaultOrder = 'LedgerName';
      setOrderBy(defaultOrder);
      setOrder('asc');
    }
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const toggleRowExpansion = (itemKey) => {
    setExpandedRows(prev => ({
      ...prev,
      [itemKey]: !prev[itemKey]
    }));
  };

  const handleExpandAll = (expand) => {
    if (!expand) {
      setExpandedRows({});
      return;
    }
    const newMap = {};
    sortedData.forEach(row => {
      const key = `${row.ItemCode}__${row.SubCode || ''}`;
      newMap[key] = true;
    });
    setExpandedRows(newMap);
  };

  // Unique filter lists
  const safeData = Array.isArray(data) ? data : [];
  const uniqueTypes = useMemo(() => ['All', ...Array.from(new Set(safeData.map(d => d.ItemType).filter(Boolean))).sort()], [safeData]);
  const uniqueBrands = useMemo(() => ['All', ...Array.from(new Set(safeData.map(d => d.Series).filter(Boolean))).sort()], [safeData]);
  
  // Unique Departments list
  const uniqueDepts = useMemo(() => {
    if (reportType === 'department') {
      return ['All', ...Array.from(new Set(safeData.map(d => d.DeptName).filter(Boolean))).sort()];
    }
    if (reportType === 'combined') {
      const set = new Set();
      safeData.forEach(item => {
        (item.Departments || []).forEach(d => {
          if (d.DeptName) set.add(d.DeptName);
        });
      });
      return ['All', ...Array.from(set).sort()];
    }
    return ['All'];
  }, [safeData, reportType]);

  // Unique Job Workers list
  const uniqueJobworkers = useMemo(() => {
    if (reportType === 'jobwork') {
      return ['All', ...Array.from(new Set(safeData.map(d => d.LedgerName).filter(Boolean))).sort()];
    }
    if (reportType === 'combined') {
      const set = new Set();
      safeData.forEach(item => {
        (item.Jobworkers || []).forEach(j => {
          if (j.LedgerName) set.add(j.LedgerName);
        });
      });
      return ['All', ...Array.from(set).sort()];
    }
    return ['All'];
  }, [safeData, reportType]);

  // Negative Stock Count across currently loaded data
  const negativeCount = useMemo(() => {
    if (reportType === 'combined') {
      return safeData.filter(r => 
        (r.TotalStock || 0) < 0 || 
        (r.MainStock || 0) < 0 || 
        (r.DeptStock || 0) < 0 || 
        (r.JwStock || 0) < 0 ||
        (r.Departments || []).some(d => (d.Pcs || 0) < 0 || (d.Weight || 0) < 0) ||
        (r.Jobworkers || []).some(j => (j.BalQty || 0) < 0 || (j.BalNetWt || 0) < 0)
      ).length;
    }
    if (reportType === 'item') {
      return safeData.filter(r => (r.ClosingStock || 0) < 0).length;
    }
    if (reportType === 'department') {
      return safeData.filter(r => (r.Pcs || 0) < 0 || (r.Weight || 0) < 0).length;
    }
    if (reportType === 'jobwork') {
      return safeData.filter(r => (r.BalQty || 0) < 0 || (r.BalNetWt || 0) < 0).length;
    }
    return 0;
  }, [safeData, reportType]);

  // Combined active negative filter flag
  const isNegativeActive = negativeOnly || (reportType === 'combined' && scopeFilter === 'NegativeStock');

  // Filter Data
  const filteredData = useMemo(() => {
    return safeData.filter(row => {
      // 0. Negative Stock Filter (Applies to all views when active)
      if (isNegativeActive) {
        if (reportType === 'combined') {
          const hasNeg = (row.TotalStock || 0) < 0 || 
                         (row.MainStock || 0) < 0 || 
                         (row.DeptStock || 0) < 0 || 
                         (row.JwStock || 0) < 0 ||
                         (row.Departments || []).some(d => (d.Pcs || 0) < 0 || (d.Weight || 0) < 0) ||
                         (row.Jobworkers || []).some(j => (j.BalQty || 0) < 0 || (j.BalNetWt || 0) < 0);
          if (!hasNeg) return false;
        } else if (reportType === 'item') {
          if ((row.ClosingStock || 0) >= 0) return false;
        } else if (reportType === 'department') {
          if ((row.Pcs || 0) >= 0 && (row.Weight || 0) >= 0) return false;
        } else if (reportType === 'jobwork') {
          if ((row.BalQty || 0) >= 0 && (row.BalNetWt || 0) >= 0) return false;
        }
      }
      // 1. Combined View Filtering
      if (reportType === 'combined') {
        if (typeFilter !== 'All' && row.ItemType !== typeFilter) return false;
        if (brandFilter !== 'All' && row.Series !== brandFilter) return false;

        // Scope filter (skip positive checks if Negative Stock filter is active)
        if (!isNegativeActive) {
          if (scopeFilter === 'WithStock' && (row.TotalStock || 0) <= 0 && (row.DeptWeight || 0) <= 0 && (row.JwWeight || 0) <= 0) return false;
          if (scopeFilter === 'MainStock' && (row.MainStock || 0) <= 0) return false;
          if (scopeFilter === 'DeptStock' && (row.DeptStock || 0) <= 0 && (row.DeptWeight || 0) <= 0) return false;
          if (scopeFilter === 'JwStock' && (row.JwStock || 0) <= 0 && (row.JwWeight || 0) <= 0) return false;
        }

        // Specific Department Filter
        if (deptFilter !== 'All') {
          const hasDept = (row.Departments || []).some(d => d.DeptName === deptFilter && ((d.Pcs || 0) !== 0 || (d.Weight || 0) !== 0));
          if (!hasDept) return false;
        }

        // Specific Job Worker Filter
        if (jwFilter !== 'All') {
          const hasJw = (row.Jobworkers || []).some(j => j.LedgerName === jwFilter && ((j.BalQty || 0) !== 0 || (j.BalNetWt || 0) !== 0));
          if (!hasJw) return false;
        }

        // Search term
        const search = searchTerm.toLowerCase();
        if (search) {
          const matchesCode = (row.ItemCode || '').toLowerCase().includes(search);
          const matchesSubCode = (row.SubCode || '').toLowerCase().includes(search);
          const matchesName = (row.ItemName || '').toLowerCase().includes(search);
          const matchesType = (row.ItemType || '').toLowerCase().includes(search);
          const matchesSeries = (row.Series || '').toLowerCase().includes(search);
          const matchesDept = (row.Departments || []).some(d => (d.DeptName || '').toLowerCase().includes(search));
          const matchesJw = (row.Jobworkers || []).some(j => (j.LedgerName || '').toLowerCase().includes(search));
          if (!matchesCode && !matchesSubCode && !matchesName && !matchesType && !matchesSeries && !matchesDept && !matchesJw) return false;
        }

        return true;
      }

      // 2. Item View Filtering
      if (reportType === 'item') {
        if (typeFilter !== 'All' && row.ItemType !== typeFilter) return false;
        if (brandFilter !== 'All' && row.Series !== brandFilter) return false;
        
        const search = searchTerm.toLowerCase();
        if (!search) return true;
        return (
          row.ItemCode?.toLowerCase().includes(search) || 
          row.SubCode?.toLowerCase().includes(search) || 
          row.ItemName?.toLowerCase().includes(search) ||
          row.ItemType?.toLowerCase().includes(search) ||
          row.Series?.toLowerCase().includes(search)
        );
      }

      // 3. Department View Filtering
      if (reportType === 'department') {
        if (deptFilter !== 'All' && row.DeptName !== deptFilter) return false;
        
        const search = searchTerm.toLowerCase();
        if (!search) return true;
        return (
          row.DeptName?.toLowerCase().includes(search) || 
          row.ItemCode?.toLowerCase().includes(search) ||
          row.SubCode?.toLowerCase().includes(search) ||
          row.ItemName?.toLowerCase().includes(search)
        );
      }

      // 4. Job Work Stock View Filtering
      if (reportType === 'jobwork') {
        if (jwFilter !== 'All' && row.LedgerName !== jwFilter) return false;

        const search = searchTerm.toLowerCase();
        if (!search) return true;
        return (
          row.LedgerName?.toLowerCase().includes(search) || 
          row.ItemCode?.toLowerCase().includes(search) ||
          row.SubCode?.toLowerCase().includes(search) ||
          row.ItemName?.toLowerCase().includes(search)
        );
      }

      return true;
    });
  }, [safeData, reportType, typeFilter, brandFilter, scopeFilter, deptFilter, jwFilter, searchTerm, negativeOnly]);

  // Sort Data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let aValue = a[orderBy] || '';
      let bValue = b[orderBy] || '';

      // Handle numeric sorting
      if ([
        'MRP', 'Costing', 'OpeningStock', 'ClosingStock', 'Pcs', 'Weight', 'Valuation',
        'MainStock', 'DeptStock', 'DeptWeight', 'JwStock', 'JwWeight', 'TotalStock', 'TotalWeight',
        'OutQty', 'OutNetWt', 'InQty', 'InNetWt', 'BalQty', 'BalNetWt'
      ].includes(orderBy)) {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else {
        aValue = aValue.toString().toLowerCase();
        bValue = bValue.toString().toLowerCase();
      }

      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, orderBy, order]);

  // Calculate Totals
  const totals = useMemo(() => {
    if (reportType === 'combined') {
      const mainStock = sortedData.reduce((sum, r) => sum + (parseFloat(r.MainStock) || 0), 0);
      const deptStock = sortedData.reduce((sum, r) => sum + (parseFloat(r.DeptStock) || 0), 0);
      const jwStock = sortedData.reduce((sum, r) => sum + (parseFloat(r.JwStock) || 0), 0);
      const totalStock = sortedData.reduce((sum, r) => sum + (parseFloat(r.TotalStock) || 0), 0);
      const totalWeight = Math.round(sortedData.reduce((sum, r) => sum + (parseFloat(r.TotalWeight) || 0), 0) * 1000) / 1000;
      const totalValuation = Math.round(sortedData.reduce((sum, r) => sum + (parseFloat(r.Valuation) || 0), 0) * 100) / 100;
      return { mainStock, deptStock, jwStock, totalStock, totalWeight, totalValuation };
    }
    if (reportType === 'item') {
      const totalOpening = sortedData.reduce((sum, row) => sum + (parseFloat(row.OpeningStock) || 0), 0);
      const totalClosing = sortedData.reduce((sum, row) => sum + (parseFloat(row.ClosingStock) || 0), 0);
      const totalValuation = Math.round(sortedData.reduce((sum, row) => sum + ((parseFloat(row.ClosingStock) || 0) * (parseFloat(row.Costing) || 0)), 0) * 100) / 100;
      return { totalOpening, totalClosing, totalValuation };
    }
    if (reportType === 'department') {
      const totalPcs = sortedData.reduce((sum, row) => sum + (parseFloat(row.Pcs) || 0), 0);
      const totalWeight = Math.round(sortedData.reduce((sum, row) => sum + (parseFloat(row.Weight) || 0), 0) * 1000) / 1000;
      const totalValuation = Math.round(sortedData.reduce((sum, row) => sum + (parseFloat(row.Valuation) || 0), 0) * 100) / 100;
      return { totalPcs, totalWeight, totalValuation };
    }
    if (reportType === 'jobwork') {
      const totalOutQty = sortedData.reduce((sum, r) => sum + (parseFloat(r.OutQty) || 0), 0);
      const totalOutWt = Math.round(sortedData.reduce((sum, r) => sum + (parseFloat(r.OutNetWt) || 0), 0) * 1000) / 1000;
      const totalInQty = sortedData.reduce((sum, r) => sum + (parseFloat(r.InQty) || 0), 0);
      const totalInWt = Math.round(sortedData.reduce((sum, r) => sum + (parseFloat(r.InNetWt) || 0), 0) * 1000) / 1000;
      const totalBalQty = sortedData.reduce((sum, r) => sum + (parseFloat(r.BalQty) || 0), 0);
      const totalBalWt = Math.round(sortedData.reduce((sum, r) => sum + (parseFloat(r.BalNetWt) || 0), 0) * 1000) / 1000;
      const totalValuation = Math.round(sortedData.reduce((sum, r) => sum + (parseFloat(r.Valuation) || 0), 0) * 100) / 100;
      return { totalOutQty, totalOutWt, totalInQty, totalInWt, totalBalQty, totalBalWt, totalValuation };
    }
    return {};
  }, [sortedData, reportType]);

  const handleExportPDF = (action = 'download') => {
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FRM Enterprise', 14, 18);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    const baseTitle = reportType === 'combined' 
      ? 'Combined Stock Report (Main Stock + Department Stock + Job Work Stock)' 
      : reportType === 'item' 
        ? 'Item Stock Report' 
        : reportType === 'department'
          ? 'Department Stock Report'
          : 'Job Work Outstanding Stock Report';
    const title = isNegativeActive ? `${baseTitle} - [NEGATIVE STOCK ONLY]` : baseTitle;
    doc.text(title, 14, 26);
    
    doc.setFontSize(8.5);
    doc.text(`Generated on: ${new Date().toLocaleString('en-GB')}`, 14, 32);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 36, 280, 36);

    let startY = 40;

    // KPI Summary Header in Combined PDF
    if (reportType === 'combined') {
      doc.setFillColor(245, 248, 252);
      doc.roundedRect(14, startY, 266, 10, 1.5, 1.5, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');

      doc.setTextColor(30, 64, 175);
      doc.text(`MAIN STOCK: ${Number(totals.mainStock || 0).toLocaleString()} PCS`, 18, startY + 6.5);

      doc.setTextColor(13, 148, 136);
      doc.text(`DEPT STOCK: ${Number(totals.deptStock || 0).toLocaleString()} PCS`, 85, startY + 6.5);

      doc.setTextColor(217, 119, 6);
      doc.text(`JOBWORK STOCK: ${Number(totals.jwStock || 0).toLocaleString()} PCS`, 150, startY + 6.5);

      doc.setTextColor(15, 59, 102);
      doc.text(`COMBINED TOTAL: ${Number(totals.totalStock || 0).toLocaleString()} PCS (Val: Rs. ${Number(totals.totalValuation || 0).toLocaleString()})`, 210, startY + 6.5);

      startY += 14;
    } else if (reportType === 'jobwork') {
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(14, startY, 266, 10, 1.5, 1.5, 'F');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text(`TOTAL PENDING OUTSTANDING WITH VENDORS: ${Number(totals.totalBalQty || 0).toLocaleString()} PCS (${Number(totals.totalBalWt || 0).toFixed(3)} KG)`, 18, startY + 6.5);
      startY += 14;
    }

    const tableData = [];
    let head = [];

    if (reportType === 'combined') {
      head = [['Code', 'Sub Code', 'Item Name', 'Type', 'Unit', 'Main Stock', 'Dept Stock', 'Jobwork Stock', 'Combined Total', 'Total Wt (KG)', 'Valuation (Rs.)']];
      sortedData.forEach(row => {
        tableData.push([
          row.ItemCode,
          row.SubCode || '-',
          row.ItemName || '-',
          row.ItemType || '-',
          row.Unit || 'PCS',
          Number(row.MainStock || 0),
          Number(row.DeptStock || 0),
          Number(row.JwStock || 0),
          Number(row.TotalStock || 0),
          Number(row.TotalWeight || 0).toFixed(3),
          Number(row.Valuation || 0).toFixed(2)
        ]);
      });
      if (sortedData.length > 0) {
        tableData.push([
          { content: 'Total:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', textColor: [15, 59, 102] } },
          { content: Number(totals.mainStock || 0), styles: { fontStyle: 'bold', textColor: [30, 64, 175] } },
          { content: Number(totals.deptStock || 0), styles: { fontStyle: 'bold', textColor: [13, 148, 136] } },
          { content: Number(totals.jwStock || 0), styles: { fontStyle: 'bold', textColor: [217, 119, 6] } },
          { content: Number(totals.totalStock || 0), styles: { fontStyle: 'bold', textColor: [15, 59, 102] } },
          { content: Number(totals.totalWeight || 0).toFixed(3), styles: { fontStyle: 'bold' } },
          { content: Number(totals.totalValuation || 0).toFixed(2), styles: { fontStyle: 'bold', textColor: [194, 65, 12] } }
        ]);
      }
    } else if (reportType === 'item') {
      head = [['Code', 'Sub Code', 'Name', 'Type', 'Series', 'Unit', 'MRP', 'Costing', 'Opening', 'Closing', 'Valuation (Rs.)']];
      sortedData.forEach(row => {
        tableData.push([
          row.ItemCode, 
          row.SubCode || '-',
          row.ItemName, 
          row.ItemType || '-', 
          row.Series || '-', 
          row.Unit || '-', 
          Number(row.MRP || 0).toFixed(2), 
          Number(row.Costing || 0).toFixed(2), 
          row.OpeningStock || 0, 
          row.ClosingStock || 0,
          Number(row.Valuation || ((Number(row.ClosingStock || 0) * Number(row.Costing || 0)))).toFixed(2)
        ]);
      });
      if (sortedData.length > 0) {
        tableData.push([
          { content: 'Total:', colSpan: 8, styles: { halign: 'right', fontStyle: 'bold', textColor: [15, 59, 102] } },
          { content: totals.totalOpening, styles: { fontStyle: 'bold', textColor: [211, 47, 47] } },
          { content: totals.totalClosing, styles: { fontStyle: 'bold', textColor: [211, 47, 47] } },
          { content: Number(totals.totalValuation || 0).toFixed(2), styles: { fontStyle: 'bold', textColor: [194, 65, 12] } }
        ]);
      }
    } else if (reportType === 'department') {
      head = [['Department', 'Code', 'Sub Code', 'Item Name', 'Unit', 'Costing (Rs.)', 'Pcs', 'Weight (KG)', 'Valuation (Rs.)']];
      sortedData.forEach(row => {
        tableData.push([
          row.DeptName, 
          row.ItemCode, 
          row.SubCode || '-',
          row.ItemName || '-', 
          row.Unit || '-',
          Number(row.Costing || 0).toFixed(2),
          row.Pcs || 0, 
          row.Weight ? Number(row.Weight).toFixed(3) : '0.000',
          Number(row.Valuation || 0).toFixed(2)
        ]);
      });
      if (sortedData.length > 0) {
        tableData.push([
          { content: 'Total:', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', textColor: [15, 59, 102] } },
          { content: Number(totals.totalPcs || 0).toLocaleString(), styles: { fontStyle: 'bold', textColor: [211, 47, 47] } },
          { content: Number(totals.totalWeight || 0).toFixed(3), styles: { fontStyle: 'bold', textColor: [211, 47, 47] } },
          { content: Number(totals.totalValuation || 0).toFixed(2), styles: { fontStyle: 'bold', textColor: [211, 47, 47] } }
        ]);
      }
    } else {
      // Job Work Stock
      head = [['Job Worker (Vendor)', 'Item Code', 'Sub Code', 'Item Name', 'Sent Qty', 'Sent Wt', 'Ret Qty', 'Ret Wt', 'Outs Qty', 'Outs Wt', 'Costing (Rs.)', 'Valuation (Rs.)']];
      sortedData.forEach(row => {
        tableData.push([
          row.LedgerName,
          row.ItemCode,
          row.SubCode || '-',
          row.ItemName || '-',
          Number(row.OutQty || 0),
          Number(row.OutNetWt || 0).toFixed(3),
          Number(row.InQty || 0),
          Number(row.InNetWt || 0).toFixed(3),
          Number(row.BalQty || 0),
          Number(row.BalNetWt || 0).toFixed(3),
          Number(row.Costing || 0).toFixed(2),
          Number(row.Valuation || 0).toFixed(2)
        ]);
      });
      if (sortedData.length > 0) {
        tableData.push([
          { content: 'Total:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', textColor: [15, 59, 102] } },
          { content: Number(totals.totalOutQty || 0), styles: { fontStyle: 'bold', textColor: [37, 99, 235] } },
          { content: Number(totals.totalOutWt || 0).toFixed(3), styles: { fontStyle: 'bold' } },
          { content: Number(totals.totalInQty || 0), styles: { fontStyle: 'bold', textColor: [22, 163, 74] } },
          { content: Number(totals.totalInWt || 0).toFixed(3), styles: { fontStyle: 'bold' } },
          { content: Number(totals.totalBalQty || 0), styles: { fontStyle: 'bold', textColor: [185, 28, 28] } },
          { content: Number(totals.totalBalWt || 0).toFixed(3), styles: { fontStyle: 'bold', textColor: [185, 28, 28] } },
          { content: '-', styles: { fontStyle: 'bold', halign: 'right' } },
          { content: Number(totals.totalValuation || 0).toFixed(2), styles: { fontStyle: 'bold', textColor: [194, 65, 12] } }
        ]);
      }
    }
    
    autoTable(doc, {
      head: head,
      body: tableData,
      startY: startY,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      margin: { top: startY }
    });

    const filename = `${reportType}_stock_report${isNegativeActive ? '_negative_only' : ''}.pdf`;

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const reportName = filename.replace('.pdf', '');
      
      fetch(`${baseUrl}/auth/share-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, reportName })
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to share PDF');
        return res.json();
      })
      .then(data => {
        alert(data.message || 'PDF saved and highlighted in explorer');
      })
      .catch(err => {
        console.error('Error sharing PDF:', err);
        alert('Error sharing PDF: ' + err.message);
      });
    } else if (action === 'preview') {
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPreviewUrl(blobUrl);
      setPreviewOpen(true);
    } else {
      doc.save(filename);
    }
  };

  const handleExportExcel = () => {
    const flatData = [];
    if (reportType === 'combined') {
      sortedData.forEach(row => {
        const deptSummary = (row.Departments || []).map(d => `${d.DeptName}: ${d.Pcs} ${row.Unit || 'PCS'}`).join('; ');
        const jwSummary = (row.Jobworkers || []).map(j => `${j.LedgerName}: ${j.BalQty} ${row.Unit || 'PCS'}`).join('; ');

        flatData.push({
          'Code': row.ItemCode,
          'Sub Code': row.SubCode || '-',
          'Item Name': row.ItemName,
          'Type': row.ItemType || '-',
          'Series': row.Series || '-',
          'Unit': row.Unit || 'PCS',
          'Costing (Rs.)': Number(row.Costing || 0),
          'Main Stock': Number(row.MainStock || 0),
          'Department Stock Total': Number(row.DeptStock || 0),
          'Department Breakdown': deptSummary || '-',
          'Jobwork Stock Total': Number(row.JwStock || 0),
          'Jobwork Ledger Breakdown': jwSummary || '-',
          'Total Combined Stock': Number(row.TotalStock || 0),
          'Total Weight (KG)': Number(row.TotalWeight || 0),
          'Valuation (Rs.)': Number(row.Valuation || 0)
        });
      });
      if (sortedData.length > 0) {
        flatData.push({
          'Code': 'Total:',
          'Sub Code': '',
          'Item Name': '',
          'Type': '',
          'Series': '',
          'Unit': '',
          'Costing (Rs.)': null,
          'Main Stock': Number(totals.mainStock) || 0,
          'Department Stock Total': Number(totals.deptStock) || 0,
          'Department Breakdown': '',
          'Jobwork Stock Total': Number(totals.jwStock) || 0,
          'Jobwork Ledger Breakdown': '',
          'Total Combined Stock': Number(totals.totalStock) || 0,
          'Total Weight (KG)': Number(totals.totalWeight) || 0,
          'Valuation (Rs.)': Number(totals.totalValuation) || 0
        });
      }
    } else if (reportType === 'item') {
      sortedData.forEach(row => {
        flatData.push({
          'Code': row.ItemCode,
          'Sub Code': row.SubCode || '-',
          'Item Name': row.ItemName,
          'Type': row.ItemType || '-',
          'Series': row.Series || '-',
          'Unit': row.Unit || '-',
          'MRP': Number(row.MRP) || 0,
          'Costing': Number(row.Costing) || 0,
          'Opening Stock': Number(row.OpeningStock) || 0,
          'Closing Stock': Number(row.ClosingStock) || 0,
          'Valuation (Rs.)': Number(row.Valuation || ((Number(row.ClosingStock || 0) * Number(row.Costing || 0))))
        });
      });
      if (sortedData.length > 0) {
        flatData.push({
          'Code': '', 'Sub Code': '', 'Item Name': '', 'Type': '', 'Series': '', 'Unit': '', 'MRP': null, 'Costing': 'Total:',
          'Opening Stock': Number(totals.totalOpening) || 0,
          'Closing Stock': Number(totals.totalClosing) || 0,
          'Valuation (Rs.)': Number(totals.totalValuation || 0)
        });
      }
    } else if (reportType === 'department') {
      sortedData.forEach(row => {
        flatData.push({
          'Department': row.DeptName,
          'Code': row.ItemCode,
          'Sub Code': row.SubCode || '-',
          'Item Name': row.ItemName || '-',
          'Unit': row.Unit || '-',
          'Costing': Number(row.Costing || 0),
          'Pcs': Number(row.Pcs) || 0,
          'Weight': Number(row.Weight || 0),
          'Valuation': Number(row.Valuation || 0)
        });
      });
      if (sortedData.length > 0) {
        flatData.push({
          'Department': '', 'Code': '', 'Sub Code': '', 'Item Name': 'Total:', 'Unit': '', 'Costing': null,
          'Pcs': Number(totals.totalPcs) || 0,
          'Weight': Number(totals.totalWeight) || 0,
          'Valuation': Number(totals.totalValuation) || 0
        });
      }
    } else {
      // Job Work Stock
      sortedData.forEach(row => {
        flatData.push({
          'Job Worker': row.LedgerName,
          'Code': row.ItemCode,
          'Sub Code': row.SubCode || '-',
          'Item Name': row.ItemName,
          'Sent Qty': Number(row.OutQty || 0),
          'Sent Wt (KG)': Number(row.OutNetWt || 0),
          'Received Qty': Number(row.InQty || 0),
          'Received Wt (KG)': Number(row.InNetWt || 0),
          'Outstanding Qty': Number(row.BalQty || 0),
          'Outstanding Wt (KG)': Number(row.BalNetWt || 0),
          'Costing (Rs.)': Number(row.Costing || 0),
          'Valuation (Rs.)': Number(row.Valuation || 0)
        });
      });
      if (sortedData.length > 0) {
        flatData.push({
          'Job Worker': 'Total:',
          'Code': '',
          'Sub Code': '',
          'Item Name': '',
          'Sent Qty': Number(totals.totalOutQty) || 0,
          'Sent Wt (KG)': Number(totals.totalOutWt) || 0,
          'Received Qty': Number(totals.totalInQty) || 0,
          'Received Wt (KG)': Number(totals.totalInWt) || 0,
          'Outstanding Qty': Number(totals.totalBalQty) || 0,
          'Outstanding Wt (KG)': Number(totals.totalBalWt) || 0,
          'Costing (Rs.)': null,
          'Valuation (Rs.)': Number(totals.totalValuation || 0)
        });
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    ensureNumericWorksheet(worksheet);
    const workbook = XLSX.utils.book_new();
    const baseSheetName = reportType === 'combined' 
      ? 'Combined Stock' 
      : reportType === 'item' 
        ? 'Item Stock' 
        : reportType === 'department' 
          ? 'Department Stock' 
          : 'Job Work Stock';
    const sheetName = isNegativeActive ? `${baseSheetName} (Negative)` : baseSheetName;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const filename = `${sheetName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_report.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const safeDeadStockData = Array.isArray(deadStockData) ? deadStockData : [];
  const uniqueDeadStockWarehouses = useMemo(() => {
    return ['All', ...Array.from(new Set(safeDeadStockData.map(i => i.WarehouseNo).filter(Boolean))).sort()];
  }, [safeDeadStockData]);

  const filteredDeadStock = useMemo(() => {
    let list = Array.isArray(deadStockData) ? deadStockData : [];

    if (deadStockTypeFilter !== 'All') {
      list = list.filter(i => i.EffectiveDeadStockType === deadStockTypeFilter);
    }

    if (deadStockCategoryFilter !== 'All') {
      list = list.filter(i => i.Category === deadStockCategoryFilter);
    }

    if (deadStockWarehouseFilter !== 'All') {
      list = list.filter(i => String(i.WarehouseNo || '').trim() === deadStockWarehouseFilter);
    }

    if (deadStockSearch.trim()) {
      const s = deadStockSearch.trim().toLowerCase();
      list = list.filter(i => 
        String(i.ItemCode || '').toLowerCase().includes(s) ||
        String(i.SubCode || '').toLowerCase().includes(s) ||
        String(i.ItemName || '').toLowerCase().includes(s) ||
        String(i.WarehouseNo || '').toLowerCase().includes(s) ||
        String(i.Location || '').toLowerCase().includes(s) ||
        String(i.Series || '').toLowerCase().includes(s)
      );
    }

    return list;
  }, [deadStockData, deadStockTypeFilter, deadStockCategoryFilter, deadStockWarehouseFilter, deadStockSearch]);

  const sortedDeadStock = useMemo(() => {
    return [...filteredDeadStock].sort((a, b) => {
      let valA = a[deadStockOrderBy];
      let valB = b[deadStockOrderBy];
      
      if (deadStockOrderBy === 'DaysInactive') {
        valA = valA === null || valA === undefined ? 999999 : Number(valA);
        valB = valB === null || valB === undefined ? 999999 : Number(valB);
      } else if (typeof valA === 'number' || typeof valB === 'number') {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return deadStockOrder === 'asc' ? -1 : 1;
      if (valA > valB) return deadStockOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDeadStock, deadStockOrderBy, deadStockOrder]);

  const deadStockTotals = useMemo(() => {
    return {
      count: filteredDeadStock.length,
      totalQty: filteredDeadStock.reduce((acc, i) => acc + Number(i.TotalStock || 0), 0),
      totalValuation: filteredDeadStock.reduce((acc, i) => acc + Number(i.DeadStockValuation || 0), 0),
      autoCount: filteredDeadStock.filter(i => i.EffectiveDeadStockType === 'Auto').length,
      manualCount: filteredDeadStock.filter(i => i.EffectiveDeadStockType === 'Manual').length
    };
  }, [filteredDeadStock]);

  const handleOpenDsModal = (item) => {
    setSelectedDsItem(item);
    setDsModalType(item.EffectiveDeadStockType || item.DeadStockType || 'Auto');
    setDsModalDays(item.DeadStockDays > 0 ? item.DeadStockDays : '');
    setDsModalOpen(true);
  };

  const handleCloseDsModal = () => {
    setDsModalOpen(false);
    setSelectedDsItem(null);
  };

  const handleSaveDsModal = async () => {
    if (!selectedDsItem) return;
    if (dsModalType === 'Auto' && (!dsModalDays || parseInt(dsModalDays, 10) <= 0)) {
      alert('Please enter a valid threshold days greater than 0.');
      return;
    }

    setDsModalLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const url = `${baseUrl}/items/${encodeURIComponent(selectedDsItem.ItemCode)}/dead-stock?subCode=${encodeURIComponent(selectedDsItem.SubCode || '')}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subCode: selectedDsItem.SubCode || '',
          deadStockType: dsModalType,
          deadStockDays: dsModalType === 'Auto' ? parseInt(dsModalDays, 10) : 0,
          isDeadStock: dsModalType === 'Manual' ? 1 : 0
        })
      });

      if (res.ok) {
        handleCloseDsModal();
        await fetchDeadStock();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to update dead stock status');
      }
    } catch (err) {
      console.error('Error saving dead stock modal:', err);
      alert('Network error updating dead stock status');
    } finally {
      setDsModalLoading(false);
    }
  };

  const handleExportDeadStockExcel = () => {
    const rows = sortedDeadStock.map(row => ({
      'Item Code': row.ItemCode,
      'Sub Code': row.SubCode || '-',
      'Item Name': row.ItemName,
      'Category': row.Category || 'Inhouse',
      'Warehouse': row.WarehouseNo || '-',
      'Location': row.Location || '-',
      'Unit': row.Unit || 'PCS',
      'Main Stock': Number(row.MainStock || 0),
      'Dept Stock': Number(row.DeptStock || 0),
      'Jobwork Stock': Number(row.JwStock || 0),
      'Total Stock': Number(row.TotalStock || 0),
      'Costing (Rs.)': Number(row.Costing || 0),
      'Dead Stock Valuation (Rs.)': Number(row.DeadStockValuation || 0),
      'Declaration Type': row.EffectiveDeadStockType,
      'Threshold (Days)': row.DeadStockDays || '-',
      'Last Movement Date': row.LastMovementDate || 'Never Moved',
      'Days Inactive': row.DaysInactive !== null ? row.DaysInactive : 'Never Moved',
      'Reason': row.DeadStockReason
    }));

    if (rows.length > 0) {
      rows.push({
        'Item Code': 'Total:',
        'Sub Code': '',
        'Item Name': '',
        'Category': '',
        'Warehouse': '',
        'Location': '',
        'Unit': '',
        'Main Stock': null,
        'Dept Stock': null,
        'Jobwork Stock': null,
        'Total Stock': Number(deadStockTotals.totalQty) || 0,
        'Costing (Rs.)': null,
        'Dead Stock Valuation (Rs.)': Number(deadStockTotals.totalValuation) || 0,
        'Declaration Type': '',
        'Threshold (Days)': '',
        'Last Movement Date': '',
        'Days Inactive': '',
        'Reason': ''
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    ensureNumericWorksheet(worksheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dead Stock');
    XLSX.writeFile(workbook, 'Dead_Stock_Report.xlsx');
  };

  const handleExportDeadStockPDF = (action = 'download') => {
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FRM Enterprise', 14, 18);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text('Dead Stock Inactivity & Valuation Report', 14, 26);
    
    doc.setFontSize(8.5);
    doc.text(`Generated on: ${new Date().toLocaleString('en-GB')}`, 14, 32);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 36, 280, 36);

    let startY = 40;

    // KPI Summary Header
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(14, startY, 266, 10, 1.5, 1.5, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');

    doc.setTextColor(185, 28, 28);
    doc.text(`TOTAL DEAD STOCK ITEMS: ${deadStockTotals.count}`, 18, startY + 6.5);

    doc.setTextColor(15, 59, 102);
    doc.text(`TOTAL UNITS: ${Number(deadStockTotals.totalQty || 0).toLocaleString()} PCS`, 90, startY + 6.5);

    doc.setTextColor(194, 65, 12);
    doc.text(`VALUATION: Rs. ${Number(deadStockTotals.totalValuation || 0).toLocaleString()}`, 155, startY + 6.5);

    doc.setTextColor(71, 85, 105);
    doc.text(`AUTO: ${deadStockTotals.autoCount} | MANUAL: ${deadStockTotals.manualCount}`, 225, startY + 6.5);

    startY += 14;

    const head = [['Code', 'SubCode', 'Item Name', 'Category', 'Warehouse', 'Unit', 'Total Stock', 'Costing', 'Valuation (Rs.)', 'Type', 'Last Movement', 'Inactive Days']];
    
    const tableData = [];
    sortedDeadStock.forEach(row => {
      tableData.push([
        row.ItemCode,
        row.SubCode || '-',
        row.ItemName || '-',
        row.Category || '-',
        row.WarehouseNo ? `${row.WarehouseNo} ${row.Location ? `(${row.Location})` : ''}` : '-',
        row.Unit || 'PCS',
        Number(row.TotalStock || 0),
        Number(row.Costing || 0).toFixed(2),
        Number(row.DeadStockValuation || 0).toFixed(2),
        row.EffectiveDeadStockType,
        row.LastMovementDate || 'Never Moved',
        row.DaysInactive !== null ? `${row.DaysInactive} d` : 'Never'
      ]);
    });

    if (sortedDeadStock.length > 0) {
      tableData.push([
        { content: 'Total:', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', textColor: [15, 59, 102] } },
        { content: Number(deadStockTotals.totalQty || 0), styles: { fontStyle: 'bold', textColor: [185, 28, 28] } },
        { content: '', styles: { fontStyle: 'bold' } },
        { content: Number(deadStockTotals.totalValuation || 0).toFixed(2), styles: { fontStyle: 'bold', textColor: [194, 65, 12] } },
        { content: '', colSpan: 3, styles: {} }
      ]);
    }

    autoTable(doc, {
      head: head,
      body: tableData,
      startY: startY,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      margin: { top: startY }
    });

    const filename = `dead_stock_report_${new Date().toISOString().slice(0, 10)}.pdf`;

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const reportName = filename.replace('.pdf', '');
      
      fetch(`${baseUrl}/auth/share-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, reportName })
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to share PDF');
        return res.json();
      })
      .then(data => {
        alert(data.message || 'PDF saved and highlighted in explorer');
      })
      .catch(err => {
        console.error('Error sharing PDF:', err);
        alert('Error sharing PDF: ' + err.message);
      });
    } else if (action === 'preview') {
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPreviewUrl(blobUrl);
      setPreviewOpen(true);
    } else {
      doc.save(filename);
    }
  };

  const DsSortableTableCell = ({ label, property, align = 'left', width }) => (
    <TableCell align={align} sx={{ backgroundColor: '#0F3B66', width, py: 0.6 }}>
      <TableSortLabel
        active={deadStockOrderBy === property}
        direction={deadStockOrderBy === property ? deadStockOrder : 'asc'}
        onClick={() => {
          const isAsc = deadStockOrderBy === property && deadStockOrder === 'asc';
          setDeadStockOrder(isAsc ? 'desc' : 'asc');
          setDeadStockOrderBy(property);
        }}
        sx={{ color: '#ffffff !important', fontWeight: 'bold', fontSize: '0.82rem', '& .MuiTableSortLabel-icon': { color: '#ffffff !important' } }}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  const SortableTableCell = ({ label, property, align = 'left', width }) => (
    <TableCell align={align} sx={{ backgroundColor: '#0F3B66', width, py: 0.6 }}>
      <TableSortLabel
        active={orderBy === property}
        direction={orderBy === property ? order : 'asc'}
        onClick={() => handleRequestSort(property)}
        sx={{ color: '#ffffff !important', fontWeight: 'bold', fontSize: '0.82rem', '& .MuiTableSortLabel-icon': { color: '#ffffff !important' } }}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 1. Header & Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', letterSpacing: -0.5 }}>
            {mainTab === 0 ? 'Stock Report' : 'Dead Stock Report'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            {mainTab === 0 
              ? (reportType === 'combined' 
                  ? 'Multi-location real-time stock across Main Store, Manufacturing Departments & Job Work Vendors'
                  : reportType === 'item' 
                    ? 'Master Item stock register' 
                    : reportType === 'department'
                      ? 'In-process stock allocated across factory departments'
                      : 'Pending material outstanding stock at outside Job Work vendors')
              : 'Audit of non-moving inventory, auto-detected inactive stock items & manually declared dead stock'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {mainTab === 0 ? (
            <>
              <Button variant="outlined" startIcon={<TableView />} onClick={handleExportExcel} sx={{ color: '#107c41', borderColor: '#107c41', textTransform: 'none', fontWeight: 600 }}>
                Export Excel
              </Button>
              <Button variant="outlined" startIcon={<Visibility />} onClick={() => handleExportPDF('preview')} sx={{ color: '#0F3B66', borderColor: '#0F3B66', textTransform: 'none', fontWeight: 600 }}>
                Preview PDF
              </Button>
              <Button variant="outlined" startIcon={<PictureAsPdf />} onClick={() => handleExportPDF('download')} sx={{ color: '#d32f2f', borderColor: '#d32f2f', textTransform: 'none', fontWeight: 600 }}>
                Export PDF
              </Button>
              <Button variant="contained" startIcon={<Share />} onClick={() => handleExportPDF('share')} sx={{ bgcolor: 'secondary.main', textTransform: 'none', fontWeight: 600 }}>
                Share
              </Button>
            </>
          ) : (
            <>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchDeadStock} sx={{ color: '#475569', borderColor: '#cbd5e1', textTransform: 'none', fontWeight: 600 }}>
                Refresh
              </Button>
              <Button variant="outlined" startIcon={<TableView />} onClick={handleExportDeadStockExcel} sx={{ color: '#107c41', borderColor: '#107c41', textTransform: 'none', fontWeight: 600 }}>
                Export Excel
              </Button>
              <Button variant="outlined" startIcon={<Visibility />} onClick={() => handleExportDeadStockPDF('preview')} sx={{ color: '#0F3B66', borderColor: '#0F3B66', textTransform: 'none', fontWeight: 600 }}>
                Preview PDF
              </Button>
              <Button variant="outlined" startIcon={<PictureAsPdf />} onClick={() => handleExportDeadStockPDF('download')} sx={{ color: '#d32f2f', borderColor: '#d32f2f', textTransform: 'none', fontWeight: 600 }}>
                Export PDF
              </Button>
              <Button variant="contained" startIcon={<Share />} onClick={() => handleExportDeadStockPDF('share')} sx={{ bgcolor: 'secondary.main', textTransform: 'none', fontWeight: 600 }}>
                Share
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Main Tabs Navigation: Live Stock Register vs Dead Stock Report */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs 
          value={mainTab} 
          onChange={(e, val) => setMainTab(val)}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.92rem',
              py: 1,
              minHeight: 44
            }
          }}
        >
          <Tab 
            icon={<Inventory sx={{ fontSize: 18 }} />} 
            iconPosition="start" 
            label="Live Stock Register" 
          />
          <Tab 
            icon={<WarningAmber sx={{ fontSize: 18, color: '#d97706' }} />} 
            iconPosition="start" 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Dead Stock Report</span>
                {deadStockTotals.count > 0 && (
                  <Chip 
                    label={deadStockTotals.count} 
                    size="small" 
                    sx={{ 
                      bgcolor: '#fee2e2', 
                      color: '#991b1b', 
                      fontWeight: 800, 
                      height: 20, 
                      fontSize: '0.7rem' 
                    }} 
                  />
                )}
              </Box>
            } 
          />
        </Tabs>
      </Box>

      {/* TAB 0: LIVE STOCK REGISTER */}
      {mainTab === 0 && (
        <>
      {/* 2. KPI Summary Banner (Combined View) */}
      {reportType === 'combined' && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {/* Card 1: Main Stock */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 2, border: '1px solid #bfdbfe', bgcolor: '#eff6ff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>
                    Main Warehouse Stock
                  </Typography>
                  <Inventory sx={{ color: '#2563eb', fontSize: 18 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e3a8a', my: 0.2 }}>
                  {Number(totals.mainStock || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>PCS</span>
                </Typography>
                <Typography variant="caption" sx={{ color: '#60a5fa', fontWeight: 600 }}>
                  Central Factory Store
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 2: Department Stock */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 2, border: '1px solid #99f6e4', bgcolor: '#f0fdfa', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#0f766e', fontWeight: 700, textTransform: 'uppercase' }}>
                    Department Stock
                  </Typography>
                  <Business sx={{ color: '#0d9488', fontSize: 18 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#134e4a', my: 0.2 }}>
                  {Number(totals.deptStock || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>PCS</span>
                </Typography>
                <Typography variant="caption" sx={{ color: '#14b8a6', fontWeight: 600 }}>
                  Internal Processing Lines
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 3: Job Work Stock */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 2, border: '1px solid #fed7aa', bgcolor: '#fff7ed', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#c2410c', fontWeight: 700, textTransform: 'uppercase' }}>
                    Job Work Stock
                  </Typography>
                  <Factory sx={{ color: '#ea580c', fontSize: 18 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#7c2d12', my: 0.2 }}>
                  {Number(totals.jwStock || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>PCS</span>
                </Typography>
                <Typography variant="caption" sx={{ color: '#f97316', fontWeight: 600 }}>
                  Material with Job Workers
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 4: Total Combined Stock */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 2, border: '2px solid #0F3B66', bgcolor: '#f8fafc', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#0F3B66', fontWeight: 800, textTransform: 'uppercase' }}>
                    Total Combined Stock
                  </Typography>
                  <Layers sx={{ color: '#0F3B66', fontSize: 18 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 900, color: '#0F3B66', my: 0.2 }}>
                  {Number(totals.totalStock || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>PCS</span>
                </Typography>
                <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 700 }}>
                  Valuation: ₹{Number(totals.totalValuation || 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* 3. Filter Controls Toolbar */}
      <Box sx={{ flexGrow: 1, width: '100%' }}>
        <Paper sx={{ p: 1.8, mb: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            
            {/* View Mode Toggle: Combined, Item, Department, Jobwork */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <ToggleButtonGroup
                color="primary"
                value={reportType}
                exclusive
                onChange={handleReportTypeChange}
                size="small"
                sx={{ backgroundColor: '#fff' }}
              >
                <ToggleButton value="combined" sx={{ px: 2, fontWeight: 700 }}>
                  🌟 Combined Stock
                </ToggleButton>
                <ToggleButton value="item" sx={{ px: 2, fontWeight: 600 }}>
                  Item Stock
                </ToggleButton>
                <ToggleButton value="department" sx={{ px: 2, fontWeight: 600 }}>
                  Department Stock
                </ToggleButton>
                <ToggleButton value="jobwork" sx={{ px: 2, fontWeight: 600 }}>
                  Job Work Stock
                </ToggleButton>
              </ToggleButtonGroup>

              {reportType === 'combined' && (
                <Box sx={{ display: 'flex', gap: 0.8 }}>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    startIcon={<UnfoldMore sx={{ fontSize: 16 }} />} 
                    onClick={() => handleExpandAll(true)}
                    sx={{ py: 0.4, px: 1.2, fontSize: '0.72rem', textTransform: 'none', borderColor: '#cbd5e1', color: '#475569' }}
                  >
                    Expand All
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    startIcon={<UnfoldLess sx={{ fontSize: 16 }} />} 
                    onClick={() => handleExpandAll(false)}
                    sx={{ py: 0.4, px: 1.2, fontSize: '0.72rem', textTransform: 'none', borderColor: '#cbd5e1', color: '#475569' }}
                  >
                    Collapse All
                  </Button>
                </Box>
              )}
            </Box>

            {/* Quick Record Counter & Negative Stock Toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant={isNegativeActive ? "contained" : "outlined"}
                onClick={() => {
                  const nextVal = !isNegativeActive;
                  setNegativeOnly(nextVal);
                  if (reportType === 'combined') {
                    setScopeFilter(nextVal ? 'NegativeStock' : 'WithStock');
                  }
                }}
                startIcon={<WarningAmber sx={{ fontSize: 17 }} />}
                sx={{
                  py: 0.4,
                  px: 1.5,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 1.5,
                  transition: 'all 0.2s ease',
                  ...(isNegativeActive ? {
                    bgcolor: '#dc2626',
                    color: '#ffffff',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.35)',
                    '&:hover': { bgcolor: '#b91c1c' }
                  } : {
                    borderColor: '#fca5a5',
                    color: '#dc2626',
                    bgcolor: '#fff1f2',
                    '&:hover': { bgcolor: '#fee2e2', borderColor: '#f87171' }
                  })
                }}
              >
                Negative Stock Only {negativeCount > 0 ? `(${negativeCount})` : ''}
              </Button>

              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                Showing {sortedData.length} of {data.length} records
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 1.5, borderColor: '#e2e8f0' }} />

          {/* Filter Inputs Row */}
          <Grid container spacing={1.5} alignItems="center">
            {/* Search Input */}
            <Grid item xs={12} sm={6} md={reportType === 'combined' ? 3.5 : reportType === 'jobwork' ? 5 : 4}>
              <TextField
                fullWidth
                size="small"
                placeholder={
                  reportType === 'combined' 
                    ? "Search Code, Name, Dept or Jobworker..." 
                    : reportType === 'jobwork'
                      ? "Search Job Worker, Item Code or Name..."
                      : "Search report..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ backgroundColor: '#fff', borderRadius: 1 }}
              />
            </Grid>

            {/* Type Filter */}
            {(reportType === 'combined' || reportType === 'item') && (
              <Grid item xs={6} sm={3} md={2}>
                <FormControl fullWidth size="small" sx={{ backgroundColor: '#fff', borderRadius: 1 }}>
                  <InputLabel>Item Type</InputLabel>
                  <Select value={typeFilter} label="Item Type" onChange={(e) => setTypeFilter(e.target.value)}>
                    {uniqueTypes.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Series / Brand Filter */}
            {(reportType === 'combined' || reportType === 'item') && (
              <Grid item xs={6} sm={3} md={2}>
                <FormControl fullWidth size="small" sx={{ backgroundColor: '#fff', borderRadius: 1 }}>
                  <InputLabel>Brand / Series</InputLabel>
                  <Select value={brandFilter} label="Brand / Series" onChange={(e) => setBrandFilter(e.target.value)}>
                    {uniqueBrands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Combined View Scope Selector */}
            {reportType === 'combined' && (
              <Grid item xs={12} sm={6} md={2.5}>
                <FormControl fullWidth size="small" sx={{ backgroundColor: '#fff', borderRadius: 1 }}>
                  <InputLabel>Stock Location Scope</InputLabel>
                  <Select 
                    value={scopeFilter} 
                    label="Stock Location Scope" 
                    onChange={(e) => {
                      const val = e.target.value;
                      setScopeFilter(val);
                      setNegativeOnly(val === 'NegativeStock');
                    }}
                  >
                    <MenuItem value="WithStock">With Stock Only (Total &gt; 0)</MenuItem>
                    <MenuItem value="All">All Items (Including Nil Stock)</MenuItem>
                    <MenuItem value="MainStock">In Main Stock (Main &gt; 0)</MenuItem>
                    <MenuItem value="DeptStock">In Departments (Dept &gt; 0)</MenuItem>
                    <MenuItem value="JwStock">At Job Workers (JW &gt; 0)</MenuItem>
                    <MenuItem value="NegativeStock" sx={{ color: '#dc2626', fontWeight: 700 }}>
                      ⚠️ Negative Stock Only {negativeCount > 0 ? `(${negativeCount})` : ''}
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Specific Department Filter */}
            {(reportType === 'combined' || reportType === 'department') && (
              <Grid item xs={12} sm={6} md={reportType === 'combined' ? 2 : 4}>
                <FormControl fullWidth size="small" sx={{ backgroundColor: '#fff', borderRadius: 1 }}>
                  <InputLabel>Department</InputLabel>
                  <Select value={deptFilter} label="Department" onChange={(e) => setDeptFilter(e.target.value)}>
                    {uniqueDepts.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Specific Job Worker Filter (Combined & Jobwork Views) */}
            {(reportType === 'combined' || reportType === 'jobwork') && (
              <Grid item xs={12} sm={6} md={reportType === 'jobwork' ? 4 : 2}>
                <FormControl fullWidth size="small" sx={{ backgroundColor: '#fff', borderRadius: 1 }}>
                  <InputLabel>Job Worker (Vendor)</InputLabel>
                  <Select value={jwFilter} label="Job Worker (Vendor)" onChange={(e) => setJwFilter(e.target.value)}>
                    {uniqueJobworkers.map(j => <MenuItem key={j} value={j}>{j}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </Paper>

        {/* Negative Filter Active Notification Banner */}
        {isNegativeActive && (
          <Alert 
            severity="warning" 
            icon={<WarningAmber fontSize="small" />} 
            sx={{ 
              mb: 1.5, 
              py: 0.3, 
              px: 2, 
              borderRadius: 1.5, 
              bgcolor: '#fef2f2', 
              border: '1px solid #fecaca', 
              color: '#991b1b', 
              '& .MuiAlert-icon': { color: '#dc2626' } 
            }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => {
                  setNegativeOnly(false);
                  if (reportType === 'combined' && scopeFilter === 'NegativeStock') {
                    setScopeFilter('WithStock');
                  }
                }}
                sx={{ fontWeight: 700, textTransform: 'none', fontSize: '0.75rem', color: '#dc2626' }}
              >
                Clear Filter
              </Button>
            }
          >
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
              Showing ONLY records with negative stock balances ({sortedData.length} records found).
            </Typography>
          </Alert>
        )}

        {/* 4. Table Data Presentation */}
        <TableContainer sx={{ maxHeight: '65vh', border: '1px solid #e2e8f0', borderRadius: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 260, gap: 1.5 }}>
              <CircularProgress size={36} sx={{ color: '#0F3B66' }} />
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Loading {
                  reportType === 'combined' 
                    ? 'Combined Multi-Location Stock...' 
                    : reportType === 'jobwork' 
                      ? 'Job Work Vendor Stock...' 
                      : 'Stock records...'
                }
              </Typography>
            </Box>
          ) : (
            <Table stickyHeader size="small" sx={{ 
              minWidth: 800, 
              '& .MuiTableRow-root': { height: 32 },
              '& .MuiTableCell-head': { py: 0.6, lineHeight: '1.2' },
              '& .MuiTableCell-root': { borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #e2e8f0' }
            }}>
              <TableHead>
                <TableRow>
                  {reportType === 'combined' ? (
                    <>
                      <TableCell sx={{ backgroundColor: '#0F3B66', width: 40, py: 0.6, color: '#fff', textAlign: 'center' }}>
                        
                      </TableCell>
                      <SortableTableCell label="Item Code" property="ItemCode" width="11%" />
                      <SortableTableCell label="Item Name" property="ItemName" width="20%" />
                      <SortableTableCell label="Type / Series" property="ItemType" width="10%" />
                      <SortableTableCell label="Unit" property="Unit" width="6%" align="center" />
                      <SortableTableCell label="Main Stock" property="MainStock" align="right" width="9%" />
                      <SortableTableCell label="Dept Stock" property="DeptStock" align="right" width="9%" />
                      <SortableTableCell label="Jobwork Stock" property="JwStock" align="right" width="9%" />
                      <SortableTableCell label="Combined Stock" property="TotalStock" align="right" width="10%" />
                      <SortableTableCell label="Total Wt (KG)" property="TotalWeight" align="right" width="8%" />
                      <SortableTableCell label="Valuation (₹)" property="Valuation" align="right" width="10%" />
                    </>
                  ) : reportType === 'item' ? (
                    <>
                      <SortableTableCell label="Code" property="ItemCode" width="9%" />
                      <SortableTableCell label="Item Name" property="ItemName" width="18%" />
                      <SortableTableCell label="Type" property="ItemType" width="9%" />
                      <SortableTableCell label="Series" property="Series" width="9%" />
                      <SortableTableCell label="Unit" property="Unit" width="7%" />
                      <SortableTableCell label="MRP" property="MRP" align="right" width="9%" />
                      <SortableTableCell label="Costing" property="Costing" align="right" width="9%" />
                      <SortableTableCell label="Opening" property="OpeningStock" align="right" width="9%" />
                      <SortableTableCell label="Closing" property="ClosingStock" align="right" width="9%" />
                      <SortableTableCell label="Valuation (₹)" property="Valuation" align="right" width="12%" />
                    </>
                  ) : reportType === 'department' ? (
                    <>
                      <SortableTableCell label="Department" property="DeptName" width="18%" />
                      <SortableTableCell label="Code" property="ItemCode" width="12%" />
                      <SortableTableCell label="Item Name" property="ItemName" width="22%" />
                      <SortableTableCell label="Unit" property="Unit" width="8%" />
                      <SortableTableCell label="Costing" property="Costing" align="right" width="10%" />
                      <SortableTableCell label="Pcs" property="Pcs" align="right" width="10%" />
                      <SortableTableCell label="Weight" property="Weight" align="right" width="10%" />
                      <SortableTableCell label="Valuation (₹)" property="Valuation" align="right" width="10%" />
                    </>
                  ) : (
                    // Job Work Stock Columns
                    <>
                      <SortableTableCell label="Job Worker (Vendor)" property="LedgerName" width="20%" />
                      <SortableTableCell label="Item Code" property="ItemCode" width="11%" />
                      <SortableTableCell label="Item Name" property="ItemName" width="18%" />
                      <SortableTableCell label="Sent Qty" property="OutQty" align="right" width="8%" />
                      <SortableTableCell label="Sent Wt" property="OutNetWt" align="right" width="8%" />
                      <SortableTableCell label="Ret Qty" property="InQty" align="right" width="7%" />
                      <SortableTableCell label="Ret Wt" property="InNetWt" align="right" width="7%" />
                      <SortableTableCell label="Outs Qty" property="BalQty" align="right" width="8%" />
                      <SortableTableCell label="Outs Wt" property="BalNetWt" align="right" width="8%" />
                      <SortableTableCell label="Costing (₹)" property="Costing" align="right" width="7%" />
                      <SortableTableCell label="Valuation (₹)" property="Valuation" align="right" width="9%" />
                    </>
                  )}
                </TableRow>
              </TableHead>

              <TableBody>
                {sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={reportType === 'combined' ? 10 : reportType === 'jobwork' ? 9 : reportType === 'item' ? 9 : 8} align="center" sx={{ py: 5 }}>
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
                        No stock records found matching your filter criteria.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((row, index) => {
                    const rowKey = `${row.ItemCode}__${row.SubCode || ''}`;
                    const isExpanded = !!expandedRows[rowKey];
                    const hasSubBreakdown = (row.Departments?.length > 0) || (row.Jobworkers?.length > 0);

                    return (
                      <React.Fragment key={row.RowId || `${row.LedgerId || ''}_${rowKey}_${index}`}>
                        <TableRow 
                          hover 
                          sx={{ 
                            backgroundColor: isExpanded ? '#f8fafc' : index % 2 === 0 ? '#ffffff' : '#fafafa',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          {reportType === 'combined' ? (
                            <>
                              {/* Expand / Collapse Button */}
                              <TableCell align="center" sx={{ py: 0.3, px: 0.5 }}>
                                {hasSubBreakdown ? (
                                  <IconButton
                                    size="small"
                                    onClick={() => toggleRowExpansion(rowKey)}
                                    sx={{ p: 0.3, color: isExpanded ? '#0F3B66' : '#94a3b8' }}
                                    title={isExpanded ? "Collapse location breakdown" : "Expand department & jobworker details"}
                                  >
                                    {isExpanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                                  </IconButton>
                                ) : (
                                  <Box sx={{ width: 24 }} />
                                )}
                              </TableCell>

                              {/* Item Code (Clickable to Ledger) */}
                              <TableCell 
                                sx={{ 
                                  fontWeight: 800, 
                                  color: '#0F3B66', 
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  textUnderlineOffset: 3,
                                  fontSize: '0.84rem',
                                  '&:hover': { color: '#F88A01' }
                                }}
                                onClick={() => navigate(`/dashboard/reports/item-ledger?itemCode=${encodeURIComponent(row.ItemCode)}&subCode=${encodeURIComponent(row.SubCode || '')}`)}
                                title="Click to view Item Stock Ledger"
                              >
                                {row.ItemCode}{row.SubCode ? ` / ${row.SubCode}` : ''}
                              </TableCell>

                              {/* Item Name */}
                              <TableCell sx={{ fontSize: '0.84rem', color: '#1e293b' }}>
                                {row.ItemName}
                              </TableCell>

                              {/* Type / Series */}
                              <TableCell sx={{ fontSize: '0.78rem', color: '#64748b' }}>
                                {row.ItemType || '-'} {row.Series ? `(${row.Series})` : ''}
                              </TableCell>

                              {/* Unit */}
                              <TableCell align="center" sx={{ fontSize: '0.75rem' }}>
                                <Chip label={row.Unit || 'PCS'} size="small" sx={{ height: 20, fontSize: '0.66rem', bgcolor: '#f1f5f9' }} />
                              </TableCell>

                              {/* 1. Main Stock */}
                              <TableCell 
                                align="right" 
                                sx={{ 
                                  fontWeight: 700, 
                                  color: (row.MainStock || 0) < 0 
                                    ? '#dc2626' 
                                    : (row.MainStock || 0) > 0 
                                      ? '#1e40af' 
                                      : '#94a3b8',
                                  ...((row.MainStock || 0) < 0 && {
                                    bgcolor: '#fee2e2',
                                    borderRadius: 1
                                  })
                                }}
                              >
                                {Number(row.MainStock || 0).toLocaleString()}
                              </TableCell>

                              {/* 2. Department Stock */}
                              <TableCell align="right">
                                {(row.DeptStock || 0) !== 0 || (row.DeptWeight || 0) > 0 ? (
                                  <Tooltip title={`Present in ${(row.Departments || []).length} Department(s). Click arrow to view details.`}>
                                    <Box 
                                      component="span" 
                                      onClick={() => toggleRowExpansion(rowKey)}
                                      sx={{ 
                                        fontWeight: 700, 
                                        color: (row.DeptStock || 0) < 0 ? '#dc2626' : '#0f766e', 
                                        bgcolor: (row.DeptStock || 0) < 0 ? '#fee2e2' : '#f0fdfa', 
                                        px: 1, 
                                        py: 0.2, 
                                        borderRadius: 1, 
                                        border: (row.DeptStock || 0) < 0 ? '1px solid #f87171' : '1px solid #ccfbf1',
                                        cursor: 'pointer' 
                                      }}
                                    >
                                      {Number(row.DeptStock || 0).toLocaleString()}
                                    </Box>
                                  </Tooltip>
                                ) : (
                                  <Typography variant="body2" sx={{ color: '#cbd5e1' }}>0</Typography>
                                )}
                              </TableCell>

                              {/* 3. Job Work Stock */}
                              <TableCell align="right">
                                {(row.JwStock || 0) !== 0 || (row.JwWeight || 0) > 0 ? (
                                  <Tooltip title={`With ${(row.Jobworkers || []).length} Job Worker(s). Click arrow to view details.`}>
                                    <Box 
                                      component="span" 
                                      onClick={() => toggleRowExpansion(rowKey)}
                                      sx={{ 
                                        fontWeight: 700, 
                                        color: (row.JwStock || 0) < 0 ? '#dc2626' : '#c2410c', 
                                        bgcolor: (row.JwStock || 0) < 0 ? '#fee2e2' : '#fff7ed', 
                                        px: 1, 
                                        py: 0.2, 
                                        borderRadius: 1, 
                                        border: (row.JwStock || 0) < 0 ? '1px solid #f87171' : '1px solid #ffedd5',
                                        cursor: 'pointer' 
                                      }}
                                    >
                                      {Number(row.JwStock || 0).toLocaleString()}
                                    </Box>
                                  </Tooltip>
                                ) : (
                                  <Typography variant="body2" sx={{ color: '#cbd5e1' }}>0</Typography>
                                )}
                              </TableCell>

                              {/* 4. Total Combined Stock */}
                              <TableCell 
                                align="right" 
                                sx={{ 
                                  fontWeight: 900, 
                                  fontSize: '0.86rem',
                                  color: (row.TotalStock || 0) < 0 
                                    ? '#dc2626' 
                                    : (row.TotalStock || 0) > 0 
                                      ? '#0F3B66' 
                                      : '#94a3b8',
                                  bgcolor: (row.TotalStock || 0) < 0 
                                    ? 'rgba(220, 38, 38, 0.12)' 
                                    : (row.TotalStock || 0) > 0 
                                      ? 'rgba(15, 59, 102, 0.04)' 
                                      : 'transparent',
                                  borderRadius: (row.TotalStock || 0) < 0 ? 1 : 0
                                }}
                              >
                                {Number(row.TotalStock || 0).toLocaleString()}
                              </TableCell>

                              {/* Total Weight */}
                              <TableCell align="right" sx={{ color: '#475569', fontSize: '0.8rem' }}>
                                {Number(row.TotalWeight || 0).toFixed(3)}
                              </TableCell>
                              {/* Valuation */}
                              <TableCell align="right" sx={{ fontWeight: 700, color: '#c2410c', fontSize: '0.84rem' }}>
                                ₹{Number(row.Valuation || 0).toFixed(2)}
                              </TableCell>
                            </>
                          ) : reportType === 'item' ? (
                            <>
                              <TableCell 
                                sx={{ 
                                  fontWeight: 700, 
                                  color: '#0F3B66', 
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  textUnderlineOffset: 3,
                                  '&:hover': { color: '#F88A01' }
                                }}
                                onClick={() => navigate(`/dashboard/reports/item-ledger?itemCode=${encodeURIComponent(row.ItemCode)}&subCode=${encodeURIComponent(row.SubCode || '')}`)}
                                title="Click to view Item Stock Ledger statement"
                              >
                                {row.ItemCode}{row.SubCode ? ` / ${row.SubCode}` : ''}
                              </TableCell>
                              <TableCell>{row.ItemName}</TableCell>
                              <TableCell>{row.ItemType || '-'}</TableCell>
                              <TableCell>{row.Series || '-'}</TableCell>
                              <TableCell>{row.Unit || '-'}</TableCell>
                              <TableCell align="right">{row.MRP || 0}</TableCell>
                              <TableCell align="right">{row.Costing || 0}</TableCell>
                              <TableCell align="right">{row.OpeningStock || 0}</TableCell>
                              <TableCell 
                                align="right" 
                                sx={{ 
                                  fontWeight: (row.ClosingStock || 0) < 0 ? 800 : 600, 
                                  color: (row.ClosingStock || 0) < 0 ? '#dc2626' : '#0F3B66',
                                  ...((row.ClosingStock || 0) < 0 && {
                                    bgcolor: '#fee2e2',
                                    borderRadius: 1
                                  })
                                }}
                              >
                                {row.ClosingStock || 0}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: '#c2410c' }}>
                                ₹{Number(row.Valuation || ((Number(row.ClosingStock || 0) * Number(row.Costing || 0)))).toFixed(2)}
                              </TableCell>
                            </>
                          ) : reportType === 'department' ? (
                            <>
                              <TableCell sx={{ fontWeight: 500 }}>{row.DeptName}</TableCell>
                              <TableCell 
                                sx={{ 
                                  fontFamily: 'monospace', 
                                  fontWeight: 700, 
                                  color: '#0F3B66', 
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  textUnderlineOffset: 3,
                                  '&:hover': { color: '#F88A01' }
                                }}
                                onClick={() => navigate(`/dashboard/reports/item-ledger?itemCode=${encodeURIComponent(row.ItemCode)}&subCode=${encodeURIComponent(row.SubCode || '')}`)}
                                title="Click to view Item Stock Ledger statement"
                              >
                                {row.ItemCode}{row.SubCode ? ` / ${row.SubCode}` : ''}
                              </TableCell>
                              <TableCell>{row.ItemName || '-'}</TableCell>
                              <TableCell>{row.Unit || '-'}</TableCell>
                              <TableCell align="right">₹{Number(row.Costing || 0).toFixed(2)}</TableCell>
                              <TableCell 
                                align="right"
                                sx={{
                                  fontWeight: (row.Pcs || 0) < 0 ? 800 : 500,
                                  color: (row.Pcs || 0) < 0 ? '#dc2626' : 'inherit',
                                  ...((row.Pcs || 0) < 0 && {
                                    bgcolor: '#fee2e2',
                                    borderRadius: 1
                                  })
                                }}
                              >
                                {row.Pcs || 0}
                              </TableCell>
                              <TableCell 
                                align="right"
                                sx={{
                                  fontWeight: (row.Weight || 0) < 0 ? 800 : 400,
                                  color: (row.Weight || 0) < 0 ? '#dc2626' : 'inherit',
                                  ...((row.Weight || 0) < 0 && {
                                    bgcolor: '#fee2e2',
                                    borderRadius: 1
                                  })
                                }}
                              >
                                {row.Weight ? Number(row.Weight).toFixed(3) : 0}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, color: '#c2410c' }}>₹{Number(row.Valuation || 0).toFixed(2)}</TableCell>
                            </>
                          ) : (
                            // Job Work Stock Row
                            <>
                              <TableCell sx={{ fontWeight: 600, color: '#0F3B66' }}>
                                {row.LedgerName}
                              </TableCell>
                              <TableCell 
                                sx={{ 
                                  fontWeight: 800, 
                                  color: '#0F3B66', 
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  textUnderlineOffset: 3,
                                  '&:hover': { color: '#F88A01' }
                                }}
                                onClick={() => navigate(`/dashboard/reports/item-ledger?itemCode=${encodeURIComponent(row.ItemCode)}&subCode=${encodeURIComponent(row.SubCode || '')}`)}
                                title="Click to view Item Stock Ledger"
                              >
                                {row.ItemCode}{row.SubCode ? ` / ${row.SubCode}` : ''}
                              </TableCell>
                              <TableCell>{row.ItemName || '-'}</TableCell>
                              <TableCell align="right" sx={{ color: '#2563eb', fontWeight: 600 }}>{Number(row.OutQty || 0).toLocaleString()}</TableCell>
                              <TableCell align="right" sx={{ color: '#3b82f6' }}>{Number(row.OutNetWt || 0).toFixed(3)}</TableCell>
                              <TableCell align="right" sx={{ color: '#16a34a', fontWeight: 600 }}>{Number(row.InQty || 0).toLocaleString()}</TableCell>
                              <TableCell align="right" sx={{ color: '#15803d' }}>{Number(row.InNetWt || 0).toFixed(3)}</TableCell>
                              <TableCell align="right">
                                <Chip 
                                  label={Number(row.BalQty || 0).toLocaleString()} 
                                  size="small" 
                                  sx={{ 
                                    fontWeight: 800, 
                                    fontSize: '0.78rem',
                                    bgcolor: (row.BalQty || 0) < 0 
                                      ? '#fee2e2' 
                                      : (row.BalQty || 0) > 0 
                                        ? '#fff7ed' 
                                        : '#f0fdf4',
                                    color: (row.BalQty || 0) < 0 
                                      ? '#dc2626' 
                                      : (row.BalQty || 0) > 0 
                                        ? '#c2410c' 
                                        : '#15803d',
                                    border: (row.BalQty || 0) < 0 ? '1px solid #f87171' : 'none'
                                  }} 
                                />
                              </TableCell>
                              <TableCell 
                                align="right" 
                                sx={{ 
                                  fontWeight: 800, 
                                  color: (row.BalNetWt || 0) < 0 
                                    ? '#dc2626' 
                                    : (row.BalNetWt || 0) > 0 
                                      ? '#c2410c' 
                                      : '#15803d' 
                                }}
                              >
                                {Number(row.BalNetWt || 0).toFixed(3)}
                              </TableCell>
                              <TableCell align="right">
                                ₹{Number(row.Costing || 0).toFixed(2)}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: '#c2410c' }}>
                                ₹{Number(row.Valuation || 0).toFixed(2)}
                              </TableCell>
                            </>
                          )}
                        </TableRow>

                        {/* Collapsible Sub-Row for Combined Stock Details */}
                        {reportType === 'combined' && hasSubBreakdown && (
                          <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell colSpan={11} sx={{ py: 0, px: 3, borderBottom: isExpanded ? '1px solid #cbd5e1' : 'none' }}>
                              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                <Box sx={{ py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                  
                                  {/* Department Breakdown */}
                                  {(row.Departments || []).length > 0 && (
                                    <Box sx={{ p: 1.2, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #ccfbf1' }}>
                                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#0f766e', display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.8, textTransform: 'uppercase' }}>
                                        <Business sx={{ fontSize: 15 }} />
                                        Department-wise Stock Allocation ({(row.Departments || []).length} Depts):
                                      </Typography>
                                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        {row.Departments.map(d => {
                                          const isNeg = (d.Pcs || 0) < 0 || (d.Weight || 0) < 0;
                                          return (
                                            <Chip
                                              key={d.DeptID}
                                              label={`${d.DeptName}: ${Number(d.Pcs || 0).toLocaleString()} ${row.Unit || 'PCS'} ${(d.Weight || 0) !== 0 ? `(${Number(d.Weight || 0).toFixed(3)} KG)` : ''}`}
                                              size="small"
                                              sx={{
                                                bgcolor: isNeg ? '#fee2e2' : '#f0fdfa',
                                                border: isNeg ? '1px solid #f87171' : '1px solid #99f6e4',
                                                color: isNeg ? '#dc2626' : '#134e4a',
                                                fontWeight: isNeg ? 800 : 600,
                                                fontSize: '0.74rem'
                                              }}
                                            />
                                          );
                                        })}
                                      </Box>
                                    </Box>
                                  )}

                                  {/* Job Work Ledger Breakdown */}
                                  {(row.Jobworkers || []).length > 0 && (
                                    <Box sx={{ p: 1.2, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #fed7aa' }}>
                                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#c2410c', display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.8, textTransform: 'uppercase' }}>
                                        <Factory sx={{ fontSize: 15 }} />
                                        Job Work Ledger-wise Pending Stock ({(row.Jobworkers || []).length} Vendors):
                                      </Typography>
                                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        {row.Jobworkers.map(j => {
                                          const isNeg = (j.BalQty || 0) < 0 || (j.BalNetWt || 0) < 0;
                                          return (
                                            <Chip
                                              key={j.LedgerId}
                                              label={`${j.LedgerName}: ${Number(j.BalQty || 0).toLocaleString()} ${row.Unit || 'PCS'} ${(j.BalNetWt || 0) !== 0 ? `(${Number(j.BalNetWt || 0).toFixed(3)} KG)` : ''}`}
                                              size="small"
                                              sx={{
                                                bgcolor: isNeg ? '#fee2e2' : '#fff7ed',
                                                border: isNeg ? '1px solid #f87171' : '1px solid #fed7aa',
                                                color: isNeg ? '#dc2626' : '#7c2d12',
                                                fontWeight: isNeg ? 800 : 600,
                                                fontSize: '0.74rem'
                                              }}
                                            />
                                          );
                                        })}
                                      </Box>
                                    </Box>
                                  )}

                                  {/* Main Warehouse Info */}
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1 }}>
                                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                                      📦 Main Warehouse Stock: <strong style={{ color: '#1e40af' }}>{Number(row.MainStock || 0).toLocaleString()} {row.Unit || 'PCS'}</strong>
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#0F3B66', fontWeight: 700 }}>
                                      Combined Location Total: <strong>{Number(row.TotalStock || 0).toLocaleString()} {row.Unit || 'PCS'}</strong>
                                    </Typography>
                                  </Box>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}

                {/* Footer Totals Row */}
                {sortedData.length > 0 && (
                  <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                    {reportType === 'combined' ? (
                      <>
                        <TableCell colSpan={5} sx={{ fontWeight: 'bold', textAlign: 'right', color: '#0F3B66' }}>
                          Grand Combined Totals:
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: '#1e40af' }}>
                          {Number(totals.mainStock || 0).toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: '#0f766e' }}>
                          {Number(totals.deptStock || 0).toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: '#c2410c' }}>
                          {Number(totals.jwStock || 0).toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900, color: '#0F3B66', fontSize: '0.9rem' }}>
                          {Number(totals.totalStock || 0).toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: '#334155' }}>
                          {Number(totals.totalWeight || 0).toFixed(3)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900, color: '#c2410c' }}>
                          ₹{Number(totals.totalValuation || 0).toFixed(2)}
                        </TableCell>
                      </>
                    ) : reportType === 'item' ? (
                      <>
                        <TableCell colSpan={7} sx={{ fontWeight: 'bold', textAlign: 'right', color: '#0F3B66' }}>Total:</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>{Number(totals.totalOpening || 0).toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>{Number(totals.totalClosing || 0).toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900, color: '#c2410c' }}>₹{Number(totals.totalValuation || 0).toFixed(2)}</TableCell>
                      </>
                    ) : reportType === 'department' ? (
                      <>
                        <TableCell colSpan={5} sx={{ fontWeight: 'bold', textAlign: 'right', color: '#0F3B66' }}>Total:</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>{Number(totals.totalPcs || 0).toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>{Number(totals.totalWeight || 0).toFixed(3)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#c2410c' }}>₹{Number(totals.totalValuation || 0).toFixed(2)}</TableCell>
                      </>
                    ) : (
                      // Job Work Stock Totals
                      <>
                        <TableCell colSpan={3} sx={{ fontWeight: 'bold', textAlign: 'right', color: '#0F3B66' }}>Total:</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#2563eb' }}>{Number(totals.totalOutQty || 0).toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#3b82f6' }}>{Number(totals.totalOutWt || 0).toFixed(3)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#16a34a' }}>{Number(totals.totalInQty || 0).toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#15803d' }}>{Number(totals.totalInWt || 0).toFixed(3)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#b91c1c' }}>{Number(totals.totalBalQty || 0).toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#b91c1c' }}>{Number(totals.totalBalWt || 0).toFixed(3)}</TableCell>
                        <TableCell align="right">-</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900, color: '#c2410c' }}>₹{Number(totals.totalValuation || 0).toFixed(2)}</TableCell>
                      </>
                    )}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Box>
      </>
      )}

      {/* TAB 1: DEAD STOCK REPORT */}
      {mainTab === 1 && (
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {/* KPI Summary Banner */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {/* Card 1: Dead Stock Items */}
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderRadius: 2, border: '1px solid #fecaca', bgcolor: '#fff1f2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#991b1b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Dead Stock Items
                    </Typography>
                    <WarningAmber sx={{ color: '#dc2626', fontSize: 18 }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#7f1d1d', my: 0.2 }}>
                    {deadStockTotals.count} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>ITEMS</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 600 }}>
                    {deadStockTotals.autoCount} Auto Detected • {deadStockTotals.manualCount} Manual
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Card 2: Dead Stock Quantity */}
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderRadius: 2, border: '1px solid #fed7aa', bgcolor: '#fff7ed', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#9a3412', fontWeight: 700, textTransform: 'uppercase' }}>
                      Dead Stock Units
                    </Typography>
                    <Layers sx={{ color: '#ea580c', fontSize: 18 }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#7c2d12', my: 0.2 }}>
                    {Number(deadStockTotals.totalQty || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>UNITS</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#f97316', fontWeight: 600 }}>
                    Total Inactive Inventory
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Card 3: Dead Stock Valuation */}
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderRadius: 2, border: '2px solid #0F3B66', bgcolor: '#f8fafc', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#0F3B66', fontWeight: 800, textTransform: 'uppercase' }}>
                      Blocked Capital (Valuation)
                    </Typography>
                    <Business sx={{ color: '#0F3B66', fontSize: 18 }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: '#0F3B66', my: 0.2 }}>
                    ₹{Number(deadStockTotals.totalValuation || 0).toLocaleString()}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 700 }}>
                    Based on Master Costing Rate
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Card 4: Detection Criteria */}
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>
                      Inactivity Thresholds
                    </Typography>
                    <AccessTime sx={{ color: '#64748b', fontSize: 18 }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#334155', my: 0.2 }}>
                    {deadStockTotals.autoCount} Auto / {deadStockTotals.manualCount} Manual
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                    Configured in Item Master
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Filter Controls Toolbar */}
          <Paper sx={{ p: 1.8, mb: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="Search dead stock, subcode, warehouse..."
                  value={deadStockSearch}
                  onChange={(e) => setDeadStockSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ width: { xs: '100%', sm: 260 } }}
                />

                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={deadStockTypeFilter}
                    label="Type"
                    onChange={(e) => setDeadStockTypeFilter(e.target.value)}
                  >
                    <MenuItem value="All">All Types</MenuItem>
                    <MenuItem value="Auto">⚡ Auto Inactivity</MenuItem>
                    <MenuItem value="Manual">🔴 Manual Declared</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={deadStockCategoryFilter}
                    label="Category"
                    onChange={(e) => setDeadStockCategoryFilter(e.target.value)}
                  >
                    <MenuItem value="All">All Categories</MenuItem>
                    <MenuItem value="SubContract">SubContract</MenuItem>
                    <MenuItem value="Inhouse">Inhouse</MenuItem>
                    <MenuItem value="BOP">BOP</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Warehouse</InputLabel>
                  <Select
                    value={deadStockWarehouseFilter}
                    label="Warehouse"
                    onChange={(e) => setDeadStockWarehouseFilter(e.target.value)}
                  >
                    {uniqueDeadStockWarehouses.map(wh => (
                      <MenuItem key={wh} value={wh}>{wh === 'All' ? 'All Warehouses' : wh}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569' }}>
                Showing <strong>{filteredDeadStock.length}</strong> items
              </Typography>
            </Box>
          </Paper>

          {/* Dead Stock Table */}
          <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', flexGrow: 1 }}>
            {deadStockLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
                <CircularProgress size={36} />
              </Box>
            ) : (
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <DsSortableTableCell label="Code" property="ItemCode" width="100px" />
                    <DsSortableTableCell label="Sub Code" property="SubCode" width="90px" />
                    <DsSortableTableCell label="Item Name" property="ItemName" />
                    <TableCell sx={{ backgroundColor: '#0F3B66', color: '#fff', fontWeight: 'bold', fontSize: '0.82rem', py: 0.6 }}>Category</TableCell>
                    <DsSortableTableCell label="Warehouse" property="WarehouseNo" />
                    <TableCell sx={{ backgroundColor: '#0F3B66', color: '#fff', fontWeight: 'bold', fontSize: '0.82rem', py: 0.6 }}>Location</TableCell>
                    <TableCell sx={{ backgroundColor: '#0F3B66', color: '#fff', fontWeight: 'bold', fontSize: '0.82rem', py: 0.6 }} align="center">Unit</TableCell>
                    <DsSortableTableCell label="Main Stock" property="MainStock" align="right" />
                    <DsSortableTableCell label="Total Stock" property="TotalStock" align="right" />
                    <DsSortableTableCell label="Costing (₹)" property="Costing" align="right" />
                    <DsSortableTableCell label="Valuation (₹)" property="DeadStockValuation" align="right" />
                    <TableCell sx={{ backgroundColor: '#0F3B66', color: '#fff', fontWeight: 'bold', fontSize: '0.82rem', py: 0.6 }}>Declaration</TableCell>
                    <TableCell sx={{ backgroundColor: '#0F3B66', color: '#fff', fontWeight: 'bold', fontSize: '0.82rem', py: 0.6 }} align="center">Threshold</TableCell>
                    <DsSortableTableCell label="Last Movement" property="LastMovementDate" />
                    <DsSortableTableCell label="Inactive" property="DaysInactive" align="center" />
                    <TableCell sx={{ backgroundColor: '#0F3B66', color: '#fff', fontWeight: 'bold', fontSize: '0.82rem', py: 0.6 }}>Reason / Condition</TableCell>
                    <TableCell sx={{ backgroundColor: '#0F3B66', color: '#fff', fontWeight: 'bold', fontSize: '0.82rem', py: 0.6 }} align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedDeadStock
                    .slice(dsPage * dsRowsPerPage, dsPage * dsRowsPerPage + dsRowsPerPage)
                    .map((row) => {
                      const isManual = row.EffectiveDeadStockType === 'Manual';
                      const categoryBg = row.Category === 'SubContract' ? '#fff7ed' : (row.Category === 'BOP' ? '#ecfeff' : '#eff6ff');
                      const categoryColor = row.Category === 'SubContract' ? '#ea580c' : (row.Category === 'BOP' ? '#0891b2' : '#0F3B66');

                      return (
                        <TableRow key={`${row.ItemCode}__${row.SubCode || ''}`} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                          <TableCell sx={{ fontWeight: 700, color: '#0F3B66' }}>{row.ItemCode}</TableCell>
                          <TableCell sx={{ color: row.SubCode ? '#334155' : '#94a3b8', fontWeight: 500 }}>
                            {row.SubCode || '-'}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{row.ItemName}</TableCell>
                          <TableCell>
                            <Chip 
                              label={row.Category || 'Inhouse'} 
                              size="small" 
                              sx={{ 
                                bgcolor: categoryBg, 
                                color: categoryColor, 
                                fontWeight: 700, 
                                fontSize: '0.7rem',
                                height: 20
                              }} 
                            />
                          </TableCell>
                          <TableCell sx={{ color: row.WarehouseNo ? '#1e293b' : '#94a3b8' }}>{row.WarehouseNo || '-'}</TableCell>
                          <TableCell sx={{ color: row.Location ? '#1e293b' : '#94a3b8' }}>{row.Location || '-'}</TableCell>
                          <TableCell align="center">{row.Unit || 'PCS'}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{Number(row.MainStock || 0).toLocaleString()}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: '#b91c1c' }}>{Number(row.TotalStock || 0).toLocaleString()}</TableCell>
                          <TableCell align="right">₹{Number(row.Costing || 0).toLocaleString()}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: '#c2410c' }}>
                            ₹{Number(row.DeadStockValuation || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {isManual ? (
                              <Chip 
                                label="Manual" 
                                size="small" 
                                sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 800, fontSize: '0.7rem', height: 22 }} 
                              />
                            ) : (
                              <Chip 
                                label={`Auto (${row.DeadStockDays || 0}d)`} 
                                size="small" 
                                sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 800, fontSize: '0.7rem', height: 22 }} 
                              />
                            )}
                          </TableCell>
                          <TableCell align="center">
                            {row.DeadStockDays > 0 ? `${row.DeadStockDays} days` : '-'}
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {row.LastMovementDate || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Never moved</span>}
                          </TableCell>
                          <TableCell align="center">
                            {row.DaysInactive !== null ? (
                              <Chip 
                                label={`${row.DaysInactive} days`} 
                                size="small" 
                                sx={{ 
                                  bgcolor: row.DaysInactive > 90 ? '#fee2e2' : '#fef3c7', 
                                  color: row.DaysInactive > 90 ? '#991b1b' : '#92400e', 
                                  fontWeight: 700,
                                  fontSize: '0.72rem',
                                  height: 20
                                }} 
                              />
                            ) : (
                              <Chip 
                                label="Never moved" 
                                size="small" 
                                sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontSize: '0.7rem', height: 20 }} 
                              />
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', color: '#475569' }}>
                            {row.DeadStockReason}
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Modify Dead Stock declaration">
                              <IconButton size="small" color="primary" onClick={() => handleOpenDsModal(row)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                  {sortedDeadStock.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={17} align="center" sx={{ py: 4, color: '#64748b' }}>
                        No dead stock items found matching your filters. Configure inactivity days in Item Master to auto-flag items or declare them manually.
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Dead Stock Summary Row */}
                  {sortedDeadStock.length > 0 && (
                    <TableRow sx={{ bgcolor: '#f8fafc', borderTop: '2px solid #0F3B66' }}>
                      <TableCell colSpan={7} sx={{ fontWeight: 'bold', textAlign: 'right', color: '#0F3B66' }}>
                        Total Dead Stock:
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#0F3B66' }}>
                        {sortedDeadStock.reduce((acc, r) => acc + Number(r.MainStock || 0), 0).toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#b91c1c' }}>
                        {Number(deadStockTotals.totalQty || 0).toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>-</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#c2410c' }}>
                        ₹{Number(deadStockTotals.totalValuation || 0).toLocaleString()}
                      </TableCell>
                      <TableCell colSpan={6}></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[25, 50, 100]}
            component="div"
            count={sortedDeadStock.length}
            rowsPerPage={dsRowsPerPage}
            page={dsPage}
            onPageChange={(e, newPage) => setDsPage(newPage)}
            onRowsPerPageChange={(e) => {
              setDsRowsPerPage(parseInt(e.target.value, 10));
              setDsPage(0);
            }}
          />

          {/* Quick Edit Dead Stock Modal */}
          <Dialog open={dsModalOpen} onClose={handleCloseDsModal} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 700, color: '#0F3B66', borderBottom: '1px solid #e2e8f0', pb: 1.5 }}>
              Dead Stock Settings
            </DialogTitle>
            <DialogContent sx={{ pt: 2.5 }}>
              {selectedDsItem && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                  <Box sx={{ p: 1.5, bgcolor: '#f1f5f9', borderRadius: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                      {selectedDsItem.ItemName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Code: {selectedDsItem.ItemCode} {selectedDsItem.SubCode ? `/ ${selectedDsItem.SubCode}` : ''} | Current Stock: {selectedDsItem.TotalStock || 0} {selectedDsItem.Unit || 'PCS'}
                    </Typography>
                  </Box>

                  <FormControl fullWidth size="small">
                    <InputLabel>Declaration Mode</InputLabel>
                    <Select
                      value={dsModalType}
                      label="Declaration Mode"
                      onChange={(e) => setDsModalType(e.target.value)}
                    >
                      <MenuItem value="None">
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#059669' }}>
                          🟢 None (Remove from Dead Stock)
                        </Typography>
                      </MenuItem>
                      <MenuItem value="Auto">
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#d97706' }}>
                          ⚡ Auto (No movement in X days)
                        </Typography>
                      </MenuItem>
                      <MenuItem value="Manual">
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#dc2626' }}>
                          🔴 Manual (Declare as Dead Stock)
                        </Typography>
                      </MenuItem>
                    </Select>
                  </FormControl>

                  {dsModalType === 'Auto' && (
                    <TextField
                      label="Inactivity Threshold Days *"
                      type="number"
                      size="small"
                      fullWidth
                      placeholder="e.g. 30, 60, 90, 180"
                      value={dsModalDays}
                      onChange={(e) => setDsModalDays(e.target.value)}
                      helperText="Classified as dead stock if not moved for this many days"
                      inputProps={{ min: 1 }}
                    />
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0' }}>
              <Button onClick={handleCloseDsModal} color="inherit" sx={{ textTransform: 'none' }}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveDsModal}
                variant="contained"
                disabled={dsModalLoading}
                sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#F88A01' }, textTransform: 'none', fontWeight: 600 }}
              >
                {dsModalLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
    
      <PdfPreviewModal 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        pdfUrl={previewUrl} 
        title={
          mainTab === 1
            ? 'Dead Stock Report Preview'
            : reportType === 'combined' 
              ? 'Combined Stock Preview' 
              : reportType === 'item' 
                ? 'Item Stock Preview' 
                : reportType === 'department' 
                  ? 'Department Stock Preview' 
                  : 'Job Work Stock Preview'
        } 
      />
    </Box>
  );
};

const StockReport = () => (
  <ErrorBoundary>
    <StockReportContent />
  </ErrorBoundary>
);

export default StockReport;
