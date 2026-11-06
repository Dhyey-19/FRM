import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Paper, CircularProgress, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, Toolbar, TextField, InputAdornment
} from '@mui/material';
import { PictureAsPdf, Visibility, TableView, Share, Search as SearchIcon } from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const TrialBalanceReport = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLedgers = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers`);
      if (!response.ok) throw new Error('Failed to fetch ledgers for trial balance');
      const data = await response.json();
      setLedgers(data);
    } catch (error) {
      console.error('Error fetching ledgers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgers();
  }, []);

  // Filter ledgers based on search term
  const filteredLedgers = ledgers.filter(l => 
    l.LedgerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.AccountGroupName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate Debit/Credit columns and Totals
  // positive is Debit, negative is Credit
  let totalDebit = 0;
  let totalCredit = 0;

  const rowData = filteredLedgers.map(l => {
    const balance = parseFloat(l.ClosingBalance) || 0;
    const isDebit = balance >= 0;
    const debitVal = isDebit ? balance : 0;
    const creditVal = !isDebit ? Math.abs(balance) : 0;

    totalDebit += debitVal;
    totalCredit += creditVal;

    return {
      id: l.Id,
      name: l.LedgerName,
      group: l.AccountGroupName || '-',
      debit: debitVal,
      credit: creditVal
    };
  });

  const diff = Number(Math.abs(totalDebit - totalCredit).toFixed(2));

  const formatAmount = (val) => {
    if (val === 0) return '-';
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const handleExportPDF = (action = 'download') => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FRM', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Trial Balance Report', 14, 30);
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 36);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40);

    const tableRows = rowData.map(row => [
      row.name,
      row.group,
      row.debit > 0 ? row.debit.toFixed(2) : '-',
      row.credit > 0 ? row.credit.toFixed(2) : '-'
    ]);

    // Add totals row
    tableRows.push([
      { content: 'Total:', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', textColor: [15, 59, 102] } },
      { content: totalDebit.toFixed(2), styles: { fontStyle: 'bold', textColor: [0, 0, 0] } },
      { content: totalCredit.toFixed(2), styles: { fontStyle: 'bold', textColor: [0, 0, 0] } }
    ]);

    if (diff > 0) {
      tableRows.push([
        { content: `Difference in Trial Balance: ${diff.toFixed(2)}`, colSpan: 4, styles: { halign: 'center', fontStyle: 'bold', textColor: [211, 47, 47] } }
      ]);
    }
    
    autoTable(doc, {
      head: [['Ledger Name', 'Account Group', 'Debit (Dr)', 'Credit (Cr)']],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' }
      }
    });

    const filename = 'trial_balance_report.pdf';

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const reportName = typeof filename !== 'undefined' ? filename.replace('.pdf', '') : 'TrialBalanceReport';
      
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
    const flatData = rowData.map(row => ({
      'Ledger Name': row.name,
      'Account Group': row.group,
      'Debit (Dr)': row.debit || 0,
      'Credit (Cr)': row.credit || 0
    }));

    if (rowData.length > 0) {
      flatData.push({
        'Ledger Name': 'Total', 'Account Group': '',
        'Debit (Dr)': totalDebit,
        'Credit (Cr)': totalCredit
      });
      if (diff > 0) {
        flatData.push({
          'Ledger Name': 'Difference in Trial Balance', 'Account Group': '',
          'Debit (Dr)': totalDebit > totalCredit ? 0 : diff,
          'Credit (Cr)': totalCredit > totalDebit ? 0 : diff
        });
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Trial Balance');
    XLSX.writeFile(workbook, 'trial_balance_report.xlsx');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Trial Balance
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          <Button variant="outlined" startIcon={<TableView />} onClick={handleExportExcel} sx={{ color: '#107c41', borderColor: '#107c41', flex: { xs: 1, sm: 'none' } }}>
            Export Excel
          </Button>
          <Button variant="outlined" startIcon={<Visibility />} onClick={() => handleExportPDF('preview')} sx={{ color: '#0F3B66', borderColor: '#0F3B66', flex: { xs: 1, sm: 'none' } }}>
            Preview PDF
          </Button>
          <Button variant="outlined" startIcon={<PictureAsPdf />} onClick={() => handleExportPDF('download')} sx={{ color: '#d32f2f', borderColor: '#d32f2f', flex: { xs: 1, sm: 'none' } }}>
            Export PDF
          </Button>
          <Button variant="contained" startIcon={<Share />} onClick={() => handleExportPDF('share')} sx={{ bgcolor: 'secondary.main', flex: { xs: 1, sm: 'none' } }}>
            Share
          </Button>
        </Box>
      </Box>

      {diff > 0 && !loading && (
        <Alert severity="warning" sx={{ mb: 3, fontWeight: 500 }}>
          Trial Balance is not balanced. Difference: ₹ {formatAmount(diff)} (Debit: ₹ {formatAmount(totalDebit)} | Credit: ₹ {formatAmount(totalCredit)})
        </Alert>
      )}

      {diff === 0 && !loading && (
        <Alert severity="success" sx={{ mb: 3, fontWeight: 500 }}>
          Trial Balance is balanced. Total Debit and Credit equal ₹ {formatAmount(totalDebit)}.
        </Alert>
      )}

      <Box sx={{ flexGrow: 1, width: '100%' }}>
        <Toolbar sx={{ pl: { xs: 1.5, sm: 2 }, pr: { xs: 1.5, sm: 2 }, pt: 2, pb: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', backgroundColor: '#f8fafc', borderBottom: '1px solid #e0e0e0' }}>
          <TextField
            size="small"
            placeholder="Search ledgers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: '100%', sm: 300 }, backgroundColor: '#fff', borderRadius: 1 }}
          />
        </Toolbar>

        <TableContainer sx={{ maxHeight: 600 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table stickyHeader size="small" sx={{ 
              minWidth: 750, 
              border: '1px solid #e0e0e0',
              '& .MuiTableRow-root': { height: 32 },
              '& .MuiTableCell-head': { py: 0.5, lineHeight: '1.2' },
              '& .MuiTableCell-root': { borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0' }
            }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ backgroundColor: '#0F3B66', color: '#ffffff !important', fontWeight: 'bold', width: '40%' }}>Ledger Name</TableCell>
                  <TableCell sx={{ backgroundColor: '#0F3B66', color: '#ffffff !important', fontWeight: 'bold', width: '30%' }}>Account Group</TableCell>
                  <TableCell align="right" sx={{ backgroundColor: '#0F3B66', color: '#ffffff !important', fontWeight: 'bold', width: '15%' }}>Debit (Dr)</TableCell>
                  <TableCell align="right" sx={{ backgroundColor: '#0F3B66', color: '#ffffff !important', fontWeight: 'bold', width: '15%' }}>Credit (Cr)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rowData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                      No ledger accounts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rowData.map((row, index) => (
                    <TableRow hover key={row.id}>
                      <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                      <TableCell>{row.group}</TableCell>
                      <TableCell align="right" sx={{ color: row.debit > 0 ? 'inherit' : 'text.secondary' }}>
                        {formatAmount(row.debit)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: row.credit > 0 ? 'inherit' : 'text.secondary' }}>
                        {formatAmount(row.credit)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {rowData.length > 0 && (
                  <>
                    <TableRow sx={{ backgroundColor: '#e2e8f0', '& td': { fontWeight: 'bold' } }}>
                      <TableCell colSpan={2} sx={{ textAlign: 'right', color: '#0F3B66' }}>Total:</TableCell>
                      <TableCell align="right">{formatAmount(totalDebit)}</TableCell>
                      <TableCell align="right">{formatAmount(totalCredit)}</TableCell>
                    </TableRow>
                    {diff > 0 && (
                      <TableRow sx={{ backgroundColor: '#fee2e2', '& td': { fontWeight: 'bold', color: '#b91c1c' } }}>
                        <TableCell colSpan={2} sx={{ textAlign: 'right' }}>Difference:</TableCell>
                        <TableCell align="right">{totalDebit > totalCredit ? formatAmount(diff) : '-'}</TableCell>
                        <TableCell align="right">{totalCredit > totalDebit ? formatAmount(diff) : '-'}</TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Box>
    
      <PdfPreviewModal 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        pdfUrl={previewUrl} 
        title="Trial Balance Preview" 
      />
    </Box>
  );
};

export default TrialBalanceReport;
