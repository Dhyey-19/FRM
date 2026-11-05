import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  CircularProgress, 
  Grid, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Divider, 
  Chip,
  IconButton
} from '@mui/material';
import { 
  PictureAsPdf, 
  Visibility, 
  TableView, 
  KeyboardArrowDown, 
  KeyboardArrowRight, 
  UnfoldMore, 
  UnfoldLess 
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
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(value);
    return isPDF ? formatted.replace('₹', 'Rs.') : formatted;
  };

  const handleExportExcel = () => {
    if (!reportData) return;

    // Create custom worksheet rows
    const rows = [
      [`${localUser.companyName || 'FRM'} - Balance Sheet`],
      [`Report Date: ${new Date().toLocaleDateString()}`],
      [],
      ['SUMMARY OF ASSETS & LIABILITIES'],
      ['Total Asset Value (As on Dashboard)', '', reportData.totalAssetValue || 0],
      ['Total Balance Sheet Assets', '', reportData.totalAssets || 0],
      ['Total Liabilities & Capital', '', reportData.totalLiabilities || 0],
      [reportData.netProfit >= 0 ? 'Net Profit' : 'Net Loss', '', Math.abs(reportData.netProfit || 0)],
      [],
      ['LIABILITIES & CAPITAL (LEFT SIDE)', '', '', 'ASSETS (RIGHT SIDE)', '', ''],
      ['Ledger Name', 'Group Name', 'Amount (INR)', 'Ledger Name', 'Group Name', 'Amount (INR)']
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
      leftItems.push([reportData.profitLossItem.label, 'P&L Transfer', reportData.profitLossItem.amount]);
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
    rows.push(['Total Liabilities', '', reportData.totalLiabilities, 'Total Assets', '', reportData.totalAssets]);

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Balance Sheet');
    XLSX.writeFile(workbook, 'balance_sheet_report.xlsx');
  };

  const handleExportPDF = (action = 'download') => {
    if (!reportData) return;

    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FRM', 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Balance Sheet', 14, 28);
    
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 34);

    doc.setFontSize(10);
    doc.setTextColor(15, 59, 102);
    doc.setFont('helvetica', 'bold');
    doc.text(`Dashboard Asset Value: ${formatCurrency(reportData.totalAssetValue || 0, true)}    |    Total Assets: ${formatCurrency(reportData.totalAssets, true)}`, 14, 40);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 44, 196, 44);

    // Left items (Liabilities)
    const leftTableData = [];
    reportData.leftSide.forEach(group => {
      group.ledgers.forEach(ledger => {
        leftTableData.push([ledger.ledgerName, group.groupName, formatCurrency(ledger.balance, true)]);
      });
    });
    if (reportData.profitLossItem && reportData.netProfit > 0) {
      leftTableData.push([reportData.profitLossItem.label, 'P&L Transfer', formatCurrency(reportData.profitLossItem.amount, true)]);
    }
    if (reportData.differenceAmount > 0 && reportData.differenceSide === 'left') {
      leftTableData.push(['Difference in Trial Balance', 'Adjustment', formatCurrency(reportData.differenceAmount, true)]);
    }
    leftTableData.push([{ content: 'Total Liabilities', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: formatCurrency(reportData.totalLiabilities, true), styles: { fontStyle: 'bold' } }]);

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
    rightTableData.push([{ content: 'Total Assets', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: formatCurrency(reportData.totalAssets, true), styles: { fontStyle: 'bold' } }]);

    doc.setFontSize(11);
    doc.setTextColor(15, 59, 102);
    doc.text('Liabilities & Capital', 14, 52);

    autoTable(doc, {
      head: [['Ledger Name', 'Account Group', 'Amount']],
      body: leftTableData,
      startY: 56,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255] }
    });

    const finalYLiabilities = doc.lastAutoTable.finalY;

    doc.setFontSize(11);
    doc.setTextColor(16, 124, 65);
    doc.text('Assets', 14, finalYLiabilities + 10);

    autoTable(doc, {
      head: [['Ledger Name', 'Account Group', 'Amount']],
      body: rightTableData,
      startY: finalYLiabilities + 14,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [16, 124, 65], textColor: [255, 255, 255] }
    });

    const finalYAssets = doc.lastAutoTable.finalY;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text(`Balanced Total: ${formatCurrency(reportData.totalAssets, true)}`, 14, finalYAssets + 12);

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

  return (
    <Box sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Header Panel */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#0F3B66' }}>
            Balance Sheet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Summarized financial position showing total assets, fixed assets, liabilities, and equity.
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

      {/* Main Split Columns Layout */}
      <Grid container spacing={3} sx={{ flexGrow: 1 }}>
        {/* Left Side: Liabilities */}
        <Grid item xs={12} md={6}>
          <Box sx={{ p: 2.5, height: '100%', border: '1px solid #e2e8f0', borderRadius: 2, display: 'flex', flexDirection: 'column', bgcolor: '#ffffff' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, pb: 1, borderBottom: '2px solid #0F3B66' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                Liabilities & Capital (Credit)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Click group to expand/collapse
              </Typography>
            </Box>
            <TableContainer sx={{ flexGrow: 1 }}>
              <Table size="small" sx={{ '& .MuiTableCell-head': { py: 0.75, lineHeight: '1.2' } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 'bold', width: '50%' }}>Ledger / Group</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Account Group</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: '25%' }} align="right">Amount</TableCell>
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

                  {/* Profit & Loss carried forward (Profit) */}
                  {reportData.profitLossItem && reportData.netProfit > 0 && (
                    <TableRow sx={{ bgcolor: 'rgba(16, 124, 65, 0.04)' }}>
                      <TableCell sx={{ pl: 2, fontWeight: 'bold', color: '#047857' }}>
                        {reportData.profitLossItem.label}
                      </TableCell>
                      <TableCell sx={{ color: '#047857' }}>P&L Transfer</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#047857' }}>
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
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                Total Liabilities
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                {formatCurrency(reportData.totalLiabilities)}
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Right Side: Assets */}
        <Grid item xs={12} md={6}>
          <Box sx={{ p: 2.5, height: '100%', border: '1px solid #e2e8f0', borderRadius: 2, display: 'flex', flexDirection: 'column', bgcolor: '#ffffff' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, pb: 1, borderBottom: '2px solid #10b981' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#10b981' }}>
                Assets (Debit)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Click group to expand/collapse
              </Typography>
            </Box>
            <TableContainer sx={{ flexGrow: 1 }}>
              <Table size="small" sx={{ '& .MuiTableCell-head': { py: 0.75, lineHeight: '1.2' } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 'bold', width: '50%' }}>Ledger / Group</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Account Group</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: '25%' }} align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Regular Assets Groups */}
                  {reportData.rightSide.map((group) => {
                    const groupKey = `right-${group.groupName}`;
                    const isCollapsed = !!collapsedGroups[groupKey];
                    const isFixedAssetGroup = group.isAssetMaster || group.groupName === 'Fixed Assets';

                    return (
                      <React.Fragment key={groupKey}>
                        {/* Group Header Row */}
                        <TableRow
                          onClick={() => toggleGroup(groupKey)}
                          sx={{
                            cursor: 'pointer',
                            bgcolor: isFixedAssetGroup ? 'rgba(13, 148, 136, 0.04)' : '#f8fafc',
                            '&:hover': { bgcolor: isFixedAssetGroup ? 'rgba(13, 148, 136, 0.08)' : '#f1f5f9' },
                            transition: 'background-color 0.15s',
                            userSelect: 'none'
                          }}
                        >
                          <TableCell colSpan={2} sx={{ py: 1, pl: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <IconButton size="small" sx={{ p: 0.25, color: isFixedAssetGroup ? '#0d9488' : '#10b981' }}>
                                {isCollapsed ? <KeyboardArrowRight fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                              </IconButton>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: isFixedAssetGroup ? '#0f766e' : '#10b981' }}>
                                {group.groupName}
                              </Typography>
                              <Chip
                                size="small"
                                label={`${group.ledgers.length} ${group.ledgers.length === 1 ? 'item' : 'items'}`}
                                sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#e2e8f0', color: '#475569', fontWeight: 600 }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1, fontWeight: 700, color: isFixedAssetGroup ? '#0f766e' : '#10b981' }}>
                            {formatCurrency(group.total)}
                          </TableCell>
                        </TableRow>

                        {/* Ledgers under this Group */}
                        {!isCollapsed && group.ledgers.map((ledger, idx) => {
                          const isFixedAssetItem = isFixedAssetGroup || ledger.ledgerName === 'Total Asset Value';
                          return (
                            <TableRow
                              key={`${groupKey}-${idx}`}
                              sx={{
                                bgcolor: isFixedAssetItem ? 'rgba(13, 148, 136, 0.02)' : '#ffffff',
                                '&:hover': { bgcolor: '#fbfcfd' },
                                '&:last-child td, &:last-child th': { borderBottom: '1px solid #e2e8f0' }
                              }}
                            >
                              <TableCell sx={{ pl: 4.5, py: 0.75 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: isFixedAssetItem ? 600 : 400 }}>
                                    {ledger.ledgerName}
                                  </Typography>
                                  {isFixedAssetItem && (
                                    <Chip
                                      size="small"
                                      label="Asset Master"
                                      sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#ccfbf1', color: '#0f766e', fontWeight: 600 }}
                                    />
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell sx={{ py: 0.75, color: 'text.secondary', fontSize: '0.85rem' }}>
                                {group.groupName}
                              </TableCell>
                              <TableCell align="right" sx={{ py: 0.75, fontWeight: isFixedAssetItem ? 600 : 400, color: isFixedAssetItem ? '#0f766e' : 'inherit' }}>
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
                    <TableRow sx={{ bgcolor: 'rgba(211, 47, 47, 0.04)' }}>
                      <TableCell sx={{ pl: 2, fontWeight: 'bold', color: '#c62828' }}>
                        {reportData.profitLossItem.label}
                      </TableCell>
                      <TableCell sx={{ color: '#c62828' }}>P&L Transfer</TableCell>
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
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#10b981' }}>
                Total Assets
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#10b981' }}>
                {formatCurrency(reportData.totalAssets)}
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Balancing status bar */}
      <Box 
        sx={{ 
          p: 2.5, 
          borderRadius: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          bgcolor: '#f0f9ff',
          borderLeft: '6px solid #0284c7',
          border: '1px solid #bae6fd'
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0369a1' }}>
            Balance Sheet Statement Status
          </Typography>
          <Typography variant="body2" sx={{ color: '#0284c7' }}>
            {hasDifference 
              ? `The books are unbalanced by ${formatCurrency(reportData.differenceAmount)} due to manual voucher entries. An adjustment row has been automatically inserted to balance the sheet.`
              : 'Perfect! The books are fully balanced. Assets match the sum of Liabilities, Capital, and Net Profit.'
            }
          </Typography>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#0369a1' }}>
          {formatCurrency(reportData.totalAssets)}
        </Typography>
      </Box>
    
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
