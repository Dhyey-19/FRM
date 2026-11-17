import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Autocomplete, Grid, Divider, Checkbox, FormControlLabel, Chip, ToggleButtonGroup, ToggleButton,
  FormControl, Select, MenuItem
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  CallReceived as JwInIcon, 
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
  OUTITEMCODE: '',
  OUTSUBCODE: '',
  INITEMCODE: '',
  INSUBCODE: '',
  GROSSWT: '',
  NETWT: '',
  TENPCSWT: '',
  SCRAPITEMCODE: null,
  SCRAPSUBCODE: '',
  SCRAPPCS: 0,
  SCRAPWT: 0,
  QUANTITY: '',
  PROCESS: '',
  UNIT: '',
  RATE: '',
  AMOUNT: ''
};

const JobworkInEntry = ({ hideTitle = false, title = 'Sub-Contract IN' }) => {
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
  const [billFilter, setBillFilter] = useState('combined'); // 'combined', 'with_bill', 'without_bill'
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  // Form States
  const [bill, setBill] = useState(true);
  const [jwInwardNo, setJwInwardNo] = useState('');
  const [jwInwardDate, setJwInwardDate] = useState(todayDate);
  const [ledgerId, setLedgerId] = useState(null);
  const [itemTypeFilter, setItemTypeFilter] = useState('Unfinished');
  const jwOutwardNo = 'All';
  const [jobworkOuts, setJobworkOuts] = useState([]);
  const [totalAmount, setTotalAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [gridRows, setGridRows] = useState([{ ...emptyRow }]);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [companyProfile, setCompanyProfile] = useState(null);

  const getItemBalance = (itemCode, subCode = '', specificOutwardNo = null) => {
    const targetOutwardNo = specificOutwardNo || jwOutwardNo;
    if (!targetOutwardNo) return { qty: 0, wt: 0 };
    const safeSub = subCode || '';

    if (targetOutwardNo === 'All') {
      let outwardQty = 0;
      let outwardNetWt = 0;
      jobworkOuts.filter(jw => jw.LEDGERID === ledgerId).forEach(jw => {
        if (jw.Details) {
          jw.Details.forEach(d => {
            if (d.ITEMCODE === itemCode && (d.SUBCODE || '') === safeSub) {
              outwardQty += parseFloat(d.QUANTITY) || 0;
              outwardNetWt += parseFloat(d.NETWT) || 0;
            }
          });
        }
      });

      let receivedQty = 0;
      let receivedNetWt = 0;
      jwInwards.filter(jw => jw.LEDGERID === ledgerId && jw.ID !== editingId).forEach(inward => {
        if (inward.Details) {
          inward.Details.forEach(d => {
            if ((d.OUTITEMCODE === itemCode || d.INITEMCODE === itemCode) && ((d.OUTSUBCODE || d.INSUBCODE || '') === safeSub)) {
              receivedQty += parseFloat(d.QUANTITY) || 0;
              receivedNetWt += parseFloat(d.NETWT) || 0;
            }
          });
        }
      });

      return {
        qty: Math.max(0, outwardQty - receivedQty),
        wt: Math.max(0, outwardNetWt - receivedNetWt)
      };
    }

    const selectedOutward = jobworkOuts.find(jw => jw.JWOUTWARDNO === targetOutwardNo);
    if (!selectedOutward || !selectedOutward.Details) return { qty: 0, wt: 0 };
    
    const detail = selectedOutward.Details.find(d => d.ITEMCODE === itemCode && (d.SUBCODE || '') === safeSub);
    if (!detail) return { qty: 0, wt: 0 };
    
    const outwardQty = parseFloat(detail.QUANTITY) || 0;
    const outwardNetWt = parseFloat(detail.NETWT) || 0;
    
    let receivedQty = 0;
    let receivedNetWt = 0;
    jwInwards.forEach(inward => {
      if (inward.JWOUTWARDNO === targetOutwardNo && inward.ID !== editingId) {
        if (inward.Details) {
          inward.Details.forEach(d => {
            if ((d.OUTITEMCODE === itemCode || d.INITEMCODE === itemCode) && ((d.OUTSUBCODE || d.INSUBCODE || '') === safeSub)) {
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

  const getFilteredItemsByType = () => {
    if (itemTypeFilter === 'Unfinished') {
      return items.filter(i => {
        const t = (i.ItemType || '').toLowerCase();
        return t.includes('unfinish') || t.includes('semi') || i.ItemType === 'SF' || i.ItemType === 'WIP';
      });
    } else if (itemTypeFilter !== 'All') {
      return items.filter(i => i.ItemType === itemTypeFilter);
    }
    return items;
  };

  const getOutItemOptions = () => {
    const baseItems = getFilteredItemsByType();
    if (!ledgerId) return baseItems;

    const outItemKeys = new Set();
    const allOutwards = jobworkOuts.filter(jw => jw.LEDGERID === ledgerId);
    allOutwards.forEach(jw => {
      if (jw.Details) {
        jw.Details.forEach(d => {
          const bal = getItemBalance(d.ITEMCODE, d.SUBCODE || '', 'All');
          if (bal.qty > 0 || bal.wt > 0) {
            outItemKeys.add(`${d.ITEMCODE}_${d.SUBCODE || ''}`);
          }
        });
      }
    });

    const pendingItems = baseItems.filter(i => outItemKeys.has(`${i.ItemCode}_${i.SubCode || ''}`));
    if (pendingItems.length > 0) return pendingItems;
    return baseItems;
  };

  const getRowOutItemOptions = (itemCode, subCode) => {
    const list = getOutItemOptions();
    if (itemCode && !list.some(i => i.ItemCode === itemCode && (i.SubCode || '') === (subCode || ''))) {
      const match = items.find(i => i.ItemCode === itemCode && (i.SubCode || '') === (subCode || ''));
      if (match) return [match, ...list];
    }
    return list;
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

  const calculateEstimatedTotalValue = (rows) => {
    return rows.reduce((sum, r) => sum + (parseFloat(r.AMOUNT !== undefined && r.AMOUNT !== '' ? r.AMOUNT : calculateRowAmount(r)) || 0), 0);
  };

  // Update total amount whenever gridRows changes
  useEffect(() => {
    const total = calculateEstimatedTotalValue(gridRows);
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
    
    let matchesBill = true;
    if (billFilter === 'with_bill') matchesBill = (jw.Bill !== false && jw.Bill !== 0);
    else if (billFilter === 'without_bill') matchesBill = (jw.Bill === false || jw.Bill === 0);

    return matchesSearch && matchesDate && matchesBill;
  });

  const generateNextJwInwardNo = (currentJwInwards) => {
    if (!currentJwInwards || currentJwInwards.length === 0) return '1';
    let maxNum = 0;
    for (const item of currentJwInwards) {
      const val = (item.JWINWARDNO || '').trim();
      if (/^\d+$/.test(val)) {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    if (maxNum === 0) {
      for (const item of currentJwInwards) {
        const val = (item.JWINWARDNO || '').trim();
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
    
    const nextNo = generateNextJwInwardNo(jwInwards);
    setJwInwardNo(nextNo);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/jobwork-ins/next-no`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.nextNo) {
          setJwInwardNo(String(data.nextNo));
        }
      }
    } catch (err) {
      console.error('Error fetching next jobwork in no:', err);
    }

    setJwInwardDate(new Date().toISOString().split('T')[0]);
    setBill(true);
    setLedgerId(null);
    setItemTypeFilter('Unfinished');
    setRemark('');
    setGridRows([{ ...emptyRow }]);
    setOpenDialog(true);
  };

  const handleEditJwInward = (jw) => {
    setDialogError('');
    setEditingId(jw.ID);
    setBill(jw.Bill !== false && jw.Bill !== 0);
    setJwInwardNo(jw.JWINWARDNO || '');
    setJwInwardDate(jw.JWINWARDDATE ? jw.JWINWARDDATE.split('T')[0] : new Date().toISOString().split('T')[0]);
    setLedgerId(jw.LEDGERID);
    setItemTypeFilter('Unfinished');
    setRemark(jw.REMARK || '');
    
    if (jw.Details && jw.Details.length > 0) {
      setGridRows(jw.Details.map(d => ({
        OUTITEMCODE: d.OUTITEMCODE || d.INITEMCODE || '',
        OUTSUBCODE: d.OUTSUBCODE || d.INSUBCODE || '',
        INITEMCODE: d.INITEMCODE || d.OUTITEMCODE || '',
        INSUBCODE: d.INSUBCODE || d.OUTSUBCODE || '',
        GROSSWT: d.GROSSWT !== null && d.GROSSWT !== undefined ? d.GROSSWT.toString() : '',
        NETWT: d.NETWT !== null && d.NETWT !== undefined ? d.NETWT.toString() : '',
        TENPCSWT: d.TENPCSWT !== null && d.TENPCSWT !== undefined ? d.TENPCSWT.toString() : '',
        SCRAPITEMCODE: null,
        SCRAPSUBCODE: '',
        SCRAPPCS: 0,
        SCRAPWT: 0,
        QUANTITY: d.QUANTITY !== null && d.QUANTITY !== undefined ? d.QUANTITY.toString() : '',
        PROCESS: d.PROCESS || '',
        UNIT: d.UNIT || '',
        RATE: d.RATE !== null && d.RATE !== undefined ? d.RATE.toString() : '',
        AMOUNT: d.AMOUNT !== null && d.AMOUNT !== undefined ? d.AMOUNT.toString() : ''
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

    if (field === 'TENPCSWT' || field === 'NETWT') {
      const netWt = parseFloat(newRows[index].NETWT);
      const tenPcsWt = parseFloat(newRows[index].TENPCSWT);
      if (netWt > 0 && tenPcsWt > 0) {
        const calculatedQty = Math.round((netWt / tenPcsWt) * 10);
        newRows[index].QUANTITY = String(calculatedQty);
      }
    }

    if (['QUANTITY', 'RATE', 'NETWT', 'GROSSWT', 'UNIT', 'TENPCSWT'].includes(field)) {
      newRows[index].AMOUNT = calculateRowAmount(newRows[index]);
    }
    
    setGridRows(newRows);
  };

  const handleItemSelect = (index, item) => {
    const newRows = [...gridRows];
    const itemCode = item ? item.ItemCode : '';
    const subCode = item ? (item.SubCode || '') : '';
    newRows[index].OUTITEMCODE = itemCode;
    newRows[index].OUTSUBCODE = subCode;
    newRows[index].INITEMCODE = itemCode;
    newRows[index].INSUBCODE = subCode;
    newRows[index].UNIT = item ? item.Unit : '';

    if (item && ledgerId) {
      const allOutwards = jobworkOuts.filter(jw => jw.LEDGERID === ledgerId);
      for (let jw of allOutwards) {
        if (jw.Details) {
          const det = jw.Details.find(d => d.ITEMCODE === itemCode && (d.SUBCODE || '') === subCode);
          if (det) {
            if (!newRows[index].PROCESS) newRows[index].PROCESS = det.PROCESS || '';
            if (!newRows[index].RATE && det.RATE !== null && det.RATE !== undefined) newRows[index].RATE = det.RATE.toString();
            break;
          }
        }
      }
    }

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

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('SUB-CONTRACT INWARD CHALLAN', 196, 20, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    doc.text(`Challan No: ${jw.JWINWARDNO}`, 196, 25, { align: 'right' });
    
    const dateVal = jw.JWINWARDDATE || new Date();
    const formattedDate = new Date(dateVal).toLocaleDateString('en-GB');
    doc.text(`Date: ${formattedDate}`, 196, 29, { align: 'right' });

    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    const dividerY = Math.max(headerY + 6, 35);
    doc.line(14, dividerY, 196, dividerY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('RECEIVED AT:', 14, dividerY + 6);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    const compName = companyProfile ? companyProfile.CompanyName : 'FRM ERP';
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

    const tableColumn = ["Sr.", "Item", "Process", "Gross Wt", "Net Wt", "Qty", "Unit", "Rate", "Amount"];
    const detailsSource = isSaveAction ? jw.Details : (jw.Details || []);
    
    const tableRows = detailsSource.map((d, index) => {
      const itemCodeDisplay = d.OUTITEMCODE || d.ITEMCODE || '-';
      const itemSubDisplay = d.OUTSUBCODE || d.SUBCODE || '';
      const matchedItem = items.find(item => item.ItemCode === itemCodeDisplay && (item.SubCode || '') === itemSubDisplay);
      const itemName = matchedItem ? matchedItem.ItemName : (d.ItemName || itemCodeDisplay);
      const gross = parseFloat(d.GROSSWT) || 0;
      const net = parseFloat(d.NETWT) || 0;
      const qty = parseFloat(d.QUANTITY) || 0;
      const rate = parseFloat(d.RATE) || 0;
      const amt = parseFloat(d.AMOUNT !== undefined && d.AMOUNT !== '' ? d.AMOUNT : calculateRowAmount(d)) || 0;
      return [
        index + 1,
        `${itemCodeDisplay}${itemSubDisplay ? ` / ${itemSubDisplay}` : ''} - ${itemName}`,
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

    let checkY = finalY;
    if (checkY + 45 > pageHeight - 30) {
      doc.addPage();
      checkY = 20;
    }

    const totalGross = detailsSource.reduce((sum, r) => sum + (parseFloat(r.GROSSWT) || 0), 0);
    const totalNet = detailsSource.reduce((sum, r) => sum + (parseFloat(r.NETWT) || 0), 0);
    const totalQty = detailsSource.reduce((sum, r) => sum + (parseFloat(r.QUANTITY) || 0), 0);
    const estVal = detailsSource.reduce((sum, r) => sum + (parseFloat(r.AMOUNT !== undefined && r.AMOUNT !== '' ? r.AMOUNT : calculateRowAmount(r)) || 0), 0);

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
    drawTotalLine('Grand Total Amount:', estVal.toFixed(2), true);

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
    if (!jwInwardNo || !ledgerId) {
      setDialogError('Challan No and Ledger/Party are required.');
      return;
    }

    const validRows = gridRows.filter(r => r.OUTITEMCODE);
    if (validRows.length === 0) {
      setDialogError('Please fill in at least one valid row with an Item.');
      return;
    }

    // Compulsory Pcs check when Unit is PCS
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      const u = String(r.UNIT || '').trim().toUpperCase();
      if ((u === 'PCS' || (!u.includes('KG') && u !== '')) && (!r.QUANTITY || parseFloat(r.QUANTITY) <= 0)) {
        setDialogError(`Pcs / Quantity is compulsory for row #${i + 1} (${r.OUTITEMCODE}) because its unit is PCS.`);
        return;
      }
    }

    const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};
    const username = localUser.Username || localUser.username || 'System';

    const payload = {
      JWINWARDNO: jwInwardNo,
      JWINWARDDATE: jwInwardDate,
      LEDGERID: ledgerId,
      JWOUTWARDNO: jwOutwardNo === 'All' ? null : (jwOutwardNo || null),
      Bill: bill ? 1 : 0,
      TOTALAMOUNT: totalAmount ? parseFloat(totalAmount) : 0,
      REMARK: remark,
      CREATEDBY: username,
      UPDATEDBY: username,
      Details: validRows.map(r => ({
        OUTITEMCODE: r.OUTITEMCODE,
        OUTSUBCODE: r.OUTSUBCODE || '',
        INITEMCODE: r.OUTITEMCODE,
        INSUBCODE: r.OUTSUBCODE || '',
        GROSSWT: r.GROSSWT ? parseFloat(r.GROSSWT) : 0,
        NETWT: r.NETWT ? parseFloat(r.NETWT) : 0,
        TENPCSWT: r.TENPCSWT ? parseFloat(r.TENPCSWT) : null,
        SCRAPITEMCODE: null,
        SCRAPSUBCODE: '',
        SCRAPPCS: 0,
        SCRAPWT: 0,
        QUANTITY: r.QUANTITY ? parseFloat(r.QUANTITY) : 0,
        PROCESS: r.PROCESS || null,
        UNIT: r.UNIT || null,
        RATE: r.RATE ? parseFloat(r.RATE) : 0,
        AMOUNT: r.AMOUNT !== undefined && r.AMOUNT !== '' ? parseFloat(r.AMOUNT) : parseFloat(calculateRowAmount(r))
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
        setDialogError(data.message || 'Error saving sub-contract in');
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

  return (
    <Box>
      {!hideTitle && (
        <Paper sx={{ mb: 3, p: 2, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <JwInIcon sx={{ fontSize: 32, color: '#38bdf8' }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                {title} (Material Receipt)
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                Receive processed / semi-finished goods back from sub-contract parties
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      <Paper sx={{ width: '100%', mb: 2, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, py: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            <TextField
              size="small"
              placeholder="Search Challan / Party..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')}><CloseIcon fontSize="small" /></IconButton>
                  </InputAdornment>
                )
              }}
              sx={{ width: { xs: '100%', sm: 240 } }}
            />
            <TextField
              size="small"
              type="date"
              label="From Date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { xs: '47%', sm: 140 } }}
            />
            <TextField
              size="small"
              type="date"
              label="To Date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { xs: '47%', sm: 140 } }}
            />
            <ToggleButtonGroup
              size="small"
              value={billFilter}
              exclusive
              onChange={(e, val) => { if (val) setBillFilter(val); }}
              sx={{ height: 38, width: { xs: '100%', sm: 'auto' }, display: 'flex' }}
            >
              <ToggleButton value="combined" sx={{ flex: { xs: 1, sm: 'none' }, fontWeight: 600, textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem' }}>
                <ReceiptLong fontSize="small" color="action" sx={{ mr: 0.5 }} /> All
              </ToggleButton>
              <ToggleButton value="with_bill" sx={{ flex: { xs: 1, sm: 'none' }, fontWeight: 600, textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem' }}>
                <Receipt fontSize="small" color="primary" sx={{ mr: 0.5 }} /> With Bill
              </ToggleButton>
              <ToggleButton value="without_bill" sx={{ flex: { xs: 1, sm: 'none' }, fontWeight: 600, textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem' }}>
                <MoneyOff fontSize="small" color="warning" sx={{ mr: 0.5 }} /> Without Bill
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleOpenDialog} disabled={!hasAddPermission()} sx={{ width: { xs: '100%', md: 'auto' } }}>
            Add {title}
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
                <TableCell sx={{ fontWeight: 600 }}>Total Charges</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Remarks</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredJwInwards.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <TableRow hover tabIndex={-1} key={`${row.ID}-${index}`}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                      {row.JWINWARDNO}
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
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>No Sub-Contract In entries found.</TableCell>
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
          <Typography variant="h6">{editingId ? `Edit ${title} ${jwInwardNo}` : `Add ${title}`}</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 2, backgroundColor: '#f8fafc' }}>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
          
          {/* Header Section */}
          <Paper sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0', boxShadow: 'none' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={3} md={1.5}>
                <FormControlLabel
                  control={<Checkbox checked={bill} onChange={(e) => setBill(e.target.checked)} />}
                  label="Bill"
                />
              </Grid>
              <Grid item xs={12} sm={4.5} md={2.5}>
                <TextField fullWidth label="Challan No" size="small" value={jwInwardNo} onChange={(e) => setJwInwardNo(e.target.value)} required />
              </Grid>
              <Grid item xs={12} sm={4.5} md={2.5}>
                <TextField fullWidth label="Date" type="date" size="small" value={jwInwardDate} onChange={(e) => setJwInwardDate(e.target.value)} InputLabelProps={{ shrink: true }} required />
              </Grid>
              <Grid item xs={12} sm={12} md={5.5}>
                <Autocomplete
                  options={ledgers}
                  getOptionLabel={(option) => option.LedgerName || ''}
                  value={ledgers.find(l => l.Id === ledgerId) || null}
                  onChange={(e, newValue) => {
                    setLedgerId(newValue ? newValue.Id : null);
                    setGridRows([{ ...emptyRow }]);
                  }}
                  renderInput={(params) => <TextField {...params} label="Ledger / Party" size="small" required fullWidth />}
                  fullWidth
                  slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Filter by Item Type Bar */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, px: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
              Received Items (Sub-Contract In)
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>Filter Item Type:</Typography>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select
                  value={itemTypeFilter}
                  onChange={(e) => setItemTypeFilter(e.target.value)}
                  sx={{ height: 32, fontSize: '0.82rem', bgcolor: '#fff' }}
                >
                  <MenuItem value="Unfinished" sx={{ fontSize: '0.82rem' }}>Unfinished / Semi-Finished</MenuItem>
                  <MenuItem value="All" sx={{ fontSize: '0.82rem' }}>All Item Types</MenuItem>
                  {[...new Set(items.map(i => i.ItemType).filter(Boolean))]
                    .filter(t => !t.toLowerCase().includes('unfinish') && !t.toLowerCase().includes('semi') && t.toUpperCase() !== 'SF')
                    .map(t => (
                      <MenuItem key={t} value={t} sx={{ fontSize: '0.82rem' }}>{t}</MenuItem>
                    ))
                  }
                </Select>
              </FormControl>
            </Box>
          </Box>

          {/* Grid Section */}
          <TableContainer component={Paper} sx={{ mb: 2, maxHeight: '42vh', border: '1px solid #e0e0e0', boxShadow: 'none' }}>
            <Table stickyHeader size="small" sx={{ minWidth: 850 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: '25%' }}>Item</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Process</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Gross Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Net Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>10 Pcs Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Qty</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '7%', textAlign: 'center' }}>Unit</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Rate</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Amount</TableCell>
                  <TableCell sx={{ width: '4%' }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gridRows.map((row, index) => (
                  <TableRow key={index} sx={{ '& td': { py: 0.5, px: 1 } }}>
                    <TableCell>
                      <Autocomplete
                        options={getRowOutItemOptions(row.OUTITEMCODE, row.OUTSUBCODE)}
                        isOptionEqualToValue={(option, value) => option?.ItemCode === value?.ItemCode && (option?.SubCode || '') === (value?.SubCode || '')}
                        getOptionLabel={(option) => {
                          if (!option) return '';
                          const subStr = option.SubCode ? ` / ${option.SubCode}` : '';
                          const bal = getItemBalance(option.ItemCode, option.SubCode || '');
                          const u = (option.Unit || '').toUpperCase();
                          const isKg = u === 'KG' || u === 'KGS';
                          const balStr = isKg ? `${bal.wt.toFixed(3)} ${option.Unit || 'KG'}` : `${bal.qty.toFixed(2)} ${option.Unit || 'PCS'}`;
                          return `${option.ItemCode}${subStr} - ${option.ItemName} [Bal: ${balStr}]`;
                        }}
                        value={items.find(i => i.ItemCode === row.OUTITEMCODE && (i.SubCode || '') === (row.OUTSUBCODE || '')) || null}
                        onChange={(e, newValue) => handleItemSelect(index, newValue)}
                        renderInput={(params) => (
                          <TextField 
                            {...params} 
                            placeholder="Select Item" 
                            size="small" 
                          />
                        )}
                        fullWidth
                        slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%', maxWidth: 450 } } }}
                      />
                    </TableCell>
                    <TableCell><TextField size="small" placeholder="Process" value={row.PROCESS || ''} onChange={(e) => handleRowChange(index, 'PROCESS', e.target.value)} fullWidth /></TableCell>
                    <TableCell><TextField type="number" size="small" value={row.GROSSWT} onChange={(e) => handleRowChange(index, 'GROSSWT', e.target.value)} fullWidth /></TableCell>
                    <TableCell><TextField type="number" size="small" value={row.NETWT} onChange={(e) => handleRowChange(index, 'NETWT', e.target.value)} fullWidth /></TableCell>
                    <TableCell><TextField type="number" size="small" placeholder="10 Pcs Wt" value={row.TENPCSWT || ''} onChange={(e) => handleRowChange(index, 'TENPCSWT', e.target.value)} fullWidth inputProps={{ step: "any" }} /></TableCell>
                    <TableCell><TextField type="number" size="small" value={row.QUANTITY} onChange={(e) => handleRowChange(index, 'QUANTITY', e.target.value)} fullWidth /></TableCell>
                    <TableCell align="center">
                      <Chip label={row.UNIT || 'PCS'} size="small" sx={{ fontWeight: 600, bgcolor: '#f1f5f9' }} />
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
                    <Typography variant="subtitle1" fontWeight={700}>Total Processing Amount:</Typography>
                    <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                      ₹{calculateEstimatedTotalValue(gridRows).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>

        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, backgroundColor: '#fff', borderTop: '1px solid #e0e0e0', flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={handleCloseDialog} color="inherit" sx={{ order: { xs: 3, sm: 1 }, width: { xs: '100%', sm: 'auto' } }}>Cancel</Button>
          <Button onClick={() => handleSave(false)} disabled={editingId ? !hasEditPermission() : !hasAddPermission()} variant="contained" color="primary" size="medium" sx={{ px: 3, order: { xs: 1, sm: 2 }, flex: { xs: 1, sm: 'none' } }}>Save</Button>
          <Button onClick={() => handleSave(true)} disabled={editingId ? !hasEditPermission() : !hasAddPermission()} variant="contained" color="secondary" size="medium" startIcon={<PrintIcon />} sx={{ px: 3, order: { xs: 2, sm: 3 }, flex: { xs: 1, sm: 'none' } }}>Save & Print</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Confirm Deletion"
        itemName="this sub-contract in entry"
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
