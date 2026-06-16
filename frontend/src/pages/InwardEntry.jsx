import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Autocomplete, Grid, Divider
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Delete as DeleteIcon, Input as InputIcon, Visibility as ViewIcon, Close as CloseIcon, Description as DescriptionIcon, Print as PrintIcon } from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import PdfPreviewModal from '../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const emptyRow = {
  ITEMCODE: '',
  GROSSWT: '',
  NETWT: '',
  SAMPLEPCS: '',
  SAMPLEWT: '',
  QUANTITY: '',
  UNIT: '',
  RATE: '',
  AMOUNT: ''
};

const InwardEntry = () => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [Inwards, setInwards] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [dbUnits, setDbUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  
  const todayDate = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayDate);
  const [toDate, setToDate] = useState(todayDate);
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  // Form States
  const [InwardNo, setInwardNo] = useState('');
  const [InwardDate, setInwardDate] = useState(todayDate);
  const [ledgerId, setLedgerId] = useState(null);
  const [expense, setExpense] = useState('');
  const [gst, setGst] = useState('');
  const [gstAmount, setGstAmount] = useState('');
  const [roundOff, setRoundOff] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [remark, setRemark] = useState('');
  
  const [gridRows, setGridRows] = useState([{ ...emptyRow }]);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [companyProfile, setCompanyProfile] = useState(null);



  const fetchInwards = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/Inwards`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setInwards(data);
    } catch (error) {
      console.error('Error fetching Inwards:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedgers = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/ledgers`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        const allowedGroups = ['sundry debtors', 'sundry creditors', 'party', 'vendor'];
        setLedgers(data.filter(l => {
          if (!l.AccountGroupName) return false;
          const groupName = l.AccountGroupName.trim().toLowerCase();
          return allowedGroups.includes(groupName);
        }));
      }
    } catch (error) {
      console.error('Error fetching ledgers:', error);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setItems(data);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const fetchUnits = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/units`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setDbUnits(data);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const fetchCompanyProfile = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/company-profile`);
      const data = await response.json();
      if (response.ok && data) setCompanyProfile(data);
    } catch (error) {
      console.error('Error fetching company profile:', error);
    }
  };

  useEffect(() => {
    fetchInwards();
    fetchLedgers();
    fetchItems();
    fetchUnits();
    fetchCompanyProfile();
  }, []);

  // Calculate totals whenever gridRows, expense, or gst changes
  useEffect(() => {
    const sumAmount = gridRows.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0);
    const exp = parseFloat(expense) || 0;
    const taxable = sumAmount + exp;
    
    let calcGstAmount = 0;
    if (gst) {
      calcGstAmount = taxable * (parseFloat(gst) / 100);
      setGstAmount(calcGstAmount.toFixed(2));
    } else {
      setGstAmount('');
    }

    const totalBeforeRound = taxable + calcGstAmount;
    const totalRounded = Math.round(totalBeforeRound);
    const roundOffDiff = (totalRounded - totalBeforeRound).toFixed(2);
    
    setRoundOff(roundOffDiff);
    setTotalAmount(totalRounded.toFixed(2));
  }, [gridRows, expense, gst]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

  const filteredInwards = Inwards.filter(i => {
    const matchesSearch = (i.LedgerName && i.LedgerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (i.INWARDNO && i.INWARDNO.toLowerCase().includes(searchTerm.toLowerCase()));
                          
    const dateStr = i.INWARDDATE ? i.INWARDDATE.split('T')[0] : '';
    let matchesDate = true;
    if (fromDate && dateStr < fromDate) matchesDate = false;
    if (toDate && dateStr > toDate) matchesDate = false;
    
    return matchesSearch && matchesDate;
  });

  const handleOpenDialog = () => {
    setDialogError('');
    setEditingId(null);
    setInwardNo('');
    setInwardDate(new Date().toISOString().split('T')[0]);
    setLedgerId(null);
    setExpense('');
    setGst('');
    setGstAmount('');
    setRoundOff('');
    setTotalAmount('');
    setRemark('');
    setGridRows([{ ...emptyRow }]);
    setOpenDialog(true);
  };

  const handleEditInward = (Inward) => {
    setDialogError('');
    setEditingId(Inward.ID);
    setInwardNo(Inward.INWARDNO || '');
    setInwardDate(Inward.INWARDDATE ? Inward.INWARDDATE.split('T')[0] : new Date().toISOString().split('T')[0]);
    setLedgerId(Inward.LEDGERID);
    setExpense(Inward.EXPENSE || '');
    setGst(Inward.GST || '');
    setGstAmount(Inward.GSTAMOUNT || '');
    setRoundOff(Inward.ROUNDOFF || '');
    setTotalAmount(Inward.TOTALAMOUNT || '');
    setRemark(Inward.REMARK || '');
    
    if (Inward.Details && Inward.Details.length > 0) {
      setGridRows(Inward.Details.map(d => ({
        ITEMCODE: d.ITEMCODE || '',
        GROSSWT: d.GROSSWT || '',
        NETWT: d.NETWT || '',
        SAMPLEPCS: d.SAMPLEPCS || '',
        SAMPLEWT: d.SAMPLEWT || '',
        QUANTITY: d.QUANTITY || '',
        UNIT: d.UNIT || '',
        RATE: d.RATE || '',
        AMOUNT: d.AMOUNT || ''
      })));
    } else {
      setGridRows([{ ...emptyRow }]);
    }
    
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setDialogError('');
  };



  const handleRowChange = (index, field, value) => {
    const newRows = [...gridRows];
    newRows[index][field] = value;
    
    // Auto calculate Amount if Qty and Rate change
    if (field === 'QUANTITY' || field === 'RATE') {
      const qty = parseFloat(newRows[index].QUANTITY) || 0;
      const rate = parseFloat(newRows[index].RATE) || 0;
      newRows[index].AMOUNT = (qty * rate).toFixed(2);
    }
    
    setGridRows(newRows);
  };

  const handleItemSelect = (index, item) => {
    const newRows = [...gridRows];
    newRows[index].ITEMCODE = item ? item.ItemCode : '';
    newRows[index].UNIT = item ? item.Unit : '';
    setGridRows(newRows);
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

  const getQRBase64 = async (upiUrl) => {
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUrl)}`;
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error('Error fetching QR image:', err);
      return null;
    }
  };

  const generatePDF = async (inward, ledgerObj, isSaveAction = false) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Vendor Header (top-left)
    const vendorName = ledgerObj.LedgerName || 'Walk-in Vendor';
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text(vendorName, 14, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    let headerY = 25;
    if (ledgerObj.Address) {
      doc.text(ledgerObj.Address, 14, headerY);
      headerY += 4;
    }
    const vendorLoc = [ledgerObj.City, ledgerObj.State].filter(Boolean).join(', ');
    if (vendorLoc) {
      doc.text(vendorLoc, 14, headerY);
      headerY += 4;
    }
    const headerTaxDetails = [];
    if (ledgerObj.GSTIN) headerTaxDetails.push(`GSTIN: ${ledgerObj.GSTIN}`);
    if (ledgerObj.MobileNo) headerTaxDetails.push(`Phone: ${ledgerObj.MobileNo}`);
    if (headerTaxDetails.length > 0) {
      doc.text(headerTaxDetails.join(' | '), 14, headerY);
    }

    // Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('PURCHASE INVOICE', 196, 20, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    doc.text(`Invoice No: ${inward.INWARDNO || inward.InwardNO}`, 196, 25, { align: 'right' });
    
    const dateVal = inward.INWARDDATE || inward.InwardDATE || new Date();
    const formattedDate = new Date(dateVal).toLocaleDateString('en-GB'); // DD/MM/YYYY
    doc.text(`Date: ${formattedDate}`, 196, 29, { align: 'right' });

    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    const dividerY = Math.max(headerY + 2, 33);
    doc.line(14, dividerY, 196, dividerY);

    // Buyer Details (Factory Flow/Company details)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('BUYER DETAILS', 14, dividerY + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    const compName = companyProfile ? companyProfile.CompanyName : 'FACTORY FLOW ERP';
    doc.text(compName, 14, dividerY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    let buyerY = dividerY + 16;
    if (companyProfile) {
      const addr = [companyProfile.Address1, companyProfile.Address2].filter(Boolean).join(', ');
      const cityDetails = [companyProfile.City, companyProfile.StateName, companyProfile.Pincode].filter(Boolean).join(', ');
      
      if (addr) {
        doc.text(addr, 14, buyerY);
        buyerY += 4;
      }
      if (cityDetails) {
        doc.text(cityDetails, 14, buyerY);
        buyerY += 4;
      }
      
      const buyerTax = [];
      if (companyProfile.GSTIN) buyerTax.push(`GSTIN: ${companyProfile.GSTIN}`);
      if (companyProfile.PANNo) buyerTax.push(`PAN: ${companyProfile.PANNo}`);
      if (companyProfile.MobileNo) buyerTax.push(`Mobile: ${companyProfile.MobileNo}`);
      if (buyerTax.length > 0) {
        doc.text(buyerTax.join(' | '), 14, buyerY);
      }
    } else {
      doc.text('Factory Site Address, City, State, ZIP', 14, buyerY);
      buyerY += 4;
      doc.text('GSTIN: 27AAAAA0000A1Z5 | Phone: +91 9876543210', 14, buyerY);
    }

    // Table Column & Rows
    const tableColumn = ["Sr.", "Item Code & Name", "Gross Wt", "Net Wt", "Qty", "Unit", "Rate", "Amount"];
    const detailsSource = isSaveAction ? inward.Details : (inward.Details || []);
    
    const tableRows = detailsSource.map((d, index) => {
      const itemName = d.ItemName || items.find(item => item.ItemCode === d.ITEMCODE)?.ItemName || '';
      return [
        index + 1,
        `${d.ITEMCODE} - ${itemName}`,
        (d.GROSSWT || 0).toFixed(3),
        (d.NETWT || 0).toFixed(3),
        (d.QUANTITY || 0).toFixed(2),
        d.UNIT || '-',
        (d.RATE || 0).toFixed(2),
        (d.AMOUNT || 0).toFixed(2)
      ];
    });

    const tableStartY = Math.max(70, buyerY + 8);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: tableStartY,
      theme: 'grid',
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 1.5 },
      columnStyles: {
        0: { width: 8, halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'center' },
        6: { halign: 'right' },
        7: { halign: 'right' }
      },
      margin: { top: 30 }
    });

    const finalY = doc.lastAutoTable.finalY + 8;
    const pageHeight = doc.internal.pageSize.height;

    // Check pagination room
    let checkY = finalY;
    if (checkY + 45 > pageHeight - 30) {
      doc.addPage();
      checkY = 20;
    }

    // Totals calculations
    const subTotal = detailsSource.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0);
    const exp = parseFloat(inward.EXPENSE) || 0;
    const gstPct = parseFloat(inward.GST) || 0;
    const gstAmt = parseFloat(inward.GSTAMOUNT) || 0;
    const roundOffDiff = parseFloat(inward.ROUNDOFF) || 0;
    const totalRounded = parseFloat(inward.TOTALAMOUNT) || 0;

    let labelY = checkY;
    const drawTotalLine = (label, value, isBold = false) => {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(isBold ? 15 : 80);
      doc.text(label, 140, labelY, { align: 'right' });
      doc.text(value, 196, labelY, { align: 'right' });
      labelY += 5;
    };

    drawTotalLine('Sub Total:', subTotal.toFixed(2));
    if (exp > 0) drawTotalLine('Expense:', exp.toFixed(2));
    if (gstPct > 0) drawTotalLine(`GST (${gstPct}%):`, gstAmt.toFixed(2));
    if (roundOffDiff !== 0) drawTotalLine('Round Off:', roundOffDiff.toFixed(2));
    labelY += 1;
    doc.line(120, labelY - 3, 196, labelY - 3);
    drawTotalLine('Grand Total:', totalRounded.toFixed(2), true);

    // Bank Details & UPI QR Code from Ledger Master on the Left side
    let leftInfoY = checkY;
    if (ledgerObj && (ledgerObj.BankName || ledgerObj.UPI)) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 59, 102);
      doc.text('BANK & PAYMENT DETAILS', 14, leftInfoY);
      leftInfoY += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(50);

      if (ledgerObj.BankName) {
        doc.text(`Bank Name: ${ledgerObj.BankName}`, 14, leftInfoY);
        leftInfoY += 4;
        doc.text(`A/c No: ${ledgerObj.AccountNo || '-'}`, 14, leftInfoY);
        leftInfoY += 4;
        doc.text(`IFSC Code: ${ledgerObj.IFSC || '-'}`, 14, leftInfoY);
        leftInfoY += 5;
      }

      if (ledgerObj.UPI) {
        doc.setFont('helvetica', 'bold');
        doc.text(`UPI ID: ${ledgerObj.UPI}`, 14, leftInfoY);
        
        // QR Code generation
        const upiUrl = `upi://pay?pa=${ledgerObj.UPI}&pn=${encodeURIComponent(ledgerObj.LedgerName || '')}&am=${totalRounded.toFixed(2)}&cu=INR`;
        const qrBase64 = await getQRBase64(upiUrl);
        if (qrBase64) {
          // Add QR Image to the left section
          // Place it at x = 75, y = checkY + 2
          doc.addImage(qrBase64, 'JPEG', 75, checkY + 2, 25, 25);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.text('Scan to Pay', 87.5, checkY + 29, { align: 'center' });
        }
      }
    }

    // Remarks
    const remarkY = Math.max(leftInfoY + 5, labelY + 2);
    if (inward.REMARK) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 59, 102);
      doc.text('Remarks / Terms:', 14, remarkY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50);
      const splitRemark = doc.splitTextToSize(inward.REMARK, 100);
      doc.text(splitRemark, 14, remarkY + 4);
    }

    // Signatures
    doc.line(14, pageHeight - 30, 70, pageHeight - 30);
    doc.text('Prepared By', 42, pageHeight - 25, { align: 'center' });

    doc.line(140, pageHeight - 30, 196, pageHeight - 30);
    doc.text('Authorized Signatory', 168, pageHeight - 25, { align: 'center' });

        const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const handlePrint = async (row) => {
    const ledgerObj = ledgers.find(l => l.Id === row.LEDGERID) || { LedgerName: row.LedgerName };
    await generatePDF(row, ledgerObj, false);
  };

  const handleSave = async (printAfterSave = false) => {
    if (!InwardNo || !ledgerId) {
      setDialogError('Inward No and Ledger are required.');
      return;
    }

    const validRows = gridRows.filter(r => r.ITEMCODE && r.QUANTITY && parseFloat(r.QUANTITY) > 0);
    if (validRows.length === 0) {
      setDialogError('Please fill in at least one valid row with Item and Quantity.');
      return;
    }

    const localUser = JSON.parse(localStorage.getItem('user')) || {};
    const username = localUser.Username || localUser.username || 'System';

    const payload = {
      INWARDNO: InwardNo,
      INWARDDATE: InwardDate,
      LEDGERID: ledgerId,
      EXPENSE: expense ? parseFloat(expense) : 0,
      GST: gst ? parseFloat(gst) : 0,
      GSTAMOUNT: gstAmount ? parseFloat(gstAmount) : 0,
      ROUNDOFF: roundOff ? parseFloat(roundOff) : 0,
      TOTALAMOUNT: totalAmount ? parseFloat(totalAmount) : 0,
      REMARK: remark,
      CREATEDBY: username,
      UPDATEDBY: username,
      Details: validRows.map(r => ({
        ...r,
        GROSSWT: parseFloat(r.GROSSWT) || 0,
        NETWT: parseFloat(r.NETWT) || 0,
        SAMPLEPCS: parseFloat(r.SAMPLEPCS) || 0,
        SAMPLEWT: parseFloat(r.SAMPLEWT) || 0,
        QUANTITY: parseFloat(r.QUANTITY) || 0,
        RATE: parseFloat(r.RATE) || 0,
        AMOUNT: parseFloat(r.AMOUNT) || 0
      }))
    };

    try {
      const url = editingId 
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/Inwards/${editingId}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/Inwards`;
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        if (printAfterSave) {
          const ledgerObj = ledgers.find(l => l.Id === ledgerId) || {};
          await generatePDF(payload, ledgerObj, true);
        }
        handleCloseDialog();
        fetchInwards();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving Inward');
      }
    } catch (error) {
      console.error('Error during save:', error);
      setDialogError('Action failed. See console for details.');
    }
  };

  const openDeleteConfirm = (id) => {
    setItemToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (itemToDelete) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/Inwards/${itemToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchInwards();
          setDeleteConfirmOpen(false);
        }
      } catch (error) {
        console.error('Error deleting Inward:', error);
      }
    }
  };

  const maxLedgerLength = ledgers.length > 0 ? Math.max(...ledgers.map(l => (l.LedgerName || '').length)) : 15;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <InputIcon /> Inward
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, display: 'flex', justifyContent: 'space-between', pt: 2, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search Inwards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
              sx={{ width: '220px' }}
            />
            <TextField
              label="From Date"
              type="date"
              size="small"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: '150px' }}
            />
            <TextField
              label="To Date"
              type="date"
              size="small"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: '150px' }}
            />
            <Button size="small" onClick={() => { setFromDate(''); setToDate(''); }}>Clear Dates</Button>
          </Box>
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleOpenDialog} disabled={!hasAddPermission()}>
            Add Inward
          </Button>
        </Toolbar>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 40 } }}>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Sr. No.</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Inward No</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ledger</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Total Amount</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInwards.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <TableRow hover tabIndex={-1} key={`${row.ID}-${index}`}>
                  <TableCell>{row.ID}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                      {row.INWARDNO}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.INWARDDATE ? row.INWARDDATE.split('T')[0] : ''}</TableCell>
                  <TableCell>{row.LedgerName}</TableCell>
                  <TableCell>{row.TOTALAMOUNT}</TableCell>
                  <TableCell align="center">

                    <IconButton color="secondary" size="small" onClick={() => handlePrint(row)} title="Print Invoice">
                      <PrintIcon fontSize="small" />
                    </IconButton>
                    <IconButton color="primary" size="small" onClick={() => handleEditInward(row)} disabled={!hasEditPermission()} title="Edit">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton color="error" size="small" onClick={() => openDeleteConfirm(row.ID)} disabled={!hasDeletePermission()} title="Delete">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filteredInwards.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>No Inward entries found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredInwards.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={(e, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#0F3B66', color: 'white', py: 2 }}>
          <Typography variant="h6">{editingId ? `Edit Inward ${InwardNo}` : 'Add Inward'}</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 2, backgroundColor: '#f8fafc' }}>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
          
          {/* Header Section */}
          <Paper sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0', boxShadow: 'none' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3} md={2}>
                <TextField fullWidth label="Inward No" size="small" value={InwardNo} onChange={(e) => setInwardNo(e.target.value)} required />
              </Grid>
              <Grid item xs={12} sm={3} md={2}>
                <TextField fullWidth label="Date" type="date" size="small" value={InwardDate} onChange={(e) => setInwardDate(e.target.value)} InputLabelProps={{ shrink: true }} required />
              </Grid>
              <Grid item xs={12} sm={6} md={8}>
                <Autocomplete
                  options={ledgers}
                  getOptionLabel={(option) => option.LedgerName || ''}
                  value={ledgers.find(l => l.Id === ledgerId) || null}
                  onChange={(e, newValue) => setLedgerId(newValue ? newValue.Id : null)}
                  renderInput={(params) => <TextField {...params} label="Ledger" size="small" required fullWidth />}
                  fullWidth
                  sx={{ minWidth: `${Math.max(20, maxLedgerLength) + 6}ch` }}
                  slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Grid Section */}
          <TableContainer component={Paper} sx={{ mb: 2, maxHeight: '40vh', border: '1px solid #e0e0e0', boxShadow: 'none' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: '25%' }}>Item</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '8%' }}>Gross Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '8%' }}>Net Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Sample Pcs</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Sample Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '6%' }}>Qty</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Unit</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '8%' }}>Rate</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Amount</TableCell>
                  <TableCell sx={{ width: '5%' }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gridRows.map((row, index) => (
                  <TableRow key={index} sx={{ '& td': { py: 0.5, px: 1 } }}>
                    <TableCell>
                      <Autocomplete
                        options={items}
                        getOptionLabel={(option) => option ? `${option.ItemCode} - ${option.ItemName}` : ''}
                        value={items.find(i => i.ItemCode === row.ITEMCODE) || null}
                        onChange={(e, newValue) => handleItemSelect(index, newValue)}
                        renderInput={(params) => <TextField {...params} placeholder="Select Item" size="small" />}
                        fullWidth
                        slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                      />
                    </TableCell>
                    <TableCell><TextField type="number" size="small" value={row.GROSSWT} onChange={(e) => handleRowChange(index, 'GROSSWT', e.target.value)} fullWidth /></TableCell>
                    <TableCell><TextField type="number" size="small" value={row.NETWT} onChange={(e) => handleRowChange(index, 'NETWT', e.target.value)} fullWidth /></TableCell>
                    <TableCell><TextField type="number" size="small" value={row.SAMPLEPCS} onChange={(e) => handleRowChange(index, 'SAMPLEPCS', e.target.value)} fullWidth /></TableCell>
                    <TableCell><TextField type="number" size="small" value={row.SAMPLEWT} onChange={(e) => handleRowChange(index, 'SAMPLEWT', e.target.value)} fullWidth /></TableCell>
                    <TableCell><TextField type="number" size="small" value={row.QUANTITY} onChange={(e) => handleRowChange(index, 'QUANTITY', e.target.value)} fullWidth /></TableCell>
                    <TableCell>
                      <Autocomplete
                        options={dbUnits}
                        getOptionLabel={(option) => option.Unit || ''}
                        value={dbUnits.find(u => u.Unit === row.UNIT) || null}
                        onChange={(e, newValue) => handleRowChange(index, 'UNIT', newValue ? newValue.Unit : '')}
                        renderInput={(params) => <TextField {...params} placeholder="Unit" size="small" />}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell><TextField type="number" size="small" value={row.RATE} onChange={(e) => handleRowChange(index, 'RATE', e.target.value)} fullWidth /></TableCell>
                    <TableCell><TextField type="number" size="small" value={row.AMOUNT} onChange={(e) => handleRowChange(index, 'AMOUNT', e.target.value)} fullWidth InputProps={{ readOnly: true, sx: { bgcolor: '#f0f0f0' } }}/></TableCell>
                    <TableCell align="center">
                      <IconButton color="error" size="small" onClick={() => removeGridRow(index)} disabled={!hasDeletePermission() || gridRows.length === 1}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Button variant="text" color="primary" onClick={addGridRow} sx={{ fontWeight: 700, mb: 2 }}>
            + Add Row
          </Button>

          {/* Footer Section */}
          <Paper sx={{ p: 2, border: '1px solid #e0e0e0', boxShadow: 'none' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField fullWidth label="Remarks" size="small" value={remark} onChange={(e) => setRemark(e.target.value)} multiline rows={3} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Sub Total:</Typography>
                    <Typography variant="body2" fontWeight={600}>{gridRows.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0).toFixed(2)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">Expense:</Typography>
                    <TextField size="small" type="number" value={expense} onChange={(e) => setExpense(e.target.value)} sx={{ width: '100px' }} inputProps={{ style: { textAlign: 'right' } }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">GST %:</Typography>
                    <TextField size="small" type="number" value={gst} onChange={(e) => setGst(e.target.value)} sx={{ width: '100px' }} inputProps={{ style: { textAlign: 'right' } }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">GST Amount:</Typography>
                    <Typography variant="body2">{gstAmount || '0.00'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Round Off:</Typography>
                    <Typography variant="body2">{roundOff || '0.00'}</Typography>
                  </Box>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" fontWeight={700}>Total Amount:</Typography>
                    <Typography variant="subtitle1" fontWeight={700} color="primary.main">{totalAmount || '0.00'}</Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>

        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, backgroundColor: '#fff', borderTop: '1px solid #e0e0e0' }}>
          <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
          <Button onClick={() => handleSave(false)} disabled={editingId ? !hasEditPermission() : !hasAddPermission()} variant="contained" color="primary" size="large" sx={{ px: 3 }}>Save</Button>
          <Button onClick={() => handleSave(true)} disabled={editingId ? !hasEditPermission() : !hasAddPermission()} variant="contained" color="secondary" size="large" startIcon={<PrintIcon />} sx={{ px: 3 }}>Save & Print</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Confirm Deletion"
        itemName="this inward entry"
      />


      <PdfPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} pdfUrl={previewUrl} title="Document Preview" />



    </Box>
  );
};

export default InwardEntry;
