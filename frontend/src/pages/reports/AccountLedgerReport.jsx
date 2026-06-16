import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Button, Paper, CircularProgress, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, InputAdornment, Toolbar, Autocomplete
} from '@mui/material';
import { PictureAsPdf, Visibility, TableView, Share, Search as SearchIcon } from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const AccountLedgerReport = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const getFirstDayOfMonth = () => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  };

  const getLastDayOfMonth = () => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  };
  
  const [ledgers, setLedgers] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [dateRange, setDateRange] = useState([getFirstDayOfMonth(), getLastDayOfMonth()]);
  const [startDate, endDate] = dateRange;
  const [selectedLedger, setSelectedLedger] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const [ledgersRes, vouchersRes] = await Promise.all([
        fetch(`${baseUrl}/ledgers`),
        fetch(`${baseUrl}/vouchers`)
      ]);
      
      if (!ledgersRes.ok || !vouchersRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const ledgersData = await ledgersRes.json();
      const vouchersData = await vouchersRes.json();

      setLedgers(ledgersData);
      setVouchers(vouchersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOppositeLedgers = (voucherNo, currentMode) => {
    const oppositeMode = currentMode === 'Debit' ? 'Credit' : 'Debit';
    const related = vouchers.filter(v => v.VoucherNo === voucherNo && v.Mode === oppositeMode);
    if (related.length === 0) return '-';
    const names = related.map(r => ledgers.find(l => l.Id === r.LedgerId)?.LedgerName || 'Unknown');
    return [...new Set(names)].join(', ');
  };

  const filteredVouchers = useMemo(() => {
    if (!selectedLedger) return [];

    return vouchers.filter(v => {
      // Must match the selected ledger
      if (v.LedgerId !== selectedLedger.Id) return false;
      
      // Date filtering
      const rowDate = v.VoucherDate ? new Date(v.VoucherDate) : null;
      if (rowDate) {
        rowDate.setHours(0,0,0,0);
        const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
        const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;
        
        if (start && rowDate.getTime() < start) return false;
        if (end && rowDate.getTime() > end) return false;
      }

      return true;
    }).sort((a, b) => new Date(a.VoucherDate) - new Date(b.VoucherDate));
  }, [vouchers, selectedLedger, startDate, endDate]);

  const periodOpeningBalance = useMemo(() => {
    if (!selectedLedger) return 0;
    
    // Base opening balance
    let balance = parseFloat(selectedLedger.OpeningBalance || 0);

    // Sum all transactions BEFORE startDate
    if (startDate) {
      const start = new Date(startDate).setHours(0,0,0,0);
      vouchers.forEach(v => {
        if (v.LedgerId === selectedLedger.Id) {
          const rowDate = v.VoucherDate ? new Date(v.VoucherDate) : null;
          if (rowDate) {
            rowDate.setHours(0,0,0,0);
            if (rowDate.getTime() < start) {
               if (v.Mode === 'Debit') balance += parseFloat(v.Amount || 0);
               if (v.Mode === 'Credit') balance -= parseFloat(v.Amount || 0);
            }
          }
        }
      });
    }
    return balance;
  }, [vouchers, selectedLedger, startDate]);

  const totals = useMemo(() => {
    let tDebit = 0;
    let tCredit = 0;
    filteredVouchers.forEach(v => {
      if (v.Mode === 'Debit') tDebit += parseFloat(v.Amount || 0);
      if (v.Mode === 'Credit') tCredit += parseFloat(v.Amount || 0);
    });
    return { debit: tDebit, credit: tCredit };
  }, [filteredVouchers]);

  const periodClosingBalance = periodOpeningBalance + totals.debit - totals.credit;

  const opDebit = periodOpeningBalance > 0 ? periodOpeningBalance : 0;
  const opCredit = periodOpeningBalance < 0 ? Math.abs(periodOpeningBalance) : 0;
  const grossDebit = opDebit + totals.debit;
  const grossCredit = opCredit + totals.credit;
  const grandTotal = Math.max(grossDebit, grossCredit);
  const closingDebit = grossCredit > grossDebit ? (grossCredit - grossDebit) : 0;
  const closingCredit = grossDebit > grossCredit ? (grossDebit - grossCredit) : 0;

  const handleExportPDF = (action = 'download') => {
    if (!selectedLedger) {
      alert("Please select a ledger first.");
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    doc.setFontSize(20);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FactoryFlow', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(`Account Ledger Report: ${selectedLedger.LedgerName}`, 14, 30);
    
    doc.setFontSize(10);
    doc.text(`Period: ${startDate ? startDate.toLocaleDateString() : 'Start'} to ${endDate ? endDate.toLocaleDateString() : 'End'}`, 14, 36);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40);

    const tableColumn = ["Date", "Voucher No", "Particulars", "Remarks", "To (Debit)", "From (Credit)"];
    const tableRows = [];

    // Add Opening Balance Row
    tableRows.push([
      { content: 'OPENING BALANCE', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [15, 59, 102] } },
      { content: periodOpeningBalance >= 0 ? periodOpeningBalance.toFixed(2) : '', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [15, 59, 102] } },
      { content: periodOpeningBalance < 0 ? Math.abs(periodOpeningBalance).toFixed(2) : '', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [15, 59, 102] } }
    ]);

    filteredVouchers.forEach(row => {
      const vDate = row.VoucherDate ? row.VoucherDate.split('T')[0] : '-';
      const debitVal = row.Mode === 'Debit' ? parseFloat(row.Amount).toFixed(2) : '-';
      const creditVal = row.Mode === 'Credit' ? parseFloat(row.Amount).toFixed(2) : '-';
      
      tableRows.push([
        vDate,
        `V${row.VoucherNo}`,
        getOppositeLedgers(row.VoucherNo, row.Mode),
        row.Remark || '-',
        debitVal,
        creditVal
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      foot: [
        [
          { content: 'TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [226, 232, 240], textColor: [15, 59, 102] } },
          { content: grossDebit.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [226, 232, 240], textColor: [15, 59, 102] } },
          { content: grossCredit.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [226, 232, 240], textColor: [15, 59, 102] } }
        ],
        [
          { content: 'CLOSING BALANCE', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [253, 253, 234], textColor: [133, 100, 4] } },
          { content: closingDebit > 0 ? closingDebit.toFixed(2) : '', styles: { halign: 'right', fontStyle: 'bold', fillColor: [253, 253, 234], textColor: [133, 100, 4] } },
          { content: closingCredit > 0 ? closingCredit.toFixed(2) : '', styles: { halign: 'right', fontStyle: 'bold', fillColor: [253, 253, 234], textColor: [133, 100, 4] } }
        ],
        [
          { content: 'GRAND TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 59, 102], textColor: [255, 255, 255] } },
          { content: grandTotal.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 59, 102], textColor: [255, 255, 255] } },
          { content: grandTotal.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 59, 102], textColor: [255, 255, 255] } }
        ]
      ],
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 1.5 },
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      footStyles: { 
        fillColor: [230, 230, 230], 
        textColor: [0, 0, 0],
        lineWidth: 0.1,
        lineColor: [200, 200, 200]
      },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' }
      },
      margin: { top: 45 }
    });

    const fileName = `ledger_${selectedLedger.LedgerName}_${startDate ? startDate.toISOString().split('T')[0] : 'start'}_to_${endDate ? endDate.toISOString().split('T')[0] : 'end'}.pdf`;

    if (action === 'share') {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const reportName = 'AccountLedgerReport';
      
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
      doc.save(fileName);
    }
  };

  const handleExportExcel = () => {
    if (!selectedLedger) {
      alert("Please select a ledger first.");
      return;
    }

    const flatData = [];
    
    // Opening Balance
    flatData.push({
      'Date': 'OPENING BALANCE',
      'Voucher No': '',
      'Particulars': '',
      'Remarks': '',
      'Debit (To)': periodOpeningBalance >= 0 ? periodOpeningBalance.toFixed(2) : '',
      'Credit (From)': periodOpeningBalance < 0 ? Math.abs(periodOpeningBalance).toFixed(2) : ''
    });

    filteredVouchers.forEach(v => {
      flatData.push({
        'Date': v.VoucherDate ? v.VoucherDate.split('T')[0] : '-',
        'Voucher No': `V${v.VoucherNo}`,
        'Particulars': getOppositeLedgers(v.VoucherNo, v.Mode),
        'Remarks': v.Remark || '-',
        'Debit (To)': v.Mode === 'Debit' ? parseFloat(v.Amount).toFixed(2) : '',
        'Credit (From)': v.Mode === 'Credit' ? parseFloat(v.Amount).toFixed(2) : ''
      });
    });

    flatData.push({
      'Date': 'TOTAL',
      'Voucher No': '',
      'Particulars': '',
      'Remarks': '',
      'Debit (To)': grossDebit.toFixed(2),
      'Credit (From)': grossCredit.toFixed(2)
    });

    flatData.push({
      'Date': 'CLOSING BALANCE',
      'Voucher No': '',
      'Particulars': '',
      'Remarks': '',
      'Debit (To)': closingDebit > 0 ? closingDebit.toFixed(2) : '',
      'Credit (From)': closingCredit > 0 ? closingCredit.toFixed(2) : ''
    });

    flatData.push({
      'Date': 'GRAND TOTAL',
      'Voucher No': '',
      'Particulars': '',
      'Remarks': '',
      'Debit (To)': grandTotal.toFixed(2),
      'Credit (From)': grandTotal.toFixed(2)
    });

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger Report');
    XLSX.writeFile(workbook, `ledger_${selectedLedger.LedgerName}_${startDate ? startDate.toISOString().split('T')[0] : 'start'}_to_${endDate ? endDate.toISOString().split('T')[0] : 'end'}.xlsx`);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Account Ledger
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<TableView />} onClick={handleExportExcel} sx={{ color: '#107c41', borderColor: '#107c41' }} disabled={!selectedLedger}>
            Export Excel
          </Button>
          <Button variant="outlined" startIcon={<Visibility />} onClick={() => handleExportPDF('preview')} sx={{ color: '#0F3B66', borderColor: '#0F3B66' }} disabled={!selectedLedger}>
            Preview PDF
          </Button>
          <Button variant="outlined" startIcon={<PictureAsPdf />} onClick={() => handleExportPDF('download')} sx={{ color: '#d32f2f', borderColor: '#d32f2f' }} disabled={!selectedLedger}>
            Export PDF
          </Button>
          <Button variant="contained" startIcon={<Share />} onClick={() => handleExportPDF('share')} sx={{ bgcolor: 'secondary.main' }} disabled={!selectedLedger}>
            Share
          </Button>
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1, width: '100%', display: 'flex', flexDirection: 'column' }}>
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 2 }, pt: 2, pb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #e0e0e0' }}>
          <Autocomplete
            options={ledgers}
            getOptionLabel={(option) => option.LedgerName || ''}
            value={selectedLedger}
            onChange={(e, newValue) => setSelectedLedger(newValue)}
            renderInput={(params) => <TextField {...params} label="Select Ledger" size="small" />}
            sx={{ width: '300px' }}
          />
          <Box sx={{ width: 250 }}>
            <DatePicker
              portalId="root"
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update) => setDateRange(update)}
              isClearable={true}
              customInput={<TextField size="small" label="Date Range" InputLabelProps={{ shrink: true }} fullWidth />}
              dateFormat="dd/MM/yyyy"
            />
          </Box>
        </Toolbar>

        <TableContainer sx={{ flexGrow: 1, overflowY: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <CircularProgress />
            </Box>
          ) : !selectedLedger ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: 'text.secondary' }}>
              <Typography variant="h6">Please select a ledger to view the report</Typography>
            </Box>
          ) : (
            <Table stickyHeader size="small" sx={{ 
              minWidth: 750, 
              border: '1px solid #e0e0e0',
              '& .MuiTableCell-head': {
                py: 0.5,
                lineHeight: '1.2'
              },
              '& .MuiTableCell-root': { 
                borderRight: '1px solid #e0e0e0',
                borderBottom: '1px solid #e0e0e0'
              },
              '& .MuiTableCell-root:last-child': {
                borderRight: 'none'
              }
            }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ backgroundColor: '#0F3B66', color: '#ffffff', fontWeight: 'bold', width: '15%' }}>Date</TableCell>
                  <TableCell sx={{ backgroundColor: '#0F3B66', color: '#ffffff', fontWeight: 'bold', width: '15%' }}>Voucher No</TableCell>
                  <TableCell sx={{ backgroundColor: '#0F3B66', color: '#ffffff', fontWeight: 'bold', width: '20%' }}>Particulars</TableCell>
                  <TableCell sx={{ backgroundColor: '#0F3B66', color: '#ffffff', fontWeight: 'bold', width: '20%' }}>Remarks</TableCell>
                  <TableCell align="right" sx={{ backgroundColor: '#0F3B66', color: '#ffffff', fontWeight: 'bold', width: '15%' }}>To (Debit)</TableCell>
                  <TableCell align="right" sx={{ backgroundColor: '#0F3B66', color: '#ffffff', fontWeight: 'bold', width: '15%' }}>From (Credit)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Opening Balance Row */}
                <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold', color: '#0f3b66' }}>
                    OPENING BALANCE
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#0f3b66' }}>
                    {periodOpeningBalance >= 0 ? periodOpeningBalance.toFixed(2) : ''}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#0f3b66' }}>
                    {periodOpeningBalance < 0 ? Math.abs(periodOpeningBalance).toFixed(2) : ''}
                  </TableCell>
                </TableRow>

                {filteredVouchers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No voucher entries found for the selected period.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filteredVouchers.map((row) => (
                      <TableRow hover key={row.VoucherId}>
                        <TableCell>{row.VoucherDate ? row.VoucherDate.split('T')[0] : '-'}</TableCell>
                        <TableCell>V{row.VoucherNo}</TableCell>
                        <TableCell>{getOppositeLedgers(row.VoucherNo, row.Mode)}</TableCell>
                        <TableCell>{row.Remark || '-'}</TableCell>
                        <TableCell align="right">{row.Mode === 'Debit' ? parseFloat(row.Amount).toFixed(2) : '-'}</TableCell>
                        <TableCell align="right">{row.Mode === 'Credit' ? parseFloat(row.Amount).toFixed(2) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                
                {/* Totals Row */}
                <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold', color: '#0f3b66', fontSize: '0.95rem' }}>
                    TOTAL
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#0f3b66', fontSize: '0.95rem' }}>
                    {grossDebit.toFixed(2)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#0f3b66', fontSize: '0.95rem' }}>
                    {grossCredit.toFixed(2)}
                  </TableCell>
                </TableRow>

                {/* Closing Balance Row */}
                <TableRow sx={{ backgroundColor: '#fdfdea' }}>
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold', color: '#856404' }}>
                    CLOSING BALANCE
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#856404' }}>
                    {closingDebit > 0 ? closingDebit.toFixed(2) : ''}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#856404' }}>
                    {closingCredit > 0 ? closingCredit.toFixed(2) : ''}
                  </TableCell>
                </TableRow>

                {/* Grand Total Row */}
                <TableRow sx={{ backgroundColor: '#0F3B66' }}>
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold', color: '#ffffff', fontSize: '1rem' }}>
                    GRAND TOTAL
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', fontSize: '1rem' }}>
                    {grandTotal.toFixed(2)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', fontSize: '1rem' }}>
                    {grandTotal.toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Box>
    
      <PdfPreviewModal 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        pdfUrl={previewUrl} 
        title="Account Ledger Preview" 
      />
    </Box>
  );
};

export default AccountLedgerReport;
