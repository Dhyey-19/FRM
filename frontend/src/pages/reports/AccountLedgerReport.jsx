import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Box, Typography, Button, Paper, CircularProgress, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, InputAdornment, Toolbar, Autocomplete,
  ToggleButtonGroup, ToggleButton, Card, CardContent, Grid, Chip, Divider, Tooltip,
  IconButton
} from '@mui/material';
import { 
  PictureAsPdf, Visibility, TableView, Share, 
  Receipt, ReceiptLong, MoneyOff, CallSplit, AccountBalanceWallet,
  ArrowBack
} from '@mui/icons-material';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import { generateInvoicePDF } from '../../utils/invoicePdfHelper';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ensureNumericWorksheet } from '../../utils/excelHelper';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const isAutoInvoice = (row) => {
  const through = (row.Through || '').trim().toLowerCase();
  const vType = (row.VoucherType || '').trim().toLowerCase();
  if (through === 'outward' || through === 'inward') return true;
  if (!through && (vType === 'sales' || vType === 'purchase')) return true;
  return false;
};

const getInvoiceType = (row) => {
  const through = (row.Through || '').trim().toLowerCase();
  const vType = (row.VoucherType || '').trim().toLowerCase();
  if (through === 'outward') return 'outward';
  if (through === 'inward') return 'inward';
  if (!through && vType === 'sales') return 'outward';
  if (!through && vType === 'purchase') return 'inward';
  return null;
};

const AccountLedgerReport = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [invoiceLoading, setInvoiceLoading] = useState(false);

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
  const [viewMode, setViewMode] = useState('combined'); // 'combined', 'with_bill', 'without_bill', 'split'

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (ledgers.length > 0) {
      const targetId = location.state?.ledgerId || new URLSearchParams(location.search).get('ledgerId');
      if (targetId) {
        const found = ledgers.find(l => String(l.Id) === String(targetId));
        if (found) {
          setSelectedLedger(found);
          setDateRange([null, null]); // Show full statement so transactions aren't hidden by month filter
        }
      }
    }
  }, [ledgers, location]);

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

  // Helper to calculate ledger statement for any subset of vouchers
  const computeLedgerMetrics = (voucherSubset, baseOpeningBalance = 0) => {
    if (!selectedLedger) return {
      vouchersList: [],
      periodOpeningBalance: 0,
      totals: { debit: 0, credit: 0 },
      periodClosingBalance: 0,
      opDebit: 0,
      opCredit: 0,
      grossDebit: 0,
      grossCredit: 0,
      grandTotal: 0,
      closingDebit: 0,
      closingCredit: 0
    };

    let opening = parseFloat(baseOpeningBalance || 0);
    const startMs = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
    const endMs = endDate ? new Date(endDate).setHours(23,59,59,999) : null;

    const inPeriodList = [];

    voucherSubset.forEach(v => {
      if (v.LedgerId !== selectedLedger.Id) return;
      const rowDate = v.VoucherDate ? new Date(v.VoucherDate) : null;
      if (!rowDate) return;

      const rowTime = new Date(rowDate).setHours(0,0,0,0);
      const amt = parseFloat(v.Amount || 0);

      if (startMs && rowTime < startMs) {
        if (v.Mode === 'Debit') opening += amt;
        if (v.Mode === 'Credit') opening -= amt;
      } else if (!endMs || rowTime <= endMs) {
        inPeriodList.push(v);
      }
    });

    inPeriodList.sort((a, b) => new Date(a.VoucherDate) - new Date(b.VoucherDate));

    let tDebit = 0;
    let tCredit = 0;
    inPeriodList.forEach(v => {
      const amt = parseFloat(v.Amount || 0);
      if (v.Mode === 'Debit') tDebit += amt;
      if (v.Mode === 'Credit') tCredit += amt;
    });

    const closing = opening + tDebit - tCredit;
    const opDebit = opening > 0 ? opening : 0;
    const opCredit = opening < 0 ? Math.abs(opening) : 0;
    const grossDebit = opDebit + tDebit;
    const grossCredit = opCredit + tCredit;
    const grandTotal = Math.max(grossDebit, grossCredit);
    const closingDebit = grossCredit > grossDebit ? (grossCredit - grossDebit) : 0;
    const closingCredit = grossDebit > grossCredit ? (grossDebit - grossCredit) : 0;

    return {
      vouchersList: inPeriodList,
      periodOpeningBalance: opening,
      totals: { debit: tDebit, credit: tCredit },
      periodClosingBalance: closing,
      opDebit,
      opCredit,
      grossDebit,
      grossCredit,
      grandTotal,
      closingDebit,
      closingCredit
    };
  };

  // Vouchers subsets
  const partyAllVouchers = useMemo(() => {
    if (!selectedLedger) return [];
    return vouchers.filter(v => v.LedgerId === selectedLedger.Id);
  }, [vouchers, selectedLedger]);

  const partyWithBillVouchers = useMemo(() => {
    return partyAllVouchers.filter(v => v.Bill !== false && v.Bill !== 0);
  }, [partyAllVouchers]);

  const partyWithoutBillVouchers = useMemo(() => {
    return partyAllVouchers.filter(v => v.Bill === false || v.Bill === 0);
  }, [partyAllVouchers]);

  // Metrics for each view
  const combinedMetrics = useMemo(() => {
    return computeLedgerMetrics(partyAllVouchers, selectedLedger?.OpeningBalance || 0);
  }, [partyAllVouchers, selectedLedger, startDate, endDate]);

  const withBillMetrics = useMemo(() => {
    return computeLedgerMetrics(partyWithBillVouchers, selectedLedger?.OpeningBalance || 0);
  }, [partyWithBillVouchers, selectedLedger, startDate, endDate]);

  const withoutBillMetrics = useMemo(() => {
    return computeLedgerMetrics(partyWithoutBillVouchers, 0);
  }, [partyWithoutBillVouchers, selectedLedger, startDate, endDate]);

  // Active single-table metrics based on viewMode
  const activeMetrics = useMemo(() => {
    if (viewMode === 'with_bill') return withBillMetrics;
    if (viewMode === 'without_bill') return withoutBillMetrics;
    return combinedMetrics;
  }, [viewMode, combinedMetrics, withBillMetrics, withoutBillMetrics]);

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
    
    doc.setFontSize(18);
    doc.setTextColor(15, 59, 102);
    doc.text(localUser.companyName || 'FRM', 14, 18);
    
    const modeLabel = viewMode === 'with_bill' ? ' (With Bill / Official)' : 
                      viewMode === 'without_bill' ? ' (Without Bill / Cash)' : 
                      viewMode === 'split' ? ' (Split Dual Ledger)' : ' (Combined)';
    
    doc.setFontSize(13);
    doc.setTextColor(60);
    doc.text(`Account Ledger Report: ${selectedLedger.LedgerName}${modeLabel}`, 14, 25);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Period: ${startDate ? startDate.toLocaleDateString() : 'Start'} to ${endDate ? endDate.toLocaleDateString() : 'End'} | Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, 33, 196, 33);

    const renderTableForDoc = (metrics, title, startY, billBadge = false) => {
      const tableColumn = ["Date", "Voucher No", "Type", ...(billBadge ? ["Bill"] : []), "Particulars", "Remarks", "To (Debit)", "From (Credit)"];
      const tableRows = [];

      // Add Opening Balance Row
      const colSpanBefore = billBadge ? 5 : 4;
      tableRows.push([
        { content: 'OPENING BALANCE', colSpan: colSpanBefore, styles: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [15, 59, 102] } },
        { content: metrics.periodOpeningBalance >= 0 ? metrics.periodOpeningBalance.toFixed(2) : '', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [15, 59, 102] } },
        { content: metrics.periodOpeningBalance < 0 ? Math.abs(metrics.periodOpeningBalance).toFixed(2) : '', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [15, 59, 102] } }
      ]);

      metrics.vouchersList.forEach(row => {
        const vDate = row.VoucherDate ? row.VoucherDate.split('T')[0] : '-';
        const debitVal = row.Mode === 'Debit' ? parseFloat(row.Amount).toFixed(2) : '-';
        const creditVal = row.Mode === 'Credit' ? parseFloat(row.Amount).toFixed(2) : '-';
        const bLabel = row.Bill !== false && row.Bill !== 0 ? 'With Bill' : 'Without Bill';
        const vType = row.VoucherType === 'General' ? 'Journal' : (row.VoucherType || 'Journal');
        
        tableRows.push([
          vDate,
          `V${row.VoucherNo}`,
          vType,
          ...(billBadge ? [bLabel] : []),
          getOppositeLedgers(row.VoucherNo, row.Mode),
          row.Remark || '-',
          debitVal,
          creditVal
        ]);
      });

      if (title) {
        doc.setFontSize(11);
        doc.setTextColor(15, 59, 102);
        doc.text(title, 14, startY - 2);
      }

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [
          [
            { content: 'TOTAL', colSpan: colSpanBefore, styles: { halign: 'right', fontStyle: 'bold', fillColor: [226, 232, 240], textColor: [15, 59, 102] } },
            { content: metrics.grossDebit.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [226, 232, 240], textColor: [15, 59, 102] } },
            { content: metrics.grossCredit.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [226, 232, 240], textColor: [15, 59, 102] } }
          ],
          [
            { content: 'CLOSING BALANCE', colSpan: colSpanBefore, styles: { halign: 'right', fontStyle: 'bold', fillColor: [253, 253, 234], textColor: [133, 100, 4] } },
            { content: metrics.closingDebit > 0 ? metrics.closingDebit.toFixed(2) : '', styles: { halign: 'right', fontStyle: 'bold', fillColor: [253, 253, 234], textColor: [133, 100, 4] } },
            { content: metrics.closingCredit > 0 ? metrics.closingCredit.toFixed(2) : '', styles: { halign: 'right', fontStyle: 'bold', fillColor: [253, 253, 234], textColor: [133, 100, 4] } }
          ],
          [
            { content: 'GRAND TOTAL', colSpan: colSpanBefore, styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 59, 102], textColor: [255, 255, 255] } },
            { content: metrics.grandTotal.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 59, 102], textColor: [255, 255, 255] } },
            { content: metrics.grandTotal.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 59, 102], textColor: [255, 255, 255] } }
          ]
        ],
        startY: startY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        footStyles: { 
          fillColor: [230, 230, 230], 
          textColor: [0, 0, 0],
          lineWidth: 0.1,
          lineColor: [200, 200, 200]
        },
        columnStyles: {
          [tableColumn.length - 2]: { halign: 'right' },
          [tableColumn.length - 1]: { halign: 'right' }
        },
        margin: { top: 35 }
      });
    };

    if (viewMode === 'split') {
      renderTableForDoc(withBillMetrics, '1. WITH BILL LEDGER (Official / GST)', 38, false);
      const nextY = (doc.lastAutoTable?.finalY || 100) + 12;
      
      if (nextY > 230) {
        doc.addPage();
        renderTableForDoc(withoutBillMetrics, '2. WITHOUT BILL LEDGER (Cash / Estimate)', 20, false);
      } else {
        renderTableForDoc(withoutBillMetrics, '2. WITHOUT BILL LEDGER (Cash / Estimate)', nextY, false);
      }
    } else {
      renderTableForDoc(activeMetrics, '', 38, viewMode === 'combined');
    }

    const fileName = `ledger_${selectedLedger.LedgerName}_${viewMode}_${startDate ? startDate.toISOString().split('T')[0] : 'start'}_to_${endDate ? endDate.toISOString().split('T')[0] : 'end'}.pdf`;

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
      setPreviewTitle(`Account Ledger Preview - ${selectedLedger.LedgerName}`);
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

    const generateExcelData = (metrics, title) => {
      const flatData = [];
      if (title) {
        flatData.push({ 'Date': title, 'Voucher No': '', 'Voucher Type': '', 'Bill Type': '', 'Particulars': '', 'Remarks': '', 'Debit (To)': null, 'Credit (From)': null });
      }
      
      // Opening Balance
      flatData.push({
        'Date': 'OPENING BALANCE',
        'Voucher No': '',
        'Voucher Type': '',
        'Bill Type': '',
        'Particulars': '',
        'Remarks': '',
        'Debit (To)': metrics.periodOpeningBalance >= 0 ? Number(metrics.periodOpeningBalance.toFixed(2)) : null,
        'Credit (From)': metrics.periodOpeningBalance < 0 ? Number(Math.abs(metrics.periodOpeningBalance).toFixed(2)) : null
      });

      metrics.vouchersList.forEach(v => {
        const amt = Math.round((parseFloat(v.Amount) || 0) * 100) / 100;
        flatData.push({
          'Date': v.VoucherDate ? v.VoucherDate.split('T')[0] : '-',
          'Voucher No': `V${v.VoucherNo}`,
          'Voucher Type': v.VoucherType === 'General' ? 'Journal' : (v.VoucherType || 'Journal'),
          'Bill Type': v.Bill !== false && v.Bill !== 0 ? 'With Bill' : 'Without Bill',
          'Particulars': getOppositeLedgers(v.VoucherNo, v.Mode),
          'Remarks': v.Remark || '-',
          'Debit (To)': v.Mode === 'Debit' ? amt : null,
          'Credit (From)': v.Mode === 'Credit' ? amt : null
        });
      });

      flatData.push({
        'Date': 'TOTAL',
        'Voucher No': '',
        'Voucher Type': '',
        'Bill Type': '',
        'Particulars': '',
        'Remarks': '',
        'Debit (To)': Number(metrics.grossDebit.toFixed(2)),
        'Credit (From)': Number(metrics.grossCredit.toFixed(2))
      });

      flatData.push({
        'Date': 'CLOSING BALANCE',
        'Voucher No': '',
        'Voucher Type': '',
        'Bill Type': '',
        'Particulars': '',
        'Remarks': '',
        'Debit (To)': metrics.closingDebit > 0 ? Number(metrics.closingDebit.toFixed(2)) : null,
        'Credit (From)': metrics.closingCredit > 0 ? Number(metrics.closingCredit.toFixed(2)) : null
      });

      flatData.push({
        'Date': 'GRAND TOTAL',
        'Voucher No': '',
        'Voucher Type': '',
        'Bill Type': '',
        'Particulars': '',
        'Remarks': '',
        'Debit (To)': Number(metrics.grandTotal.toFixed(2)),
        'Credit (From)': Number(metrics.grandTotal.toFixed(2))
      });

      return flatData;
    };

    const workbook = XLSX.utils.book_new();

    if (viewMode === 'split') {
      const withBillData = generateExcelData(withBillMetrics, 'WITH BILL LEDGER');
      const ws1 = XLSX.utils.json_to_sheet(withBillData);
      ensureNumericWorksheet(ws1);
      XLSX.utils.book_append_sheet(workbook, ws1, 'With Bill');

      const withoutBillData = generateExcelData(withoutBillMetrics, 'WITHOUT BILL LEDGER');
      const ws2 = XLSX.utils.json_to_sheet(withoutBillData);
      ensureNumericWorksheet(ws2);
      XLSX.utils.book_append_sheet(workbook, ws2, 'Without Bill');

      const combinedData = generateExcelData(combinedMetrics, 'COMBINED LEDGER');
      const ws3 = XLSX.utils.json_to_sheet(combinedData);
      ensureNumericWorksheet(ws3);
      XLSX.utils.book_append_sheet(workbook, ws3, 'Combined');
    } else {
      const activeData = generateExcelData(activeMetrics, `${viewMode.toUpperCase()} LEDGER`);
      const worksheet = XLSX.utils.json_to_sheet(activeData);
      ensureNumericWorksheet(worksheet);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger Report');
    }

    XLSX.writeFile(workbook, `ledger_${selectedLedger.LedgerName}_${viewMode}_${startDate ? startDate.toISOString().split('T')[0] : 'start'}_to_${endDate ? endDate.toISOString().split('T')[0] : 'end'}.xlsx`);
  };

  const handleViewVoucher = async (row) => {
    const voucherItems = vouchers.filter(v => v.VoucherNo === row.VoucherNo);
    if (voucherItems.length === 0) return;

    try {
      setInvoiceLoading(true);
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const profileRes = await fetch(`${baseUrl}/company-profile`);
      const companyProfile = profileRes.ok ? await profileRes.json() : null;

      const voucherDate = voucherItems[0].VoucherDate ? voucherItems[0].VoucherDate.split('T')[0] : '';
      const voucherType = voucherItems[0].VoucherType === 'General' ? 'Journal' : (voucherItems[0].VoucherType || 'Journal');
      let tDebit = 0;
      let tCredit = 0;

      const rowsHTML = voucherItems.map(item => {
        const ledgerName = ledgers.find(l => l.Id === item.LedgerId)?.LedgerName || item.LedgerName || '-';
        const debitVal = item.Mode === 'Debit' ? parseFloat(item.Amount).toFixed(2) : '-';
        const creditVal = item.Mode === 'Credit' ? parseFloat(item.Amount).toFixed(2) : '-';
        if (item.Mode === 'Debit') tDebit += parseFloat(item.Amount);
        if (item.Mode === 'Credit') tCredit += parseFloat(item.Amount);

        return `
          <tr>
            <td style="padding: 8px; border: 1px solid #cbd5e1; width: 1%; white-space: nowrap;">${item.Mode}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: 600;">${ledgerName}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; width: 1%; white-space: nowrap;">${item.Through || '-'}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">${item.Remark || '-'}</td>
            <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; width: 1%; white-space: nowrap;">${debitVal}</td>
            <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; width: 1%; white-space: nowrap;">${creditVal}</td>
          </tr>
        `;
      }).join('');

      const compName = companyProfile?.CompanyName || localUser?.companyName || 'FRM ERP';
      let addressParts = '';
      let phonePart = '';
      let gstPart = '';

      if (companyProfile) {
        addressParts = [companyProfile.Address1, companyProfile.Address2, companyProfile.City, companyProfile.StateName, companyProfile.Pincode].filter(Boolean).join(', ');
        if (companyProfile.MobileNo) phonePart = companyProfile.MobileNo;
        if (companyProfile.GSTIN) gstPart = companyProfile.GSTIN;
      }

      const renderVoucherCopy = (title) => `
        <div class="voucher" style="font-family: 'Helvetica', 'Arial', sans-serif; padding: 20px; border: 2px solid #1e293b; border-radius: 8px; box-sizing: border-box; width: 100%; height: 133mm; display: flex; flex-direction: column;">
          <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; position: relative;">
            <div style="position: absolute; top: 0; left: 0; font-size: 12px; font-weight: bold; color: #64748b;">GSTIN: ${gstPart || 'N/A'}</div>
            <div style="position: absolute; top: 0; right: 0; font-size: 12px; font-weight: bold; color: #64748b;">(${title})</div>
            <h1 style="margin: 0; color: #0F3B66; font-size: 24px;">${compName}</h1>
            <p style="margin: 2px 0; font-size: 12px; color: #333;">${addressParts}${phonePart ? ' | Phone: ' + phonePart : ''}</p>
            <h2 style="margin: 10px 0 0 0; font-size: 18px; text-transform: uppercase; letter-spacing: 2px;">${voucherType} VOUCHER</h2>
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 14px;">
            <div><strong>Voucher No:</strong> V${row.VoucherNo}</div>
            <div><strong>Date:</strong> ${voucherDate}</div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 15px; flex-grow: 1;">
            <thead>
              <tr style="background-color: transparent; color: #1e293b;">
                <th style="padding: 8px; text-align: left; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #1e293b; font-weight: bold; width: 1%; white-space: nowrap;">Mode</th>
                <th style="padding: 8px; text-align: left; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #1e293b; font-weight: bold;">Ledger Name</th>
                <th style="padding: 8px; text-align: left; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #1e293b; font-weight: bold; width: 1%; white-space: nowrap;">Through</th>
                <th style="padding: 8px; text-align: left; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #1e293b; font-weight: bold;">Remarks</th>
                <th style="padding: 8px; text-align: right; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #1e293b; font-weight: bold; width: 1%; white-space: nowrap;">Debit</th>
                <th style="padding: 8px; text-align: right; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #1e293b; font-weight: bold; width: 1%; white-space: nowrap;">Credit</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
            <tfoot>
              <tr style="background-color: transparent; font-weight: bold;">
                <td colspan="4" style="padding: 8px; text-align: right; border-top: 2px solid #1e293b;">TOTAL:</td>
                <td style="padding: 8px; text-align: right; border-top: 2px solid #1e293b; color: #dc2626; width: 1%; white-space: nowrap;">${tDebit.toFixed(2)}</td>
                <td style="padding: 8px; text-align: right; border-top: 2px solid #1e293b; color: #16a34a; width: 1%; white-space: nowrap;">${tCredit.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <div style="display: flex; justify-content: space-between; margin-top: auto; padding-top: 20px; font-size: 12px; font-weight: bold;">
            <div style="text-align: center; border-top: 1px solid #000; width: 150px; padding-top: 5px;">Prepared By</div>
            <div style="text-align: center; border-top: 1px solid #000; width: 150px; padding-top: 5px;">Authorized Signatory</div>
          </div>
        </div>
      `;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print Voucher V${row.VoucherNo}</title>
            <style>
              @page { size: A4 portrait; margin: 10mm; }
              html, body {
                height: 100%;
                margin: 0;
                padding: 0;
                background-color: white;
              }
              body { 
                font-family: 'Helvetica', 'Arial', sans-serif; 
                color: #1e293b;
              }
              .print-container {
                width: 100%;
                height: 277mm;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                box-sizing: border-box;
              }
              .cutter-line {
                text-align: center;
                border-top: 1px dashed #000;
                margin: 0;
                position: relative;
                height: 1px;
              }
              .cutter-line span {
                position: absolute;
                top: -10px;
                left: 50%;
                transform: translateX(-50%);
                background: white;
                padding: 0 10px;
                color: #64748b;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="print-container">
              ${renderVoucherCopy("ORIGINAL")}
              <div class="cutter-line"><span>✂-------------------------------------------------------✂</span></div>
              ${renderVoucherCopy("DUPLICATE")}
            </div>
          </body>
        </html>
      `;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setPreviewTitle(`${voucherType} Voucher #V${row.VoucherNo}`);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (err) {
      console.error('Error opening voucher preview:', err);
      alert('Failed to load voucher preview: ' + err.message);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleViewInvoice = async (row) => {
    const type = getInvoiceType(row);
    if (!type) {
      handleViewVoucher(row);
      return;
    }

    try {
      setInvoiceLoading(true);
      const invoiceNo = (row.Remark || '').trim();
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

      const [profileRes, itemsRes, invoicesRes] = await Promise.all([
        fetch(`${baseUrl}/company-profile`),
        fetch(`${baseUrl}/items`),
        fetch(`${baseUrl}/${type === 'outward' ? 'outwards' : 'inwards'}`)
      ]);

      const compProfile = profileRes.ok ? await profileRes.json() : null;
      const allItems = itemsRes.ok ? await itemsRes.json() : [];
      const allInvoices = invoicesRes.ok ? await invoicesRes.json() : [];

      // Determine candidate party IDs for precise matching
      const oppositeMode = row.Mode === 'Debit' ? 'Credit' : 'Debit';
      const oppositeRows = vouchers.filter(v => v.VoucherNo === row.VoucherNo && v.Mode === oppositeMode);
      const candidatePartyIds = [];
      if (selectedLedger && selectedLedger.LedgerName !== 'Sales' && selectedLedger.LedgerName !== 'Purchase') {
        candidatePartyIds.push(selectedLedger.Id);
      }
      oppositeRows.forEach(r => {
        if (!candidatePartyIds.includes(r.LedgerId)) candidatePartyIds.push(r.LedgerId);
      });

      const invNoClean = invoiceNo.toLowerCase();

      // Step 1: Match by exact invoice number AND candidate party ID
      let matched = null;
      if (invNoClean) {
        matched = allInvoices.find(inv => {
          const no = String(type === 'outward' ? inv.OUTWARDNO : inv.INWARDNO).trim().toLowerCase();
          return no === invNoClean && candidatePartyIds.includes(inv.LEDGERID);
        });

        // Step 2: Match by exact invoice number alone
        if (!matched) {
          matched = allInvoices.find(inv => {
            const no = String(type === 'outward' ? inv.OUTWARDNO : inv.INWARDNO).trim().toLowerCase();
            return no === invNoClean;
          });
        }
      }

      // Step 3: Match by candidate party ID and exact amount
      if (!matched && candidatePartyIds.length > 0) {
        matched = allInvoices.find(inv => {
          return candidatePartyIds.includes(inv.LEDGERID) && 
                 Math.abs(parseFloat(inv.TOTALAMOUNT || 0) - parseFloat(row.Amount || 0)) < 0.01;
        });
      }

      // Fallback: if no linked invoice record found, preview as Voucher document
      if (!matched) {
        handleViewVoucher(row);
        return;
      }

      const ledgerObj = ledgers.find(l => l.Id === matched.LEDGERID) || selectedLedger || { LedgerName: matched.LedgerName };

      const { blobUrl } = await generateInvoicePDF(type, matched, ledgerObj, compProfile, allItems);
      setPreviewTitle(`${type === 'outward' ? 'Sales Invoice' : 'Purchase Invoice'} #${matched.OUTWARDNO || matched.INWARDNO || invoiceNo}`);
      setPreviewUrl(blobUrl);
      setPreviewOpen(true);
    } catch (err) {
      console.error('Error opening invoice preview:', err);
      alert('Failed to load invoice preview: ' + err.message);
    } finally {
      setInvoiceLoading(false);
    }
  };

  // Component to render individual ledger table
  const renderLedgerTable = (metrics, title = null, headerColor = '#0F3B66', showBillBadge = false) => {
    return (
      <Box sx={{ width: '100%', mb: 3 }}>
        {title && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, px: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: headerColor, display: 'flex', alignItems: 'center', gap: 1 }}>
              {title}
            </Typography>
            <Chip 
              size="small" 
              label={`Closing: ₹ ${Math.abs(metrics.periodClosingBalance).toFixed(2)} ${metrics.periodClosingBalance >= 0 ? 'Dr' : 'Cr'}`}
              sx={{ fontWeight: 700, bgcolor: metrics.periodClosingBalance >= 0 ? '#e0f2fe' : '#fef3c7', color: metrics.periodClosingBalance >= 0 ? '#0369a1' : '#b45309' }}
            />
          </Box>
        )}
        <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: 1 }}>
          <Table size="small" sx={{ 
            minWidth: 600, 
            '& .MuiTableCell-head': { py: 0.75, lineHeight: '1.2' },
            '& .MuiTableCell-root': { borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0' },
            '& .MuiTableCell-root:last-child': { borderRight: 'none' }
          }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ backgroundColor: headerColor, color: '#ffffff', fontWeight: 'bold', width: '11%' }}>Date</TableCell>
                <TableCell sx={{ backgroundColor: headerColor, color: '#ffffff', fontWeight: 'bold', width: '11%' }}>Voucher No</TableCell>
                <TableCell sx={{ backgroundColor: headerColor, color: '#ffffff', fontWeight: 'bold', width: '11%' }}>Voucher Type</TableCell>
                {showBillBadge && (
                  <TableCell sx={{ backgroundColor: headerColor, color: '#ffffff', fontWeight: 'bold', width: '10%' }}>Bill Type</TableCell>
                )}
                <TableCell sx={{ backgroundColor: headerColor, color: '#ffffff', fontWeight: 'bold', width: '18%' }}>Particulars</TableCell>
                <TableCell sx={{ backgroundColor: headerColor, color: '#ffffff', fontWeight: 'bold', width: '15%' }}>Remarks</TableCell>
                <TableCell align="right" sx={{ backgroundColor: headerColor, color: '#ffffff', fontWeight: 'bold', width: '12%' }}>To (Debit)</TableCell>
                <TableCell align="right" sx={{ backgroundColor: headerColor, color: '#ffffff', fontWeight: 'bold', width: '12%' }}>From (Credit)</TableCell>
                <TableCell align="center" sx={{ backgroundColor: headerColor, color: '#ffffff', fontWeight: 'bold', width: '7%' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Opening Balance Row */}
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell colSpan={showBillBadge ? 6 : 5} align="right" sx={{ fontWeight: 'bold', color: headerColor }}>
                  OPENING BALANCE
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: headerColor }}>
                  {metrics.periodOpeningBalance >= 0 ? metrics.periodOpeningBalance.toFixed(2) : ''}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: headerColor }}>
                  {metrics.periodOpeningBalance < 0 ? Math.abs(metrics.periodOpeningBalance).toFixed(2) : ''}
                </TableCell>
                <TableCell sx={{ borderRight: 'none' }} />
              </TableRow>

              {metrics.vouchersList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showBillBadge ? 9 : 8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    No voucher entries found for the selected period.
                  </TableCell>
                </TableRow>
              ) : (
                metrics.vouchersList.map((row, idx) => (
                  <TableRow hover key={`${row.VoucherId || row.VoucherNo}-${idx}`}>
                    <TableCell>{row.VoucherDate ? row.VoucherDate.split('T')[0] : '-'}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Box 
                        component="span"
                        onClick={() => handleViewInvoice(row)}
                        sx={{ 
                          cursor: 'pointer', 
                          color: 'primary.main', 
                          textDecoration: 'underline',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          '&:hover': { color: 'primary.dark' }
                        }}
                        title={isAutoInvoice(row) 
                          ? `Click to preview ${getInvoiceType(row) === 'outward' ? 'Sales' : 'Purchase'} invoice` 
                          : `Click to preview Voucher V${row.VoucherNo}`
                        }
                      >
                        V{row.VoucherNo}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        size="small" 
                        label={row.VoucherType === 'General' ? 'Journal' : (row.VoucherType || 'Journal')}
                        sx={{ 
                          fontSize: '0.7rem', 
                          height: 20, 
                          fontWeight: 600,
                          bgcolor: 
                            row.VoucherType === 'Receipt' ? '#ecfdf5' :
                            row.VoucherType === 'Payment' ? '#eff6ff' :
                            row.VoucherType === 'Sales' ? '#f0fdf4' :
                            row.VoucherType === 'Purchase' ? '#fefce8' :
                            row.VoucherType === 'Contra' ? '#f5f3ff' : '#f1f5f9',
                          color: 
                            row.VoucherType === 'Receipt' ? '#047857' :
                            row.VoucherType === 'Payment' ? '#1d4ed8' :
                            row.VoucherType === 'Sales' ? '#15803d' :
                            row.VoucherType === 'Purchase' ? '#a16207' :
                            row.VoucherType === 'Contra' ? '#6d28d9' : '#475569',
                          border: '1px solid',
                          borderColor: 
                            row.VoucherType === 'Receipt' ? '#a7f3d0' :
                            row.VoucherType === 'Payment' ? '#bfdbfe' :
                            row.VoucherType === 'Sales' ? '#bbf7d0' :
                            row.VoucherType === 'Purchase' ? '#fef08a' :
                            row.VoucherType === 'Contra' ? '#ddd6fe' : '#cbd5e1'
                        }}
                      />
                    </TableCell>
                    {showBillBadge && (
                      <TableCell>
                        <Chip 
                          size="small" 
                          label={row.Bill !== false && row.Bill !== 0 ? 'With Bill' : 'Without Bill'}
                          color={row.Bill !== false && row.Bill !== 0 ? 'primary' : 'warning'}
                          variant={row.Bill !== false && row.Bill !== 0 ? 'outlined' : 'filled'}
                          sx={{ fontSize: '0.7rem', height: 20, fontWeight: 600 }}
                        />
                      </TableCell>
                    )}
                    <TableCell>{getOppositeLedgers(row.VoucherNo, row.Mode)}</TableCell>
                    <TableCell>{row.Remark || '-'}</TableCell>
                    <TableCell align="right">{row.Mode === 'Debit' ? parseFloat(row.Amount).toFixed(2) : '-'}</TableCell>
                    <TableCell align="right">{row.Mode === 'Credit' ? parseFloat(row.Amount).toFixed(2) : '-'}</TableCell>
                    <TableCell align="center">
                      <Tooltip title={isAutoInvoice(row) 
                        ? `Preview ${getInvoiceType(row) === 'outward' ? 'Sales (Outward)' : 'Purchase (Inward)'} Invoice` 
                        : `Preview Voucher V${row.VoucherNo}`
                      }>
                        <IconButton
                          size="small"
                          disabled={invoiceLoading}
                          onClick={() => handleViewInvoice(row)}
                          sx={{
                            p: 0.5,
                            color: isAutoInvoice(row) 
                              ? (getInvoiceType(row) === 'outward' ? '#0F3B66' : '#b45309')
                              : '#475569',
                            bgcolor: isAutoInvoice(row)
                              ? (getInvoiceType(row) === 'outward' ? '#e0f2fe' : '#fef3c7')
                              : '#f1f5f9',
                            border: '1px solid',
                            borderColor: isAutoInvoice(row)
                              ? (getInvoiceType(row) === 'outward' ? '#bae6fd' : '#fde68a')
                              : '#cbd5e1',
                            '&:hover': {
                              bgcolor: isAutoInvoice(row)
                                ? (getInvoiceType(row) === 'outward' ? '#bae6fd' : '#fde68a')
                                : '#e2e8f0'
                            }
                          }}
                        >
                          <Visibility sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
              
              {/* Totals Row */}
              <TableRow sx={{ backgroundColor: '#e2e8f0' }}>
                <TableCell colSpan={showBillBadge ? 6 : 5} align="right" sx={{ fontWeight: 'bold', color: headerColor, fontSize: '0.9rem' }}>
                  TOTAL
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: headerColor, fontSize: '0.9rem' }}>
                  {metrics.grossDebit.toFixed(2)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: headerColor, fontSize: '0.9rem' }}>
                  {metrics.grossCredit.toFixed(2)}
                </TableCell>
                <TableCell sx={{ borderRight: 'none' }} />
              </TableRow>

              {/* Closing Balance Row */}
              <TableRow sx={{ backgroundColor: '#fdfdea' }}>
                <TableCell colSpan={showBillBadge ? 6 : 5} align="right" sx={{ fontWeight: 'bold', color: '#856404' }}>
                  CLOSING BALANCE
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: '#856404' }}>
                  {metrics.closingDebit > 0 ? metrics.closingDebit.toFixed(2) : ''}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: '#856404' }}>
                  {metrics.closingCredit > 0 ? metrics.closingCredit.toFixed(2) : ''}
                </TableCell>
                <TableCell sx={{ borderRight: 'none' }} />
              </TableRow>

              {/* Grand Total Row */}
              <TableRow sx={{ backgroundColor: headerColor }}>
                <TableCell colSpan={showBillBadge ? 6 : 5} align="right" sx={{ fontWeight: 'bold', color: '#ffffff', fontSize: '0.95rem' }}>
                  GRAND TOTAL
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', fontSize: '0.95rem' }}>
                  {metrics.grandTotal.toFixed(2)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ffffff', fontSize: '0.95rem' }}>
                  {metrics.grandTotal.toFixed(2)}
                </TableCell>
                <TableCell sx={{ borderRight: 'none' }} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalanceWallet sx={{ fontSize: 32 }} /> Account Ledger
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
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

      {/* Toolbar & Filters */}
      <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Party / Ledger Select Box */}
          <Autocomplete
            options={ledgers}
            getOptionLabel={(option) => option.LedgerName || ''}
            value={selectedLedger}
            onChange={(e, newValue) => setSelectedLedger(newValue)}
            sx={{ width: { xs: '100%', sm: 320, md: 360 } }}
            slotProps={{
              popper: {
                sx: {
                  minWidth: 380,
                  maxWidth: '90vw',
                  width: 'fit-content',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  borderRadius: 2
                }
              }
            }}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.Id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', py: 0.75, px: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F3B66' }}>
                  {option.LedgerName}
                </Typography>
                {option.AccountGroupName && (
                  <Chip 
                    label={option.AccountGroupName} 
                    size="small" 
                    sx={{ fontSize: '0.7rem', height: 20, ml: 1.5, bgcolor: '#f1f5f9', color: '#334155', fontWeight: 500, flexShrink: 0 }} 
                  />
                )}
              </Box>
            )}
            renderInput={(params) => (
              <TextField 
                {...params} 
                label="Select Party / Ledger" 
                size="small"
                placeholder="Search party / ledger..."
                InputLabelProps={{ shrink: true }}
              />
            )}
          />

          {/* Date Range Box */}
          <Box sx={{ width: { xs: '100%', sm: 240 } }}>
            <DatePicker
              portalId="root"
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update) => setDateRange(update)}
              isClearable={true}
              customInput={
                <TextField 
                  label="Date Range" 
                  size="small"
                  InputLabelProps={{ shrink: true }} 
                  fullWidth 
                />
              }
              dateFormat="dd/MM/yyyy"
            />
          </Box>

          {/* Ledger View Mode Toggles */}
          <Box sx={{ ml: { lg: 'auto' } }}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, nextMode) => { if (nextMode) setViewMode(nextMode); }}
              size="small"
            >
              <ToggleButton value="combined" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5 }}>
                <Tooltip title="Show all entries in a single combined ledger">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ReceiptLong fontSize="small" /> Combined
                  </Box>
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="with_bill" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5 }}>
                <Tooltip title="Show only With Bill (GST/Official) transactions against With-Bill payments">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Receipt fontSize="small" color="primary" /> With Bill
                  </Box>
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="without_bill" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5 }}>
                <Tooltip title="Show only Without Bill (Cash/Estimate) transactions against Without-Bill payments">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <MoneyOff fontSize="small" color="warning" /> Without Bill
                  </Box>
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="split" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5 }}>
                <Tooltip title="Side-by-side Dual Split Ledger comparing With-Bill vs Without-Bill">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CallSplit fontSize="small" color="secondary" /> Split View
                  </Box>
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        {/* Balance KPI Cards */}
        {selectedLedger && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed #e2e8f0' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Card variant="outlined" sx={{ bgcolor: '#f0f9ff', borderColor: '#bae6fd', borderRadius: 2 }}>
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      🧾 With-Bill Balance (Official)
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0c4a6e', mt: 0.5 }}>
                      ₹ {Math.abs(withBillMetrics.periodClosingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <Typography component="span" variant="body2" sx={{ ml: 1, fontWeight: 700, color: withBillMetrics.periodClosingBalance >= 0 ? 'primary.main' : 'error.main' }}>
                        ({withBillMetrics.periodClosingBalance >= 0 ? 'Dr / Receivable' : 'Cr / Payable'})
                      </Typography>
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <Card variant="outlined" sx={{ bgcolor: '#fffbeb', borderColor: '#fde68a', borderRadius: 2 }}>
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      📋 Without-Bill Balance (Cash)
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#78350f', mt: 0.5 }}>
                      ₹ {Math.abs(withoutBillMetrics.periodClosingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <Typography component="span" variant="body2" sx={{ ml: 1, fontWeight: 700, color: withoutBillMetrics.periodClosingBalance >= 0 ? 'primary.main' : 'error.main' }}>
                        ({withoutBillMetrics.periodClosingBalance >= 0 ? 'Dr / Receivable' : 'Cr / Payable'})
                      </Typography>
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={4}>
                <Card variant="outlined" sx={{ bgcolor: '#f8fafc', borderColor: '#cbd5e1', borderRadius: 2 }}>
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      🌐 Combined Total Net Balance
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
                      ₹ {Math.abs(combinedMetrics.periodClosingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <Typography component="span" variant="body2" sx={{ ml: 1, fontWeight: 700, color: combinedMetrics.periodClosingBalance >= 0 ? 'primary.main' : 'error.main' }}>
                        ({combinedMetrics.periodClosingBalance >= 0 ? 'Dr / Net Receivable' : 'Cr / Net Payable'})
                      </Typography>
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Main Ledger Content */}
      <Box sx={{ flexGrow: 1, width: '100%', overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <CircularProgress />
          </Box>
        ) : !selectedLedger ? (
          <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary', borderRadius: 2 }}>
            <Typography variant="h6">Please select a ledger/party to view the report</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              You can toggle between Combined, With-Bill, Without-Bill, or Split View.
            </Typography>
          </Paper>
        ) : viewMode === 'split' ? (
          /* Split View: 2 Columns Side-by-Side */
          <Grid container spacing={2}>
            <Grid item xs={12} lg={6}>
              {renderLedgerTable(
                withBillMetrics, 
                '🧾 WITH BILL (OFFICIAL / GST)', 
                '#0F3B66',
                false
              )}
            </Grid>
            <Grid item xs={12} lg={6}>
              {renderLedgerTable(
                withoutBillMetrics, 
                '📋 WITHOUT BILL (CASH / ESTIMATE)', 
                '#d97706',
                false
              )}
            </Grid>
          </Grid>
        ) : (
          /* Single View: Combined / With Bill / Without Bill */
          renderLedgerTable(
            activeMetrics,
            viewMode === 'with_bill' ? '🧾 WITH BILL LEDGER (Official / GST)' :
            viewMode === 'without_bill' ? '📋 WITHOUT BILL LEDGER (Cash / Estimate)' :
            '🌐 COMBINED ACCOUNT LEDGER',
            viewMode === 'without_bill' ? '#d97706' : '#0F3B66',
            viewMode === 'combined'
          )
        )}
      </Box>
    
      <PdfPreviewModal 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        pdfUrl={previewUrl} 
        title={previewTitle || `Account Ledger Preview - ${selectedLedger?.LedgerName || ''}`} 
      />
    </Box>
  );
};

export default AccountLedgerReport;
