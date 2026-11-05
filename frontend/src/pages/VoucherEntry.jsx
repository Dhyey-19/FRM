import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Alert,
  MenuItem, Select, FormControl, InputLabel, Autocomplete, Grid, Divider, Chip, Stack
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Delete as DeleteIcon, Receipt as ReceiptIcon, Print as PrintIcon, Visibility as ViewIcon, Close as CloseIcon, Description as DescriptionIcon, AccountBalance as BankIcon } from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import PdfPreviewModal from '../components/common/PdfPreviewModal';

const emptyRow = {
  LedgerId: null,
  Mode: 'Debit',
  Amount: '',
  Through: '',
  Remark: ''
};

const getDefaultRows = (voucherType) => {
  if (voucherType === 'Receipt') {
    return [
      { ...emptyRow, Mode: 'Credit' },
      { ...emptyRow, Mode: 'Debit' }
    ];
  }
  if (voucherType === 'Payment') {
    return [
      { ...emptyRow, Mode: 'Debit' },
      { ...emptyRow, Mode: 'Credit' }
    ];
  }
  return [
    { ...emptyRow, Mode: 'Debit' },
    { ...emptyRow, Mode: 'Credit' }
  ];
};

const VoucherEntry = ({ user }) => {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [billFilter, setBillFilter] = useState('All');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState('All');
  
  const todayDate = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayDate);
  const [toDate, setToDate] = useState(todayDate);
  
  // Grid Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [editingVoucherNo, setEditingVoucherNo] = useState(null);
  
  const [globalDate, setGlobalDate] = useState(new Date().toISOString().split('T')[0]);
  const [globalVoucherType, setGlobalVoucherType] = useState('Receipt');
  const [globalBill, setGlobalBill] = useState(true);
  const [gridRows, setGridRows] = useState([{ ...emptyRow }]);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [companyProfile, setCompanyProfile] = useState(null);

  const fetchCompanyProfile = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/company-profile`);
      if (response.ok) {
        const data = await response.json();
        setCompanyProfile(data);
      }
    } catch (error) {
      console.error('Error fetching company profile:', error);
    }
  };

  const fetchVouchers = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/vouchers`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setVouchers(data);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedgers = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setLedgers(data);
    } catch (error) {
      console.error('Error fetching ledgers:', error);
    }
  };

  useEffect(() => {
    fetchVouchers();
    fetchLedgers();
    fetchCompanyProfile();
  }, []);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

  const standardVoucherTypes = ['Receipt', 'Payment', 'Contra', 'Journal', 'Purchase', 'Sales'];
  const dynamicVoucherTypes = Array.from(
    new Set(
      vouchers
        .map(v => (v.VoucherType === 'General' ? 'Journal' : (v.VoucherType || 'Journal')))
        .filter(Boolean)
    )
  );
  const voucherTypeOptions = Array.from(new Set([...standardVoucherTypes, ...dynamicVoucherTypes]));

  const filteredVouchers = vouchers.filter(v => {
    const vType = v.VoucherType === 'General' ? 'Journal' : (v.VoucherType || 'Journal');

    const matchesSearch = (v.LedgerName && v.LedgerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (v.Mode && v.Mode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (v.VoucherNo && v.VoucherNo.toString().includes(searchTerm)) ||
                          (vType && vType.toLowerCase().includes(searchTerm.toLowerCase()));
                          
    const voucherDateStr = v.VoucherDate ? v.VoucherDate.split('T')[0] : '';
    let matchesDate = true;
    if (fromDate && voucherDateStr < fromDate) matchesDate = false;
    if (toDate && voucherDateStr > toDate) matchesDate = false;

    let matchesBill = true;
    if (billFilter === 'With Bill') {
      matchesBill = (v.Bill !== false && v.Bill !== 0);
    } else if (billFilter === 'Without Bill') {
      matchesBill = (v.Bill === false || v.Bill === 0);
    }

    let matchesType = true;
    if (voucherTypeFilter !== 'All') {
      matchesType = vType.toLowerCase() === voucherTypeFilter.toLowerCase();
    }
    
    return matchesSearch && matchesDate && matchesBill && matchesType;
  });

  const handleOpenDialog = () => {
    setDialogError('');
    setEditingVoucherNo(null);
    setGlobalDate(new Date().toISOString().split('T')[0]);
    setGlobalVoucherType('Receipt');
    setGlobalBill(true);
    setGridRows(getDefaultRows('Receipt'));
    setOpenDialog(true);
  };

  const handleEditVoucher = (voucherNo) => {
    const voucherItems = vouchers.filter(v => v.VoucherNo === voucherNo);
    if (voucherItems.length > 0) {
      setDialogError('');
      setEditingVoucherNo(voucherNo);
      setGlobalDate(voucherItems[0].VoucherDate ? voucherItems[0].VoucherDate.split('T')[0] : new Date().toISOString().split('T')[0]);
      setGlobalVoucherType(voucherItems[0].VoucherType || 'Receipt');
      setGlobalBill(voucherItems[0].Bill !== false && voucherItems[0].Bill !== 0);
      
      const rows = voucherItems.map(item => ({
        LedgerId: item.LedgerId,
        Mode: item.Mode,
        Amount: item.Amount,
        Through: item.Through || '',
        Remark: item.Remark || '',
        Bill: item.Bill,
        CreatedBy: item.CreatedBy || item.CREATEDBY || item.createdby || item.createdBy
      }));
      
      setGridRows(rows);
      setOpenDialog(true);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setDialogError('');
    setEditingVoucherNo(null);
  };



  const handleRowChange = (index, field, value) => {
    const newRows = [...gridRows];
    newRows[index][field] = value;
    if (field === 'Mode') {
      newRows[index].LedgerId = null;
    }
    setGridRows(newRows);
  };

  const balanceGridRows = (rows) => {
    let totalDebit = 0;
    let totalCredit = 0;
    
    rows.forEach(r => {
      const amt = parseFloat(r.Amount) || 0;
      if (r.Mode === 'Debit') totalDebit += amt;
      else if (r.Mode === 'Credit') totalCredit += amt;
    });

    if (totalDebit === totalCredit) {
      return rows;
    }

    const diff = Number(Math.abs(totalDebit - totalCredit).toFixed(2));
    const neededMode = totalDebit < totalCredit ? 'Debit' : 'Credit';

    const updatedRows = [...rows];
    const emptyRowIdx = updatedRows.findIndex(r => !r.Amount || parseFloat(r.Amount) === 0);
    
    if (emptyRowIdx !== -1) {
      updatedRows[emptyRowIdx].Amount = diff.toString();
      updatedRows[emptyRowIdx].Mode = neededMode;
      updatedRows[emptyRowIdx].LedgerId = null;
      return updatedRows;
    }

    return [
      ...updatedRows,
      { ...emptyRow, Mode: neededMode, Amount: diff.toString() }
    ];
  };

  const handleAmountBlur = () => {
    setGridRows(prev => balanceGridRows(prev));
  };

  const handleAmountKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  const addGridRow = () => {
    setGridRows([...gridRows, { ...emptyRow }]);
  };

  const removeGridRow = (index) => {
    if (gridRows.length > 1) {
      const newRows = [...gridRows];
      newRows.splice(index, 1);
      setGridRows(newRows);
    }
  };

  const totalCredit = gridRows.reduce((sum, row) => sum + (row.Mode === 'Credit' ? parseFloat(row.Amount || 0) : 0), 0);
  const totalDebit = gridRows.reduce((sum, row) => sum + (row.Mode === 'Debit' ? parseFloat(row.Amount || 0) : 0), 0);

  const generateVoucherPDF = (payload, voucherNo) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5'
    });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('VOUCHER', 74, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Voucher No: V${voucherNo}`, 10, 25);
    doc.text(`Date: ${globalDate}`, 138, 25, { align: 'right' });

    doc.line(10, 28, 138, 28);

    const tableColumn = [
      "Ledger Name", 
      "Remarks", 
      "Through", 
      { content: "To", styles: { halign: 'center' } }, 
      { content: "From", styles: { halign: 'center' } }
    ];
    const tableRows = [];

    let tCredit = 0;
    let tDebit = 0;

    payload.forEach(row => {
      const ledgerName = ledgers.find(l => l.Id === row.LedgerId)?.LedgerName || '-';
      const debitVal = row.Mode === 'Debit' ? row.Amount.toFixed(2) : '-';
      const creditVal = row.Mode === 'Credit' ? row.Amount.toFixed(2) : '-';
      
      tableRows.push([
        ledgerName,
        row.Remark || '-',
        row.Through || '-',
        debitVal,
        creditVal
      ]);

      if (row.Mode === 'Credit') tCredit += row.Amount;
      if (row.Mode === 'Debit') tDebit += row.Amount;
    });

    autoTable(doc, {
      startY: 32,
      head: [tableColumn],
      body: tableRows,
      foot: [[
        { content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: tDebit.toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: tCredit.toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }
      ]],
      theme: 'grid',
      headStyles: { fillColor: [15, 59, 102] },
      footStyles: { 
        fillColor: [230, 230, 230], 
        textColor: [0, 0, 0],
        lineWidth: 0.1,
        lineColor: [200, 200, 200]
      },
      styles: { fontSize: 9 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' }
      }
    });

    // Use iframe for printing
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const handlePrintHTML = (voucherNo, customItems = null) => {
    const voucherItems = customItems || vouchers.filter(v => v.VoucherNo === voucherNo);
    if (voucherItems.length === 0) return;

    const voucherDate = voucherItems[0].VoucherDate ? voucherItems[0].VoucherDate.split('T')[0] : '';
    const voucherType = voucherItems[0].VoucherType === 'General' ? 'Journal' : (voucherItems[0].VoucherType || 'Journal');
    let tDebit = 0;
    let tCredit = 0;

    const rowsHTML = voucherItems.map(row => {
      const ledgerName = ledgers.find(l => l.Id === row.LedgerId)?.LedgerName || '-';
      const debitVal = row.Mode === 'Debit' ? parseFloat(row.Amount).toFixed(2) : '-';
      const creditVal = row.Mode === 'Credit' ? parseFloat(row.Amount).toFixed(2) : '-';
      if (row.Mode === 'Debit') tDebit += parseFloat(row.Amount);
      if (row.Mode === 'Credit') tCredit += parseFloat(row.Amount);

      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; width: 1%; white-space: nowrap;">${row.Mode}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: 600;">${ledgerName}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; width: 1%; white-space: nowrap;">${row.Through || '-'}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${row.Remark || '-'}</td>
          <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; width: 1%; white-space: nowrap;">${debitVal}</td>
          <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; width: 1%; white-space: nowrap;">${creditVal}</td>
        </tr>
      `;
    }).join('');

    const compName = companyProfile?.CompanyName || 'FRM ERP';
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
          <div><strong>Voucher No:</strong> V${voucherNo}</div>
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
          <title>Print Voucher V${voucherNo}</title>
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
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const handleSaveBulk = async (printAfterSave = false) => {
    // Validate rows
    const validRows = gridRows.filter(r => r.LedgerId && r.Amount && parseFloat(r.Amount) > 0);
    if (validRows.length === 0) {
      setDialogError('Please fill in at least one valid row with a Ledger and Amount.');
      return;
    }

    const tCredit = validRows.reduce((sum, row) => sum + (row.Mode === 'Credit' ? parseFloat(row.Amount || 0) : 0), 0);
    const tDebit = validRows.reduce((sum, row) => sum + (row.Mode === 'Debit' ? parseFloat(row.Amount || 0) : 0), 0);

    if (tCredit !== tDebit) {
      setDialogError(`Cannot save: Total Credit (${tCredit.toFixed(2)}) must equal Total Debit (${tDebit.toFixed(2)}).`);
      return;
    }

    const localUser = JSON.parse(localStorage.getItem('user')) || {};
    const username = localUser.Username || localUser.username || 'System';

    const originalCreatedByRow = editingVoucherNo ? gridRows.find(r => r.CreatedBy !== undefined && r.CreatedBy !== null) : null;
    const originalCreatedBy = originalCreatedByRow ? originalCreatedByRow.CreatedBy : null;    const payload = validRows.map(r => ({
      ...r,
      VoucherDate: globalDate,
      VoucherType: globalVoucherType,
      Bill: globalBill,
      Amount: parseFloat(r.Amount),
      CreatedBy: editingVoucherNo ? originalCreatedBy : username,
      UpdatedBy: username
    }));

    try {
      const url = editingVoucherNo 
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/vouchers/bulk/${editingVoucherNo}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/vouchers/bulk`;
      
      const method = editingVoucherNo ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vouchers: payload, Bill: globalBill })
      });
      
      if (response.ok) {
        const data = await response.json();
        const savedVoucherNo = editingVoucherNo || data.voucherNo;
        
        if (printAfterSave && savedVoucherNo) {
          generateVoucherPDF(payload, savedVoucherNo);
        }
        
        handleCloseDialog();
        fetchVouchers();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving vouchers');
      }
    } catch (error) {
      console.error('Error during save/print:', error);
      setDialogError('Action failed. See console for details.');
    }
  };

  const openDeleteConfirm = (id) => {
    setItemToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const getFilteredLedgers = (mode) => {
    return ledgers.filter(ledger => {
      const isCashOrBank = ledger.AccountGroupName === 'Cash-in-Hand' || ledger.AccountGroupName === 'Bank Accounts';
      
      const isExpenseOrDiscount = 
        ledger.AccountGroupName === 'Indirect Expenses' || 
        ledger.AccountGroupName === 'Direct Expenses' || 
        (ledger.AccountGroupName && ledger.AccountGroupName.toLowerCase().includes('expense')) ||
        (ledger.AccountGroupName && ledger.AccountGroupName.toLowerCase().includes('discount')) ||
        (ledger.LedgerName && (
          ledger.LedgerName.toLowerCase().includes('discount') || 
          ledger.LedgerName.toLowerCase().includes('cdc') || 
          ledger.LedgerName.toLowerCase().trim() === 'cd'
        ));

      const isIncomeOrDiscount = 
        ledger.AccountGroupName === 'Indirect Incomes' || 
        ledger.AccountGroupName === 'Direct Incomes' || 
        (ledger.AccountGroupName && ledger.AccountGroupName.toLowerCase().includes('income')) ||
        (ledger.AccountGroupName && ledger.AccountGroupName.toLowerCase().includes('discount')) ||
        (ledger.LedgerName && (
          ledger.LedgerName.toLowerCase().includes('discount') || 
          ledger.LedgerName.toLowerCase().includes('cdc') || 
          ledger.LedgerName.toLowerCase().trim() === 'cd'
        ));

      if (globalVoucherType === 'Receipt') {
        // In Receipt: Debit can be Cash/Bank OR Discount/Expense (e.g. CD/CDC, bank charge)
        // Credit is the paying party (Sundry Debtors, Party, etc.)
        return mode === 'Debit' ? (isCashOrBank || isExpenseOrDiscount) : !isCashOrBank;
      } else if (globalVoucherType === 'Payment') {
        // In Payment: Debit is the payee/expense
        // Credit can be Cash/Bank OR Discount Received/Income
        return mode === 'Debit' ? !isCashOrBank : (isCashOrBank || isIncomeOrDiscount);
      } else if (globalVoucherType === 'Contra') {
        return isCashOrBank;
      } else if (globalVoucherType === 'Journal' || globalVoucherType === 'General') {
        // Journal allows all ledgers
        return true;
      } else {
        return !isCashOrBank;
      }
    });
  };

  const handleDeleteVoucher = async () => {
    if (itemToDelete) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/vouchers/${itemToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchVouchers();
          setDeleteConfirmOpen(false);
        }
      } catch (error) {
        console.error('Error deleting voucher:', error);
      }
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon /> Voucher Entry
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, display: 'flex', justifyContent: 'space-between', pt: 2, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search vouchers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
              sx={{ width: '220px' }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Voucher Type</InputLabel>
              <Select
                label="Voucher Type"
                value={voucherTypeFilter}
                onChange={(e) => {
                  setVoucherTypeFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="All">All Types</MenuItem>
                {voucherTypeOptions.map((type) => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Bill Type</InputLabel>
              <Select
                label="Bill Type"
                value={billFilter}
                onChange={(e) => {
                  setBillFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="All">All Vouchers</MenuItem>
                <MenuItem value="With Bill">With Bill</MenuItem>
                <MenuItem value="Without Bill">Without Bill</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="From Date"
              type="date"
              size="small"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(0);
              }}
              InputLabelProps={{ shrink: true }}
              sx={{ width: '150px' }}
            />
            <TextField
              label="To Date"
              type="date"
              size="small"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(0);
              }}
              InputLabelProps={{ shrink: true }}
              sx={{ width: '150px' }}
            />
            <Button size="small" onClick={() => { setFromDate(''); setToDate(''); setBillFilter('All'); setVoucherTypeFilter('All'); setSearchTerm(''); setPage(0); }}>Clear</Button>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="outlined"
              startIcon={<BankIcon />}
              onClick={() => navigate('/dashboard/bank-reconciliation')}
              sx={{ borderColor: '#0F3B66', color: '#0F3B66' }}
            >
              Bank Reconciliation
            </Button>
            <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleOpenDialog} disabled={!hasAddPermission()}>
              Bulk Add Vouchers
            </Button>
          </Stack>
        </Toolbar>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 32 } }}>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Voucher No</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Bill Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Mode</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ledger</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Debit</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Credit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredVouchers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <TableRow hover tabIndex={-1} key={`${row.VoucherNo}-${index}`}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                      V{row.VoucherNo}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.VoucherType === 'General' ? 'Journal' : (row.VoucherType || 'Journal')}</TableCell>
                  <TableCell>
                    <Chip 
                      size="small" 
                      label={row.Bill !== false && row.Bill !== 0 ? 'With Bill' : 'Without Bill'}
                      color={row.Bill !== false && row.Bill !== 0 ? 'primary' : 'warning'}
                      variant={row.Bill !== false && row.Bill !== 0 ? 'outlined' : 'filled'}
                      sx={{ fontSize: '0.72rem', height: 22, fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>{row.VoucherDate ? row.VoucherDate.split('T')[0] : ''}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ 
                      color: row.Mode === 'Credit' ? 'success.main' : 'error.main',
                      fontWeight: 600 
                    }}>
                      {row.Mode}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.LedgerName}</TableCell>
                  <TableCell align="right" sx={{ 
                    fontWeight: row.Mode === 'Debit' ? 600 : 400, 
                    color: row.Mode === 'Debit' ? 'error.main' : 'text.secondary' 
                  }}>
                    {row.Mode === 'Debit' ? row.Amount : '-'}
                  </TableCell>
                  <TableCell align="right" sx={{ 
                    fontWeight: row.Mode === 'Credit' ? 600 : 400, 
                    color: row.Mode === 'Credit' ? 'success.main' : 'text.secondary' 
                  }}>
                    {row.Mode === 'Credit' ? row.Amount : '-'}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton 
                      color="primary" 
                      size="small" 
                      onClick={() => handleEditVoucher(row.VoucherNo)}
                      disabled={!hasEditPermission() || ['Purchase', 'Sales'].includes(row.VoucherType)}
                      title={['Purchase', 'Sales'].includes(row.VoucherType) ? "System generated Purchase/Sales vouchers cannot be edited directly." : "Edit Voucher"}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton color="secondary" size="small" onClick={() => generateVoucherPDF(vouchers.filter(v => v.VoucherNo === row.VoucherNo), row.VoucherNo)} title="Print Voucher">
                      <PrintIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      color="error" 
                      size="small" 
                      onClick={() => openDeleteConfirm(row.VoucherNo)}
                      disabled={!hasDeletePermission() || ['Purchase', 'Sales'].includes(row.VoucherType)}
                      title={['Purchase', 'Sales'].includes(row.VoucherType) ? "System generated Purchase/Sales vouchers cannot be deleted directly." : "Delete Voucher"}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filteredVouchers.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 3 }}>No vouchers found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredVouchers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Bulk Add Grid Dialog */}
      <Dialog open={openDialog} onClose={(e, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#0F3B66', color: 'white', py: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">{editingVoucherNo ? `Edit Voucher V${editingVoucherNo}` : 'Add Vouchers'}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1">Type:</Typography>
              <FormControl size="small" sx={{ backgroundColor: 'white', borderRadius: 1, minWidth: 120 }}>
                <Select 
                  value={globalVoucherType} 
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setGlobalVoucherType(nextType);
                    if (!editingVoucherNo) {
                      setGridRows(getDefaultRows(nextType));
                    }
                  }}
                  disabled={!!editingVoucherNo}
                >
                  <MenuItem value="Receipt">Receipt</MenuItem>
                  <MenuItem value="Payment">Payment</MenuItem>
                  <MenuItem value="Contra">Contra</MenuItem>
                  <MenuItem value="Journal">Journal</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body1" sx={{ ml: 1 }}>Bill:</Typography>
              <FormControl size="small" sx={{ backgroundColor: 'white', borderRadius: 1, minWidth: 140 }}>
                <Select 
                  value={globalBill ? 'true' : 'false'} 
                  onChange={(e) => setGlobalBill(e.target.value === 'true')}
                >
                  <MenuItem value="true">With Bill</MenuItem>
                  <MenuItem value="false">Without Bill</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body1" sx={{ ml: 1 }}>Date:</Typography>
              <TextField 
                type="date"
                size="small"
                value={globalDate}
                onChange={(e) => setGlobalDate(e.target.value)}
                sx={{ backgroundColor: 'white', borderRadius: 1 }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, backgroundColor: '#f8fafc' }}>
          {dialogError && <Alert severity="error" sx={{ m: 2 }}>{dialogError}</Alert>}
          
          <TableContainer sx={{ maxHeight: '60vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: '12%' }}>Mode</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '20%' }}>Ledger Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '12%' }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '15%' }}>Through</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '15%' }}>Remarks</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Credit</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Debit</TableCell>
                  <TableCell sx={{ width: '6%' }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gridRows.map((row, index) => {
                  const creditVal = row.Mode === 'Credit' ? (row.Amount || '0') : '0';
                  const debitVal = row.Mode === 'Debit' ? (row.Amount || '0') : '0';

                  return (
                    <TableRow key={index} sx={{ '& td': { py: 1 } }}>
                      <TableCell>
                        <FormControl fullWidth size="small">
                          <Select value={row.Mode} onChange={(e) => handleRowChange(index, 'Mode', e.target.value)}>
                            <MenuItem value="Debit">To (+)</MenuItem>
                            <MenuItem value="Credit">From (-)</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Autocomplete
                          options={getFilteredLedgers(row.Mode)}
                          getOptionLabel={(option) => option.LedgerName || ''}
                          value={ledgers.find(l => l.Id === row.LedgerId) || null}
                          onChange={(e, newValue) => handleRowChange(index, 'LedgerId', newValue ? newValue.Id : null)}
                          renderOption={(props, option) => (
                            <Box component="li" {...props} key={option.Id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', py: 0.5, px: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F3B66' }}>
                                {option.LedgerName}
                              </Typography>
                              {option.AccountGroupName && (
                                <Chip 
                                  label={option.AccountGroupName} 
                                  size="small" 
                                  sx={{ fontSize: '0.68rem', height: 18, ml: 1, bgcolor: '#f1f5f9', color: '#475569', fontWeight: 500 }} 
                                />
                              )}
                            </Box>
                          )}
                          renderInput={(params) => <TextField {...params} placeholder="Select Ledger" size="small" />}
                          fullWidth
                        />
                      </TableCell>
                      <TableCell>
                        <TextField 
                          type="number" 
                          size="small" 
                          placeholder="0.00"
                          value={row.Amount} 
                          onChange={(e) => handleRowChange(index, 'Amount', e.target.value)} 
                          onBlur={handleAmountBlur}
                          onKeyDown={handleAmountKeyDown}
                          fullWidth 
                          sx={{ '& input': { textAlign: 'right' } }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" placeholder="Through" value={row.Through} onChange={(e) => handleRowChange(index, 'Through', e.target.value)} fullWidth />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" placeholder="Remarks" value={row.Remark} onChange={(e) => handleRowChange(index, 'Remark', e.target.value)} fullWidth />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: row.Mode === 'Credit' && row.Amount ? 600 : 400, color: row.Mode === 'Credit' && row.Amount ? 'success.main' : 'text.secondary' }}>
                        {creditVal}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: row.Mode === 'Debit' && row.Amount ? 600 : 400, color: row.Mode === 'Debit' && row.Amount ? 'error.main' : 'text.secondary' }}>
                        {debitVal}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton color="error" size="small" onClick={() => removeGridRow(index)} disabled={!hasDeletePermission() || gridRows.length === 1}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 2, textAlign: 'right', fontWeight: 700 }}>
                    <Button variant="text" color="primary" onClick={addGridRow} sx={{ fontWeight: 700, float: 'left' }}>
                      ADD +
                    </Button>
                    TOTAL:
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, borderTop: '2px solid #ccc' }}>
                    {totalCredit.toFixed(2)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, borderTop: '2px solid #ccc' }}>
                    {totalDebit.toFixed(2)}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, backgroundColor: '#fff', borderTop: '1px solid #e0e0e0' }}>
          <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
          <Button onClick={() => handleSaveBulk(false)} disabled={editingVoucherNo ? !hasEditPermission() : !hasAddPermission()} variant="contained" color="primary" size="large" sx={{ px: 3 }}>Save</Button>
          <Button onClick={() => handleSaveBulk(true)} disabled={editingVoucherNo ? !hasEditPermission() : !hasAddPermission()} variant="contained" color="secondary" size="large" startIcon={<PrintIcon />} sx={{ px: 3 }}>Save & Print</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteVoucher}
        title="Confirm Deletion"
        itemName="this voucher"
      />


      <PdfPreviewModal 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        pdfUrl={previewUrl} 
        title="Document Preview" 
      />
    </Box>
  );
};

export default VoucherEntry;
