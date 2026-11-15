import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Chip, Grid, Card, CardContent, Divider, Alert, Tooltip,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, Tabs, Tab,
  LinearProgress, Stack, Dialog, DialogTitle, DialogContent, DialogActions,
  ToggleButton, ToggleButtonGroup
} from '@mui/material';
import {
  AccountBalance as BankIcon,
  CloudUpload as UploadIcon,
  Search as SearchIcon,
  CheckCircle as MatchedIcon,
  WarningAmber as MismatchedIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon,
  LinkOff as UnlinkIcon,
  FilePresent as ExcelIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { ensureNumericWorksheet } from '../utils/excelHelper';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';
import {
  parseExcelStatement,
  parsePdfStatement,
  reconcileEntries,
  formatDisplayDate,
  downloadSampleBankStatement
} from '../utils/statementParser';
import PdfPreviewModal from '../components/common/PdfPreviewModal';

const BankReconciliation = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Core Data
  const [ledgers, setLedgers] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyProfile, setCompanyProfile] = useState(null);

  // Configuration & Filters
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateTolerance, setDateTolerance] = useState(3);
  const [invertDrCr, setInvertDrCr] = useState(false);

  // File Upload State
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [statementRows, setStatementRows] = useState([]);

  // Results & Display Filters
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'MATCHED' | 'UNMATCHED'
  const [unmatchedType, setUnmatchedType] = useState('ALL'); // 'ALL' | 'STATEMENT_ONLY' | 'BOOKS_ONLY'
  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState('ALL'); // 'ALL' | 'Withdrawal' | 'Deposit'
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Print & PDF Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  // Manual Overrides / Unlinked Pairs tracking
  const [manualUnlinkedIds, setManualUnlinkedIds] = useState(new Set());

  // Fetch initial ledgers, vouchers, company profile
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const [ledgersRes, vouchersRes, profileRes] = await Promise.all([
        fetch(`${baseUrl}/ledgers`),
        fetch(`${baseUrl}/vouchers`),
        fetch(`${baseUrl}/company-profile`)
      ]);

      if (ledgersRes.ok) {
        const lData = await ledgersRes.json();
        setLedgers(lData);
        // Default select the first bank account
        const firstBank = lData.find(l => 
          l.AccountGroupName === 'Bank Accounts' || 
          (l.AccountGroupName && l.AccountGroupName.toLowerCase().includes('bank'))
        );
        if (firstBank) setSelectedLedger(firstBank);
        else if (lData.length > 0) setSelectedLedger(lData[0]);
      }

      if (vouchersRes.ok) {
        const vData = await vouchersRes.json();
        setVouchers(Array.isArray(vData) ? vData : []);
      }

      if (profileRes.ok) {
        const pData = await profileRes.json();
        setCompanyProfile(pData);
      }
    } catch (err) {
      console.error('Error fetching initial reconciliation data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Bank ledgers list
  const bankLedgers = useMemo(() => {
    return ledgers.filter(l => 
      l.AccountGroupName === 'Bank Accounts' || 
      (l.AccountGroupName && l.AccountGroupName.toLowerCase().includes('bank')) ||
      (l.AccountGroupName && l.AccountGroupName.toLowerCase().includes('cash'))
    );
  }, [ledgers]);

  // Vouchers belonging to selected bank ledger
  const bookVouchers = useMemo(() => {
    if (!selectedLedger) return [];
    return vouchers.filter(v => {
      if (v.LedgerId !== selectedLedger.Id) return false;
      const vDate = v.VoucherDate ? v.VoucherDate.split('T')[0] : '';
      if (fromDate && vDate < fromDate) return false;
      if (toDate && vDate > toDate) return false;
      return true;
    });
  }, [vouchers, selectedLedger, fromDate, toDate]);

  // Current ledger closing balance calculation
  const ledgerClosingBalance = useMemo(() => {
    if (!selectedLedger) return 0;
    const initial = parseFloat(selectedLedger.OpeningBalance || 0);
    const relatedVouchers = vouchers.filter(v => v.LedgerId === selectedLedger.Id);
    let totalDebit = 0;
    let totalCredit = 0;
    relatedVouchers.forEach(v => {
      const amt = parseFloat(v.Amount || 0);
      if (v.Mode === 'Debit') totalDebit += amt;
      else if (v.Mode === 'Credit') totalCredit += amt;
    });
    // For Bank Accounts (Asset): Debit increases, Credit decreases
    return initial + totalDebit - totalCredit;
  }, [selectedLedger, vouchers]);

  // Helper to find counter/opposite ledger for a voucher
  const getOppositeLedgerName = (voucherNo, currentMode) => {
    const oppMode = currentMode === 'Debit' ? 'Credit' : 'Debit';
    const related = vouchers.filter(v => v.VoucherNo === voucherNo && v.Mode === oppMode);
    if (related.length === 0) return '-';
    const names = related.map(r => ledgers.find(l => l.Id === r.LedgerId)?.LedgerName || 'Unknown');
    return [...new Set(names)].join(', ');
  };

  // Handle file upload (Excel or PDF)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsParsing(true);
    setParseError('');
    setManualUnlinkedIds(new Set());

    try {
      const fileName = file.name.toLowerCase();
      let parsedResult;

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        parsedResult = await parseExcelStatement(file);
      } else if (fileName.endsWith('.pdf')) {
        parsedResult = await parsePdfStatement(file);
      } else {
        throw new Error('Unsupported file format. Please upload an Excel (.xlsx, .xls, .csv) or PDF (.pdf) file.');
      }

      if (!parsedResult.transactions || parsedResult.transactions.length === 0) {
        throw new Error('No valid transaction rows found in the uploaded file.');
      }

      setStatementRows(parsedResult.transactions);

      // Auto-set Date range based on statement if not set
      const dates = parsedResult.transactions.map(t => t.date).filter(Boolean).sort();
      if (dates.length > 0) {
        if (!fromDate) setFromDate(dates[0]);
        if (!toDate) setToDate(dates[dates.length - 1]);
      }
    } catch (err) {
      console.error('File parsing error:', err);
      setParseError(err.message || 'Failed to parse bank statement file.');
      setStatementRows([]);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  // Run Reconciliation Engine
  const reconciliationData = useMemo(() => {
    if (!statementRows.length && !bookVouchers.length) {
      return {
        matchedPairs: [],
        unmatchedStatements: [],
        unmatchedBooks: [],
        allReconciliationItems: [],
        summary: {
          totalStatementCount: 0,
          totalBookCount: 0,
          matchedCount: 0,
          unmatchedStatementCount: 0,
          unmatchedBookCount: 0,
          totalStmtAmount: 0,
          totalBookAmount: 0,
          matchedStmtAmount: 0,
          unmatchedStmtAmount: 0,
          unmatchedBookAmount: 0,
          stmtDeposits: 0,
          stmtWithdrawals: 0,
          netStmtFlow: 0,
          bookDeposits: 0,
          bookWithdrawals: 0,
          netBookFlow: 0,
          reconciliationDifference: 0
        }
      };
    }

    const res = reconcileEntries(statementRows, bookVouchers, {
      dateToleranceDays: Number(dateTolerance),
      matchByRefNo: true,
      invertDrCr
    });

    // Handle manual unlinks
    if (manualUnlinkedIds.size > 0) {
      const activeMatched = [];
      const extraStmt = [...res.unmatchedStatements];
      const extraBooks = [...res.unmatchedBooks];

      res.matchedPairs.forEach(pair => {
        if (manualUnlinkedIds.has(pair.id)) {
          extraStmt.push({
            id: `unlinked-stmt-${pair.id}`,
            status: 'UNMATCHED_STATEMENT',
            matchConfidence: 'None',
            matchReason: 'Manually unlinked by user',
            statement: pair.statement,
            book: null
          });
          extraBooks.push({
            id: `unlinked-book-${pair.id}`,
            status: 'UNMATCHED_BOOKS',
            matchConfidence: 'None',
            matchReason: 'Manually unlinked by user',
            statement: null,
            book: pair.book
          });
        } else {
          activeMatched.push(pair);
        }
      });

      return {
        ...res,
        matchedPairs: activeMatched,
        unmatchedStatements: extraStmt,
        unmatchedBooks: extraBooks,
        allReconciliationItems: [...activeMatched, ...extraStmt, ...extraBooks],
        summary: {
          ...res.summary,
          matchedCount: activeMatched.length,
          unmatchedStatementCount: extraStmt.length,
          unmatchedBookCount: extraBooks.length
        }
      };
    }

    return res;
  }, [statementRows, bookVouchers, dateTolerance, invertDrCr, manualUnlinkedIds]);

  // Toggle unlink for a matched pair
  const handleToggleUnlink = (pairId) => {
    setManualUnlinkedIds(prev => {
      const updated = new Set(prev);
      if (updated.has(pairId)) updated.delete(pairId);
      else updated.add(pairId);
      return updated;
    });
  };

  // Filtered Display Items
  const displayedItems = useMemo(() => {
    let items = [];

    if (filterTab === 'ALL') {
      items = reconciliationData.allReconciliationItems;
    } else if (filterTab === 'MATCHED') {
      items = reconciliationData.matchedPairs;
    } else if (filterTab === 'UNMATCHED') {
      if (unmatchedType === 'ALL') {
        items = [...reconciliationData.unmatchedStatements, ...reconciliationData.unmatchedBooks];
      } else if (unmatchedType === 'STATEMENT_ONLY') {
        items = reconciliationData.unmatchedStatements;
      } else if (unmatchedType === 'BOOKS_ONLY') {
        items = reconciliationData.unmatchedBooks;
      }
    }

    // Direction Filter (Withdrawal/Payment vs Deposit/Receipt)
    if (directionFilter !== 'ALL') {
      items = items.filter(item => {
        const stmtType = item.statement?.type;
        const bookType = item.book?.bookType;
        return (stmtType === directionFilter) || (bookType === directionFilter);
      });
    }

    // Free text search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter(item => {
        const stmt = item.statement;
        const book = item.book;

        const matchStmt = stmt && (
          stmt.description.toLowerCase().includes(q) ||
          stmt.refNo.toLowerCase().includes(q) ||
          stmt.amount.toString().includes(q) ||
          stmt.dateDisplay.includes(q)
        );

        const matchBook = book && (
          book.voucherNo.toString().includes(q) ||
          book.remark.toLowerCase().includes(q) ||
          book.through.toLowerCase().includes(q) ||
          book.amount.toString().includes(q) ||
          book.dateDisplay.includes(q) ||
          getOppositeLedgerName(book.voucherNo, book.mode).toLowerCase().includes(q)
        );

        return matchStmt || matchBook;
      });
    }

    return items;
  }, [reconciliationData, filterTab, unmatchedType, directionFilter, searchTerm, vouchers, ledgers]);

  // Reset filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setDirectionFilter('ALL');
    setFilterTab('ALL');
    setUnmatchedType('ALL');
    setPage(0);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportRows = displayedItems.map((item, index) => {
      const stmt = item.statement;
      const book = item.book;

      return {
        'Sr No': index + 1,
        'Status': item.status === 'MATCHED' ? 'Matched' : (item.status === 'UNMATCHED_STATEMENT' ? 'In Statement Only' : 'In Books Only'),
        'Match Reason / Note': item.matchReason || '',
        'Stmt Date': stmt ? stmt.dateDisplay : '-',
        'Stmt Particulars': stmt ? stmt.description : '-',
        'Stmt Ref / Chq No': stmt ? stmt.refNo : '-',
        'Stmt Type': stmt ? stmt.type : '-',
        'Stmt Amount': stmt ? (Number(stmt.amount) || 0) : 0,
        'Book Date': book ? book.dateDisplay : '-',
        'Voucher No': book ? `V${book.voucherNo}` : '-',
        'Voucher Type': book ? book.voucherType : '-',
        'Particulars (Party/Account)': book ? getOppositeLedgerName(book.voucherNo, book.mode) : '-',
        'Book Mode': book ? (book.mode === 'Debit' ? 'Debit (Deposit)' : 'Credit (Payment)') : '-',
        'Book Amount': book ? (Number(book.amount) || 0) : 0
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    ensureNumericWorksheet(worksheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reconciliation');
    
    const bankName = selectedLedger ? selectedLedger.LedgerName.replace(/[^a-zA-Z0-9]/g, '_') : 'Bank';
    XLSX.writeFile(workbook, `Bank_Reconciliation_${bankName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Generate PDF BRS Statement
  const handleGeneratePdf = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const companyName = companyProfile?.CompanyName || 'FRM-BBP Enterprise';
    const bankName = selectedLedger?.LedgerName || 'Bank Account';
    const periodStr = `${fromDate ? formatDisplayDate(fromDate) : 'Start'} to ${toDate ? formatDisplayDate(toDate) : 'Current'}`;

    // Header Title
    doc.setFontSize(16);
    doc.setTextColor(15, 59, 102); // #0F3B66
    doc.text(companyName, 14, 15);

    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(`Bank Reconciliation Statement: ${bankName}`, 14, 22);

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${periodStr} | Date Tolerance: ±${dateTolerance} Days | Generated on: ${new Date().toLocaleDateString()}`, 14, 27);

    // Summary Box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 30, 269, 16, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(15, 59, 102);
    doc.setFont('helvetica', 'bold');
    doc.text(`Matched: ${reconciliationData.summary.matchedCount} (₹${reconciliationData.summary.matchedStmtAmount.toLocaleString('en-IN')})`, 20, 36);
    
    doc.setTextColor(217, 119, 6);
    doc.text(`In Statement Only: ${reconciliationData.summary.unmatchedStatementCount} (₹${reconciliationData.summary.unmatchedStmtAmount.toLocaleString('en-IN')})`, 105, 36);
    
    doc.setTextColor(37, 99, 235);
    doc.text(`In Books Only: ${reconciliationData.summary.unmatchedBookCount} (₹${reconciliationData.summary.unmatchedBookAmount.toLocaleString('en-IN')})`, 200, 36);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Ledger Closing Balance: ₹${ledgerClosingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 20, 42);

    // Table Data
    const tableRows = displayedItems.map((item, idx) => {
      const stmt = item.statement;
      const book = item.book;
      const statusStr = item.status === 'MATCHED' ? 'MATCHED' : (item.status === 'UNMATCHED_STATEMENT' ? 'STMT ONLY' : 'BOOKS ONLY');

      return [
        idx + 1,
        statusStr,
        stmt ? `${stmt.dateDisplay}\n${stmt.description.substring(0, 30)}` : '-',
        stmt ? stmt.refNo : '-',
        stmt ? (stmt.type === 'Withdrawal' ? `₹${stmt.amount.toFixed(2)}` : '-') : '-',
        stmt ? (stmt.type === 'Deposit' ? `₹${stmt.amount.toFixed(2)}` : '-') : '-',
        book ? `V#${book.voucherNo} (${book.voucherType})\n${book.dateDisplay}` : '-',
        book ? getOppositeLedgerName(book.voucherNo, book.mode).substring(0, 25) : '-',
        book ? (book.mode === 'Credit' ? `₹${book.amount.toFixed(2)}` : '-') : '-',
        book ? (book.mode === 'Debit' ? `₹${book.amount.toFixed(2)}` : '-') : '-'
      ];
    });

    autoTable(doc, {
      startY: 50,
      head: [
        [
          { content: '#', rowSpan: 2, styles: { valign: 'middle' } },
          { content: 'Status', rowSpan: 2, styles: { valign: 'middle' } },
          { content: 'Bank Statement', colSpan: 4, styles: { halign: 'center', fillColor: [15, 59, 102] } },
          { content: 'Books (FRM Vouchers)', colSpan: 4, styles: { halign: 'center', fillColor: [248, 138, 1] } }
        ],
        [
          'Date / Particulars', 'Ref/Chq No', 'Withdrawal (Dr)', 'Deposit (Cr)',
          'Voucher / Date', 'Party / Counter A/c', 'Payment (Cr)', 'Receipt (Dr)'
        ]
      ],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [15, 59, 102], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 20, fontStyle: 'bold' },
        2: { cellWidth: 46 },
        3: { cellWidth: 22 },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 24, halign: 'right' },
        6: { cellWidth: 32 },
        7: { cellWidth: 45 },
        8: { cellWidth: 24, halign: 'right' },
        9: { cellWidth: 24, halign: 'right' }
      }
    });

    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    setPreviewUrl(blobUrl);
    setPreviewOpen(true);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      {/* Title & Top Toolbar */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', display: 'flex', alignItems: 'center', gap: 1 }}>
            <BankIcon sx={{ color: '#0F3B66', fontSize: 32 }} /> Bank Statement Reconciliation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload your bank statement in Excel or PDF format to cross-verify against books and instantly isolate matched and mismatched entries.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" sx={{ width: { xs: '100%', md: 'auto' } }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={downloadSampleBankStatement}
            sx={{ borderColor: '#0F3B66', color: '#0F3B66', width: { xs: '100%', sm: 'auto' } }}
          >
            Sample Excel Format
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ExcelIcon />}
            disabled={displayedItems.length === 0}
            onClick={handleExportExcel}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Export Excel
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<PrintIcon />}
            disabled={displayedItems.length === 0}
            onClick={handleGeneratePdf}
            sx={{ backgroundColor: '#0F3B66', '&:hover': { backgroundColor: '#0a2744' }, width: { xs: '100%', sm: 'auto' } }}
          >
            Print BRS Report
          </Button>
        </Stack>
      </Box>

      {/* Configuration & Selection Strip */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <Grid container spacing={2} alignItems="center">
          {/* Select Bank Ledger */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Autocomplete
              options={bankLedgers}
              getOptionLabel={(option) => `${option.LedgerName} (${option.AccountGroupName})`}
              value={selectedLedger}
              onChange={(e, val) => setSelectedLedger(val)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Bank Account (Ledger)"
                  size="small"
                  fullWidth
                  placeholder="Choose Bank Account..."
                />
              )}
            />
          </Grid>

          {/* Date Range: From */}
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              label="From Date"
              type="date"
              size="small"
              fullWidth
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          {/* Date Range: To */}
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              label="To Date"
              type="date"
              size="small"
              fullWidth
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          {/* Matching Date Tolerance */}
          <Grid size={{ xs: 6, md: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Date Tolerance</InputLabel>
              <Select
                value={dateTolerance}
                label="Date Tolerance"
                onChange={(e) => setDateTolerance(e.target.value)}
              >
                <MenuItem value={0}>0 Days (Exact Date)</MenuItem>
                <MenuItem value={1}>±1 Day</MenuItem>
                <MenuItem value={2}>±2 Days</MenuItem>
                <MenuItem value={3}>±3 Days (Standard)</MenuItem>
                <MenuItem value={7}>±7 Days (Cheque Clearing)</MenuItem>
                <MenuItem value={15}>±15 Days</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Clear / Refresh */}
          <Grid size={{ xs: 6, md: 2 }} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              startIcon={<RefreshIcon />}
              onClick={fetchInitialData}
            >
              Refresh Data
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Upload Box Card */}
      <Paper 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 2, 
          border: '2px dashed #0F3B66',
          backgroundColor: uploadedFile ? '#f0fdf4' : '#fafafa',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv, .pdf"
          style={{ display: 'none' }}
          id="bank-statement-upload"
          onChange={handleFileUpload}
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          {uploadedFile ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {uploadedFile.name.toLowerCase().endsWith('.pdf') ? (
                  <PdfIcon sx={{ color: '#ef4444', fontSize: 36 }} />
                ) : (
                  <ExcelIcon sx={{ color: '#16a34a', fontSize: 36 }} />
                )}
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#0F3B66' }}>
                  {uploadedFile.name}
                </Typography>
                <Chip 
                  label={`${statementRows.length} Transactions Parsed`} 
                  color="success" 
                  size="small" 
                  sx={{ fontWeight: 600 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                File size: {(uploadedFile.size / 1024).toFixed(1)} KB | Ready for reconciliation
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 1.5 }}>
                <label htmlFor="bank-statement-upload">
                  <Button variant="outlined" size="small" component="span" startIcon={<UploadIcon />}>
                    Upload Another Statement
                  </Button>
                </label>
                <Button 
                  variant="text" 
                  size="small" 
                  color="error"
                  onClick={() => {
                    setUploadedFile(null);
                    setStatementRows([]);
                  }}
                >
                  Clear Statement
                </Button>
              </Box>
            </>
          ) : (
            <>
              <UploadIcon sx={{ fontSize: 44, color: '#0F3B66', mb: 0.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#0F3B66' }}>
                Upload Bank Statement (Excel or PDF)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 650 }}>
                Upload your bank statement spreadsheet (<strong>.xlsx, .xls, .csv</strong>) or digital e-statement (<strong>.pdf</strong>). FRM-BBP will parse the transactions and automatically match them against your ledger vouchers.
              </Typography>
              <Box sx={{ mt: 1.5 }}>
                <label htmlFor="bank-statement-upload">
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<UploadIcon />}
                    sx={{ backgroundColor: '#F88A01', '&:hover': { backgroundColor: '#d97706' }, px: 3 }}
                  >
                    Select Statement File
                  </Button>
                </label>
              </Box>
            </>
          )}

          {isParsing && (
            <Box sx={{ width: '100%', maxWidth: 400, mt: 2 }}>
              <LinearProgress sx={{ borderRadius: 1 }} />
              <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                Extracting and parsing statement transactions...
              </Typography>
            </Box>
          )}

          {parseError && (
            <Alert severity="error" sx={{ mt: 2, textAlign: 'left', maxWidth: 700 }}>
              {parseError}
            </Alert>
          )}
        </Box>
      </Paper>

      {/* KPI Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Total Bank Statement */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: 2, borderLeft: '4px solid #0F3B66', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: '14px !important' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>
                Bank Statement Entries
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mt: 0.5 }}>
                {reconciliationData.summary.totalStatementCount}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Total: ₹{reconciliationData.summary.totalStmtAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Book Vouchers */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: 2, borderLeft: '4px solid #F88A01', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: '14px !important' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>
                FRM Vouchers (Books)
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#F88A01', mt: 0.5 }}>
                {reconciliationData.summary.totalBookCount}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Ledger Balance: ₹{ledgerClosingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Matched Entries */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card 
            sx={{ 
              borderRadius: 2, 
              borderLeft: '4px solid #10B981', 
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              backgroundColor: filterTab === 'MATCHED' ? '#ecfdf5' : '#ffffff',
              cursor: 'pointer'
            }}
            onClick={() => setFilterTab('MATCHED')}
          >
            <CardContent sx={{ p: '14px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#047857', fontWeight: 700, textTransform: 'uppercase' }}>
                  Matched Entries
                </Typography>
                <MatchedIcon sx={{ color: '#10B981', fontSize: 20 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#047857', mt: 0.5 }}>
                {reconciliationData.summary.matchedCount}
              </Typography>
              <Typography variant="body2" sx={{ color: '#047857', mt: 0.5, fontWeight: 500 }}>
                Matched Amt: ₹{reconciliationData.summary.matchedStmtAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Mismatched / Unmatched Entries */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card 
            sx={{ 
              borderRadius: 2, 
              borderLeft: '4px solid #EF4444', 
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              backgroundColor: filterTab === 'UNMATCHED' ? '#fef2f2' : '#ffffff',
              cursor: 'pointer'
            }}
            onClick={() => { setFilterTab('UNMATCHED'); setUnmatchedType('ALL'); }}
          >
            <CardContent sx={{ p: '14px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase' }}>
                  Mismatched / Unmatched
                </Typography>
                <MismatchedIcon sx={{ color: '#EF4444', fontSize: 20 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#b91c1c', mt: 0.5 }}>
                {reconciliationData.summary.unmatchedStatementCount + reconciliationData.summary.unmatchedBookCount}
              </Typography>
              <Typography variant="body2" sx={{ color: '#b91c1c', mt: 0.5, fontSize: '0.8rem' }}>
                {reconciliationData.summary.unmatchedStatementCount} in Stmt only | {reconciliationData.summary.unmatchedBookCount} in Books only
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Filter & Navigation Strip */}
      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        {/* Core Filter Tabs: ALL, MATCHED, UNMATCHED */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Tabs 
            value={filterTab} 
            onChange={(e, val) => { setFilterTab(val); setPage(0); }}
            textColor="primary"
            indicatorColor="primary"
            sx={{
              '& .MuiTab-root': { fontWeight: 600, fontSize: '0.9rem', textTransform: 'none', minHeight: 44 }
            }}
          >
            <Tab 
              value="ALL" 
              label={`All Transactions (${reconciliationData.allReconciliationItems.length})`} 
            />
            <Tab 
              value="MATCHED" 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <MatchedIcon sx={{ color: '#10B981', fontSize: 18 }} />
                  <span>Matched Entries ({reconciliationData.matchedPairs.length})</span>
                </Box>
              } 
            />
            <Tab 
              value="UNMATCHED" 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <MismatchedIcon sx={{ color: '#EF4444', fontSize: 18 }} />
                  <span>Mismatched / Unmatched ({reconciliationData.summary.unmatchedStatementCount + reconciliationData.summary.unmatchedBookCount})</span>
                </Box>
              } 
            />
          </Tabs>

          {/* Sub-Filters for Unmatched view */}
          {filterTab === 'UNMATCHED' && (
            <ToggleButtonGroup
              size="small"
              value={unmatchedType}
              exclusive
              onChange={(e, val) => { if (val) { setUnmatchedType(val); setPage(0); } }}
              sx={{ my: 0.5 }}
            >
              <ToggleButton value="ALL" sx={{ textTransform: 'none', px: 1.5, py: 0.3, fontSize: '0.8rem' }}>
                All Unmatched ({reconciliationData.summary.unmatchedStatementCount + reconciliationData.summary.unmatchedBookCount})
              </ToggleButton>
              <ToggleButton value="STATEMENT_ONLY" sx={{ textTransform: 'none', px: 1.5, py: 0.3, fontSize: '0.8rem', color: '#d97706' }}>
                In Statement Only ({reconciliationData.summary.unmatchedStatementCount})
              </ToggleButton>
              <ToggleButton value="BOOKS_ONLY" sx={{ textTransform: 'none', px: 1.5, py: 0.3, fontSize: '0.8rem', color: '#2563eb' }}>
                In Books Only ({reconciliationData.summary.unmatchedBookCount})
              </ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>

        {/* Search & Direction Toolbar */}
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 2 }, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, pt: 1.5, pb: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            <TextField
              size="small"
              placeholder="Search particulars, ref no, voucher no, amount..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                )
              }}
              sx={{ width: { xs: '100%', sm: '320px' } }}
            />

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Flow Direction</InputLabel>
              <Select
                value={directionFilter}
                label="Flow Direction"
                onChange={(e) => { setDirectionFilter(e.target.value); setPage(0); }}
              >
                <MenuItem value="ALL">All Flows</MenuItem>
                <MenuItem value="Withdrawal">Withdrawals / Payments Only</MenuItem>
                <MenuItem value="Deposit">Deposits / Receipts Only</MenuItem>
              </Select>
            </FormControl>

            <Button size="small" onClick={handleResetFilters}>
              Reset Filters
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Showing <strong>{displayedItems.length}</strong> entries
            </Typography>
          </Box>
        </Toolbar>

        {/* Comparison Table */}
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" stickyHeader sx={{ minWidth: 950, '& .MuiTableRow-root': { height: 36 } }}>
            <TableHead>
              {/* Dual Group Header */}
              <TableRow sx={{ '& th': { backgroundColor: '#f1f5f9', fontWeight: 700 } }}>
                <TableCell sx={{ width: 50, borderRight: '1px solid #e2e8f0' }} align="center">#</TableCell>
                <TableCell sx={{ width: 140, borderRight: '1px solid #e2e8f0' }} align="center">Status</TableCell>
                <TableCell colSpan={4} sx={{ backgroundColor: '#e2e8f0', color: '#0F3B66', fontWeight: 700, textAlign: 'center', borderRight: '2px solid #cbd5e1' }}>
                  BANK STATEMENT ENTRY
                </TableCell>
                <TableCell colSpan={4} sx={{ backgroundColor: '#fed7aa', color: '#9a3412', fontWeight: 700, textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                  FRM BOOKS (VOUCHER)
                </TableCell>
                <TableCell sx={{ width: 80 }} align="center">Action</TableCell>
              </TableRow>
              {/* Detailed Columns Header */}
              <TableRow sx={{ '& th': { backgroundColor: '#f8fafc', fontWeight: 600, fontSize: '0.8rem' } }}>
                <TableCell align="center" sx={{ borderRight: '1px solid #e2e8f0' }}>Sr</TableCell>
                <TableCell align="center" sx={{ borderRight: '1px solid #e2e8f0' }}>Match Details</TableCell>
                
                {/* Statement columns */}
                <TableCell sx={{ width: 95 }}>Date</TableCell>
                <TableCell>Particulars / Narration</TableCell>
                <TableCell sx={{ width: 110 }}>Ref / Chq No</TableCell>
                <TableCell align="right" sx={{ width: 110, borderRight: '2px solid #cbd5e1' }}>Amount</TableCell>
                
                {/* Books columns */}
                <TableCell sx={{ width: 100 }}>Voucher</TableCell>
                <TableCell sx={{ width: 95 }}>Date</TableCell>
                <TableCell>Counter Party / Ledger</TableCell>
                <TableCell align="right" sx={{ width: 110, borderRight: '1px solid #e2e8f0' }}>Amount</TableCell>
                
                {/* Action column */}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {displayedItems
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row, index) => {
                  const stmt = row.statement;
                  const book = row.book;
                  const isMatched = row.status === 'MATCHED';
                  const isStmtOnly = row.status === 'UNMATCHED_STATEMENT';
                  const isBookOnly = row.status === 'UNMATCHED_BOOKS';

                  return (
                    <TableRow 
                      hover 
                      key={row.id || index}
                      sx={{
                        backgroundColor: isMatched 
                          ? 'inherit' 
                          : (isStmtOnly ? 'rgba(254, 243, 199, 0.25)' : 'rgba(239, 246, 255, 0.35)')
                      }}
                    >
                      {/* Sr No */}
                      <TableCell align="center" sx={{ borderRight: '1px solid #e2e8f0', color: 'text.secondary' }}>
                        {page * rowsPerPage + index + 1}
                      </TableCell>

                      {/* Status & Confidence Badge */}
                      <TableCell align="center" sx={{ borderRight: '1px solid #e2e8f0' }}>
                        {isMatched && (
                          <Tooltip title={row.matchReason || 'Matched'}>
                            <Chip
                              size="small"
                              icon={<MatchedIcon sx={{ fontSize: '14px !important' }} />}
                              label="Matched"
                              color="success"
                              sx={{ fontWeight: 600, fontSize: '0.72rem', height: 22 }}
                            />
                          </Tooltip>
                        )}
                        {isStmtOnly && (
                          <Tooltip title="Recorded in Bank Statement, but Missing in FRM books.">
                            <Chip
                              size="small"
                              icon={<MismatchedIcon sx={{ fontSize: '14px !important' }} />}
                              label="In Stmt Only"
                              color="warning"
                              sx={{ fontWeight: 600, fontSize: '0.72rem', height: 22 }}
                            />
                          </Tooltip>
                        )}
                        {isBookOnly && (
                          <Tooltip title="Recorded in books, but not yet cleared/present in Bank Statement.">
                            <Chip
                              size="small"
                              label="In Books Only"
                              color="info"
                              variant="outlined"
                              sx={{ fontWeight: 600, fontSize: '0.72rem', height: 22 }}
                            />
                          </Tooltip>
                        )}
                      </TableCell>

                      {/* BANK STATEMENT SIDE */}
                      {stmt ? (
                        <>
                          <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {stmt.dateDisplay}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.82rem' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {stmt.description}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', fontFamily: 'monospace' }}>
                            {stmt.refNo || '-'}
                          </TableCell>
                          <TableCell 
                            align="right" 
                            sx={{ 
                              borderRight: '2px solid #cbd5e1', 
                              fontWeight: 700,
                              color: stmt.type === 'Withdrawal' ? 'error.main' : 'success.main'
                            }}
                          >
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span>₹{stmt.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              <Typography variant="caption" sx={{ fontSize: '0.68rem', opacity: 0.8 }}>
                                {stmt.type === 'Withdrawal' ? 'Dr (Withdrawal)' : 'Cr (Deposit)'}
                              </Typography>
                            </Box>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell colSpan={4} align="center" sx={{ borderRight: '2px solid #cbd5e1', color: 'text.disabled', fontStyle: 'italic', bgcolor: '#f8fafc' }}>
                            — Not in Bank Statement —
                          </TableCell>
                        </>
                      )}

                      {/* FRM BOOKS (VOUCHER) SIDE */}
                      {book ? (
                        <>
                          <TableCell sx={{ fontSize: '0.8rem' }}>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 700, 
                                color: '#0F3B66',
                                cursor: 'pointer',
                                '&:hover': { textDecoration: 'underline' }
                              }}
                              onClick={() => navigate('/dashboard/vouchers')}
                              title="Click to view vouchers"
                            >
                              V{book.voucherNo}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                              {book.voucherType}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {book.dateDisplay}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.82rem' }}>
                            <Typography variant="body2">
                              {getOppositeLedgerName(book.voucherNo, book.mode)}
                            </Typography>
                            {book.remark && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                                Ref: {book.remark}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell 
                            align="right" 
                            sx={{ 
                              borderRight: '1px solid #e2e8f0', 
                              fontWeight: 700,
                              color: book.mode === 'Credit' ? 'error.main' : 'success.main'
                            }}
                          >
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span>₹{book.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              <Typography variant="caption" sx={{ fontSize: '0.68rem', opacity: 0.8 }}>
                                {book.mode === 'Credit' ? 'Payment (Out)' : 'Receipt (In)'}
                              </Typography>
                            </Box>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell colSpan={4} align="center" sx={{ borderRight: '1px solid #e2e8f0', color: 'text.disabled', fontStyle: 'italic', bgcolor: '#f8fafc' }}>
                            — Missing in FRM books —
                          </TableCell>
                        </>
                      )}

                      {/* ACTIONS */}
                      <TableCell align="center">
                        {isMatched ? (
                          <Tooltip title="Unlink / Break pairing">
                            <IconButton 
                              size="small" 
                              color="default"
                              onClick={() => handleToggleUnlink(row.id)}
                            >
                              <UnlinkIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : isStmtOnly ? (
                          <Tooltip title="Create Voucher for this transaction">
                            <Button
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', py: 0.2, px: 1, minWidth: 0 }}
                              onClick={() => navigate('/dashboard/vouchers')}
                            >
                              + Voucher
                            </Button>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Pending
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}

              {displayedItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 6 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <BankIcon sx={{ fontSize: 44, color: '#cbd5e1' }} />
                      <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                        {!uploadedFile ? 'Please upload a bank statement file to begin reconciliation.' : 'No entries match the selected filters.'}
                      </Typography>
                      {uploadedFile && (
                        <Button size="small" variant="text" onClick={handleResetFilters}>
                          Reset All Filters
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Table Pagination */}
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={displayedItems.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* PDF Report Preview Modal */}
      <PdfPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        pdfUrl={previewUrl}
        title={`Bank Reconciliation Report - ${selectedLedger?.LedgerName || 'Bank'}`}
      />
    </Box>
  );
};

export default BankReconciliation;
