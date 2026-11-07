import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Alert,
  Autocomplete, Grid, Divider, MenuItem, Select, FormControl, InputLabel, Checkbox, FormControlLabel, Chip, TableSortLabel,
  ToggleButtonGroup, ToggleButton
} from '@mui/material';
import { 
  Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Delete as DeleteIcon, 
  Input as InputIcon, Visibility as ViewIcon, Close as CloseIcon, AddCircle as AddCircleIcon,
  Description as DescriptionIcon, Print as PrintIcon, ReceiptLong, Receipt, MoneyOff 
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import PdfPreviewModal from '../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const emptyRow = {
  ITEMCODE: '',
  SUBCODE: '',
  GROSSWT: '',
  NETWT: '',
  TENPCSWT: '',
  QUANTITY: '',
  UNIT: '',
  RATE: '',
  DISCOUNT: '',
  AMOUNT: ''
};

const OutwardEntry = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParamOutwardNo = searchParams.get('outwardNo');

  const [outwards, setOutwards] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [dbUnits, setDbUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc'
  const [billFilter, setBillFilter] = useState('combined'); // 'combined', 'with_bill', 'without_bill'
  
  const todayDate = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(filterParamOutwardNo ? '' : todayDate);
  const [toDate, setToDate] = useState(filterParamOutwardNo ? '' : todayDate);
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  const [bill, setBill] = useState(true);
  const [outwardNo, setOutwardNo] = useState('');
  const [outwardDate, setOutwardDate] = useState(todayDate);
  const [ledgerId, setLedgerId] = useState(null);
  const [expense, setExpense] = useState('');
  const [cdPer, setCdPer] = useState('');
  const [cdAmount, setCdAmount] = useState('');
  const [sgst, setSgst] = useState('');
  const [cgst, setCgst] = useState('');
  const [igst, setIgst] = useState('');
  const [gstPer, setGstPer] = useState('');
  const [roundOff, setRoundOff] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [remark, setRemark] = useState('');
  
  const [gridRows, setGridRows] = useState([{ ...emptyRow }]);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [companyProfile, setCompanyProfile] = useState(null);

  const fetchOutwards = async () => {
    try {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/outwards${filterParamOutwardNo ? `?outwardNo=${encodeURIComponent(filterParamOutwardNo)}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setOutwards(data);
    } catch (error) {
      console.error('Error fetching outwards:', error);
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
    fetchOutwards();
    fetchLedgers();
    fetchItems();
    fetchUnits();
    fetchCompanyProfile();
  }, []);

  const calculateRowAmount = (row) => {
    const unit = row.UNIT ? row.UNIT.trim().toUpperCase() : '';
    const rate = parseFloat(row.RATE) || 0;
    const disc = parseFloat(row.DISCOUNT) || 0;
    let gross = 0;
    if (unit === 'KGS' || unit === 'KG') {
      const netwt = parseFloat(row.NETWT) || 0;
      gross = netwt * rate;
    } else {
      const qty = parseFloat(row.QUANTITY) || 0;
      gross = qty * rate;
    }
    const net = gross * (1 - (disc / 100));
    return net > 0 ? net.toFixed(2) : (gross > 0 ? '0.00' : '');
  };

  // Calculate totals whenever gridRows, expense, cdAmount, gstPer, or ledgerId changes
  useEffect(() => {
    const sumAmount = gridRows.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0);
    const exp = parseFloat(expense) || 0;
    const cdAmt = parseFloat(cdAmount) || 0;
    const taxable = Math.max(0, sumAmount - cdAmt + exp);
    
    let calcSgst = 0;
    let calcCgst = 0;
    let calcIgst = 0;
    let totalTax = 0;

    if (gstPer && parseFloat(gstPer) > 0) {
      const selectedLedger = ledgers.find(l => l.Id === ledgerId);
      const stateName = selectedLedger && selectedLedger.State ? selectedLedger.State.toUpperCase() : '';
      const gstRate = parseFloat(gstPer);
      
      if (stateName === 'GUJARAT') {
        calcSgst = taxable * ((gstRate / 2) / 100);
        calcCgst = taxable * ((gstRate / 2) / 100);
      } else {
        calcIgst = taxable * (gstRate / 100);
      }
      totalTax = calcSgst + calcCgst + calcIgst;
    }

    setSgst(calcSgst > 0 ? calcSgst.toFixed(2) : '');
    setCgst(calcCgst > 0 ? calcCgst.toFixed(2) : '');
    setIgst(calcIgst > 0 ? calcIgst.toFixed(2) : '');

    const totalBeforeRound = taxable + totalTax;
    const totalRounded = Math.round(totalBeforeRound);
    const roundOffDiff = (totalRounded - totalBeforeRound).toFixed(2);
    
    setRoundOff(roundOffDiff);
    setTotalAmount(totalRounded.toFixed(2));
  }, [gridRows, expense, cdAmount, gstPer, ledgerId, ledgers]);

  const handleCdPerChange = (val) => {
    setCdPer(val);
    const sumAmount = gridRows.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0);
    const pct = parseFloat(val) || 0;
    if (pct > 0 && sumAmount > 0) {
      setCdAmount((sumAmount * (pct / 100)).toFixed(2));
    } else {
      setCdAmount('');
    }
  };

  const handleCdAmountChange = (val) => {
    setCdAmount(val);
    const sumAmount = gridRows.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0);
    const amt = parseFloat(val) || 0;
    if (amt > 0 && sumAmount > 0) {
      setCdPer(((amt / sumAmount) * 100).toFixed(2));
    } else {
      setCdPer('');
    }
  };

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

  const filteredOutwards = outwards.filter(i => {
    if (filterParamOutwardNo) {
      return String(i.OUTWARDNO || '').trim().toLowerCase() === filterParamOutwardNo.trim().toLowerCase();
    }
    const matchesSearch = (i.LedgerName && i.LedgerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (i.OUTWARDNO && i.OUTWARDNO.toLowerCase().includes(searchTerm.toLowerCase()));
                          
    const dateStr = i.OUTWARDDATE ? i.OUTWARDDATE.split('T')[0] : '';
    let matchesDate = true;
    if (fromDate && dateStr < fromDate) matchesDate = false;
    if (toDate && dateStr > toDate) matchesDate = false;
    
    let matchesBill = true;
    if (billFilter === 'with_bill') matchesBill = (i.Bill !== false && i.Bill !== 0);
    else if (billFilter === 'without_bill') matchesBill = (i.Bill === false || i.Bill === 0);

    return matchesSearch && matchesDate && matchesBill;
  });

  const sortedOutwards = useMemo(() => {
    return [...filteredOutwards].sort((a, b) => {
      const numA = parseInt(a.OUTWARDNO, 10);
      const numB = parseInt(b.OUTWARDNO, 10);
      const isNumA = !isNaN(numA) && /^\d+$/.test(String(a.OUTWARDNO || '').trim());
      const isNumB = !isNaN(numB) && /^\d+$/.test(String(b.OUTWARDNO || '').trim());

      if (isNumA && isNumB) {
        return sortOrder === 'desc' ? numB - numA : numA - numB;
      }
      if (isNumA) return sortOrder === 'desc' ? -1 : 1;
      if (isNumB) return sortOrder === 'desc' ? 1 : -1;

      const comp = String(a.OUTWARDNO || '').localeCompare(String(b.OUTWARDNO || ''), undefined, { numeric: true });
      return sortOrder === 'desc' ? -comp : comp;
    });
  }, [filteredOutwards, sortOrder]);

  const generateNextOutwardNo = (currentOutwards) => {
    if (!currentOutwards || currentOutwards.length === 0) return '1';
    let maxNum = 0;
    for (const item of currentOutwards) {
      const val = (item.OUTWARDNO || '').trim();
      if (/^\d+$/.test(val)) {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    if (maxNum === 0) {
      for (const item of currentOutwards) {
        const val = (item.OUTWARDNO || '').trim();
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

  const handleBillChange = (e) => {
    const newBill = e.target.checked;
    setBill(newBill);
  };

  const handleOpenDialog = async () => {
    setDialogError('');
    setEditingId(null);

    // Immediately pre-fill auto-incremented outward no
    const nextNo = generateNextOutwardNo(outwards);
    setOutwardNo(nextNo);

    // Sync latest next number from server
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/outwards/next-no`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.nextNo) {
          setOutwardNo(String(data.nextNo));
        }
      }
    } catch (err) {
      console.error('Error fetching next outward no:', err);
    }

    setOutwardDate(new Date().toISOString().split('T')[0]);
    setLedgerId(null);
    setBill(true);
    setExpense('');
    setCdPer('');
    setCdAmount('');
    setSgst('');
    setCgst('');
    setIgst('');
    setGstPer('');
    setRoundOff('');
    setTotalAmount('');
    setRemark('');
    setGridRows([{ ...emptyRow }]);
    setOpenDialog(true);
  };

  const handleEditOutward = (outward) => {
    setDialogError('');
    setEditingId(outward.ID);
    setOutwardNo(outward.OUTWARDNO || '');
    setOutwardDate(outward.OUTWARDDATE ? outward.OUTWARDDATE.split('T')[0] : new Date().toISOString().split('T')[0]);
    setLedgerId(outward.LEDGERID);
    setBill(outward.Bill !== false);
    setExpense(outward.EXPENSE || '');
    setCdPer(outward.CDPER !== undefined && outward.CDPER !== null && outward.CDPER !== 0 ? String(outward.CDPER) : '');
    setCdAmount(outward.CDAMOUNT !== undefined && outward.CDAMOUNT !== null && outward.CDAMOUNT !== 0 ? String(outward.CDAMOUNT) : '');
    setSgst(outward.SGST || '');
    setCgst(outward.CGST || '');
    setIgst(outward.IGST || '');
    setGstPer(outward.GSTPER || '');
    setRoundOff(outward.ROUNDOFF || '');
    setTotalAmount(outward.TOTALAMOUNT || '');
    setRemark(outward.REMARK || '');
    
    if (outward.Details && outward.Details.length > 0) {
      setGridRows(outward.Details.map(d => ({
        ITEMCODE: d.ITEMCODE || '',
        SUBCODE: d.SUBCODE || '',
        GROSSWT: d.GROSSWT || '',
        NETWT: d.NETWT || '',
        TENPCSWT: d.TENPCSWT !== null && d.TENPCSWT !== undefined ? d.TENPCSWT.toString() : '',
        QUANTITY: d.QUANTITY || '',
        UNIT: d.UNIT || '',
        RATE: d.RATE || '',
        DISCOUNT: d.DISCOUNT !== undefined && d.DISCOUNT !== null && d.DISCOUNT !== 0 ? String(d.DISCOUNT) : '',
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
    
    // Auto calculate Quantity if 10 Pcs Wt or Net Wt changes
    if (field === 'TENPCSWT' || field === 'NETWT') {
      const netWt = parseFloat(newRows[index].NETWT);
      const tenPcsWt = parseFloat(newRows[index].TENPCSWT);
      if (netWt > 0 && tenPcsWt > 0) {
        const calculatedQty = Math.round((netWt / tenPcsWt) * 10);
        newRows[index].QUANTITY = String(calculatedQty);
      }
    }

    // Auto calculate Amount if Qty, NetWt, GrossWt, Rate, Unit, Discount or 10 Pcs Wt changes
    if (['QUANTITY', 'RATE', 'UNIT', 'NETWT', 'GROSSWT', 'DISCOUNT', 'TENPCSWT'].includes(field)) {
      newRows[index].AMOUNT = calculateRowAmount(newRows[index]);
    }
    
    setGridRows(newRows);
  };

  const handleItemSelect = (index, item) => {
    const newRows = [...gridRows];
    newRows[index].ITEMCODE = item ? item.ItemCode : '';
    newRows[index].SUBCODE = item ? (item.SubCode || '') : '';
    newRows[index].UNIT = item ? item.Unit : '';
    
    if (item && item.MRP !== undefined && item.MRP !== null) {
      newRows[index].RATE = item.MRP.toString();
    } else if (!item) {
      newRows[index].RATE = '';
    }
    
    // Default discount from selected customer if row discount is blank
    if (!newRows[index].DISCOUNT) {
      const selectedLedger = ledgers.find(l => l.Id === ledgerId);
      const defaultDisc = selectedLedger ? (selectedLedger.Discount || selectedLedger.Bill || '') : '';
      if (defaultDisc) newRows[index].DISCOUNT = String(defaultDisc);
    }
    
    newRows[index].AMOUNT = calculateRowAmount(newRows[index]);
    setGridRows(newRows);
  };

  const handleLedgerChange = (e, newValue) => {
    const newId = newValue ? newValue.Id : null;
    setLedgerId(newId);
    
    if (newValue) {
      // Pre-fill CD %
      if (newValue.CD !== undefined && newValue.CD !== null && newValue.CD !== '') {
        const cdVal = String(newValue.CD);
        setCdPer(cdVal);
        const sumAmount = gridRows.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0);
        const pct = parseFloat(cdVal) || 0;
        if (pct > 0 && sumAmount > 0) {
          setCdAmount((sumAmount * (pct / 100)).toFixed(2));
        }
      }
      // Pre-fill item discount on blank rows
      const custDisc = newValue.Discount || newValue.Bill || '';
      if (custDisc) {
        setGridRows(prev => prev.map(r => {
          if (!r.DISCOUNT || r.DISCOUNT === '0') {
            const updated = { ...r, DISCOUNT: String(custDisc) };
            return { ...updated, AMOUNT: calculateRowAmount(updated) };
          }
          return r;
        }));
      }
    }
  };

  const addGridRow = () => {
    const selectedLedger = ledgers.find(l => l.Id === ledgerId);
    const defaultDisc = selectedLedger ? (selectedLedger.Discount || selectedLedger.Bill || '') : '';
    setGridRows([...gridRows, { ...emptyRow, DISCOUNT: defaultDisc ? String(defaultDisc) : '' }]);
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

  const generatePDF = async (outward, ledgerObj, isSaveAction = false) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Company Header
    const compName = companyProfile ? companyProfile.CompanyName : 'FRM ERP';
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text(compName, 14, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    
    let currentHeaderY = 25;
    if (companyProfile) {
      const addr = [companyProfile.Address1, companyProfile.Address2].filter(Boolean).join(', ');
      const cityDetails = [companyProfile.City, companyProfile.StateName, companyProfile.Pincode].filter(Boolean).join(', ');
      
      if (addr) {
        doc.text(addr, 14, currentHeaderY);
        currentHeaderY += 4;
      }
      if (cityDetails) {
        doc.text(cityDetails, 14, currentHeaderY);
        currentHeaderY += 4;
      }
      
      const taxDetails = [];
      if (companyProfile.GSTIN) taxDetails.push(`GSTIN: ${companyProfile.GSTIN}`);
      if (companyProfile.PANNo) taxDetails.push(`PAN: ${companyProfile.PANNo}`);
      if (companyProfile.MobileNo) taxDetails.push(`Phone: ${companyProfile.MobileNo}`);
      
      if (taxDetails.length > 0) {
        doc.text(taxDetails.join(' | '), 14, currentHeaderY);
        currentHeaderY += 4;
      }
    } else {
      doc.text('Factory Site Address, City, State, ZIP', 14, 25);
      doc.text('GSTIN: 27AAAAA0000A1Z5 | Phone: +91 9876543210', 14, 29);
      currentHeaderY = 33;
    }

    // Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('SALES INVOICE', 196, 20, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    doc.text(`Invoice No: ${outward.OUTWARDNO}`, 196, 25, { align: 'right' });
    
    const dateVal = outward.OUTWARDDATE || new Date();
    const formattedDate = new Date(dateVal).toLocaleDateString('en-GB'); // DD/MM/YYYY
    doc.text(`Date: ${formattedDate}`, 196, 29, { align: 'right' });

    const dividerY = Math.max(currentHeaderY + 2, 33);
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, dividerY, 196, dividerY);

    // Customer Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('BILL TO', 14, dividerY + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(ledgerObj.LedgerName || 'Walk-in Customer', 14, dividerY + 12);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    let currentY = dividerY + 16;
    if (ledgerObj.Address) {
      doc.text(ledgerObj.Address, 14, currentY);
      currentY += 4;
    }
    const location = [ledgerObj.City, ledgerObj.State].filter(Boolean).join(', ');
    if (location) {
      doc.text(location, 14, currentY);
      currentY += 4;
    }
    if (ledgerObj.GSTIN) {
      doc.text(`GSTIN: ${ledgerObj.GSTIN}`, 14, currentY);
      currentY += 4;
    }
    if (ledgerObj.MobileNo) {
      doc.text(`Mobile: ${ledgerObj.MobileNo}`, 14, currentY);
      currentY += 4;
    }

    const tableStartY = Math.max(currentY + 5, dividerY + 35);

    // Table Column & Rows
    const tableColumn = ["Sr.", "Item Code & Name", "Gross Wt", "Net Wt", "Qty", "Unit", "Rate", "Discount", "Amount"];
    const detailsSource = isSaveAction ? outward.Details : (outward.Details || []);
    
    const tableRows = detailsSource.map((d, index) => {
      const matched = items.find(item => item.ItemCode === d.ITEMCODE && (item.SubCode || '') === (d.SUBCODE || ''));
      const itemName = d.ItemName || matched?.ItemName || '';
      const itemCodeDisplay = d.SUBCODE ? `${d.ITEMCODE} / ${d.SUBCODE}` : d.ITEMCODE;
      const discVal = parseFloat(d.DISCOUNT) || 0;
      return [
        index + 1,
        `${itemCodeDisplay} - ${itemName}`,
        (d.GROSSWT || 0).toFixed(3),
        (d.NETWT || 0).toFixed(3),
        (d.QUANTITY || 0).toFixed(2),
        d.UNIT || '-',
        (d.RATE || 0).toFixed(2),
        discVal > 0 ? `${discVal.toFixed(2)}%` : '-',
        (d.AMOUNT || 0).toFixed(2)
      ];
    });

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
        7: { halign: 'center' },
        8: { halign: 'right' }
      },
      margin: { top: tableStartY }
    });

    const finalY = doc.lastAutoTable.finalY + 8;
    const pageHeight = doc.internal.pageSize.height;

    // Check pagination room
    let checkY = finalY;
    if (checkY + 50 > pageHeight - 30) {
      doc.addPage();
      checkY = 20;
    }

    // Summary calculation
    const subTotal = detailsSource.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0);
    const exp = parseFloat(outward.EXPENSE) || 0;
    const cdP = parseFloat(outward.CDPER) || 0;
    const cdAmt = parseFloat(outward.CDAMOUNT) || (cdP > 0 ? (subTotal * cdP / 100) : 0);
    const taxableVal = Math.max(0, subTotal - cdAmt + exp);
    const sgstAmt = parseFloat(outward.SGST) || 0;
    const cgstAmt = parseFloat(outward.CGST) || 0;
    const igstAmt = parseFloat(outward.IGST) || 0;
    const roundOffDiff = parseFloat(outward.ROUNDOFF) || 0;
    const totalRounded = parseFloat(outward.TOTALAMOUNT) || 0;

    // Totals on the right
    let labelY = checkY;
    const drawTotalLine = (label, value, isBold = false) => {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(isBold ? 15 : 80);
      doc.text(label, 140, labelY, { align: 'right' });
      doc.text(value, 196, labelY, { align: 'right' });
      labelY += 5;
    };

    drawTotalLine('Sub Total:', subTotal.toFixed(2));
    if (cdAmt > 0) {
      const cdLabel = cdP > 0 ? `Cash Discount (-${cdP}%):` : 'Cash Discount:';
      drawTotalLine(cdLabel, `-${cdAmt.toFixed(2)}`);
    }
    if (exp > 0) drawTotalLine('Expense:', exp.toFixed(2));
    if (cdAmt > 0 || exp > 0) drawTotalLine('Taxable Value:', taxableVal.toFixed(2));
    if (sgstAmt > 0) drawTotalLine('SGST:', sgstAmt.toFixed(2));
    if (cgstAmt > 0) drawTotalLine('CGST:', cgstAmt.toFixed(2));
    if (igstAmt > 0) drawTotalLine('IGST:', igstAmt.toFixed(2));
    if (roundOffDiff !== 0) drawTotalLine('Round Off:', roundOffDiff.toFixed(2));
    labelY += 1;
    doc.line(120, labelY - 3, 196, labelY - 3);
    drawTotalLine('Grand Total:', totalRounded.toFixed(2), true);

    // Bank Details & UPI QR Code on the Left side
    let leftInfoY = checkY;
    if (companyProfile && (companyProfile.BankName || companyProfile.UPI)) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 59, 102);
      doc.text('PAYMENT DETAILS', 14, leftInfoY);
      leftInfoY += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(50);

      if (companyProfile.BankName) {
        doc.text(`Bank Name: ${companyProfile.BankName}`, 14, leftInfoY);
        leftInfoY += 4;
        doc.text(`A/c No: ${companyProfile.AccountNo || '-'}`, 14, leftInfoY);
        leftInfoY += 4;
        doc.text(`IFSC Code: ${companyProfile.IFSCCode || '-'}`, 14, leftInfoY);
        leftInfoY += 4;
        doc.text(`Branch: ${companyProfile.BranchName || '-'}`, 14, leftInfoY);
        leftInfoY += 5;
      }

      if (companyProfile.UPI) {
        doc.setFont('helvetica', 'bold');
        doc.text(`UPI ID: ${companyProfile.UPI}`, 14, leftInfoY);
        
        // QR Code generation
        const upiUrl = `upi://pay?pa=${companyProfile.UPI}&pn=${encodeURIComponent(compName)}&am=${totalRounded.toFixed(2)}&cu=INR`;
        const qrBase64 = await getQRBase64(upiUrl);
        if (qrBase64) {
          // Add QR Image to the left section
          // Let's place it at x = 75, y = checkY + 2
          doc.addImage(qrBase64, 'JPEG', 75, checkY + 2, 25, 25);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.text('Scan to Pay', 87.5, checkY + 29, { align: 'center' });
        }
      }
    }

    // Remarks
    const remarkY = Math.max(leftInfoY + 5, labelY + 2);
    if (outward.REMARK) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 59, 102);
      doc.text('Remarks / Terms:', 14, remarkY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50);
      const splitRemark = doc.splitTextToSize(outward.REMARK, 100);
      doc.text(splitRemark, 14, remarkY + 4);
    }

    // Signatures
    const finalPageHeight = doc.internal.pageSize.height;
    doc.line(14, finalPageHeight - 30, 70, finalPageHeight - 30);
    doc.text('Prepared By', 42, finalPageHeight - 25, { align: 'center' });

    doc.line(140, finalPageHeight - 30, 196, finalPageHeight - 30);
    doc.text('Authorized Signatory', 168, finalPageHeight - 25, { align: 'center' });

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
    if (!outwardNo || !ledgerId) {
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
      Bill: bill,
      OUTWARDNO: outwardNo,
      OUTWARDDATE: outwardDate,
      LEDGERID: ledgerId,
      EXPENSE: expense ? parseFloat(expense) : 0,
      CDPER: cdPer ? parseFloat(cdPer) : 0,
      CDAMOUNT: cdAmount ? parseFloat(cdAmount) : 0,
      SGST: sgst ? parseFloat(sgst) : 0,
      CGST: cgst ? parseFloat(cgst) : 0,
      IGST: igst ? parseFloat(igst) : 0,
      GSTPER: gstPer ? parseFloat(gstPer) : 0,
      ROUNDOFF: roundOff ? parseFloat(roundOff) : 0,
      TOTALAMOUNT: totalAmount ? parseFloat(totalAmount) : 0,
      REMARK: remark,
      CREATEDBY: username,
      UPDATEDBY: username,
      Details: validRows.map(r => ({
        ...r,
        SUBCODE: r.SUBCODE || '',
        GROSSWT: parseFloat(r.GROSSWT) || 0,
        NETWT: parseFloat(r.NETWT) || 0,
        TENPCSWT: r.TENPCSWT ? parseFloat(r.TENPCSWT) : null,
        QUANTITY: parseFloat(r.QUANTITY) || 0,
        RATE: parseFloat(r.RATE) || 0,
        DISCOUNT: parseFloat(r.DISCOUNT) || 0,
        AMOUNT: parseFloat(r.AMOUNT) || 0
      }))
    };

    try {
      const url = editingId 
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/outwards/${editingId}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/outwards`;
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        if (printAfterSave) {
          const ledgerObj = ledgers.find(l => l.Id === ledgerId) || {};
          generatePDF(payload, ledgerObj, true);
        }
        handleCloseDialog();
        fetchOutwards();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving outward');
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
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/outwards/${itemToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchOutwards();
          setDeleteConfirmOpen(false);
        }
      } catch (error) {
        console.error('Error deleting outward:', error);
      }
    }
  };

  const maxLedgerLength = ledgers.length > 0 ? Math.max(...ledgers.map(l => (l.LedgerName || '').length)) : 15;

  return (
    <Box>
      {/* Header Row */}
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', display: 'flex', alignItems: 'center', gap: 1 }}>
          <InputIcon /> Sales
        </Typography>
        <Button 
          variant="contained" 
          color="secondary" 
          startIcon={<AddIcon />} 
          onClick={handleOpenDialog} 
          disabled={!hasAddPermission()}
          sx={{ fontWeight: 600, px: 2.5, width: { xs: '100%', sm: 'auto' } }}
        >
          Add Sales
        </Button>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <Toolbar sx={{ pl: { xs: 1.5, sm: 2 }, pr: { xs: 1.5, sm: 2 }, display: 'flex', justifyContent: 'space-between', pt: 2, pb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', width: { xs: '100%', md: 'auto' } }}>
            <TextField
              size="small"
              placeholder="Search Sales..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
              sx={{ width: { xs: '100%', sm: 200 } }}
            />
            <TextField
              label="From Date"
              type="date"
              size="small"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { xs: 'calc(50% - 8px)', sm: 145 } }}
            />
            <TextField
              label="To Date"
              type="date"
              size="small"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { xs: 'calc(50% - 8px)', sm: 145 } }}
            />
            <Button size="small" onClick={() => { setFromDate(''); setToDate(''); }} sx={{ width: { xs: '100%', sm: 'auto' } }}>Clear Dates</Button>

            <ToggleButtonGroup
              value={billFilter}
              exclusive
              onChange={(e, nextMode) => { if (nextMode) setBillFilter(nextMode); }}
              size="small"
              sx={{ bgcolor: '#f8fafc', width: { xs: '100%', sm: 'auto' } }}
            >
              <ToggleButton value="combined" sx={{ flex: { xs: 1, sm: 'none' }, fontWeight: 600, textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem' }}>
                <ReceiptLong fontSize="small" sx={{ mr: 0.5 }} /> Combined
              </ToggleButton>
              <ToggleButton value="with_bill" sx={{ flex: { xs: 1, sm: 'none' }, fontWeight: 600, textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem' }}>
                <Receipt fontSize="small" color="primary" sx={{ mr: 0.5 }} /> With Bill
              </ToggleButton>
              <ToggleButton value="without_bill" sx={{ flex: { xs: 1, sm: 'none' }, fontWeight: 600, textTransform: 'none', px: 1.5, py: 0.5, fontSize: '0.8rem' }}>
                <MoneyOff fontSize="small" color="warning" sx={{ mr: 0.5 }} /> Without Bill
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Toolbar>

        {filterParamOutwardNo && (
          <Alert 
            severity="info" 
            action={
              <Button color="inherit" size="small" onClick={() => { setSearchParams({}); setFromDate(todayDate); setToDate(todayDate); fetchOutwards(); }}>
                Show All Sales
              </Button>
            }
            sx={{ mx: 2, mt: 2 }}
          >
            Viewing single Sales Voucher <strong>#{filterParamOutwardNo}</strong> opened from notification.
          </Alert>
        )}

        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 32 } }}>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={true}
                    direction={sortOrder}
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                  >
                    Outward No
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ledger</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Total Amount</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedOutwards.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <TableRow hover tabIndex={-1} key={`${row.ID}-${index}`}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                      {row.OUTWARDNO}
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
                  <TableCell>{row.OUTWARDDATE ? row.OUTWARDDATE.split('T')[0] : ''}</TableCell>
                  <TableCell>{row.LedgerName}</TableCell>
                  <TableCell>{row.TOTALAMOUNT}</TableCell>
                  <TableCell align="center">

                    <IconButton color="secondary" size="small" onClick={() => handlePrint(row)} title="Print Invoice">
                      <PrintIcon fontSize="small" />
                    </IconButton>
                    <IconButton color="primary" size="small" onClick={() => handleEditOutward(row)} disabled={!hasEditPermission()} title="Edit">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton color="error" size="small" onClick={() => openDeleteConfirm(row.ID)} disabled={!hasDeletePermission()} title="Delete">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {sortedOutwards.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>No outward entries found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredOutwards.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={(e, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#0F3B66', color: 'white', py: 2 }}>
          <Typography variant="h6">{editingId ? `Edit Sales ${outwardNo}` : 'Add Sales'}</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 2, backgroundColor: '#f8fafc' }}>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
          
          {/* Header Section */}
          <Paper sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0', boxShadow: 'none' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={3} md={1.5}>
                <FormControlLabel
                  control={<Checkbox checked={bill} onChange={handleBillChange} />}
                  label="Bill"
                />
              </Grid>
              <Grid item xs={12} sm={4.5} md={2.5}>
                <TextField fullWidth label="Outward No" size="small" value={outwardNo} onChange={(e) => setOutwardNo(e.target.value)} required />
              </Grid>
              <Grid item xs={12} sm={4.5} md={2.5}>
                <TextField fullWidth label="Date" type="date" size="small" value={outwardDate} onChange={(e) => setOutwardDate(e.target.value)} InputLabelProps={{ shrink: true }} required />
              </Grid>
              <Grid item xs={12} sm={12} md={5.5}>
                <Autocomplete
                  options={ledgers}
                  getOptionLabel={(option) => option.LedgerName || ''}
                  value={ledgers.find(l => l.Id === ledgerId) || null}
                  onChange={handleLedgerChange}
                  renderInput={(params) => <TextField {...params} label="Ledger" size="small" required fullWidth />}
                  fullWidth
                  slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Grid Section */}
          <TableContainer component={Paper} sx={{ mb: 2, maxHeight: '40vh', border: '1px solid #e0e0e0', boxShadow: 'none' }}>
            <Table stickyHeader size="small" sx={{ minWidth: 850 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: '23%' }}>Item</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Gross Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Net Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>10 Pcs Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '8%' }}>Qty</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '11%' }}>Unit</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Rate</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Discount (%)</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Amount</TableCell>
                  <TableCell sx={{ width: '3%' }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gridRows.map((row, index) => {
                  const selectedItem = items.find(i => i.ItemCode === row.ITEMCODE && (i.SubCode || '') === (row.SUBCODE || ''));
                  let warningMsg = null;
                  if (selectedItem && selectedItem.StdWeight) {
                    const netWt = parseFloat(row.NETWT) || 0;
                    const qty = parseFloat(row.QUANTITY) || 0;
                    if (qty > 0 && netWt > 0) {
                      const perPcsWeight = netWt / qty;
                      const stdWt = parseFloat(selectedItem.StdWeight);
                      if (perPcsWeight > stdWt) {
                         const diff = (perPcsWeight - stdWt).toFixed(3);
                         warningMsg = `+${diff} above std (${stdWt})`;
                      }
                    }
                  }
                  
                  return (
                    <TableRow key={index} sx={{ '& td': { py: 0.5, px: 1 } }}>
                      <TableCell>
                        <Autocomplete
                          options={items}
                          getOptionLabel={(option) => option ? `${option.ItemCode}${option.SubCode ? ` / ${option.SubCode}` : ''} - ${option.ItemName}` : ''}
                          value={selectedItem || null}
                          onChange={(e, newValue) => handleItemSelect(index, newValue)}
                          renderInput={(params) => <TextField {...params} placeholder="Select Item" size="small" />}
                          fullWidth
                          slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                        />
                      </TableCell>
                      <TableCell><TextField type="number" size="small" value={row.GROSSWT} onChange={(e) => handleRowChange(index, 'GROSSWT', e.target.value)} fullWidth /></TableCell>
                      <TableCell>
                        <TextField type="number" size="small" value={row.NETWT} onChange={(e) => handleRowChange(index, 'NETWT', e.target.value)} fullWidth />
                        {warningMsg && <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5, lineHeight: 1.1 }}>{warningMsg}</Typography>}
                      </TableCell>
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
                      <TableCell><TextField type="number" size="small" placeholder="0.00" value={row.DISCOUNT || ''} onChange={(e) => handleRowChange(index, 'DISCOUNT', e.target.value)} fullWidth inputProps={{ style: { textAlign: 'right' } }} /></TableCell>
                      <TableCell><TextField type="number" size="small" value={row.AMOUNT} onChange={(e) => handleRowChange(index, 'AMOUNT', e.target.value)} fullWidth InputProps={{ readOnly: true, sx: { bgcolor: '#f0f0f0' } }}/></TableCell>
                      <TableCell align="center">
                        <IconButton color="error" size="small" onClick={() => removeGridRow(index)} disabled={!hasDeletePermission() || gridRows.length === 1}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
                    <Typography variant="body2">Cash Disc (CD):</Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <TextField 
                        size="small" 
                        type="number" 
                        placeholder="%" 
                        value={cdPer} 
                        onChange={(e) => handleCdPerChange(e.target.value)} 
                        sx={{ width: '65px' }} 
                        inputProps={{ style: { textAlign: 'right' } }} 
                      />
                      <TextField 
                        size="small" 
                        type="number" 
                        placeholder="Amount" 
                        value={cdAmount} 
                        onChange={(e) => handleCdAmountChange(e.target.value)} 
                        sx={{ width: '95px' }} 
                        inputProps={{ style: { textAlign: 'right' } }} 
                      />
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">Expense:</Typography>
                    <TextField size="small" type="number" value={expense} onChange={(e) => setExpense(e.target.value)} sx={{ width: '100px' }} inputProps={{ style: { textAlign: 'right' } }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F3B66' }}>Taxable Value:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F3B66' }}>
                      {Math.max(0, gridRows.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0) - (parseFloat(cdAmount) || 0) + (parseFloat(expense) || 0)).toFixed(2)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">GST %:</Typography>
                    <TextField size="small" type="number" value={gstPer} onChange={(e) => setGstPer(e.target.value)} sx={{ width: '100px' }} inputProps={{ style: { textAlign: 'right' } }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">SGST:</Typography>
                    <Typography variant="body2">{sgst || '0.00'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">CGST:</Typography>
                    <Typography variant="body2">{cgst || '0.00'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">IGST:</Typography>
                    <Typography variant="body2">{igst || '0.00'}</Typography>
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
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, backgroundColor: '#fff', borderTop: '1px solid #e0e0e0', flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={handleCloseDialog} color="inherit" sx={{ order: { xs: 3, sm: 1 }, width: { xs: '100%', sm: 'auto' } }}>Cancel</Button>
          <Button onClick={() => handleSave(false)} disabled={editingId ? !hasEditPermission() : !hasAddPermission()} variant="contained" color="primary" size="medium" sx={{ px: 3, order: { xs: 1, sm: 2 }, flex: { xs: 1, sm: 'none' } }}>Save</Button>
          <Button onClick={() => handleSave(true)} disabled={editingId ? !hasEditPermission() : !hasAddPermission()} variant="contained" color="secondary" size="medium" startIcon={<PrintIcon />} sx={{ px: 3, order: { xs: 2, sm: 3 }, flex: { xs: 1, sm: 'none' } }}>Save & Print</Button>
        </DialogActions>
      </Dialog>

      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Confirm Deletion"
        itemName="this outward entry"
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

export default OutwardEntry;
