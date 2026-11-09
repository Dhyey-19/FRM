import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  CircularProgress, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Divider, 
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Card,
  CardContent,
  Avatar
} from '@mui/material';
import { 
  PictureAsPdf, 
  Visibility, 
  TableView, 
  KeyboardArrowDown, 
  KeyboardArrowRight, 
  UnfoldMore, 
  UnfoldLess,
  Search as SearchIcon,
  Close as CloseIcon,
  Inventory2,
  PrecisionManufacturing,
  AccountBalanceWallet,
  AccountBalance,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const BalanceSheetReport = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Group collapse/expand state
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [allExpanded, setAllExpanded] = useState(true);

  // Department WIP Costing Modal State
  const [costingModalOpen, setCostingModalOpen] = useState(false);
  const [selectedDeptTab, setSelectedDeptTab] = useState(0); // 0 = All, 1..N = Specific depts
  const [costingSearch, setCostingSearch] = useState('');

  const fetchBSData = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers/balance-sheet`);
      if (!response.ok) throw new Error('Failed to fetch Balance Sheet report');
      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error('Error fetching Balance Sheet data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBSData();
  }, []);

  const toggleGroup = (groupKey) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const toggleAllGroups = () => {
    if (!reportData) return;
    if (allExpanded) {
      const newCollapsed = {};
      reportData.leftSide.forEach(g => { newCollapsed[`left-${g.groupName}`] = true; });
      reportData.rightSide.forEach(g => { newCollapsed[`right-${g.groupName}`] = true; });
      setCollapsedGroups(newCollapsed);
      setAllExpanded(false);
    } else {
      setCollapsedGroups({});
      setAllExpanded(true);
    }
  };

  const formatCurrency = (value, isPDF = false) => {
    const num = Number(value) || 0;
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(num);
    return isPDF ? formatted.replace('₹', 'Rs.') : formatted;
  };

  const openDeptCosting = (deptName = null) => {
    if (!reportData?.departmentStockBreakdown) return;
    if (deptName) {
      const idx = reportData.departmentStockBreakdown.findIndex(d => d.deptName === deptName);
      setSelectedDeptTab(idx !== -1 ? idx + 1 : 0);
    } else {
      setSelectedDeptTab(0);
    }
    setCostingSearch('');
    setCostingModalOpen(true);
  };

  const handleExportExcel = () => {
    if (!reportData) return;

    // Sheet 1: Balance Sheet Statement
    const rows = [
      [`${localUser.companyName || 'FRM'} - Balance Sheet Statement`],
      [`Report Date: ${new Date().toLocaleDateString()}`],
      [],
      ['SUMMARY OF ASSETS & LIABILITIES (ACCOUNTING RULES)'],
      ['Total Balance Sheet Assets', '', reportData.totalAssets || 0],
      ['Total Liabilities & Capital', '', reportData.totalLiabilities || 0],
      ['Main Store Closing Stock', '', reportData.mainClosingStockValue || 0],
      ['Stock in Process (Departments WIP)', '', reportData.processStockValue || 0],
      ['Total Stock-in-Hand (Closing Stock)', '', reportData.closingStockValue || 0],
      ['Total Asset Value (Fixed Assets Master)', '', reportData.totalAssetValue || 0],
      [reportData.netProfit >= 0 ? 'Net Profit (Transferred to Capital)' : 'Net Loss', '', Math.abs(reportData.netProfit || 0)],
      [],
      ['LIABILITIES & CAPITAL (LEFT SIDE / CREDIT)', '', '', 'ASSETS (RIGHT SIDE / DEBIT)', '', ''],
      ['Particulars / Ledger Name', 'Group Name', 'Amount (INR)', 'Particulars / Ledger Name', 'Group Name', 'Amount (INR)']
    ];

    const leftItems = [];
    // Regular Liabilities
    reportData.leftSide.forEach(group => {
      group.ledgers.forEach(ledger => {
        leftItems.push([ledger.ledgerName, group.groupName, ledger.balance]);
      });
    });
    // Profit/Loss Item if on Left
    if (reportData.profitLossItem && reportData.netProfit > 0) {
      leftItems.push([reportData.profitLossItem.label, 'P&L Transfer to Capital', reportData.profitLossItem.amount]);
    }
    // Difference in Trial Balance if on Left
    if (reportData.differenceAmount > 0 && reportData.differenceSide === 'left') {
      leftItems.push(['Difference in Trial Balance', 'Suspense/Adjustment', reportData.differenceAmount]);
    }

    const rightItems = [];
    // Regular Assets
    reportData.rightSide.forEach(group => {
      group.ledgers.forEach(ledger => {
        rightItems.push([ledger.ledgerName, group.groupName, ledger.balance]);
      });
    });
    // Profit/Loss Item if on Right
    if (reportData.profitLossItem && reportData.netProfit < 0) {
      rightItems.push([reportData.profitLossItem.label, 'P&L Transfer', reportData.profitLossItem.amount]);
    }
    // Difference in Trial Balance if on Right
    if (reportData.differenceAmount > 0 && reportData.differenceSide === 'right') {
      rightItems.push(['Difference in Trial Balance', 'Suspense/Adjustment', reportData.differenceAmount]);
    }

    const maxLength = Math.max(leftItems.length, rightItems.length);

    for (let i = 0; i < maxLength; i++) {
      const leftRow = leftItems[i] || ['', '', ''];
      const rightRow = rightItems[i] || ['', '', ''];
      rows.push([...leftRow, ...rightRow]);
    }

    rows.push([]);
    rows.push(['Total Liabilities & Capital', '', reportData.totalLiabilities, 'Total Assets', '', reportData.totalAssets]);

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Balance Sheet');

    // Sheet 2: Stock in Process by Department (Goods Costing & Valuation)
    if (reportData.departmentStockBreakdown && reportData.departmentStockBreakdown.length > 0) {
      const wipRows = [
        [`${localUser.companyName || 'FRM'} - Stock in Process by Department (Goods Costing & Valuation)`],
        [`Report Date: ${new Date().toLocaleDateString()}`],
        [],
        ['Department', 'Item Code', 'Item Name', 'Unit', 'Transfer Rate (INR)', 'Pcs', 'Weight (KG)', 'Valuation (INR)']
      ];

      reportData.departmentStockBreakdown.forEach(dept => {
        dept.items.forEach(item => {
          wipRows.push([
            dept.deptName,
            item.itemCode,
            item.itemName || '-',
            item.unit || '-',
            item.rate || item.costing || 0,
            item.pcs || 0,
            item.weight || 0,
            item.valuation || 0
          ]);
        });
        wipRows.push([`${dept.deptName} Subtotal`, '', '', '', '', dept.totalPcs, dept.totalWeight, dept.totalValuation]);
        wipRows.push([]);
      });

      wipRows.push(['Total Stock in Process Valuation', '', '', '', '', '', '', reportData.processStockValue || 0]);

      const wipWorksheet = XLSX.utils.aoa_to_sheet(wipRows);
      XLSX.utils.book_append_sheet(workbook, wipWorksheet, 'Stock in Process');
    }

    XLSX.writeFile(workbook, 'balance_sheet_report.xlsx');
  };

  const handleExportPDF = (action = 'download') => {
    if (!reportData) return;

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FRM', 14, 18);
    
    doc.setFontSize(13);
    doc.setTextColor(100);
    doc.text('Balance Sheet Statement', 14, 25);
    
    doc.setFontSize(8.5);
    doc.setTextColor(120);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 31);

    doc.setFontSize(9.5);
    doc.setTextColor(15, 59, 102);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Assets: ${formatCurrency(reportData.totalAssets, true)}    |    Closing Stock: ${formatCurrency(reportData.closingStockValue || 0, true)}    |    Net Profit: ${formatCurrency(reportData.netProfit || 0, true)}`, 14, 38);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 42, 196, 42);

    // Left items (Liabilities)
    const leftTableData = [];
    reportData.leftSide.forEach(group => {
      group.ledgers.forEach(ledger => {
        leftTableData.push([ledger.ledgerName, group.groupName, formatCurrency(ledger.balance, true)]);
      });
    });
    if (reportData.profitLossItem && reportData.netProfit > 0) {
      leftTableData.push([reportData.profitLossItem.label, 'P&L Transfer to Capital', formatCurrency(reportData.profitLossItem.amount, true)]);
    }
    if (reportData.differenceAmount > 0 && reportData.differenceSide === 'left') {
      leftTableData.push(['Difference in Trial Balance', 'Adjustment', formatCurrency(reportData.differenceAmount, true)]);
    }
    leftTableData.push([
      { content: 'Total Liabilities & Capital', colSpan: 2, styles: { fontStyle: 'bold' } }, 
      { content: formatCurrency(reportData.totalLiabilities, true), styles: { fontStyle: 'bold' } }
    ]);

    // Right items (Assets)
    const rightTableData = [];
    reportData.rightSide.forEach(group => {
      group.ledgers.forEach(ledger => {
        rightTableData.push([ledger.ledgerName, group.groupName, formatCurrency(ledger.balance, true)]);
      });
    });
    if (reportData.profitLossItem && reportData.netProfit < 0) {
      rightTableData.push([reportData.profitLossItem.label, 'P&L Transfer', formatCurrency(reportData.profitLossItem.amount, true)]);
    }
    if (reportData.differenceAmount > 0 && reportData.differenceSide === 'right') {
      rightTableData.push(['Difference in Trial Balance', 'Adjustment', formatCurrency(reportData.differenceAmount, true)]);
    }
    rightTableData.push([
      { content: 'Total Assets', colSpan: 2, styles: { fontStyle: 'bold' } }, 
      { content: formatCurrency(reportData.totalAssets, true), styles: { fontStyle: 'bold' } }
    ]);

    doc.setFontSize(10.5);
    doc.setTextColor(15, 59, 102);
    doc.text('Liabilities & Capital', 14, 49);

    autoTable(doc, {
      head: [['Ledger Name', 'Account Group', 'Amount']],
      body: leftTableData,
      startY: 53,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255] }
    });

    const finalYLiabilities = doc.lastAutoTable.finalY;

    doc.setFontSize(10.5);
    doc.setTextColor(16, 124, 65);
    doc.text('Assets (including Closing Stock & Fixed Assets)', 14, finalYLiabilities + 8);

    autoTable(doc, {
      head: [['Ledger Name', 'Account Group', 'Amount']],
      body: rightTableData,
      startY: finalYLiabilities + 12,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [16, 124, 65], textColor: [255, 255, 255] }
    });

    let currentY = doc.lastAutoTable.finalY;

    // Stock in Process Department Summary Table in PDF
    if (reportData.departmentStockBreakdown && reportData.departmentStockBreakdown.length > 0) {
      if (currentY > 220) {
        doc.addPage();
        currentY = 15;
      } else {
        currentY += 8;
      }

      doc.setFontSize(10.5);
      doc.setTextColor(194, 65, 12);
      doc.text('Stock in Process by Department (Goods Costing & Valuation)', 14, currentY);

      const deptSummaryRows = reportData.departmentStockBreakdown.map(d => [
        d.deptName,
        `${d.items.length} items`,
        d.totalPcs || 0,
        d.totalWeight ? `${d.totalWeight} kg` : '0 kg',
        formatCurrency(d.totalValuation, true)
      ]);
      deptSummaryRows.push([
        { content: 'Total Stock in Process Valuation', colSpan: 4, styles: { fontStyle: 'bold' } },
        { content: formatCurrency(reportData.processStockValue || 0, true), styles: { fontStyle: 'bold' } }
      ]);

      autoTable(doc, {
        head: [['Department', 'Items Count', 'Total Pcs', 'Total Weight', 'Department Valuation']],
        body: deptSummaryRows,
        startY: currentY + 4,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [194, 65, 12], textColor: [255, 255, 255] }
      });

      currentY = doc.lastAutoTable.finalY;
    }

    if (currentY > 260) {
      doc.addPage();
      currentY = 20;
    } else {
      currentY += 10;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text(`Balanced Total: ${formatCurrency(reportData.totalAssets, true)}`, 14, currentY);

    if (action === 'preview') {
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPreviewUrl(blobUrl);
      setPreviewOpen(true);
    } else {
      doc.save('balance_sheet_report.pdf');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const hasDifference = reportData.differenceAmount > 0;
  const isProfit = reportData.netProfit >= 0;

  // Compute filtered items for Costing Breakdown Modal
  const deptTabs = ['All Departments', ...(reportData.departmentStockBreakdown || []).map(d => d.deptName)];
  
  let modalItems = [];
  if (reportData.departmentStockBreakdown) {
    if (selectedDeptTab === 0) {
      reportData.departmentStockBreakdown.forEach(dept => {
        dept.items.forEach(item => {
          modalItems.push({ ...item, deptName: dept.deptName });
        });
      });
    } else {
      const currentDept = reportData.departmentStockBreakdown[selectedDeptTab - 1];
      if (currentDept) {
        modalItems = currentDept.items.map(item => ({ ...item, deptName: currentDept.deptName }));
      }
    }
  }

  const filteredModalItems = modalItems.filter(item => {
    if (!costingSearch) return true;
    const q = costingSearch.toLowerCase();
    return (
      item.itemCode?.toLowerCase().includes(q) ||
      item.itemName?.toLowerCase().includes(q) ||
      item.deptName?.toLowerCase().includes(q)
    );
  });

  const modalTotalPcs = filteredModalItems.reduce((acc, i) => acc + (i.pcs || 0), 0);
  const modalTotalWeight = Math.round(filteredModalItems.reduce((acc, i) => acc + (i.weight || 0), 0) * 1000) / 1000;
  const modalTotalValuation = Math.round(filteredModalItems.reduce((acc, i) => acc + (i.valuation || 0), 0) * 100) / 100;

  return (
    <Box sx={{ p: 1, width: '100%', maxWidth: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Header Panel */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F3B66', letterSpacing: -0.5, fontSize: { xs: '1.5rem', sm: '1.85rem', md: '2.125rem' } }}>
            Balance Sheet Statement
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Summarized financial position as per accounting rules showing Assets (with Closing Stock), Liabilities, Capital, and Net Profit.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button 
            variant="outlined" 
            startIcon={allExpanded ? <UnfoldLess /> : <UnfoldMore />}
            onClick={toggleAllGroups}
            sx={{ color: '#0F3B66', borderColor: '#bfdbfe', '&:hover': { bgcolor: '#f0f7ff' } }}
          >
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<PrecisionManufacturing />}
            onClick={() => openDeptCosting()}
            sx={{ color: '#c2410c', borderColor: '#fed7aa', bgcolor: '#fff7ed', '&:hover': { bgcolor: '#ffedd5', borderColor: '#fdba74' } }}
          >
            Stock in Process Costing
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<TableView />}
            onClick={handleExportExcel}
            sx={{ color: '#107c41', borderColor: '#107c41', '&:hover': { bgcolor: 'rgba(16, 124, 65, 0.04)' } }}
          >
            Export Excel
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<Visibility />}
            onClick={() => handleExportPDF('preview')}
            sx={{ color: '#0F3B66', borderColor: '#0F3B66', '&:hover': { bgcolor: 'rgba(15, 59, 102, 0.04)' } }}
          >
            Preview PDF
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<PictureAsPdf />}
            onClick={() => handleExportPDF('download')}
            sx={{ color: '#d32f2f', borderColor: '#d32f2f', '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.04)' } }}
          >
            Export PDF
          </Button>
        </Box>
      </Box>

      {/* KPI Cards Row - Auto-stretch & fit row */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, 
        gap: { xs: 2, sm: 2.5, md: 3 }, 
        width: '100%', 
        alignItems: 'stretch' 
      }}>
        {/* Card 1: Total Assets */}
        <Card sx={{ 
          borderRadius: 3, 
          boxShadow: '0 2px 10px rgba(15, 59, 102, 0.06)',
          border: '1px solid #e2e8f0',
          borderTop: '4px solid #10b981',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } }, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Total Assets
              </Typography>
              <Avatar sx={{ bgcolor: '#d1fae5', color: '#10b981', width: 40, height: 40, borderRadius: 2 }}>
                <AccountBalance />
              </Avatar>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#10b981', fontSize: { xs: '1.3rem', md: '1.45rem' } }}>
              {formatCurrency(reportData.totalAssets)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Fixed Assets, Closing Stock, Debtors & Bank
            </Typography>
          </CardContent>
        </Card>

        {/* Card 2: Total Liabilities & Capital */}
        <Card sx={{ 
          borderRadius: 3, 
          boxShadow: '0 2px 10px rgba(15, 59, 102, 0.06)',
          border: '1px solid #e2e8f0',
          borderTop: '4px solid #0F3B66',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } }, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Liabilities & Capital
              </Typography>
              <Avatar sx={{ bgcolor: '#eff6ff', color: '#0F3B66', width: 40, height: 40, borderRadius: 2 }}>
                <AccountBalanceWallet />
              </Avatar>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F3B66', fontSize: { xs: '1.3rem', md: '1.45rem' } }}>
              {formatCurrency(reportData.totalLiabilities)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Capital A/c, Loans, Creditors & Reserves
            </Typography>
          </CardContent>
        </Card>

        {/* Card 3: Stock-in-Hand (Closing Stock - Main Store + Dept WIP) */}
        <Card sx={{ 
          borderRadius: 3, 
          boxShadow: '0 2px 10px rgba(15, 59, 102, 0.06)',
          border: '1px solid #e2e8f0',
          borderTop: '4px solid #0284c7',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } }, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Stock-in-Hand (Closing)
              </Typography>
              <Avatar sx={{ bgcolor: '#e0f2fe', color: '#0284c7', width: 40, height: 40, borderRadius: 2 }}>
                <Inventory2 />
              </Avatar>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F3B66', fontSize: { xs: '1.3rem', md: '1.45rem' } }}>
              {formatCurrency(reportData.closingStockValue || 0)}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Main Store + Dept WIP
              </Typography>
              <Button size="small" onClick={() => openDeptCosting()} sx={{ p: 0, minWidth: 0, fontSize: '0.68rem', textTransform: 'none', fontWeight: 700, color: '#0284c7' }}>
                View WIP ↗
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Card 4: Net Profit / Net Loss inside Card */}
        <Card sx={{ 
          borderRadius: 3, 
          boxShadow: isProfit ? '0 4px 14px rgba(16, 185, 129, 0.15)' : '0 4px 14px rgba(239, 68, 68, 0.15)',
          border: `1px solid ${isProfit ? '#a7f3d0' : '#fecaca'}`,
          borderTop: `4px solid ${isProfit ? '#10b981' : '#ef4444'}`,
          bgcolor: isProfit ? '#f0fdf4' : '#fef2f2',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } }, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Typography variant="caption" sx={{ color: isProfit ? '#047857' : '#b91c1c', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {isProfit ? 'Net Profit (Surplus)' : 'Net Loss (Deficit)'}
              </Typography>
              <Avatar sx={{ bgcolor: isProfit ? '#dcfce7' : '#fee2e2', color: isProfit ? '#15803d' : '#dc2626', width: 40, height: 40, borderRadius: 2 }}>
                {isProfit ? <TrendingUp /> : <TrendingDown />}
              </Avatar>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 900, color: isProfit ? '#15803d' : '#dc2626', fontSize: { xs: '1.3rem', md: '1.45rem' } }}>
              {formatCurrency(Math.abs(reportData.netProfit || 0))}
            </Typography>
            <Typography variant="caption" sx={{ color: isProfit ? '#047857' : '#b91c1c', fontWeight: 600, mt: 0.5 }}>
              {isProfit ? 'Transferred from P&L to Capital A/c' : 'Carried forward to Balance Sheet'}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Main Split Columns Layout as per Account Rules (Liabilities Cr. vs Assets Dr.) */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, 
        gap: { xs: 2, sm: 2.5, md: 3 }, 
        width: '100%', 
        alignItems: 'stretch' 
      }}>
        {/* Left Side: Liabilities & Capital (Credit) */}
        <Box sx={{ 
          width: '100%', 
          p: { xs: 2, sm: 2.5 }, 
          border: '1px solid #e2e8f0', 
          borderRadius: 3, 
          display: 'flex', 
          flexDirection: 'column', 
          bgcolor: '#ffffff',
          boxShadow: '0 2px 10px rgba(15, 59, 102, 0.06)',
          boxSizing: 'border-box'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, pb: 1, borderBottom: '2px solid #0F3B66' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F3B66' }}>
                Liabilities & Capital (Cr.)
              </Typography>
              <Chip label="Credit" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, bgcolor: '#eff6ff', color: '#1e40af' }} />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Click group to expand/collapse
            </Typography>
          </Box>
          <TableContainer sx={{ flexGrow: 1 }}>
            <Table size="small" sx={{ '& .MuiTableCell-head': { py: 0.75, lineHeight: '1.2' } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 'bold', width: '50%' }}>Particulars / Ledger Group</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Account Group</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '25%' }} align="right">Amount (₹)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Regular Liabilities Groups */}
                {reportData.leftSide.map((group) => {
                  const groupKey = `left-${group.groupName}`;
                  const isCollapsed = !!collapsedGroups[groupKey];

                  return (
                    <React.Fragment key={groupKey}>
                      {/* Group Header Row */}
                      <TableRow
                        onClick={() => toggleGroup(groupKey)}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: '#f8fafc',
                          '&:hover': { bgcolor: '#f1f5f9' },
                          transition: 'background-color 0.15s',
                          userSelect: 'none'
                        }}
                      >
                        <TableCell colSpan={2} sx={{ py: 1, pl: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <IconButton size="small" sx={{ p: 0.25, color: '#0F3B66' }}>
                              {isCollapsed ? <KeyboardArrowRight fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                            </IconButton>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                              {group.groupName}
                            </Typography>
                            <Chip
                              size="small"
                              label={`${group.ledgers.length} ${group.ledgers.length === 1 ? 'item' : 'items'}`}
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#e2e8f0', color: '#475569', fontWeight: 600 }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1, fontWeight: 700, color: '#0F3B66' }}>
                          {formatCurrency(group.total)}
                        </TableCell>
                      </TableRow>

                      {/* Ledgers under this Group */}
                      {!isCollapsed && group.ledgers.map((ledger, idx) => (
                        <TableRow
                          key={`${groupKey}-${idx}`}
                          sx={{
                            bgcolor: '#ffffff',
                            '&:hover': { bgcolor: '#fbfcfd' },
                            '&:last-child td, &:last-child th': { borderBottom: '1px solid #e2e8f0' }
                          }}
                        >
                          <TableCell sx={{ pl: 4.5, py: 0.75 }}>
                            <Typography variant="body2" sx={{ color: '#1e293b' }}>
                              {ledger.ledgerName}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.75, color: 'text.secondary', fontSize: '0.85rem' }}>
                            {group.groupName}
                          </TableCell>
                          <TableCell align="right" sx={{ py: 0.75, fontWeight: 500 }}>
                            {formatCurrency(ledger.balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}

                {/* Profit & Loss carried forward (Net Profit - Transferred to Capital) */}
                {reportData.profitLossItem && reportData.netProfit > 0 && (
                  <TableRow sx={{ bgcolor: '#f0fdf4', borderTop: '2px dashed #10b981' }}>
                    <TableCell sx={{ pl: 2, py: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#15803d' }}>
                          {reportData.profitLossItem.label}
                        </Typography>
                        <Chip size="small" label="Surplus to Capital" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, bgcolor: '#dcfce7', color: '#166534' }} />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: '#15803d', fontWeight: 600, fontSize: '0.8rem' }}>
                      Reserves & Surplus / Capital
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, color: '#15803d' }}>
                      {formatCurrency(reportData.profitLossItem.amount)}
                    </TableCell>
                  </TableRow>
                )}

                {/* Difference in Trial Balance (balancing adjustment) */}
                {hasDifference && reportData.differenceSide === 'left' && (
                  <TableRow sx={{ bgcolor: 'rgba(245, 158, 11, 0.04)' }}>
                    <TableCell sx={{ pl: 2, fontWeight: 'bold', color: '#b45309' }}>
                      Difference in Trial Balance
                    </TableCell>
                    <TableCell sx={{ color: '#b45309' }}>Suspense/Adjustment</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#b45309' }}>
                      {formatCurrency(reportData.differenceAmount)}
                    </TableCell>
                  </TableRow>
                )}

                {reportData.leftSide.length === 0 && !reportData.profitLossItem && !hasDifference && (
                  <TableRow>
                    <TableCell colSpan={3} align="center" color="text.secondary" sx={{ py: 4 }}>
                      No Liabilities accounts with transactions.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ mt: 'auto', pt: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#0F3B66' }}>
              Total Liabilities & Capital
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#0F3B66' }}>
              {formatCurrency(reportData.totalLiabilities)}
            </Typography>
          </Box>
        </Box>

        {/* Right Side: Assets (Debit) */}
        <Box sx={{ 
          width: '100%', 
          p: { xs: 2, sm: 2.5 }, 
          border: '1px solid #e2e8f0', 
          borderRadius: 3, 
          display: 'flex', 
          flexDirection: 'column', 
          bgcolor: '#ffffff',
          boxShadow: '0 2px 10px rgba(15, 59, 102, 0.06)',
          boxSizing: 'border-box'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, pb: 1, borderBottom: '2px solid #10b981' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#10b981' }}>
                Assets (Dr.)
              </Typography>
              <Chip label="Debit" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, bgcolor: '#ecfdf5', color: '#065f46' }} />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Click group to expand/collapse
            </Typography>
          </Box>
          <TableContainer sx={{ flexGrow: 1 }}>
            <Table size="small" sx={{ '& .MuiTableCell-head': { py: 0.75, lineHeight: '1.2' } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 'bold', width: '50%' }}>Particulars / Ledger Group</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Account Group</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '25%' }} align="right">Amount (₹)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Regular Assets Groups */}
                {reportData.rightSide.map((group) => {
                  const groupKey = `right-${group.groupName}`;
                  const isCollapsed = !!collapsedGroups[groupKey];
                  const isFixedAssetGroup = group.isAssetMaster || group.groupName === 'Fixed Assets';
                  const isStockGroup = group.isStock || group.groupName.includes('Stock-in-Hand');

                  return (
                    <React.Fragment key={groupKey}>
                      {/* Group Header Row */}
                      <TableRow
                        onClick={() => toggleGroup(groupKey)}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: isStockGroup ? 'rgba(2, 132, 199, 0.04)' : isFixedAssetGroup ? 'rgba(13, 148, 136, 0.04)' : '#f8fafc',
                          '&:hover': { bgcolor: isStockGroup ? 'rgba(2, 132, 199, 0.08)' : isFixedAssetGroup ? 'rgba(13, 148, 136, 0.08)' : '#f1f5f9' },
                          transition: 'background-color 0.15s',
                          userSelect: 'none'
                        }}
                      >
                        <TableCell colSpan={2} sx={{ py: 1, pl: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <IconButton size="small" sx={{ p: 0.25, color: isStockGroup ? '#0284c7' : isFixedAssetGroup ? '#0d9488' : '#10b981' }}>
                              {isCollapsed ? <KeyboardArrowRight fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                            </IconButton>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: isStockGroup ? '#0284c7' : isFixedAssetGroup ? '#0f766e' : '#10b981' }}>
                              {group.groupName}
                            </Typography>
                            <Chip
                              size="small"
                              label={`${group.ledgers.length} ${group.ledgers.length === 1 ? 'item' : 'items'}`}
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#e2e8f0', color: '#475569', fontWeight: 600 }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1, fontWeight: 700, color: isStockGroup ? '#0284c7' : isFixedAssetGroup ? '#0f766e' : '#10b981' }}>
                          {formatCurrency(group.total)}
                        </TableCell>
                      </TableRow>

                      {/* Ledgers under this Group */}
                      {!isCollapsed && group.ledgers.map((ledger, idx) => {
                        const isFixedAssetItem = isFixedAssetGroup || ledger.ledgerName === 'Total Asset Value';
                        const isWipItem = ledger.type === 'department_wip';
                        const isMainStockItem = ledger.type === 'main_stock';

                        return (
                          <TableRow
                            key={`${groupKey}-${idx}`}
                            sx={{
                              bgcolor: isWipItem ? '#fffbf5' : isStockGroup ? 'rgba(2, 132, 199, 0.02)' : isFixedAssetItem ? 'rgba(13, 148, 136, 0.02)' : '#ffffff',
                              '&:hover': { bgcolor: isWipItem ? '#fff7ed' : '#fbfcfd' },
                              '&:last-child td, &:last-child th': { borderBottom: '1px solid #e2e8f0' }
                            }}
                          >
                            <TableCell sx={{ pl: 4.5, py: 0.75 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: (isFixedAssetItem || isStockGroup) ? 600 : 400 }}>
                                  {ledger.ledgerName}
                                </Typography>
                                
                                {isFixedAssetItem && (
                                  <Chip
                                    size="small"
                                    label="Asset Master"
                                    sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#ccfbf1', color: '#0f766e', fontWeight: 600 }}
                                  />
                                )}

                                {isMainStockItem && (
                                  <Chip
                                    size="small"
                                    label="Main Store"
                                    sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#dcfce7', color: '#15803d', fontWeight: 600 }}
                                  />
                                )}

                                {isWipItem && (
                                  <>
                                    <Chip
                                      size="small"
                                      label={`${ledger.itemsCount || 0} goods in process`}
                                      sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#fed7aa', color: '#9a3412', fontWeight: 600 }}
                                    />
                                    <Button
                                      size="small"
                                      variant="text"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDeptCosting(ledger.deptName);
                                      }}
                                      sx={{ 
                                        p: 0, 
                                        minWidth: 0, 
                                        fontSize: '0.7rem', 
                                        color: '#c2410c', 
                                        textTransform: 'none', 
                                        textDecoration: 'underline',
                                        '&:hover': { textDecoration: 'underline', bgcolor: 'transparent' }
                                      }}
                                    >
                                      View Costing
                                    </Button>
                                  </>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ py: 0.75, color: 'text.secondary', fontSize: '0.85rem' }}>
                              {isWipItem ? `Stock in Process (${ledger.deptName})` : group.groupName}
                            </TableCell>
                            <TableCell align="right" sx={{ py: 0.75, fontWeight: (isFixedAssetItem || isStockGroup) ? 600 : 400, color: isWipItem ? '#c2410c' : isStockGroup ? '#0284c7' : isFixedAssetItem ? '#0f766e' : 'inherit' }}>
                              {formatCurrency(ledger.balance)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

                {/* Profit & Loss carried forward (Loss) */}
                {reportData.profitLossItem && reportData.netProfit < 0 && (
                  <TableRow sx={{ bgcolor: 'rgba(211, 47, 47, 0.04)', borderTop: '2px dashed #ef4444' }}>
                    <TableCell sx={{ pl: 2, fontWeight: 'bold', color: '#c62828' }}>
                      {reportData.profitLossItem.label}
                    </TableCell>
                    <TableCell sx={{ color: '#c62828' }}>P&L Transfer (Deficit)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#c62828' }}>
                      {formatCurrency(reportData.profitLossItem.amount)}
                    </TableCell>
                  </TableRow>
                )}

                {/* Difference in Trial Balance (balancing adjustment) */}
                {hasDifference && reportData.differenceSide === 'right' && (
                  <TableRow sx={{ bgcolor: 'rgba(245, 158, 11, 0.04)' }}>
                    <TableCell sx={{ pl: 2, fontWeight: 'bold', color: '#b45309' }}>
                      Difference in Trial Balance
                    </TableCell>
                    <TableCell sx={{ color: '#b45309' }}>Suspense/Adjustment</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#b45309' }}>
                      {formatCurrency(reportData.differenceAmount)}
                    </TableCell>
                  </TableRow>
                )}

                {reportData.rightSide.length === 0 && !reportData.profitLossItem && !hasDifference && (
                  <TableRow>
                    <TableCell colSpan={3} align="center" color="text.secondary" sx={{ py: 4 }}>
                      No Asset accounts with transactions.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ mt: 'auto', pt: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#10b981' }}>
              Total Assets
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#10b981' }}>
              {formatCurrency(reportData.totalAssets)}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Balancing status bar */}
      <Box 
        sx={{ 
          p: 2.5, 
          borderRadius: 2.5, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          gap: 2,
          bgcolor: '#f0f9ff',
          borderLeft: '6px solid #0284c7',
          border: '1px solid #bae6fd',
          boxShadow: '0 2px 8px rgba(2, 132, 199, 0.06)'
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0369a1' }}>
            Balance Sheet Statement Status
          </Typography>
          <Typography variant="body2" sx={{ color: '#0284c7' }}>
            {hasDifference 
              ? `The books are unbalanced by ${formatCurrency(reportData.differenceAmount)} due to manual voucher entries. An adjustment row has been automatically inserted to balance the sheet.`
              : 'Perfect! The books are fully balanced as per accounting principles. Total Assets match Total Liabilities & Capital (including Net Profit and Closing Stock).'
            }
          </Typography>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#0369a1' }}>
          {formatCurrency(reportData.totalAssets)}
        </Typography>
      </Box>

      {/* Department In-Process Goods Costing & Valuation Modal */}
      <Dialog 
        open={costingModalOpen} 
        onClose={() => setCostingModalOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5, overflow: 'hidden' } }}
      >
        <DialogTitle sx={{ m: 0, p: 2, bgcolor: '#0F3B66', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PrecisionManufacturing />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#ffffff' }}>
              Stock in Process - Department Stock Valuation (Stock Transfer)
            </Typography>
          </Box>
          <IconButton onClick={() => setCostingModalOpen(false)} sx={{ color: '#ffffff' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 2.5 }}>
          {/* Tabs for Department selection */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs 
              value={selectedDeptTab} 
              onChange={(e, val) => setSelectedDeptTab(val)}
              variant="scrollable"
              scrollButtons="auto"
            >
              {deptTabs.map((deptName) => (
                <Tab 
                  key={deptName} 
                  label={deptName} 
                  sx={{ fontWeight: 600, textTransform: 'none', fontSize: '0.9rem' }}
                />
              ))}
            </Tabs>
          </Box>

          {/* Search and Summary Toolbar */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search item code, item name, department..."
              value={costingSearch}
              onChange={(e) => setCostingSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                )
              }}
              sx={{ width: 320 }}
            />

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Chip 
                label={`Items: ${filteredModalItems.length}`} 
                sx={{ bgcolor: '#f1f5f9', fontWeight: 600, color: '#334155' }} 
              />
              <Chip 
                label={`Total Pcs: ${modalTotalPcs}`} 
                sx={{ bgcolor: '#f1f5f9', fontWeight: 600, color: '#334155' }} 
              />
              <Chip 
                label={`Total Weight: ${modalTotalWeight} kg`} 
                sx={{ bgcolor: '#f1f5f9', fontWeight: 600, color: '#334155' }} 
              />
              <Chip 
                label={`Valuation: ${formatCurrency(modalTotalValuation)}`} 
                sx={{ bgcolor: '#ffedd5', color: '#c2410c', fontWeight: 700, border: '1px solid #fed7aa' }} 
              />
            </Box>
          </Box>

          {/* Costing Table */}
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#0F3B66' }}>
                  <TableCell sx={{ bgcolor: '#0F3B66', color: '#ffffff', fontWeight: 700 }}>Department</TableCell>
                  <TableCell sx={{ bgcolor: '#0F3B66', color: '#ffffff', fontWeight: 700 }}>Item Code</TableCell>
                  <TableCell sx={{ bgcolor: '#0F3B66', color: '#ffffff', fontWeight: 700 }}>Item Name</TableCell>
                  <TableCell sx={{ bgcolor: '#0F3B66', color: '#ffffff', fontWeight: 700 }}>Unit</TableCell>
                  <TableCell sx={{ bgcolor: '#0F3B66', color: '#ffffff', fontWeight: 700 }} align="right">Transfer Rate (₹)</TableCell>
                  <TableCell sx={{ bgcolor: '#0F3B66', color: '#ffffff', fontWeight: 700 }} align="right">Pcs</TableCell>
                  <TableCell sx={{ bgcolor: '#0F3B66', color: '#ffffff', fontWeight: 700 }} align="right">Weight (KG)</TableCell>
                  <TableCell sx={{ bgcolor: '#0F3B66', color: '#ffffff', fontWeight: 700 }} align="right">Valuation (₹)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredModalItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No items currently in process for this department.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredModalItems.map((item, idx) => (
                    <TableRow key={`${item.deptName}-${item.itemCode}-${idx}`} hover>
                      <TableCell sx={{ fontWeight: 600, color: '#0F3B66' }}>{item.deptName}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.itemCode}</TableCell>
                      <TableCell>{item.itemName || '-'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={item.unit || '-'} sx={{ height: 20, fontSize: '0.7rem' }} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: '#0F3B66' }}>
                        ₹{Number(item.rate || item.costing || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="right">{item.pcs || 0}</TableCell>
                      <TableCell align="right">{item.weight ? Number(item.weight).toFixed(3) : '0.000'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#c2410c' }}>
                        {formatCurrency(item.valuation || 0)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {filteredModalItems.length > 0 && (
                  <TableRow sx={{ bgcolor: '#f8fafc', fontWeight: 'bold' }}>
                    <TableCell colSpan={5} sx={{ fontWeight: 700 }}>
                      Subtotal
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{modalTotalPcs}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{modalTotalWeight.toFixed(3)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#c2410c' }}>
                      {formatCurrency(modalTotalValuation)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}>
          <Button onClick={() => setCostingModalOpen(false)} variant="contained" sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#0d3258' } }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    
      <PdfPreviewModal 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        pdfUrl={previewUrl} 
        title="Balance Sheet Preview" 
      />
    </Box>
  );
};

export default BalanceSheetReport;
