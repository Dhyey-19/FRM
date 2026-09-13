import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Autocomplete, Grid, Divider, Checkbox, FormControlLabel, Chip, ToggleButtonGroup, ToggleButton
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  CallMade as JwIcon, 
  Close as CloseIcon, 
  Print as PrintIcon,
  ReceiptLong,
  Receipt,
  MoneyOff
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import PdfPreviewModal from '../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const emptyRow = {
  ITEMCODE: '',
  GROSSWT: '',
  NETWT: '',
  TENPCSWT: '',
  QUANTITY: '',
  UNIT: '',
  RATE: '',
  AMOUNT: '',
  PROCESS: ''
};

const JobworkOutEntry = () => {
  const [jwOutwards, setJwOutwards] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [dbUnits, setDbUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  
  const todayDate = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayDate);
  const [toDate, setToDate] = useState(todayDate);
  const [billFilter, setBillFilter] = useState('combined'); // 'combined', 'with_bill', 'without_bill'
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  // Form States
  const [bill, setBill] = useState(true);
  const [jwOutwardNo, setJwOutwardNo] = useState('');
  const [jwOutwardDate, setJwOutwardDate] = useState(todayDate);
  const [ledgerId, setLedgerId] = useState(null);
  const [remark, setRemark] = useState('');
  const [gridRows, setGridRows] = useState([{ ...emptyRow }]);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [companyProfile, setCompanyProfile] = useState(null);

  const fetchJwOutwards = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/jobwork-outs`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setJwOutwards(data);
    } catch (error) {
      console.error('Error fetching jobwork outs:', error);
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
    fetchJwOutwards();
    fetchLedgers();
    fetchItems();
    fetchUnits();
    fetchCompanyProfile();
  }, []);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

  const filteredJwOutwards = jwOutwards.filter(jw => {
    const matchesSearch = (jw.LedgerName && jw.LedgerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (jw.JWOUTWARDNO && jw.JWOUTWARDNO.toLowerCase().includes(searchTerm.toLowerCase()));
                          
    const dateStr = jw.JWOUTWARDDATE ? jw.JWOUTWARDDATE.split('T')[0] : '';
    let matchesDate = true;
    if (fromDate && dateStr < fromDate) matchesDate = false;
    if (toDate && dateStr > toDate) matchesDate = false;
    
    let matchesBill = true;
    if (billFilter === 'with_bill') matchesBill = (jw.Bill !== false && jw.Bill !== 0);
    else if (billFilter === 'without_bill') matchesBill = (jw.Bill === false || jw.Bill === 0);

    return matchesSearch && matchesDate && matchesBill;
  });

  const generateNextJwOutwardNo = (currentJwOutwards) => {
    if (!currentJwOutwards || currentJwOutwards.length === 0) return '1';
    let maxNum = 0;
    for (const item of currentJwOutwards) {
      const val = (item.JWOUTWARDNO || '').trim();
      if (/^\d+$/.test(val)) {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    if (maxNum === 0) {
      for (const item of currentJwOutwards) {
        const val = (item.JWOUTWARDNO || '').trim();
        const match = val.match(/(\d+)(?!.*\d)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
    return String(maxNum + 1);
  };

  const handleOpenDialog = async () => {
    setDialogError('');
    setEditingId(null);
    
    // Immediately pre-fill auto-incremented challan no
    const nextNo = generateNextJwOutwardNo(jwOutwards);
    setJwOutwardNo(nextNo);

    // Sync latest next number from server
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/jobwork-outs/next-no`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.nextNo) {
          setJwOutwardNo(String(data.nextNo));
        }
      }
    } catch (err) {
      console.error('Error fetching next jobwork out no:', err);
    }

    setJwOutwardDate(new Date().toISOString().split('T')[0]);
    setBill(true);
    setLedgerId(null);
    setRemark('');
    setGridRows([{ ...emptyRow }]);
    setOpenDialog(true);
  };

  const handleEditJwOutward = (jw) => {
    setDialogError('');
    setEditingId(jw.ID);
    setBill(jw.Bill !== false && jw.Bill !== 0);
    setJwOutwardNo(jw.JWOUTWARDNO || '');
    setJwOutwardDate(jw.JWOUTWARDDATE ? jw.JWOUTWARDDATE.split('T')[0] : new Date().toISOString().split('T')[0]);
    setLedgerId(jw.LEDGERID);
    setRemark(jw.REMARK || '');
    
    if (jw.Details && jw.Details.length > 0) {
      setGridRows(jw.Details.map(d => ({
        ITEMCODE: d.ITEMCODE || '',
        GROSSWT: d.GROSSWT !== null ? d.GROSSWT.toString() : '',
        NETWT: d.NETWT !== null ? d.NETWT.toString() : '',
        TENPCSWT: d.TENPCSWT !== null && d.TENPCSWT !== undefined ? d.TENPCSWT.toString() : '',
        QUANTITY: d.QUANTITY !== null ? d.QUANTITY.toString() : '',
        UNIT: d.UNIT || '',
        RATE: d.RATE !== null ? d.RATE.toString() : '',
        AMOUNT: calculateRowAmount(d),
        PROCESS: d.PROCESS || ''
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

  const calculateRowAmount = (row) => {
    const unit = row.UNIT ? row.UNIT.trim().toUpperCase() : '';
    const rate = parseFloat(row.RATE) || 0;
    if (unit === 'KGS' || unit === 'KG') {
      const netwt = parseFloat(row.NETWT) || 0;
      return (netwt * rate).toFixed(2);
    } else {
      const qty = parseFloat(row.QUANTITY) || 0;
      return (qty * rate).toFixed(2);
    }
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...gridRows];
    newRows[index][field] = value;

    // Auto calculate Quantity if 10 Pcs Wt or Net Wt changes
    if (field === 'TENPCSWT' || field === 'NETWT') {
      const netWt = parseFloat(newRows[index].NETWT);
      const tenPcsWt = parseFloat(newRows[index].TENPCSWT);
      if (netWt > 0 && tenPcsWt > 0) {
        const calculatedQty = Math.round((netWt / tenPcsWt) * 10);
        newRows[index].QUANTITY = String(calculatedQty);
      }
    }

    // Auto calculate Amount if Qty, Rate, NetWt, Unit, GrossWt or 10 Pcs Wt changes
    if (['QUANTITY', 'RATE', 'NETWT', 'GROSSWT', 'UNIT', 'TENPCSWT'].includes(field)) {
      newRows[index].AMOUNT = calculateRowAmount(newRows[index]);
    }

    setGridRows(newRows);
  };

  const handleItemSelect = (index, item) => {
    const newRows = [...gridRows];
    newRows[index].ITEMCODE = item ? item.ItemCode : '';
    newRows[index].UNIT = item ? item.Unit : '';
    newRows[index].AMOUNT = calculateRowAmount(newRows[index]);
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

  const generatePDF = async (jw, ledgerObj, isSaveAction = false) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Company Header (top-left)
    const compName = companyProfile ? companyProfile.CompanyName : 'FACTORY FLOW ERP';
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text(compName, 14, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    let headerY = 25;
    if (companyProfile) {
      const addr = [companyProfile.Address1, companyProfile.Address2].filter(Boolean).join(', ');
      const cityDetails = [companyProfile.City, companyProfile.StateName, companyProfile.Pincode].filter(Boolean).join(', ');
      
      if (addr) {
        doc.text(addr, 14, headerY);
        headerY += 4;
      }
      if (cityDetails) {
        doc.text(cityDetails, 14, headerY);
        headerY += 4;
      }
      
      const headerTaxDetails = [];
      if (companyProfile.GSTIN) headerTaxDetails.push(`GSTIN: ${companyProfile.GSTIN}`);
      if (companyProfile.PANNo) headerTaxDetails.push(`PAN: ${companyProfile.PANNo}`);
      if (companyProfile.MobileNo) headerTaxDetails.push(`Phone: ${companyProfile.MobileNo}`);
      if (headerTaxDetails.length > 0) {
        doc.text(headerTaxDetails.join(' | '), 14, headerY);
      }
    } else {
      doc.text('Factory Site Address, City, State, ZIP', 14, headerY);
      headerY += 4;
      doc.text('GSTIN: 27AAAAA0000A1Z5 | Phone: +91 9876543210', 14, headerY);
    }

    // Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('JOB WORK OUT CHALLAN', 196, 20, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    doc.text(`Challan No: ${jw.JWOUTWARDNO}`, 196, 25, { align: 'right' });
    
    const dateVal = jw.JWOUTWARDDATE || new Date();
    const formattedDate = new Date(dateVal).toLocaleDateString('en-GB'); // DD/MM/YYYY
    doc.text(`Date: ${formattedDate}`, 196, 29, { align: 'right' });

    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    const dividerY = Math.max(headerY + 2, 33);
    doc.line(14, dividerY, 196, dividerY);

    // Receiver Details (Vendor details)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('RECEIVER DETAILS', 14, dividerY + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    const vendorName = ledgerObj.LedgerName || 'Walk-in Party';
    doc.text(vendorName, 14, dividerY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    let receiverY = dividerY + 16;
    if (ledgerObj.Address) {
      doc.text(ledgerObj.Address, 14, receiverY);
      receiverY += 4;
    }
    const vendorLoc = [ledgerObj.City, ledgerObj.State].filter(Boolean).join(', ');
    if (vendorLoc) {
      doc.text(vendorLoc, 14, receiverY);
      receiverY += 4;
    }
    const receiverTax = [];
    if (ledgerObj.GSTIN) receiverTax.push(`GSTIN: ${ledgerObj.GSTIN}`);
    if (ledgerObj.MobileNo) receiverTax.push(`Phone: ${ledgerObj.MobileNo}`);
    if (receiverTax.length > 0) {
      doc.text(receiverTax.join(' | '), 14, receiverY);
    }

    // Table Column & Rows
    const tableColumn = ["Sr.", "Item Code & Name", "Process", "Gross Wt", "Net Wt", "Qty", "Unit", "Rate", "Amount"];
    const detailsSource = isSaveAction ? jw.Details : (jw.Details || []);
    
    const tableRows = detailsSource.map((d, index) => {
      const itemName = d.ItemName || items.find(item => item.ItemCode === d.ITEMCODE)?.ItemName || '';
      const unit = (d.UNIT || '').trim().toUpperCase();
      const gross = parseFloat(d.GROSSWT) || 0;
      const net = parseFloat(d.NETWT) || 0;
      const qty = parseFloat(d.QUANTITY) || 0;
      const rate = parseFloat(d.RATE) || 0;
      const amt = (unit === 'KGS' || unit === 'KG') ? (net * rate) : (qty * rate);
      return [
        index + 1,
        `${d.ITEMCODE} - ${itemName}`,
        d.PROCESS || '-',
        gross.toFixed(3),
        net.toFixed(3),
        qty.toFixed(2),
        d.UNIT || '-',
        rate.toFixed(2),
        amt.toFixed(2)
      ];
    });

    const tableStartY = Math.max(70, receiverY + 8);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: tableStartY,
      theme: 'grid',
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 1.5 },
      columnStyles: {
        0: { width: 8, halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'center' },
        7: { halign: 'right' },
        8: { halign: 'right' }
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
    const totalQty = detailsSource.reduce((sum, r) => sum + (parseFloat(r.QUANTITY) || 0), 0);
    const totalGross = detailsSource.reduce((sum, r) => sum + (parseFloat(r.GROSSWT) || 0), 0);
    const totalNet = detailsSource.reduce((sum, r) => sum + (parseFloat(r.NETWT) || 0), 0);
    const estVal = detailsSource.reduce((sum, r) => sum + ((parseFloat(r.QUANTITY) || 0) * (parseFloat(r.RATE) || 0)), 0);

    let labelY = checkY;
    const drawTotalLine = (label, value, isBold = false) => {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(isBold ? 15 : 80);
      doc.text(label, 140, labelY, { align: 'right' });
      doc.text(value, 196, labelY, { align: 'right' });
      labelY += 5;
    };

    drawTotalLine('Total Gross Wt:', totalGross.toFixed(3));
    drawTotalLine('Total Net Wt:', totalNet.toFixed(3));
    drawTotalLine('Total Quantity:', totalQty.toFixed(2));
    labelY += 1;
    doc.line(120, labelY - 3, 196, labelY - 3);
    drawTotalLine('Estimated Value:', estVal.toFixed(2), true);

    // Remarks
    const remarkY = Math.max(checkY + 25, labelY + 2);
    if (jw.REMARK) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 59, 102);
      doc.text('Remarks / Terms:', 14, remarkY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50);
      const splitRemark = doc.splitTextToSize(jw.REMARK, 100);
      doc.text(splitRemark, 14, remarkY + 4);
    }

    // Signatures
    doc.line(14, pageHeight - 30, 70, pageHeight - 30);
    doc.text('Prepared By', 42, pageHeight - 25, { align: 'center' });

    doc.line(140, pageHeight - 30, 196, pageHeight - 30);
    doc.text('Authorized Signatory', 168, pageHeight - 25, { align: 'center' });

    // Use iframe for printing
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
    if (!jwOutwardNo || !ledgerId) {
      setDialogError('Challan No and Ledger/Party are required.');
      return;
    }

    const validRows = gridRows.filter(r => r.ITEMCODE && (parseFloat(r.QUANTITY) > 0 || parseFloat(r.NETWT) > 0));
    if (validRows.length === 0) {
      setDialogError('Please fill in at least one valid row with Item and Quantity or Net Wt.');
      return;
    }

    const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
    const username = localUser.Username || localUser.username || 'System';

    const payload = {
      JWOUTWARDNO: jwOutwardNo,
      JWOUTWARDDATE: jwOutwardDate,
      LEDGERID: ledgerId,
      Bill: bill ? 1 : 0,
      REMARK: remark,
      CREATEDBY: username,
      UPDATEDBY: username,
      Details: validRows.map(r => ({
        ...r,
        GROSSWT: r.GROSSWT ? parseFloat(r.GROSSWT) : 0,
        NETWT: r.NETWT ? parseFloat(r.NETWT) : 0,
        TENPCSWT: r.TENPCSWT ? parseFloat(r.TENPCSWT) : null,
        QUANTITY: r.QUANTITY ? parseFloat(r.QUANTITY) : 0,
        RATE: r.RATE ? parseFloat(r.RATE) : 0,
        PROCESS: r.PROCESS || null
      }))
    };

    try {
      const url = editingId 
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/jobwork-outs/${editingId}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/jobwork-outs`;
      
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
        fetchJwOutwards();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving job work out');
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
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/jobwork-outs/${itemToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchJwOutwards();
          setDeleteConfirmOpen(false);
        }
      } catch (error) {
        console.error('Error deleting jobwork out:', error);
      }
    }
  };

  const maxLedgerLength = ledgers.length > 0 ? Math.max(...ledgers.map(l => (l.LedgerName || '').length)) : 15;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <JwIcon /> Job Work Out
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, display: 'flex', justifyContent: 'space-between', pt: 2, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search Jobwork Out..."
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

            <ToggleButtonGroup
              value={billFilter}
              exclusive
              onChange={(e, nextMode) => { if (nextMode) setBillFilter(nextMode); }}
              size="small"
              sx={{ bgcolor: '#f8fafc' }}
            >
              <ToggleButton value="combined" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem' }}>
                <ReceiptLong fontSize="small" sx={{ mr: 0.5 }} /> Combined
              </ToggleButton>
              <ToggleButton value="with_bill" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem' }}>
                <Receipt fontSize="small" color="primary" sx={{ mr: 0.5 }} /> With Bill
              </ToggleButton>
              <ToggleButton value="without_bill" sx={{ fontWeight: 600, textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem' }}>
                <MoneyOff fontSize="small" color="warning" sx={{ mr: 0.5 }} /> Without Bill
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleOpenDialog} disabled={!hasAddPermission()}>
            Add Jobwork Out
          </Button>
        </Toolbar>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 32 } }}>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Challan No</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ledger / Party</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Remarks</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredJwOutwards.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <TableRow hover tabIndex={-1} key={`${row.ID}-${index}`}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                      {row.JWOUTWARDNO}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      size="small" 
                      label={row.Bill !== false && row.Bill !== 0 ? 'With Bill' : 'Without Bill'}
                      color={row.Bill !== false && row.Bill !== 0 ? 'primary' : 'warning'}
                      variant={row.Bill !== false && row.Bill !== 0 ? 'outlined' : 'filled'}
                      sx={{ fontSize: '0.75rem', height: 22, fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>{row.JWOUTWARDDATE ? row.JWOUTWARDDATE.split('T')[0] : ''}</TableCell>
                  <TableCell>{row.LedgerName}</TableCell>
                  <TableCell>{row.REMARK || '-'}</TableCell>
                  <TableCell align="center">
                    <IconButton color="secondary" size="small" onClick={() => handlePrint(row)} title="Print Challan">
                      <PrintIcon fontSize="small" />
                    </IconButton>
                    <IconButton color="primary" size="small" onClick={() => handleEditJwOutward(row)} disabled={!hasEditPermission()} title="Edit">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton color="error" size="small" onClick={() => openDeleteConfirm(row.ID)} disabled={!hasDeletePermission()} title="Delete">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filteredJwOutwards.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>No Job Work Out entries found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredJwOutwards.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={(e, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#0F3B66', color: 'white', py: 2 }}>
          <Typography variant="h6">{editingId ? `Edit Job Work Out ${jwOutwardNo}` : 'Add Job Work Out'}</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 2, backgroundColor: '#f8fafc' }}>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
          
          {/* Header Section */}
          <Paper sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0', boxShadow: 'none' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={1}>
                <FormControlLabel
                  control={<Checkbox checked={bill} onChange={(e) => setBill(e.target.checked)} />}
                  label="Bill"
                />
              </Grid>
              <Grid item xs={12} sm={3} md={2}>
                <TextField fullWidth label="Challan No" size="small" value={jwOutwardNo} onChange={(e) => setJwOutwardNo(e.target.value)} required />
              </Grid>
              <Grid item xs={12} sm={3} md={2}>
                <TextField fullWidth label="Date" type="date" size="small" value={jwOutwardDate} onChange={(e) => setJwOutwardDate(e.target.value)} InputLabelProps={{ shrink: true }} required />
              </Grid>
              <Grid item xs={12} sm={5} md={7}>
                <Autocomplete
                  options={ledgers}
                  getOptionLabel={(option) => option.LedgerName || ''}
                  value={ledgers.find(l => l.Id === ledgerId) || null}
                  onChange={(e, newValue) => setLedgerId(newValue ? newValue.Id : null)}
                  renderInput={(params) => <TextField {...params} label="Ledger / Party" size="small" required fullWidth />}
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
                  <TableCell sx={{ fontWeight: 700, width: '22%' }}>Item</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Process</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Gross Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Net Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>10 Pcs Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Qty</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Unit</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Rate</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Est Amount</TableCell>
                  <TableCell sx={{ width: '4%' }}></TableCell>
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
                    <TableCell><TextField size="small" placeholder="Process" value={row.PROCESS || ''} onChange={(e) => handleRowChange(index, 'PROCESS', e.target.value)} fullWidth /></TableCell>
                    <TableCell><TextField type="number" size="small" value={row.GROSSWT} onChange={(e) => handleRowChange(index, 'GROSSWT', e.target.value)} fullWidth /></TableCell>
                    <TableCell><TextField type="number" size="small" value={row.NETWT} onChange={(e) => handleRowChange(index, 'NETWT', e.target.value)} fullWidth /></TableCell>
                    <TableCell><TextField type="number" size="small" placeholder="10 Pcs Wt" value={row.TENPCSWT || ''} onChange={(e) => handleRowChange(index, 'TENPCSWT', e.target.value)} fullWidth inputProps={{ step: "any" }} /></TableCell>
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
                    <TableCell>
                      <TextField 
                        type="number" 
                        size="small" 
                        value={row.AMOUNT !== undefined && row.AMOUNT !== '' ? row.AMOUNT : calculateRowAmount(row)} 
                        fullWidth 
                        InputProps={{ readOnly: true, sx: { bgcolor: '#f0f0f0' } }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton color="error" size="small" onClick={() => removeGridRow(index)} disabled={gridRows.length === 1}>
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
              <Grid item xs={12} sm={7}>
                <TextField fullWidth label="Remarks" size="small" value={remark} onChange={(e) => setRemark(e.target.value)} multiline rows={4} />
              </Grid>
              <Grid item xs={12} sm={5}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Total Quantity:</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {gridRows.reduce((sum, row) => sum + (parseFloat(row.QUANTITY) || 0), 0).toFixed(2)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Total Gross Weight:</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {gridRows.reduce((sum, row) => sum + (parseFloat(row.GROSSWT) || 0), 0).toFixed(3)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Total Net Weight:</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {gridRows.reduce((sum, row) => sum + (parseFloat(row.NETWT) || 0), 0).toFixed(3)}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" fontWeight={700}>Estimated Total Value:</Typography>
                    <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                      {gridRows.reduce((sum, row) => sum + ((parseFloat(row.QUANTITY) || 0) * (parseFloat(row.RATE) || 0)), 0).toFixed(2)}
                    </Typography>
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
        itemName="this jobwork out entry"
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

export default JobworkOutEntry;
