import React, { useState, useEffect, useMemo } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Autocomplete, Grid, Divider, Checkbox, FormControlLabel, TableSortLabel, Chip,
  ToggleButtonGroup, ToggleButton
} from '@mui/material';
import { 
  Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Delete as DeleteIcon, 
  Input as InputIcon, Visibility as ViewIcon, Close as CloseIcon, Description as DescriptionIcon, 
  Print as PrintIcon, ReceiptLong, Receipt, MoneyOff 
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
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc'
  const [billFilter, setBillFilter] = useState('combined'); // 'combined', 'with_bill', 'without_bill'
  
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
  const [bill, setBill] = useState(true);
  const [expense, setExpense] = useState('');
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

  // Calculate totals whenever gridRows, expense, gstPer, or ledgerId changes
  useEffect(() => {
    const sumAmount = gridRows.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0);
    const exp = parseFloat(expense) || 0;
    const taxable = sumAmount + exp;
    
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
  }, [gridRows, expense, gstPer, ledgerId, ledgers]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

  const filteredInwards = Inwards.filter(i => {
    const matchesSearch = (i.LedgerName && i.LedgerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (i.INWARDNO && i.INWARDNO.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (i.REMARK && i.REMARK.toLowerCase().includes(searchTerm.toLowerCase()));
                          
    const dateStr = i.INWARDDATE ? i.INWARDDATE.split('T')[0] : '';
    let matchesDate = true;
    if (fromDate && dateStr < fromDate) matchesDate = false;
    if (toDate && dateStr > toDate) matchesDate = false;
    
    let matchesBill = true;
    if (billFilter === 'with_bill') matchesBill = (i.Bill !== false && i.Bill !== 0);
    else if (billFilter === 'without_bill') matchesBill = (i.Bill === false || i.Bill === 0);

    return matchesSearch && matchesDate && matchesBill;
  });

  const sortedInwards = useMemo(() => {
    return [...filteredInwards].sort((a, b) => {
      const numA = parseInt(a.INWARDNO, 10);
      const numB = parseInt(b.INWARDNO, 10);
      const isNumA = !isNaN(numA) && /^\d+$/.test(String(a.INWARDNO || '').trim());
      const isNumB = !isNaN(numB) && /^\d+$/.test(String(b.INWARDNO || '').trim());

      if (isNumA && isNumB) {
        return sortOrder === 'desc' ? numB - numA : numA - numB;
      }
      if (isNumA) return sortOrder === 'desc' ? -1 : 1;
      if (isNumB) return sortOrder === 'desc' ? 1 : -1;

      const comp = String(a.INWARDNO || '').localeCompare(String(b.INWARDNO || ''), undefined, { numeric: true });
      return sortOrder === 'desc' ? -comp : comp;
    });
  }, [filteredInwards, sortOrder]);

  const generateNextInwardNo = (currentInwards) => {
    if (!currentInwards || currentInwards.length === 0) return '1';
    let maxNum = 0;
    for (const item of currentInwards) {
      const val = (item.INWARDNO || '').trim();
      if (/^\d+$/.test(val)) {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    if (maxNum === 0) {
      for (const item of currentInwards) {
        const val = (item.INWARDNO || '').trim();
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

    // Immediately pre-fill auto-incremented inward no
    const nextNo = generateNextInwardNo(Inwards);
    setInwardNo(nextNo);

    // Sync latest next number from server
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/Inwards/next-no`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.nextNo) {
          setInwardNo(String(data.nextNo));
        }
      }
    } catch (err) {
      console.error('Error fetching next inward no:', err);
    }

    setInwardDate(new Date().toISOString().split('T')[0]);
    setLedgerId(null);
    setBill(true);
    setExpense('');
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

  const handleEditInward = (Inward) => {
    setDialogError('');
    setEditingId(Inward.ID);
    setInwardNo(Inward.INWARDNO || '');
    setInwardDate(Inward.INWARDDATE ? Inward.INWARDDATE.split('T')[0] : new Date().toISOString().split('T')[0]);
    setLedgerId(Inward.LEDGERID);
    setBill(Inward.Bill !== false);
    setExpense(Inward.EXPENSE || '');
    setSgst(Inward.SGST || '');
    setCgst(Inward.CGST || '');
    setIgst(Inward.IGST || '');
    setGstPer(Inward.GSTPER || '');
    setRoundOff(Inward.ROUNDOFF || '');
    setTotalAmount(Inward.TOTALAMOUNT || '');
    setRemark(Inward.REMARK || '');
    
    if (Inward.Details && Inward.Details.length > 0) {
      setGridRows(Inward.Details.map(d => ({
        ITEMCODE: d.ITEMCODE || '',
        GROSSWT: d.GROSSWT || '',
        NETWT: d.NETWT || '',
        TENPCSWT: d.TENPCSWT !== null && d.TENPCSWT !== undefined ? d.TENPCSWT.toString() : '',
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

    // Auto calculate Amount if Qty, NetWt, Rate, Unit, GrossWt or 10 Pcs Wt changes
    if (['QUANTITY', 'RATE', 'UNIT', 'NETWT', 'GROSSWT', 'TENPCSWT'].includes(field)) {
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

    // Buyer Details (FRM/Company details)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('BUYER DETAILS', 14, dividerY + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    const compName = companyProfile ? companyProfile.CompanyName : 'FRM ERP';
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
    const gstPct = parseFloat(inward.GSTPER) || 0;
    const sgstAmt = parseFloat(inward.SGST) || 0;
    const cgstAmt = parseFloat(inward.CGST) || 0;
    const igstAmt = parseFloat(inward.IGST) || 0;
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
    if (sgstAmt > 0) drawTotalLine('SGST:', sgstAmt.toFixed(2));
    if (cgstAmt > 0) drawTotalLine('CGST:', cgstAmt.toFixed(2));
    if (igstAmt > 0) drawTotalLine('IGST:', igstAmt.toFixed(2));
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
    const trimmedNo = (InwardNo || '').trim();
    if (!trimmedNo || !ledgerId) {
      setDialogError('Inward No and Ledger are required.');
      return;
    }

    // Uniqueness validation
    const isDuplicate = Inwards.some(i => 
      i.INWARDNO && 
      i.INWARDNO.trim().toLowerCase() === trimmedNo.toLowerCase() && 
      i.ID !== editingId
    );
    if (isDuplicate) {
      setDialogError(`Inward No "${trimmedNo}" already exists. It must be unique.`);
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
      INWARDNO: trimmedNo,
      INWARDDATE: InwardDate,
      LEDGERID: ledgerId,
      Bill: bill ? 1 : 0,
      EXPENSE: expense ? parseFloat(expense) : 0,
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
        GROSSWT: parseFloat(r.GROSSWT) || 0,
        NETWT: parseFloat(r.NETWT) || 0,
        TENPCSWT: r.TENPCSWT ? parseFloat(r.TENPCSWT) : null,
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
      {/* Header Row */}
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', display: 'flex', alignItems: 'center', gap: 1 }}>
          <InputIcon /> Purchase
        </Typography>
        <Button 
          variant="contained" 
          color="secondary" 
          startIcon={<AddIcon />} 
          onClick={handleOpenDialog} 
          disabled={!hasAddPermission()}
          sx={{ fontWeight: 600, px: 2.5 }}
        >
          Add Purchase
        </Button>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, display: 'flex', justifyContent: 'space-between', pt: 2, pb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search Purchases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
              sx={{ width: '200px' }}
            />
            <TextField
              label="From Date"
              type="date"
              size="small"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: '145px' }}
            />
            <TextField
              label="To Date"
              type="date"
              size="small"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: '145px' }}
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
        </Toolbar>

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
                    Inward No
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ledger</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Total Amount</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Remark</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedInwards.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                <TableRow hover tabIndex={-1} key={`${row.ID}-${index}`}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                      {row.INWARDNO}
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
                  <TableCell>{row.INWARDDATE ? row.INWARDDATE.split('T')[0] : ''}</TableCell>
                  <TableCell>{row.LedgerName}</TableCell>
                  <TableCell>{row.TOTALAMOUNT}</TableCell>
                  <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.REMARK || ''}>
                    {row.REMARK || '-'}
                  </TableCell>
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
              {sortedInwards.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>No Inward entries found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={sortedInwards.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={(e, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#0F3B66', color: 'white', py: 2 }}>
          <Typography variant="h6">{editingId ? `Edit Purchase ${InwardNo}` : 'Add Purchase'}</Typography>
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
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Gross Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Net Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>10 Pcs Wt</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Qty</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '13%' }}>Unit</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '9%' }}>Rate</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Amount</TableCell>
                  <TableCell sx={{ width: '3%' }}></TableCell>
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
