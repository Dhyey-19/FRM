import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Autocomplete, Grid, Divider
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  CallReceived as JwInIcon, 
  Close as CloseIcon, 
  Print as PrintIcon 
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import PdfPreviewModal from '../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const emptyRow = {
  OUTITEMCODE: '',
  INITEMCODE: '',
  GROSSWT: '',
  NETWT: '',
  SCRAPITEMCODE: '',
  SCRAPPCS: '',
  SCRAPWT: '',
  QUANTITY: '',
  PROCESS: '',
  UNIT: '',
  RATE: '',
  AMOUNT: ''
};

const JobworkInEntry = () => {
  const [jwInwards, setJwInwards] = useState([]);
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
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  // Form States
  const [jwInwardNo, setJwInwardNo] = useState('');
  const [jwInwardDate, setJwInwardDate] = useState(todayDate);
  const [ledgerId, setLedgerId] = useState(null);
  const [jwOutwardNo, setJwOutwardNo] = useState('');
  const [jobworkOuts, setJobworkOuts] = useState([]);
  const [totalAmount, setTotalAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [gridRows, setGridRows] = useState([{ ...emptyRow }]);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [companyProfile, setCompanyProfile] = useState(null);

  const getItemBalance = (itemCode, specificOutwardNo = null) => {
    const targetOutwardNo = specificOutwardNo || jwOutwardNo;
    if (!targetOutwardNo) return { qty: 0, wt: 0 };
    const selectedOutward = jobworkOuts.find(jw => jw.JWOUTWARDNO === targetOutwardNo);
    if (!selectedOutward || !selectedOutward.Details) return { qty: 0, wt: 0 };
    
    const detail = selectedOutward.Details.find(d => d.ITEMCODE === itemCode);
    if (!detail) return { qty: 0, wt: 0 };
    
    const outwardQty = parseFloat(detail.QUANTITY) || 0;
    const outwardNetWt = parseFloat(detail.NETWT) || 0;
    
    let receivedQty = 0;
    let receivedNetWt = 0;
    jwInwards.forEach(inward => {
      if (inward.JWOUTWARDNO === targetOutwardNo && inward.ID !== editingId) {
        if (inward.Details) {
          inward.Details.forEach(d => {
            if (d.OUTITEMCODE === itemCode) {
              receivedQty += parseFloat(d.QUANTITY) || 0;
              receivedNetWt += parseFloat(d.NETWT) || 0;
            }
          });
        }
      }
    });
    
    return {
      qty: Math.max(0, outwardQty - receivedQty),
      wt: Math.max(0, outwardNetWt - receivedNetWt)
    };
  };

  const getOutItemOptions = () => {
    if (!jwOutwardNo) return [];
    const selectedOutward = jobworkOuts.find(jw => jw.JWOUTWARDNO === jwOutwardNo);
    if (!selectedOutward || !selectedOutward.Details) return [];
    const outItemCodes = selectedOutward.Details.map(d => d.ITEMCODE);
    return items.filter(i => outItemCodes.includes(i.ItemCode));
  };

  const fetchJwInwards = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/jobwork-ins`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setJwInwards(data);
    } catch (error) {
      console.error('Error fetching jobwork ins:', error);
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

  const fetchJobworkOuts = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/jobwork-outs`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setJobworkOuts(data);
    } catch (error) {
      console.error('Error fetching jobwork outs:', error);
    }
  };

  useEffect(() => {
    fetchJwInwards();
    fetchLedgers();
    fetchItems();
    fetchUnits();
    fetchCompanyProfile();
    fetchJobworkOuts();
  }, []);

  // Update total amount whenever gridRows changes
  useEffect(() => {
    const total = gridRows.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0);
    setTotalAmount(total.toFixed(2));
  }, [gridRows]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

  const filteredJwInwards = jwInwards.filter(jw => {
    const matchesSearch = (jw.LedgerName && jw.LedgerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (jw.JWINWARDNO && jw.JWINWARDNO.toLowerCase().includes(searchTerm.toLowerCase()));
                          
    const dateStr = jw.JWINWARDDATE ? jw.JWINWARDDATE.split('T')[0] : '';
    let matchesDate = true;
    if (fromDate && dateStr < fromDate) matchesDate = false;
    if (toDate && dateStr > toDate) matchesDate = false;
    
    return matchesSearch && matchesDate;
  });

  const handleOpenDialog = () => {
    setDialogError('');
    setEditingId(null);
    setJwInwardNo('');
    setJwInwardDate(new Date().toISOString().split('T')[0]);
    setLedgerId(null);
    setJwOutwardNo('');
    setRemark('');
    setGridRows([{ ...emptyRow }]);
    setOpenDialog(true);
  };

  const handleEditJwInward = (jw) => {
    setDialogError('');
    setEditingId(jw.ID);
    setJwInwardNo(jw.JWINWARDNO || '');
    setJwInwardDate(jw.JWINWARDDATE ? jw.JWINWARDDATE.split('T')[0] : new Date().toISOString().split('T')[0]);
    setLedgerId(jw.LEDGERID);
    setJwOutwardNo(jw.JWOUTWARDNO || '');
    setRemark(jw.REMARK || '');
    
    if (jw.Details && jw.Details.length > 0) {
      setGridRows(jw.Details.map(d => ({
        OUTITEMCODE: d.OUTITEMCODE || '',
        INITEMCODE: d.INITEMCODE || '',
        GROSSWT: d.GROSSWT !== null ? d.GROSSWT.toString() : '',
        NETWT: d.NETWT !== null ? d.NETWT.toString() : '',
        SCRAPITEMCODE: d.SCRAPITEMCODE || '',
        SCRAPPCS: d.SCRAPPCS !== null ? d.SCRAPPCS.toString() : '',
        SCRAPWT: d.SCRAPWT !== null ? d.SCRAPWT.toString() : '',
        QUANTITY: d.QUANTITY !== null ? d.QUANTITY.toString() : '',
        PROCESS: d.PROCESS || '',
        UNIT: d.UNIT || '',
        RATE: d.RATE !== null ? d.RATE.toString() : '',
        AMOUNT: d.AMOUNT !== null ? d.AMOUNT.toString() : ''
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

  const handleItemSelect = (index, field, item) => {
    const newRows = [...gridRows];
    newRows[index][field] = item ? item.ItemCode : '';
    
    if (field === 'OUTITEMCODE') {
      newRows[index].INITEMCODE = item ? item.ItemCode : '';
      if (jwOutwardNo && item) {
        const selectedOutward = jobworkOuts.find(jw => jw.JWOUTWARDNO === jwOutwardNo);
        const outwardDetail = selectedOutward?.Details?.find(d => d.ITEMCODE === item.ItemCode);
        if (outwardDetail) {
          newRows[index].PROCESS = outwardDetail.PROCESS || '';
          newRows[index].RATE = outwardDetail.RATE !== null && outwardDetail.RATE !== undefined ? outwardDetail.RATE.toString() : '';
          
          // Auto calculate Amount if Qty and Rate change
          const qty = parseFloat(newRows[index].QUANTITY) || 0;
          const rate = parseFloat(newRows[index].RATE) || 0;
          newRows[index].AMOUNT = (qty * rate).toFixed(2);
        }
      }
      newRows[index].UNIT = item ? item.Unit : '';
    }
    
    if (field === 'INITEMCODE') {
      newRows[index].UNIT = item ? item.Unit : '';
    }
    
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

    // Vendor Header (top-left)
    const vendorName = ledgerObj.LedgerName || 'Walk-in Party';
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
    doc.text('JOB WORK INWARD CHALLAN', 196, 20, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    doc.text(`Challan No: ${jw.JWINWARDNO}`, 196, 25, { align: 'right' });
    
    const dateVal = jw.JWINWARDDATE || new Date();
    const formattedDate = new Date(dateVal).toLocaleDateString('en-GB'); // DD/MM/YYYY
    doc.text(`Date: ${formattedDate}`, 196, 29, { align: 'right' });

    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    const dividerY = Math.max(headerY + 2, 33);
    doc.line(14, dividerY, 196, dividerY);

    // Receiver Details (Factory Flow/Company details)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('RECEIVER DETAILS', 14, dividerY + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    const compName = companyProfile ? companyProfile.CompanyName : 'FACTORY FLOW ERP';
    doc.text(compName, 14, dividerY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    let receiverY = dividerY + 16;
    if (companyProfile) {
      const addr = [companyProfile.Address1, companyProfile.Address2].filter(Boolean).join(', ');
      const cityDetails = [companyProfile.City, companyProfile.StateName, companyProfile.Pincode].filter(Boolean).join(', ');
      
      if (addr) {
        doc.text(addr, 14, receiverY);
        receiverY += 4;
      }
      if (cityDetails) {
        doc.text(cityDetails, 14, receiverY);
        receiverY += 4;
      }
      
      const receiverTax = [];
      if (companyProfile.GSTIN) receiverTax.push(`GSTIN: ${companyProfile.GSTIN}`);
      if (companyProfile.PANNo) receiverTax.push(`PAN: ${companyProfile.PANNo}`);
      if (companyProfile.MobileNo) receiverTax.push(`Mobile: ${companyProfile.MobileNo}`);
      if (receiverTax.length > 0) {
        doc.text(receiverTax.join(' | '), 14, receiverY);
      }
    } else {
      doc.text('Factory Site Address, City, State, ZIP', 14, receiverY);
      receiverY += 4;
      doc.text('GSTIN: 27AAAAA0000A1Z5 | Phone: +91 9876543210', 14, receiverY);
    }

    // Table Column & Rows
    const tableColumn = ["Sr.", "Out Item", "In Item", "Net Wt", "Qty", "Process", "Unit", "Scrap Item", "Scrap Pcs", "Scrap Wt", "Rate", "Amount"];
    const detailsSource = isSaveAction ? jw.Details : (jw.Details || []);
    
    const tableRows = detailsSource.map((d, index) => {
      const outName = items.find(item => item.ItemCode === d.OUTITEMCODE)?.ItemName || d.OUTITEMCODE;
      const inName = items.find(item => item.ItemCode === d.INITEMCODE)?.ItemName || d.INITEMCODE;
      const scrapName = items.find(item => item.ItemCode === d.SCRAPITEMCODE)?.ItemName || d.SCRAPITEMCODE || '-';
      const net = parseFloat(d.NETWT) || 0;
      const qty = parseFloat(d.QUANTITY) || 0;
      const scrapPcs = parseFloat(d.SCRAPPCS) || 0;
      const scrapWt = parseFloat(d.SCRAPWT) || 0;
      const rate = parseFloat(d.RATE) || 0;
      const amt = parseFloat(d.AMOUNT) || 0;
      return [
        index + 1,
        outName,
        inName,
        net.toFixed(3),
        qty.toFixed(2),
        d.PROCESS || '-',
        d.UNIT || '-',
        scrapName,
        scrapPcs.toFixed(2),
        scrapWt.toFixed(3),
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
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 1 },
      columnStyles: {
        0: { width: 8, halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'left' },
        6: { halign: 'center' },
        7: { halign: 'left' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'right' }
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
    const totalNet = detailsSource.reduce((sum, r) => sum + (parseFloat(r.NETWT) || 0), 0);
    const estVal = detailsSource.reduce((sum, r) => sum + (parseFloat(r.AMOUNT) || 0), 0);

    let labelY = checkY;
    const drawTotalLine = (label, value, isBold = false) => {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(isBold ? 15 : 80);
      doc.text(label, 140, labelY, { align: 'right' });
      doc.text(value, 196, labelY, { align: 'right' });
      labelY += 5;
    };

    drawTotalLine('Total Net Wt:', totalNet.toFixed(3));
    drawTotalLine('Total Quantity:', totalQty.toFixed(2));
    labelY += 1;
    doc.line(120, labelY - 3, 196, labelY - 3);
    drawTotalLine('Grand Total Amount:', estVal.toFixed(2), true);

    // Remarks
    const remarkY = Math.max(checkY + 20, labelY + 2);
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
    if (!jwInwardNo || !ledgerId) {
      setDialogError('Challan No and Ledger/Party are required.');
      return;
    }

    const validRows = gridRows.filter(r => r.OUTITEMCODE && r.INITEMCODE && (parseFloat(r.QUANTITY) > 0 || parseFloat(r.NETWT) > 0));
    if (validRows.length === 0) {
      setDialogError('Please fill in at least one valid row with Raw Material, Finished Item, and Quantity or Net Wt.');
      return;
    }

    const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
    const username = localUser.Username || localUser.username || 'System';

    const payload = {
      JWINWARDNO: jwInwardNo,
      JWINWARDDATE: jwInwardDate,
      LEDGERID: ledgerId,
      JWOUTWARDNO: jwOutwardNo || null,
      TOTALAMOUNT: totalAmount ? parseFloat(totalAmount) : 0,
      REMARK: remark,
      CREATEDBY: username,
      UPDATEDBY: username,
      Details: validRows.map(r => ({
        ...r,
        GROSSWT: r.GROSSWT ? parseFloat(r.GROSSWT) : 0,
        NETWT: r.NETWT ? parseFloat(r.NETWT) : 0,
        SCRAPITEMCODE: r.SCRAPITEMCODE || null,
        SCRAPPCS: r.SCRAPPCS ? parseFloat(r.SCRAPPCS) : 0,
        SCRAPWT: r.SCRAPWT ? parseFloat(r.SCRAPWT) : 0,
        QUANTITY: r.QUANTITY ? parseFloat(r.QUANTITY) : 0,
        RATE: r.RATE ? parseFloat(r.RATE) : 0,
        AMOUNT: r.AMOUNT ? parseFloat(r.AMOUNT) : 0
      }))
    };

    try {
      const url = editingId 
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/jobwork-ins/${editingId}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/jobwork-ins`;
      
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
        fetchJwInwards();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving job work in');
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
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/jobwork-ins/${itemToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchJwInwards();
          setDeleteConfirmOpen(false);
        }
      } catch (error) {
        console.error('Error deleting jobwork in:', error);
      }
    }
  };

  const maxLedgerLength = ledgers.length > 0 ? Math.max(...ledgers.map(l => (l.LedgerName || '').length)) : 15;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <JwInIcon /> Job Work In
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, display: 'flex', justifyContent: 'space-between', pt: 2, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search Jobwork In..."
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
            Add Jobwork In
          </Button>
        </Toolbar>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 40 } }}>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Sr. No.</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Challan No</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ledger / Party</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Total Charges</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Remarks</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredJwInwards.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <TableRow hover tabIndex={-1} key={`${row.ID}-${index}`}>
                  <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                      {row.JWINWARDNO}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.JWINWARDDATE ? row.JWINWARDDATE.split('T')[0] : ''}</TableCell>
                  <TableCell>{row.LedgerName}</TableCell>
                  <TableCell>{row.TOTALAMOUNT !== null ? parseFloat(row.TOTALAMOUNT).toFixed(2) : '0.00'}</TableCell>
                  <TableCell>{row.REMARK || '-'}</TableCell>
                  <TableCell align="center">
                    <IconButton color="secondary" size="small" onClick={() => handlePrint(row)} title="Print Challan">
                      <PrintIcon fontSize="small" />
                    </IconButton>
                    <IconButton color="primary" size="small" onClick={() => handleEditJwInward(row)} disabled={!hasEditPermission()} title="Edit">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton color="error" size="small" onClick={() => openDeleteConfirm(row.ID)} disabled={!hasDeletePermission()} title="Delete">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filteredJwInwards.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>No Job Work In entries found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredJwInwards.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={(e, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#0F3B66', color: 'white', py: 2 }}>
          <Typography variant="h6">{editingId ? `Edit Job Work In ${jwInwardNo}` : 'Add Job Work In'}</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 2, backgroundColor: '#f8fafc' }}>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
          
          {/* Header Section */}
          <Paper sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0', boxShadow: 'none' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3} md={2}>
                <TextField fullWidth label="Challan No" size="small" value={jwInwardNo} onChange={(e) => setJwInwardNo(e.target.value)} required />
              </Grid>
              <Grid item xs={12} sm={3} md={2}>
                <TextField fullWidth label="Date" type="date" size="small" value={jwInwardDate} onChange={(e) => setJwInwardDate(e.target.value)} InputLabelProps={{ shrink: true }} required />
              </Grid>
              <Grid item xs={12} sm={6} md={5}>
                <Autocomplete
                  options={ledgers}
                  getOptionLabel={(option) => option.LedgerName || ''}
                  value={ledgers.find(l => l.Id === ledgerId) || null}
                  onChange={(e, newValue) => {
                    setLedgerId(newValue ? newValue.Id : null);
                    setJwOutwardNo('');
                    setGridRows([{ ...emptyRow }]);
                  }}
                  renderInput={(params) => <TextField {...params} label="Ledger / Party" size="small" required fullWidth />}
                  fullWidth
                  sx={{ minWidth: `${Math.max(20, maxLedgerLength) + 6}ch` }}
                  slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Autocomplete
                  options={jobworkOuts.filter(jw => {
                    if (jw.LEDGERID !== ledgerId) return false;
                    if (editingId && jw.JWOUTWARDNO === jwOutwardNo) return true;
                    if (!jw.Details || jw.Details.length === 0) return false;
                    return jw.Details.some(d => {
                      const bal = getItemBalance(d.ITEMCODE, jw.JWOUTWARDNO);
                      return bal.qty > 0 || bal.wt > 0;
                    });
                  })}
                  getOptionLabel={(option) => option.JWOUTWARDNO || ''}
                  value={jobworkOuts.find(jw => jw.JWOUTWARDNO === jwOutwardNo) || null}
                  onChange={(e, newValue) => {
                    setJwOutwardNo(newValue ? newValue.JWOUTWARDNO : '');
                  }}
                  disabled={!ledgerId}
                  renderInput={(params) => <TextField {...params} label="Outward Challan Ref" size="small" placeholder={ledgerId ? "Select Challan" : "Select Ledger First"} />}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Grid Section */}
          <TableContainer component={Paper} sx={{ mb: 2, maxHeight: '50vh', border: '1px solid #e0e0e0', boxShadow: 'none' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: '25%', minWidth: 150 }}>Out Item (Raw)</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '25%', minWidth: 150 }}>In Item (Fin)</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '7%', minWidth: 70 }}>Gross Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '7%', minWidth: 70 }}>Net Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '7%', minWidth: 70 }}>Qty</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '12%', minWidth: 110 }}>Unit</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '7%', minWidth: 70 }}>Rate</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%', minWidth: 85 }}>Amount</TableCell>
                  <TableCell sx={{ width: '5%' }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gridRows.map((row, index) => (
                  <React.Fragment key={index}>
                    {/* Row 1: Primary items and weights */}
                    <TableRow sx={{ '& td': { py: 0.5, px: 0.5, borderBottom: 'none' } }}>
                      {/* Out Item */}
                      <TableCell>
                        <Autocomplete
                          options={getOutItemOptions()}
                          getOptionLabel={(option) => {
                            if (!option) return '';
                            const bal = getItemBalance(option.ItemCode);
                            return `${option.ItemCode} - ${option.ItemName} (Bal: Qty: ${bal.qty.toFixed(2)}, Wt: ${bal.wt.toFixed(3)})`;
                          }}
                          value={getOutItemOptions().find(i => i.ItemCode === row.OUTITEMCODE) || null}
                          onChange={(e, newValue) => handleItemSelect(index, 'OUTITEMCODE', newValue)}
                          renderInput={(params) => <TextField {...params} placeholder={jwOutwardNo ? "Select Item" : "Select Challan"} size="small" />}
                          disabled={!jwOutwardNo}
                          fullWidth
                          slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                        />
                      </TableCell>
                      {/* In Item */}
                      <TableCell>
                        <Autocomplete
                          options={items}
                          getOptionLabel={(option) => option ? `${option.ItemCode} - ${option.ItemName}` : ''}
                          value={items.find(i => i.ItemCode === row.INITEMCODE) || null}
                          onChange={(e, newValue) => handleItemSelect(index, 'INITEMCODE', newValue)}
                          renderInput={(params) => <TextField {...params} placeholder="Select Item" size="small" />}
                          fullWidth
                          slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                        />
                      </TableCell>
                      {/* Gross Wt */}
                      <TableCell><TextField type="number" size="small" value={row.GROSSWT} onChange={(e) => handleRowChange(index, 'GROSSWT', e.target.value)} fullWidth /></TableCell>
                      {/* Net Wt */}
                      <TableCell><TextField type="number" size="small" value={row.NETWT} onChange={(e) => handleRowChange(index, 'NETWT', e.target.value)} fullWidth /></TableCell>
                      {/* Qty */}
                      <TableCell><TextField type="number" size="small" value={row.QUANTITY} onChange={(e) => handleRowChange(index, 'QUANTITY', e.target.value)} fullWidth /></TableCell>
                      {/* Unit */}
                      <TableCell>
                        <Autocomplete
                          options={dbUnits}
                          getOptionLabel={(option) => option.Unit || ''}
                          value={dbUnits.find(u => u.Unit === row.UNIT) || null}
                          onChange={(e, newValue) => handleRowChange(index, 'UNIT', newValue ? newValue.Unit : '')}
                          renderInput={(params) => <TextField {...params} placeholder="Unit" size="small" />}
                          disableClearable
                          fullWidth
                        />
                      </TableCell>
                      {/* Rate */}
                      <TableCell><TextField type="number" size="small" value={row.RATE} onChange={(e) => handleRowChange(index, 'RATE', e.target.value)} fullWidth /></TableCell>
                      {/* Amount */}
                      <TableCell>
                        <TextField 
                          type="number" 
                          size="small" 
                          value={row.AMOUNT} 
                          onChange={(e) => handleRowChange(index, 'AMOUNT', e.target.value)}
                          fullWidth 
                          InputProps={{ readOnly: true, sx: { bgcolor: '#f0f0f0' } }}
                        />
                      </TableCell>
                      {/* Actions */}
                      <TableCell align="center">
                        <IconButton color="error" size="small" onClick={() => removeGridRow(index)} disabled={gridRows.length === 1}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    
                    {/* Row 2: Secondary items and process */}
                    <TableRow sx={{ '& td': { py: 0.5, px: 0.5 }, backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                      {/* Process */}
                      <TableCell colSpan={2}>
                        <TextField 
                          label="Process" 
                          size="small" 
                          value={row.PROCESS} 
                          onChange={(e) => handleRowChange(index, 'PROCESS', e.target.value)} 
                          fullWidth 
                          sx={{ maxWidth: 220 }}
                          InputLabelProps={{ shrink: true }}
                        />
                      </TableCell>
                      {/* Scrap Item */}
                      <TableCell colSpan={2}>
                        <Autocomplete
                          options={items.filter(item => (item.ItemType || '').toLowerCase() === 'scrap')}
                          getOptionLabel={(option) => option ? `${option.ItemCode} - ${option.ItemName}` : ''}
                          value={items.find(i => i.ItemCode === row.SCRAPITEMCODE) || null}
                          onChange={(e, newValue) => handleItemSelect(index, 'SCRAPITEMCODE', newValue)}
                          renderInput={(params) => <TextField {...params} label="Scrap Item" size="small" InputLabelProps={{ shrink: true }} />}
                          fullWidth
                          slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                        />
                      </TableCell>
                      {/* Scrap Pcs */}
                      <TableCell colSpan={1}>
                        <TextField 
                          label="Scrap Pcs" 
                          type="number" 
                          size="small" 
                          value={row.SCRAPPCS} 
                          onChange={(e) => handleRowChange(index, 'SCRAPPCS', e.target.value)} 
                          fullWidth 
                          InputLabelProps={{ shrink: true }}
                        />
                      </TableCell>
                      {/* Scrap Wt */}
                      <TableCell colSpan={1}>
                        <TextField 
                          label="Scrap Wt" 
                          type="number" 
                          size="small" 
                          value={row.SCRAPWT} 
                          onChange={(e) => handleRowChange(index, 'SCRAPWT', e.target.value)} 
                          fullWidth 
                          InputLabelProps={{ shrink: true }}
                        />
                      </TableCell>
                      {/* Spacers */}
                      <TableCell colSpan={3} />
                    </TableRow>

                    {/* Spacer row to add space between records */}
                    <TableRow key={`spacer-${index}`} sx={{ height: '10px', backgroundColor: '#f8fafc', '& td': { border: 'none', py: 0 } }}>
                      <TableCell colSpan={9} sx={{ border: 'none', py: 0 }} />
                    </TableRow>
                  </React.Fragment>
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Total Scrap Weight:</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {gridRows.reduce((sum, row) => sum + (parseFloat(row.SCRAPWT) || 0), 0).toFixed(3)}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" fontWeight={700}>Total Processing Amount:</Typography>
                    <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                      {totalAmount || '0.00'}
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
        itemName="this jobwork in entry"
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

export default JobworkInEntry;
