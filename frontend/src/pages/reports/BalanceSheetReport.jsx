import { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, CircularProgress, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Divider } from '@mui/material';
import { PictureAsPdf, Visibility, TableView } from '@mui/icons-material';
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
      [`${localUser.companyName || 'FactoryFlow'} - Balance Sheet`],
      [`Report Date: ${new Date().toLocaleDateString()}`],
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
    doc.text(localUser.companyName || 'FactoryFlow', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Balance Sheet', 14, 30);
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 36);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40);

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

    doc.setFontSize(12);
    doc.setTextColor(15, 59, 102);
    doc.text('Liabilities & Capital', 14, 48);

    autoTable(doc, {
      head: [['Ledger Name', 'Account Group', 'Amount']],
      body: leftTableData,
      startY: 52,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255] }
    });

    const finalYLiabilities = doc.lastAutoTable.finalY;

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
    <Box sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header Panel */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#0F3B66' }}>
            Balance Sheet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Summarized financial position showing assets, liabilities, and equity.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
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
          <Box sx={{ p: 3, height: '100%', border: '1px solid #e0e0e0', borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66', mb: 2, pb: 1, borderBottom: '2px solid #0F3B66' }}>
              Liabilities & Capital (Credit)
            </Typography>
            <TableContainer sx={{ flexGrow: 1 }}>
              <Table size="small" sx={{ '& .MuiTableCell-head': { py: 0.5, lineHeight: '1.2' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Ledger Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Account Group</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Regular Liabilities */}
                  {reportData.leftSide.map((group) => (
                    group.ledgers.map((ledger, idx) => (
                      <TableRow key={`${group.groupName}-${idx}`}>
                        <TableCell sx={{ pl: 2 }}>{ledger.ledgerName}</TableCell>
                        <TableCell color="text.secondary">{group.groupName}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 500 }}>{formatCurrency(ledger.balance)}</TableCell>
                      </TableRow>
                    ))
                  ))}
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
          <Box sx={{ p: 3, height: '100%', border: '1px solid #e0e0e0', borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#10b981', mb: 2, pb: 1, borderBottom: '2px solid #10b981' }}>
              Assets (Debit)
            </Typography>
            <TableContainer sx={{ flexGrow: 1 }}>
              <Table size="small" sx={{ '& .MuiTableCell-head': { py: 0.5, lineHeight: '1.2' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Ledger Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Account Group</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Regular Assets */}
                  {reportData.rightSide.map((group) => (
                    group.ledgers.map((ledger, idx) => (
                      <TableRow key={`${group.groupName}-${idx}`}>
                        <TableCell sx={{ pl: 2 }}>{ledger.ledgerName}</TableCell>
                        <TableCell color="text.secondary">{group.groupName}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 500 }}>{formatCurrency(ledger.balance)}</TableCell>
                      </TableRow>
                    ))
                  ))}
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
          p: 3, 
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
