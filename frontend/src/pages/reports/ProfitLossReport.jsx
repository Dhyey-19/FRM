import { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, CircularProgress, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Divider } from '@mui/material';
import { PictureAsPdf, Visibility, TableView } from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const ProfitLossReport = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPLData = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers/profit-loss`);
      if (!response.ok) throw new Error('Failed to fetch Profit & Loss report');
      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error('Error fetching P&L data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPLData();
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
      [`${localUser.companyName || 'FactoryFlow'} - Profit & Loss Statement`],
      [`Report Date: ${new Date().toLocaleDateString()}`],
      [],
      ['EXPENSES / PURCHASES (LEFT SIDE)', '', '', 'INCOMES / SALES (RIGHT SIDE)', '', ''],
      ['Ledger Name', 'Group Name', 'Amount (INR)', 'Ledger Name', 'Group Name', 'Amount (INR)']
    ];

    const leftItems = [];
    reportData.leftSide.forEach(group => {
      group.ledgers.forEach(ledger => {
        leftItems.push([ledger.ledgerName, group.groupName, ledger.balance]);
      });
    });

    const rightItems = [];
    reportData.rightSide.forEach(group => {
      group.ledgers.forEach(ledger => {
        rightItems.push([ledger.ledgerName, group.groupName, ledger.balance]);
      });
    });

    const maxLength = Math.max(leftItems.length, rightItems.length);

    for (let i = 0; i < maxLength; i++) {
      const leftRow = leftItems[i] || ['', '', ''];
      const rightRow = rightItems[i] || ['', '', ''];
      rows.push([...leftRow, ...rightRow]);
    }

    rows.push([]);
    rows.push(['Total Expenses', '', reportData.totalExpenses, 'Total Incomes', '', reportData.totalIncomes]);
    rows.push([]);
    
    if (reportData.netProfit >= 0) {
      rows.push(['Net Profit', '', reportData.netProfit]);
    } else {
      rows.push(['Net Loss', '', Math.abs(reportData.netProfit)]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Profit & Loss');
    XLSX.writeFile(workbook, 'profit_loss_report.xlsx');
  };

  const handleExportPDF = (action = 'download') => {
    if (!reportData) return;

    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FactoryFlow', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Profit & Loss Statement', 14, 30);
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 36);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40);

    // Left items (Expenses)
    const leftTableData = [];
    reportData.leftSide.forEach(group => {
      group.ledgers.forEach(ledger => {
        leftTableData.push([ledger.ledgerName, group.groupName, formatCurrency(ledger.balance, true)]);
      });
    });
    leftTableData.push([{ content: 'Total Expenses', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: formatCurrency(reportData.totalExpenses, true), styles: { fontStyle: 'bold' } }]);

    // Right items (Incomes)
    const rightTableData = [];
    reportData.rightSide.forEach(group => {
      group.ledgers.forEach(ledger => {
        rightTableData.push([ledger.ledgerName, group.groupName, formatCurrency(ledger.balance, true)]);
      });
    });
    rightTableData.push([{ content: 'Total Incomes', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: formatCurrency(reportData.totalIncomes, true), styles: { fontStyle: 'bold' } }]);

    doc.setFontSize(12);
    doc.setTextColor(15, 59, 102);
    doc.text('Expenses & Purchases', 14, 48);

    autoTable(doc, {
      head: [['Ledger Name', 'Account Group', 'Amount']],
      body: leftTableData,
      startY: 52,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255] }
    });

    const finalYExpenses = doc.lastAutoTable.finalY;

    doc.text('Incomes & Sales', 14, finalYExpenses + 10);

    autoTable(doc, {
      head: [['Ledger Name', 'Account Group', 'Amount']],
      body: rightTableData,
      startY: finalYExpenses + 14,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [16, 124, 65], textColor: [255, 255, 255] }
    });

    const finalYIncomes = doc.lastAutoTable.finalY;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    
    if (reportData.netProfit >= 0) {
      doc.setTextColor(16, 124, 65);
      doc.text(`Net Profit: ${formatCurrency(reportData.netProfit, true)}`, 14, finalYIncomes + 12);
    } else {
      doc.setTextColor(211, 47, 47);
      doc.text(`Net Loss: ${formatCurrency(Math.abs(reportData.netProfit), true)}`, 14, finalYIncomes + 12);
    }

    if (action === 'preview') {
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPreviewUrl(blobUrl);
      setPreviewOpen(true);
    } else {
      doc.save('profit_loss_report.pdf');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
    </Box>
    );
  }

  const isProfit = reportData.netProfit >= 0;

  return (
    <Box sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header Panel */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#0F3B66' }}>
            Profit & Loss Statement
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Standard reporting period statement of incomes and expenses.
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
        {/* Left Side: Expenses */}
        <Grid item xs={12} md={6}>
          <Box sx={{ p: 3, height: '100%', border: '1px solid #e0e0e0', borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66', mb: 2, pb: 1, borderBottom: '2px solid #0F3B66' }}>
              Expenses & Purchases (Debit)
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
                  {reportData.leftSide.map((group) => (
                    group.ledgers.map((ledger, idx) => (
                      <TableRow key={`${group.groupName}-${idx}`} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ pl: 2 }}>{ledger.ledgerName}</TableCell>
                        <TableCell color="text.secondary">{group.groupName}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 500 }}>{formatCurrency(ledger.balance)}</TableCell>
                      </TableRow>
                    ))
                  ))}
                  {reportData.leftSide.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" color="text.secondary" sx={{ py: 4 }}>
                        No Expense accounts with transactions.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                Total Expenses
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                {formatCurrency(reportData.totalExpenses)}
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Right Side: Incomes */}
        <Grid item xs={12} md={6}>
          <Box sx={{ p: 3, height: '100%', border: '1px solid #e0e0e0', borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#10b981', mb: 2, pb: 1, borderBottom: '2px solid #10b981' }}>
              Incomes & Sales (Credit)
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
                  {reportData.rightSide.map((group) => (
                    group.ledgers.map((ledger, idx) => (
                      <TableRow key={`${group.groupName}-${idx}`} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ pl: 2 }}>{ledger.ledgerName}</TableCell>
                        <TableCell color="text.secondary">{group.groupName}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 500 }}>{formatCurrency(ledger.balance)}</TableCell>
                      </TableRow>
                    ))
                  ))}
                  {reportData.rightSide.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" color="text.secondary" sx={{ py: 4 }}>
                        No Income accounts with transactions.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#10b981' }}>
                Total Incomes
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#10b981' }}>
                {formatCurrency(reportData.totalIncomes)}
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Net profit/loss summary banner */}
      <Box 
        sx={{ 
          p: 3, 
          borderRadius: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          bgcolor: isProfit ? '#ecfdf5' : '#fef2f2',
          borderLeft: `6px solid ${isProfit ? '#10b981' : '#ef4444'}`,
          border: '1px solid',
          borderColor: isProfit ? '#a7f3d0' : '#fecaca'
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: isProfit ? '#065f46' : '#991b1b' }}>
            {isProfit ? 'Net Profit' : 'Net Loss'}
          </Typography>
          <Typography variant="body2" sx={{ color: isProfit ? '#047857' : '#b91c1c' }}>
            {isProfit 
              ? 'Great! The company registered a positive surplus for this period.' 
              : 'The company registered a deficit. Expenses exceeded incomes for this period.'
            }
          </Typography>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 800, color: isProfit ? '#047857' : '#b91c1c' }}>
          {formatCurrency(Math.abs(reportData.netProfit))}
        </Typography>
      </Box>
    
      <PdfPreviewModal 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        pdfUrl={previewUrl} 
        title="Profit Loss Preview" 
      />
    </Box>
  );
};

export default ProfitLossReport;
