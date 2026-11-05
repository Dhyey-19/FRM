import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Alert,
  Autocomplete, Grid, Divider, FormControl, InputLabel, Select, MenuItem, Chip
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  CompareArrows as TransferIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  Description as DescriptionIcon,
  Print as PrintIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import PdfPreviewModal from '../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const emptyItemRow = {
  ItemCode: '',
  Pcs: '',
  Weight: '',
  Unit: '',
  Rate: '',
  Amount: ''
};

const emptyRow = {
  OutItemCode: '',
  OutPcs: '',
  OutWeight: '',
  Unit: '',
  Rate: '',
  Amount: '',
  InItemCode: '',
  InPcs: '',
  InWeight: '',
  ScrapItemCode: '',
  ScrapPcs: '',
  ScrapWeight: '',
  LossWeight: '0.00',
  LossRate: '0.00',
  LossAmount: '0.00'
};

const StockTransfer = ({ user }) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [transfers, setTransfers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [items, setItems] = useState([]);
  const [dbUnits, setDbUnits] = useState([]);
  const [availableOutItems, setAvailableOutItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  
  const todayDate = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayDate);
  const [toDate, setToDate] = useState(todayDate);
  
  // Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add');
  const [dialogError, setDialogError] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  // Header Form States
  const [moveDate, setMoveDate] = useState(todayDate);
  const [fromDeptId, setFromDeptId] = useState(null);
  const [toDeptId, setToDeptId] = useState(null);
  const [manualChallanNo, setManualChallanNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [fromDeptFilter, setFromDeptFilter] = useState('');
  const [toDeptFilter, setToDeptFilter] = useState('');

  const fetchNextChallanNo = async (deptId) => {
    if (!deptId) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/stock-transfers/next-challan/${deptId}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.nextChallanNo) {
          setManualChallanNo(String(data.nextChallanNo));
        }
      }
    } catch (err) {
      console.error('Error fetching next challan no:', err);
    }
  };
  
  // Grid State
  const [outItems, setOutItems] = useState([{ ...emptyItemRow }]);
  const [inItems, setInItems] = useState([{ ...emptyItemRow }]);
  const [scrapItems, setScrapItems] = useState([]);
  const [lossWeight, setLossWeight] = useState('0.000');
  const [lossRate, setLossRate] = useState('0.00');
  const [lossAmount, setLossAmount] = useState('0.00');
  
  // Deletion States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [companyProfile, setCompanyProfile] = useState(null);

  const fetchTransfers = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/stock-transfers`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setTransfers(data);
    } catch (error) {
      console.error('Error fetching transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/departments`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setDepartments(data);
    } catch (error) {
      console.error('Error fetching departments:', error);
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
      if (response.ok) {
        const data = await response.json();
        setCompanyProfile(data);
      }
    } catch (error) {
      console.error('Error fetching company profile:', error);
    }
  };

  useEffect(() => {
    fetchTransfers();
    fetchDepartments();
    fetchItems();
    fetchUnits();
    fetchCompanyProfile();
  }, []);

  useEffect(() => {
    const fetchAvailableStock = async () => {
      if (!fromDeptId) {
        setAvailableOutItems([]);
        return;
      }
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/stock-transfers/available-stock/${fromDeptId}`);
        const data = await response.json();
        if (response.ok && Array.isArray(data)) {
          setAvailableOutItems(data);
        } else {
          setAvailableOutItems([]);
        }
      } catch (error) {
        console.error('Error fetching available stock:', error);
        setAvailableOutItems([]);
      }
    };
    fetchAvailableStock();
  }, [fromDeptId]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

  const filteredTransfers = transfers.filter(t => {
    const matchesSearch = 
      (t.ManualChallanNo && t.ManualChallanNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.TransferID && String(t.TransferID).toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.OutItemName && t.OutItemName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.InItemName && t.InItemName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.FromDeptName && t.FromDeptName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.ToDeptName && t.ToDeptName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.Remarks && t.Remarks.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const dateStr = t.MoveDate ? t.MoveDate.split('T')[0] : '';
    let matchesDate = true;
    if (fromDate && dateStr < fromDate) matchesDate = false;
    if (toDate && dateStr > toDate) matchesDate = false;

    let matchesFrom = true;
    if (fromDeptFilter && t.FromDeptID !== parseInt(fromDeptFilter, 10)) {
      matchesFrom = false;
    }

    let matchesTo = true;
    if (toDeptFilter && t.ToDeptID !== parseInt(toDeptFilter, 10)) {
      matchesTo = false;
    }
    
    return matchesSearch && matchesDate && matchesFrom && matchesTo;
  });

  const handleOpenDialog = () => {
    setDialogMode('add');
    setDialogError('');
    setEditingId(null);
    setMoveDate(todayDate);
    setFromDeptId(null);
    setToDeptId(null);
    setManualChallanNo('');
    setRemarks('');
    setOutItems([{ ...emptyItemRow }]);
    setInItems([{ ...emptyItemRow }]);
    setScrapItems([]);
    setLossWeight('0.000');
    setLossRate('0.00');
    setLossAmount('0.00');
    setOpenDialog(true);
  };

  const handleEditTransfer = (group) => {
    setDialogMode('edit');
    setDialogError('');
    setEditingId(group.TransferID);
    setMoveDate(group.MoveDate ? group.MoveDate.split('T')[0] : todayDate);
    // Because a group contains multiple details, we take Dept from the first detail row
    const firstDetail = group.details && group.details.length > 0 ? group.details[0] : group;
    setFromDeptId(firstDetail.FromDeptID || group.FromDeptID);
    setToDeptId(firstDetail.ToDeptID || group.ToDeptID);
    setManualChallanNo(firstDetail.ManualChallanNo || group.ManualChallanNo || '');
    setRemarks(firstDetail.Remarks || group.Remarks || '');
    
    const outs = [];
    const ins = [];
    const scraps = [];
    let totalLoss = 0;
    let savedLossRate = '0.00';
    let savedLossAmount = '0.00';

    const detailsArray = group.details || [group];
    detailsArray.forEach(d => {
      const fmtRate = d.Rate !== null && d.Rate !== undefined ? d.Rate.toString() : '';
      const fmtAmt = d.Amount !== null && d.Amount !== undefined ? d.Amount.toString() : '';

      if (d.OutItemCode) outs.push({ ItemCode: d.OutItemCode, Pcs: d.OutPcs !== null ? d.OutPcs.toString() : '', Weight: d.OutWeight !== null ? d.OutWeight.toString() : '', Unit: d.Unit || '', Rate: fmtRate, Amount: fmtAmt });
      if (d.InItemCode) ins.push({ ItemCode: d.InItemCode, Pcs: d.InPcs !== null ? d.InPcs.toString() : '', Weight: d.InWeight !== null ? d.InWeight.toString() : '', Unit: d.Unit || '', Rate: fmtRate, Amount: fmtAmt });
      if (d.ScrapItemCode) scraps.push({ ItemCode: d.ScrapItemCode, Pcs: d.ScrapPcs !== null ? d.ScrapPcs.toString() : '', Weight: d.ScrapWeight !== null ? d.ScrapWeight.toString() : '', Unit: d.Unit || '', Rate: fmtRate, Amount: fmtAmt });
      if (d.LossWeight) totalLoss += parseFloat(d.LossWeight) || 0;
      if (d.LossRate) savedLossRate = (parseFloat(d.LossRate) || 0).toFixed(2);
      if (d.LossAmount) savedLossAmount = (parseFloat(d.LossAmount) || 0).toFixed(2);
    });

    if (outs.length === 0) outs.push({ ...emptyItemRow });
    if (ins.length === 0) ins.push({ ...emptyItemRow });

    setOutItems(outs);
    setInItems(ins);
    setScrapItems(scraps);
    setLossWeight(totalLoss.toFixed(3));
    setLossRate(savedLossRate);
    setLossAmount(savedLossAmount);
    
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setDialogError('');
  };

  const getItemUnit = (itemCode) => {
    const found = availableOutItems.find(i => i.ItemCode === itemCode) || items.find(i => i.ItemCode === itemCode);
    return found ? found.Unit : '';
  };

  const calculateRowAmount = (row) => {
    const rate = parseFloat(row.Rate) || 0;
    const unit = (row.Unit || '').trim().toUpperCase();
    if (unit === 'KG' || unit === 'KGS') {
      const wt = parseFloat(row.Weight) || 0;
      return (wt * rate).toFixed(2);
    } else {
      const pcs = parseFloat(row.Pcs) || 0;
      return (pcs * rate).toFixed(2);
    }
  };

  useEffect(() => {
    const totalOut = outItems.reduce((sum, item) => sum + (parseFloat(item.Weight) || 0), 0);
    const totalIn = inItems.reduce((sum, item) => sum + (parseFloat(item.Weight) || 0), 0);
    const totalScrap = scrapItems.reduce((sum, item) => sum + (parseFloat(item.Weight) || 0), 0);
    const diff = totalOut - totalIn - totalScrap;
    const computedLossWt = Math.max(0, diff).toFixed(3);
    setLossWeight(computedLossWt);

    // If lossRate is 0 or empty, default it to the first Out item's Rate
    let currentLossRate = parseFloat(lossRate) || 0;
    if (currentLossRate === 0 && outItems.length > 0 && outItems[0].Rate) {
      currentLossRate = parseFloat(outItems[0].Rate) || 0;
      setLossRate(currentLossRate > 0 ? currentLossRate.toFixed(2) : '0.00');
    }
    const computedLossAmt = (parseFloat(computedLossWt) * currentLossRate).toFixed(2);
    setLossAmount(computedLossAmt);
  }, [outItems, inItems, scrapItems]);

  const handleLossRateChange = (val) => {
    setLossRate(val);
    const wt = parseFloat(lossWeight) || 0;
    const r = parseFloat(val) || 0;
    setLossAmount((wt * r).toFixed(2));
  };

  const handleArrayChange = (setter, itemsArray, index, field, value) => {
    const newArr = [...itemsArray];
    newArr[index][field] = value;
    if (['Pcs', 'Weight', 'Rate', 'Unit'].includes(field)) {
      newArr[index].Amount = calculateRowAmount(newArr[index]);
    }
    setter(newArr);
  };

  const handleArrayItemSelect = (setter, itemsArray, index, item) => {
    const newArr = [...itemsArray];
    newArr[index].ItemCode = item ? item.ItemCode : '';
    if (item && item.Unit && !newArr[index].Unit) {
      newArr[index].Unit = item.Unit;
    }
    if (item && item.Costing && (!newArr[index].Rate || newArr[index].Rate === '0' || newArr[index].Rate === '0.00')) {
      newArr[index].Rate = item.Costing.toString();
    }
    newArr[index].Amount = calculateRowAmount(newArr[index]);
    setter(newArr);
  };

  const addArrayRow = (setter, itemsArray) => setter([...itemsArray, { ...emptyItemRow }]);
  const removeArrayRow = (setter, itemsArray, index) => {
    if (itemsArray.length > 1 || setter === setScrapItems) {
      const newArr = [...itemsArray];
      newArr.splice(index, 1);
      setter(newArr);
    }
  };

  const handleSave = async (printAfter = false) => {
    if (!moveDate || !fromDeptId || !toDeptId) {
      setDialogError('Date, From Dept, and To Dept are required.');
      return;
    }

    if (fromDeptId === toDeptId) {
      setDialogError('Source and Destination Department cannot be the same.');
      return;
    }

    const validOuts = outItems.filter(r => r.ItemCode);
    const validIns = inItems.filter(r => r.ItemCode);
    const validScraps = scrapItems.filter(r => r.ItemCode);

    if (validOuts.length === 0) {
      setDialogError('Please fill in at least one Out Item.');
      return;
    }

    const payload = {
      MoveDate: moveDate,
      FromDeptID: fromDeptId,
      ToDeptID: toDeptId,
      ManualChallanNo: manualChallanNo,
      Remarks: remarks,
      CreatedBy: user?.username || 'Admin',
      UpdatedBy: user?.username || 'Admin',
      outItems: validOuts,
      inItems: validIns,
      scrapItems: validScraps,
      LossWeight: lossWeight,
      LossRate: lossRate,
      LossAmount: lossAmount
    };

    try {
      const url = dialogMode === 'edit'
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/stock-transfers/${editingId}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/stock-transfers`;
      
      const method = dialogMode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const returnedId = data.TransferID || data.id || editingId || 'NEW';

        if (printAfter) {
          const getOutName = code => availableOutItems.find(i => i.ItemCode === code)?.ItemName || items.find(i => i.ItemCode === code)?.ItemName || code;
          const getInName = code => items.find(i => i.ItemCode === code)?.ItemName || code;
          
          const detailsList = [];
          validOuts.forEach(r => detailsList.push({ OutItemCode: r.ItemCode, OutItemName: getOutName(r.ItemCode), OutPcs: r.Pcs, OutWeight: r.Weight, Unit: r.Unit, Rate: r.Rate, Amount: r.Amount }));
          validIns.forEach(r => detailsList.push({ InItemCode: r.ItemCode, InItemName: getInName(r.ItemCode), InPcs: r.Pcs, InWeight: r.Weight, Unit: r.Unit, Rate: r.Rate, Amount: r.Amount }));
          validScraps.forEach(r => detailsList.push({ ScrapItemCode: r.ItemCode, ScrapItemName: getInName(r.ItemCode), ScrapPcs: r.Pcs, ScrapWeight: r.Weight, Unit: r.Unit, Rate: r.Rate, Amount: r.Amount }));
          if (detailsList.length > 0) {
            detailsList[0].LossWeight = lossWeight;
            detailsList[0].LossRate = lossRate;
            detailsList[0].LossAmount = lossAmount;
          }

          const groupData = {
            TransferID: returnedId,
            ManualChallanNo: manualChallanNo,
            MoveDate: moveDate,
            FromDeptName: departments.find(d => d.DeptID === fromDeptId)?.DeptName || '',
            ToDeptName: departments.find(d => d.DeptID === toDeptId)?.DeptName || '',
            Remarks: remarks,
            details: detailsList
          };
          printVoucher(groupData);
        }

        handleCloseDialog();
        fetchTransfers();
      } else {
        const data = await response.json();
        setDialogError(data.message || 'Error saving transfer');
      }
    } catch (error) {
      console.error('Error during save:', error);
      setDialogError('Action failed. See console for details.');
    }
  };

  const printVoucher = (group) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;

    // Header
    const compName = companyProfile && companyProfile.CompanyName ? companyProfile.CompanyName : 'FRM ERP';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 59, 102);
    doc.text(compName, pageWidth / 2, yPos, { align: 'center' });
    
    if (companyProfile) {
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(50);
      const addressParts = [companyProfile.Address1, companyProfile.Address2, companyProfile.City, companyProfile.StateName, companyProfile.Pincode].filter(Boolean).join(', ');
      doc.text(addressParts, pageWidth / 2, yPos, { align: 'center' });
      
      if (companyProfile.PhoneNo) {
        yPos += 5;
        doc.text(`Phone: ${companyProfile.PhoneNo}`, pageWidth / 2, yPos, { align: 'center' });
      }
      if (companyProfile.GSTIN) {
        doc.setFont('helvetica', 'bold');
        doc.text(`GSTIN: ${companyProfile.GSTIN}`, 14, 20);
      }
    }

    yPos += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('STOCK TRANSFER VOUCHER', pageWidth / 2, yPos, { align: 'center' });

    yPos += 12;
    // Meta Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Transfer ID:', 14, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(group.TransferID?.toString() || 'N/A', 38, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('Challan No:', 75, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(group.ManualChallanNo ? group.ManualChallanNo.toString() : '-', 98, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('Date:', 145, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(group.MoveDate ? group.MoveDate.split('T')[0] : '', 158, yPos);

    yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('From Dept:', 14, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(group.FromDeptName || '', 38, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('To Dept:', 145, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(group.ToDeptName || '', 158, yPos);

    yPos += 10;

    // Table
    const tableCols = ['Type', 'Item Name', 'Pcs', 'Weight', 'Unit', 'Rate', 'Amount'];
    const tableRows = [];
    let totalOutPcs = 0, totalOutWt = 0, totalOutAmt = 0;
    let totalInPcs = 0, totalInWt = 0, totalInAmt = 0;
    let totalScrapPcs = 0, totalScrapWt = 0, totalScrapAmt = 0;
    let totalLossWt = 0, totalLossRt = 0, totalLossAmt = 0;

    group.details.forEach(d => {
      const rate = parseFloat(d.Rate) || 0;
      const amount = parseFloat(d.Amount) || 0;
      if (d.OutItemCode) {
        tableRows.push(['OUT', d.OutItemName || d.OutItemCode, d.OutPcs || '0', d.OutWeight || '0.00', d.Unit || '', rate > 0 ? rate.toFixed(2) : '', amount > 0 ? amount.toFixed(2) : '']);
        totalOutPcs += parseFloat(d.OutPcs) || 0;
        totalOutWt += parseFloat(d.OutWeight) || 0;
        totalOutAmt += amount;
      }
      if (d.InItemCode) {
        tableRows.push(['IN', d.InItemName || d.InItemCode, d.InPcs || '0', d.InWeight || '0.00', d.Unit || '', rate > 0 ? rate.toFixed(2) : '', amount > 0 ? amount.toFixed(2) : '']);
        totalInPcs += parseFloat(d.InPcs) || 0;
        totalInWt += parseFloat(d.InWeight) || 0;
        totalInAmt += amount;
      }
      if (d.ScrapItemCode) {
        tableRows.push(['SCRAP', d.ScrapItemName || d.ScrapItemCode, d.ScrapPcs || '0', d.ScrapWeight || '0.00', d.Unit || '', rate > 0 ? rate.toFixed(2) : '', amount > 0 ? amount.toFixed(2) : '']);
        totalScrapPcs += parseFloat(d.ScrapPcs) || 0;
        totalScrapWt += parseFloat(d.ScrapWeight) || 0;
        totalScrapAmt += amount;
      }
      if (d.LossWeight) {
        totalLossWt += parseFloat(d.LossWeight) || 0;
      }
      if (d.LossRate) {
        totalLossRt = parseFloat(d.LossRate) || 0;
      }
      if (d.LossAmount) {
        totalLossAmt += parseFloat(d.LossAmount) || 0;
      }
    });

    const fmt = (val) => (parseFloat(val) || 0).toFixed(2);
    
    // Add Summary Rows
    tableRows.push(['', '', '', '', '', '', '']); // empty separator
    tableRows.push(['TOTAL OUT', '', fmt(totalOutPcs), fmt(totalOutWt), '', '', fmt(totalOutAmt)]);
    tableRows.push(['TOTAL IN', '', fmt(totalInPcs), fmt(totalInWt), '', '', fmt(totalInAmt)]);
    tableRows.push(['TOTAL SCRAP', '', fmt(totalScrapPcs), fmt(totalScrapWt), '', '', fmt(totalScrapAmt)]);
    tableRows.push(['BATCH LOSS', '', '', fmt(totalLossWt), '', totalLossRt > 0 ? fmt(totalLossRt) : '', fmt(totalLossAmt)]);

    autoTable(doc, {
      startY: yPos,
      head: [tableCols],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 59, 102], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'right' }
      },
      willDrawCell: (data) => {
        if (data.row.index >= tableRows.length - 4) {
          doc.setFont('helvetica', 'bold');
          if (data.section === 'body') {
            doc.setFillColor(240, 240, 240);
          }
        }
      }
    });

    yPos = doc.lastAutoTable.finalY + 15;

    if (group.Remarks) {
      doc.setFont('helvetica', 'bold');
      doc.text('Remarks:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      const splitRemark = doc.splitTextToSize(group.Remarks, 180);
      doc.text(splitRemark, 35, yPos);
      yPos += (splitRemark.length * 5) + 10;
    }

    const pageHeight = doc.internal.pageSize.getHeight();
    const sigY = Math.max(yPos + 20, pageHeight - 30);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    
    doc.line(14, sigY, 60, sigY);
    doc.text('Issued By (From Dept)', 37, sigY + 5, { align: 'center' });

    doc.line(75, sigY, 125, sigY);
    doc.text('Received By (To Dept)', 100, sigY + 5, { align: 'center' });

    doc.line(140, sigY, 196, sigY);
    doc.text('Authorized Signatory', 168, sigY + 5, { align: 'center' });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const openDeleteConfirm = (id) => {
    setItemToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (itemToDelete) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/stock-transfers/${itemToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          fetchTransfers();
          setDeleteConfirmOpen(false);
        }
      } catch (error) {
        console.error('Error deleting transfer:', error);
      }
    }
  };

  const maxDeptLength = departments.length > 0 ? Math.max(...departments.map(d => (d.DeptName || '').length)) : 15;

  const unitOptions = dbUnits.length > 0 
    ? Array.from(new Set(['KGS', 'PCS', ...dbUnits.map(u => typeof u === 'string' ? u : u.Unit).filter(Boolean)]))
    : ['KGS', 'PCS', 'NOS', 'MTR', 'SET'];

  const groupedTransfers = {};
  filteredTransfers.forEach(transfer => {
    if (!groupedTransfers[transfer.TransferID]) {
      groupedTransfers[transfer.TransferID] = {
        TransferID: transfer.TransferID,
        MoveDate: transfer.MoveDate,
        FromDeptName: transfer.FromDeptName || 'Unknown',
        ToDeptName: transfer.ToDeptName || 'Unknown',
        FromDeptID: transfer.FromDeptID,
        ToDeptID: transfer.ToDeptID,
        ManualChallanNo: transfer.ManualChallanNo,
        Remarks: transfer.Remarks,
        details: []
      };
    }
    groupedTransfers[transfer.TransferID].details.push(transfer);
  });
  const groupedArray = Object.values(groupedTransfers);

  // Sort groupedArray so From & To departments are separated and grouped
  groupedArray.sort((a, b) => {
    const fromCompare = (a.FromDeptName || '').localeCompare(b.FromDeptName || '');
    if (fromCompare !== 0) return fromCompare;
    const toCompare = (a.ToDeptName || '').localeCompare(b.ToDeptName || '');
    if (toCompare !== 0) return toCompare;

    // Within same From and To department, sort by ManualChallanNo DESC (or MoveDate DESC)
    const numA = parseInt(a.ManualChallanNo, 10);
    const numB = parseInt(b.ManualChallanNo, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numB - numA;
    }
    const dateCompare = (b.MoveDate || '').localeCompare(a.MoveDate || '');
    if (dateCompare !== 0) return dateCompare;
    return (parseInt(b.TransferID, 10) || 0) - (parseInt(a.TransferID, 10) || 0);
  });

  // Calculate total counts per route
  const routeCounts = {};
  groupedArray.forEach(g => {
    const key = `${g.FromDeptID || 0}->${g.ToDeptID || 0}`;
    routeCounts[key] = (routeCounts[key] || 0) + 1;
  });

  const paginatedGroups = rowsPerPage > 0 
    ? groupedArray.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    : groupedArray;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TransferIcon /> Stock Transfer
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, display: 'flex', justifyContent: 'space-between', pt: 2, pb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search transfers or challan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
              sx={{ width: '210px' }}
            />
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="from-dept-filter-label">From Department</InputLabel>
              <Select
                labelId="from-dept-filter-label"
                value={fromDeptFilter}
                label="From Department"
                onChange={(e) => { setFromDeptFilter(e.target.value); setPage(0); }}
              >
                <MenuItem value=""><em>All From Departments</em></MenuItem>
                {departments.map(d => (
                  <MenuItem key={d.DeptID} value={d.DeptID}>{d.DeptName}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="to-dept-filter-label">To Department</InputLabel>
              <Select
                labelId="to-dept-filter-label"
                value={toDeptFilter}
                label="To Department"
                onChange={(e) => { setToDeptFilter(e.target.value); setPage(0); }}
              >
                <MenuItem value=""><em>All To Departments</em></MenuItem>
                {departments.map(d => (
                  <MenuItem key={d.DeptID} value={d.DeptID}>{d.DeptName}</MenuItem>
                ))}
              </Select>
            </FormControl>
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
            {(fromDate || toDate || fromDeptFilter || toDeptFilter || searchTerm) && (
              <Button size="small" onClick={() => { setFromDate(''); setToDate(''); setFromDeptFilter(''); setToDeptFilter(''); setSearchTerm(''); setPage(0); }}>Reset Filters</Button>
            )}
          </Box>
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleOpenDialog} disabled={!hasAddPermission()}>
            Add Transfer
          </Button>
        </Toolbar>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 1000 }}>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Item Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Pcs</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Weight</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Unit</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Rate</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedGroups.map((group, groupIdx) => {
                const currentRouteKey = `${group.FromDeptID || 0}->${group.ToDeptID || 0}`;
                const prevGroup = groupIdx > 0 ? paginatedGroups[groupIdx - 1] : null;
                const prevRouteKey = prevGroup ? `${prevGroup.FromDeptID || 0}->${prevGroup.ToDeptID || 0}` : null;
                const isNewRoute = currentRouteKey !== prevRouteKey;

                const batchLoss = group.details.reduce((sum, d) => sum + (parseFloat(d.LossWeight) || 0), 0);
                const firstDetail = group.details && group.details.length > 0 ? group.details[0] : group;
                const batchLossRt = parseFloat(firstDetail.LossRate) || 0;
                const batchLossAmt = parseFloat(firstDetail.LossAmount) || 0;
                return (
                <React.Fragment key={group.TransferID}>
                  {isNewRoute && (
                    <TableRow sx={{ backgroundColor: '#0f3b66' }}>
                      <TableCell colSpan={7} sx={{ py: 1.2, px: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                            <Chip label="FROM" size="small" sx={{ bgcolor: '#38bdf8', color: '#0f172a', fontWeight: 800, fontSize: '0.72rem', height: 22 }} />
                            <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem' }}>{group.FromDeptName}</Typography>
                            <ArrowForwardIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                            <Chip label="TO" size="small" sx={{ bgcolor: '#4ade80', color: '#0f172a', fontWeight: 800, fontSize: '0.72rem', height: 22 }} />
                            <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem' }}>{group.ToDeptName}</Typography>
                          </Box>
                          <Chip 
                            label={`${routeCounts[currentRouteKey] || 0} Transfers`} 
                            size="small" 
                            sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#ffffff', fontWeight: 700, fontSize: '0.75rem' }} 
                          />
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow sx={{ backgroundColor: '#e0f2fe' }}>
                    <TableCell colSpan={7} sx={{ py: 1.2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Chip 
                            label={`Challan: ${group.ManualChallanNo || '-'}`} 
                            size="small" 
                            sx={{ 
                              fontWeight: 800, 
                              bgcolor: '#0284c7', 
                              color: '#ffffff', 
                              fontSize: '0.8rem',
                              letterSpacing: '0.3px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }} 
                          />
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0369a1' }}>
                            Transfer ID: {group.TransferID}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#0369a1' }}>
                            <strong>Date:</strong> {group.MoveDate ? group.MoveDate.split('T')[0] : ''}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#0369a1' }}>
                            <strong>From Dept:</strong> <span style={{ fontWeight: 600 }}>{group.FromDeptName}</span>
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#0369a1' }}>
                            <strong>To Dept:</strong> <span style={{ fontWeight: 600 }}>{group.ToDeptName}</span>
                          </Typography>
                          {group.Remarks && (
                            <Typography variant="body2" sx={{ color: '#475569', fontStyle: 'italic' }}>
                              <strong>Remarks:</strong> {group.Remarks}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton color="secondary" size="small" onClick={() => printVoucher(group)} title="Print Voucher">
                            <PrintIcon fontSize="small" />
                          </IconButton>
                          <IconButton color="primary" size="small" onClick={() => handleEditTransfer(group)} disabled={!hasEditPermission()} title="Edit">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton color="error" size="small" onClick={() => openDeleteConfirm(group.TransferID)} disabled={!hasDeletePermission()} title="Delete">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </TableCell>
                  </TableRow>
                  {group.details.map((row, idx) => (
                    <React.Fragment key={row.MoveID || idx}>
                      {row.OutItemCode && (
                        <TableRow hover sx={{ '& td': { borderBottom: '1px solid #f1f5f9' } }}>
                          <TableCell sx={{ color: '#d32f2f', fontWeight: 'bold' }}>OUT</TableCell>
                          <TableCell>{row.OutItemName || row.OutItemCode}</TableCell>
                          <TableCell align="right">{row.OutPcs || 0}</TableCell>
                          <TableCell align="right">{row.OutWeight || 0}</TableCell>
                          <TableCell align="center">{row.Unit || '-'}</TableCell>
                          <TableCell align="right">{row.Rate ? parseFloat(row.Rate).toFixed(2) : '-'}</TableCell>
                          <TableCell align="right">{row.Amount ? parseFloat(row.Amount).toFixed(2) : '-'}</TableCell>
                        </TableRow>
                      )}
                      {row.InItemCode && (
                        <TableRow hover sx={{ '& td': { borderBottom: '1px solid #f1f5f9' } }}>
                          <TableCell sx={{ color: '#2e7d32', fontWeight: 'bold' }}>IN</TableCell>
                          <TableCell>{row.InItemName || row.InItemCode}</TableCell>
                          <TableCell align="right">{row.InPcs || 0}</TableCell>
                          <TableCell align="right">{row.InWeight || 0}</TableCell>
                          <TableCell align="center">{row.Unit || '-'}</TableCell>
                          <TableCell align="right">{row.Rate ? parseFloat(row.Rate).toFixed(2) : '-'}</TableCell>
                          <TableCell align="right">{row.Amount ? parseFloat(row.Amount).toFixed(2) : '-'}</TableCell>
                        </TableRow>
                      )}
                      {row.ScrapItemCode && (
                        <TableRow hover sx={{ '& td': { borderBottom: '1px solid #f1f5f9' } }}>
                          <TableCell sx={{ color: '#ed6c02', fontWeight: 'bold' }}>SCRAP</TableCell>
                          <TableCell>{row.ScrapItemName || row.ScrapItemCode}</TableCell>
                          <TableCell align="right">{row.ScrapPcs || 0}</TableCell>
                          <TableCell align="right">{row.ScrapWeight || 0}</TableCell>
                          <TableCell align="center">{row.Unit || '-'}</TableCell>
                          <TableCell align="right">{row.Rate ? parseFloat(row.Rate).toFixed(2) : '-'}</TableCell>
                          <TableCell align="right">{row.Amount ? parseFloat(row.Amount).toFixed(2) : '-'}</TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                  <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                    <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold', color: '#0f172a' }}>Batch Loss:</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#0f172a' }}>{batchLoss.toFixed(3)} Wt</TableCell>
                    <TableCell align="center">KGS</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#0f172a' }}>{batchLossRt > 0 ? `@ ₹${batchLossRt.toFixed(2)}` : '-'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>{batchLossAmt > 0 ? `₹${batchLossAmt.toFixed(2)}` : '-'}</TableCell>
                  </TableRow>
                </React.Fragment>
              )})}
              {groupedArray.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>No stock transfers found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100, 200, { label: 'All', value: -1 }]}
          component="div"
          count={groupedArray.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={(e, reason) => { if (reason !== 'backdropClick') handleCloseDialog(); }} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#0F3B66', color: 'white', py: 2 }}>
          <Typography variant="h6">{dialogMode === 'edit' ? `Edit Stock Transfer` : 'Add Stock Transfer'}</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 2, backgroundColor: '#f8fafc' }}>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
          
          {/* Header Section */}
          <Paper sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0', boxShadow: 'none' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="Manual Challan No"
                  placeholder="e.g. 2301"
                  size="small"
                  value={manualChallanNo}
                  onChange={(e) => setManualChallanNo(e.target.value)}
                  helperText={fromDeptId ? "Dept Wise Challan No (Editable)" : "Auto / Manual"}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth label="Transfer Date" type="date" size="small" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} InputLabelProps={{ shrink: true }} required />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Autocomplete
                  options={departments.filter(d => d.DeptID !== toDeptId)}
                  disabled={dialogMode === 'edit'}
                  getOptionLabel={(option) => option.DeptName || ''}
                  value={departments.find(d => d.DeptID === fromDeptId) || null}
                  onChange={(e, newValue) => {
                    const newId = newValue ? newValue.DeptID : null;
                    if (newId !== fromDeptId) {
                      setFromDeptId(newId);
                      if (dialogMode === 'add') {
                        if (newId) fetchNextChallanNo(newId);
                        // Clean/reset form data when department changes before save
                        setOutItems([{ ...emptyItemRow }]);
                        setInItems([{ ...emptyItemRow }]);
                        setScrapItems([]);
                        setRemarks('');
                      }
                    }
                  }}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="From Department" 
                      size="small" 
                      required 
                      fullWidth 
                      helperText={dialogMode === 'edit' ? "Cannot change dept in edit mode" : ""}
                    />
                  )}
                  fullWidth
                  sx={{ minWidth: `${Math.max(20, maxDeptLength) + 6}ch` }}
                  slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Autocomplete
                  options={departments.filter(d => d.DeptID !== fromDeptId)}
                  disabled={dialogMode === 'edit'}
                  getOptionLabel={(option) => option.DeptName || ''}
                  value={departments.find(d => d.DeptID === toDeptId) || null}
                  onChange={(e, newValue) => {
                    const newId = newValue ? newValue.DeptID : null;
                    if (newId !== toDeptId) {
                      setToDeptId(newId);
                      if (dialogMode === 'add') {
                        setInItems([{ ...emptyItemRow }]);
                      }
                    }
                  }}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="To Department" 
                      size="small" 
                      required 
                      fullWidth 
                      helperText={dialogMode === 'edit' ? "Cannot change dept in edit mode" : ""}
                    />
                  )}
                  fullWidth
                  sx={{ minWidth: `${Math.max(20, maxDeptLength) + 6}ch` }}
                  slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Grid Section */}
          <TableContainer component={Paper} sx={{ mb: 2, maxHeight: '50vh', border: '1px solid #e0e0e0', boxShadow: 'none' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 65 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 220 }}>Item</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 120 }}>Pcs</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 135 }}>Weight</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 105 }}>Unit</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 135 }}>Rate</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 145 }}>Amount</TableCell>
                  <TableCell sx={{ width: 45 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* OUT ITEMS */}
                {outItems.map((row, index) => (
                  <TableRow key={`out-${index}`} sx={{ '& td': { py: 0.5, px: 0.5, borderBottom: '1px solid #f1f5f9' } }}>
                    <TableCell align="center" sx={{ fontWeight: 600, color: '#d32f2f', bgcolor: '#fce4e4' }}>OUT</TableCell>
                    <TableCell sx={{ width: 220, maxWidth: 240 }}>
                      <Autocomplete
                        options={availableOutItems}
                        isOptionEqualToValue={(option, value) => option.ItemCode === value.ItemCode}
                        getOptionLabel={(option) => option ? `${option.ItemCode} - ${option.ItemName} (${option.Pcs || 0} Pcs | ${option.Weight || 0} Wt)` : ''}
                        value={availableOutItems.find(i => i.ItemCode === row.ItemCode) || items.find(i => i.ItemCode === row.ItemCode) || null}
                        onChange={(e, newValue) => handleArrayItemSelect(setOutItems, outItems, index, newValue)}
                        renderInput={(params) => <TextField {...params} placeholder="Out Item" size="small" />}
                        fullWidth
                        slotProps={{ paper: { sx: { minWidth: '100%', maxWidth: 350 } } }}
                      />
                    </TableCell>
                    <TableCell sx={{ width: 120 }}><TextField type="number" size="small" value={row.Pcs} onChange={(e) => handleArrayChange(setOutItems, outItems, index, 'Pcs', e.target.value)} inputProps={{ style: { textAlign: 'right' } }} fullWidth /></TableCell>
                    <TableCell sx={{ width: 135 }}><TextField type="number" size="small" value={row.Weight} onChange={(e) => handleArrayChange(setOutItems, outItems, index, 'Weight', e.target.value)} inputProps={{ style: { textAlign: 'right' } }} fullWidth /></TableCell>
                    <TableCell sx={{ width: 105 }}>
                      <Autocomplete
                        options={unitOptions}
                        freeSolo
                        value={row.Unit || ''}
                        onChange={(e, newValue) => handleArrayChange(setOutItems, outItems, index, 'Unit', newValue || '')}
                        onInputChange={(e, newInputValue) => {
                          if (e && e.type === 'change') {
                            handleArrayChange(setOutItems, outItems, index, 'Unit', newInputValue);
                          }
                        }}
                        renderInput={(params) => <TextField {...params} placeholder="Unit" size="small" />}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell sx={{ width: 135 }}><TextField type="number" size="small" value={row.Rate} onChange={(e) => handleArrayChange(setOutItems, outItems, index, 'Rate', e.target.value)} placeholder="0.00" inputProps={{ style: { textAlign: 'right' } }} fullWidth /></TableCell>
                    <TableCell sx={{ width: 145 }}><TextField type="number" size="small" value={row.Amount} onChange={(e) => handleArrayChange(setOutItems, outItems, index, 'Amount', e.target.value)} placeholder="0.00" inputProps={{ style: { textAlign: 'right' } }} InputProps={{ readOnly: true, sx: { bgcolor: '#f8fafc', fontWeight: 600 } }} fullWidth /></TableCell>
                    <TableCell align="center" sx={{ width: 45 }}>
                      <IconButton color="error" size="small" onClick={() => removeArrayRow(setOutItems, outItems, index)} disabled={!hasDeletePermission() || outItems.length === 1}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 1, borderBottom: '2px solid #e0e0e0' }}>
                    <Button size="small" color="error" onClick={() => addArrayRow(setOutItems, outItems)}>+ Add Out Row</Button>
                  </TableCell>
                </TableRow>

                {/* IN ITEMS */}
                {inItems.map((row, index) => (
                  <TableRow key={`in-${index}`} sx={{ '& td': { py: 0.5, px: 0.5, borderBottom: '1px solid #f1f5f9' } }}>
                    <TableCell align="center" sx={{ fontWeight: 600, color: '#2e7d32', bgcolor: '#e8f5e9' }}>IN</TableCell>
                    <TableCell sx={{ width: 220, maxWidth: 240 }}>
                      <Autocomplete
                        options={items}
                        getOptionLabel={(option) => option ? `${option.ItemCode} - ${option.ItemName}` : ''}
                        value={items.find(i => i.ItemCode === row.ItemCode) || null}
                        onChange={(e, newValue) => handleArrayItemSelect(setInItems, inItems, index, newValue)}
                        renderInput={(params) => <TextField {...params} placeholder="In Item" size="small" />}
                        fullWidth
                        slotProps={{ paper: { sx: { minWidth: '100%', maxWidth: 350 } } }}
                      />
                    </TableCell>
                    <TableCell sx={{ width: 120 }}><TextField type="number" size="small" value={row.Pcs} onChange={(e) => handleArrayChange(setInItems, inItems, index, 'Pcs', e.target.value)} inputProps={{ style: { textAlign: 'right' } }} fullWidth /></TableCell>
                    <TableCell sx={{ width: 135 }}><TextField type="number" size="small" value={row.Weight} onChange={(e) => handleArrayChange(setInItems, inItems, index, 'Weight', e.target.value)} inputProps={{ style: { textAlign: 'right' } }} fullWidth /></TableCell>
                    <TableCell sx={{ width: 105 }}>
                      <Autocomplete
                        options={unitOptions}
                        freeSolo
                        value={row.Unit || ''}
                        onChange={(e, newValue) => handleArrayChange(setInItems, inItems, index, 'Unit', newValue || '')}
                        onInputChange={(e, newInputValue) => {
                          if (e && e.type === 'change') {
                            handleArrayChange(setInItems, inItems, index, 'Unit', newInputValue);
                          }
                        }}
                        renderInput={(params) => <TextField {...params} placeholder="Unit" size="small" />}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell sx={{ width: 135 }}><TextField type="number" size="small" value={row.Rate} onChange={(e) => handleArrayChange(setInItems, inItems, index, 'Rate', e.target.value)} placeholder="0.00" inputProps={{ style: { textAlign: 'right' } }} fullWidth /></TableCell>
                    <TableCell sx={{ width: 145 }}><TextField type="number" size="small" value={row.Amount} onChange={(e) => handleArrayChange(setInItems, inItems, index, 'Amount', e.target.value)} placeholder="0.00" inputProps={{ style: { textAlign: 'right' } }} InputProps={{ readOnly: true, sx: { bgcolor: '#f8fafc', fontWeight: 600 } }} fullWidth /></TableCell>
                    <TableCell align="center" sx={{ width: 45 }}>
                      <IconButton color="error" size="small" onClick={() => removeArrayRow(setInItems, inItems, index)} disabled={!hasDeletePermission() || inItems.length === 1}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 1, borderBottom: '2px solid #e0e0e0' }}>
                    <Button size="small" color="success" onClick={() => addArrayRow(setInItems, inItems)}>+ Add In Row</Button>
                  </TableCell>
                </TableRow>

                {/* SCRAP ITEMS */}
                {scrapItems.map((row, index) => (
                  <TableRow key={`scrap-${index}`} sx={{ '& td': { py: 0.5, px: 0.5, borderBottom: '1px solid #f1f5f9' } }}>
                    <TableCell align="center" sx={{ fontWeight: 600, color: '#ed6c02', bgcolor: '#fff3e0' }}>SCRAP</TableCell>
                    <TableCell sx={{ width: 220, maxWidth: 240 }}>
                      <Autocomplete
                        options={items.filter(i => i.ItemType && i.ItemType.toLowerCase() === 'scrap')}
                        getOptionLabel={(option) => option ? `${option.ItemCode} - ${option.ItemName}` : ''}
                        value={items.find(i => i.ItemCode === row.ItemCode) || null}
                        onChange={(e, newValue) => handleArrayItemSelect(setScrapItems, scrapItems, index, newValue)}
                        renderInput={(params) => <TextField {...params} placeholder="Scrap Item" size="small" />}
                        fullWidth
                        slotProps={{ paper: { sx: { minWidth: '100%', maxWidth: 350 } } }}
                      />
                    </TableCell>
                    <TableCell sx={{ width: 120 }}><TextField type="number" size="small" value={row.Pcs} onChange={(e) => handleArrayChange(setScrapItems, scrapItems, index, 'Pcs', e.target.value)} inputProps={{ style: { textAlign: 'right' } }} fullWidth /></TableCell>
                    <TableCell sx={{ width: 135 }}><TextField type="number" size="small" value={row.Weight} onChange={(e) => handleArrayChange(setScrapItems, scrapItems, index, 'Weight', e.target.value)} inputProps={{ style: { textAlign: 'right' } }} fullWidth /></TableCell>
                    <TableCell sx={{ width: 105 }}>
                      <Autocomplete
                        options={unitOptions}
                        freeSolo
                        value={row.Unit || ''}
                        onChange={(e, newValue) => handleArrayChange(setScrapItems, scrapItems, index, 'Unit', newValue || '')}
                        onInputChange={(e, newInputValue) => {
                          if (e && e.type === 'change') {
                            handleArrayChange(setScrapItems, scrapItems, index, 'Unit', newInputValue);
                          }
                        }}
                        renderInput={(params) => <TextField {...params} placeholder="Unit" size="small" />}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell sx={{ width: 135 }}><TextField type="number" size="small" value={row.Rate} onChange={(e) => handleArrayChange(setScrapItems, scrapItems, index, 'Rate', e.target.value)} placeholder="0.00" inputProps={{ style: { textAlign: 'right' } }} fullWidth /></TableCell>
                    <TableCell sx={{ width: 145 }}><TextField type="number" size="small" value={row.Amount} onChange={(e) => handleArrayChange(setScrapItems, scrapItems, index, 'Amount', e.target.value)} placeholder="0.00" inputProps={{ style: { textAlign: 'right' } }} InputProps={{ readOnly: true, sx: { bgcolor: '#f8fafc', fontWeight: 600 } }} fullWidth /></TableCell>
                    <TableCell align="center" sx={{ width: 45 }}>
                      <IconButton color="error" size="small" onClick={() => removeArrayRow(setScrapItems, scrapItems, index)} disabled={!hasDeletePermission()}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 1, borderBottom: '2px solid #e0e0e0' }}>
                    <Button size="small" color="warning" onClick={() => addArrayRow(setScrapItems, scrapItems)}>+ Add Scrap Row</Button>
                  </TableCell>
                </TableRow>

                {/* LOSS WEIGHT & AMOUNT SUM */}
                <TableRow sx={{ backgroundColor: '#f0f0f0' }}>
                  <TableCell colSpan={2} align="right" sx={{ fontWeight: 'bold' }}>Batch Loss:</TableCell>
                  <TableCell></TableCell>
                  <TableCell sx={{ width: 135 }}>
                    <TextField label="Loss Wt" type="number" size="small" value={lossWeight} InputProps={{ readOnly: true, sx: { fontWeight: 'bold', bgcolor: '#fff' } }} inputProps={{ style: { textAlign: 'right' } }} fullWidth />
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary', width: 105 }}>KGS</TableCell>
                  <TableCell sx={{ width: 135 }}>
                    <TextField label="Loss Rate" type="number" size="small" value={lossRate} onChange={(e) => handleLossRateChange(e.target.value)} sx={{ bgcolor: '#fff' }} inputProps={{ style: { textAlign: 'right' } }} fullWidth />
                  </TableCell>
                  <TableCell sx={{ width: 145 }}>
                    <TextField label="Loss Amount" type="number" size="small" value={lossAmount} InputProps={{ readOnly: true, sx: { fontWeight: 'bold', bgcolor: '#fff', color: '#d32f2f' } }} inputProps={{ style: { textAlign: 'right' } }} fullWidth />
                  </TableCell>
                  <TableCell sx={{ width: 45 }}></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {/* Footer Section */}
          <Paper sx={{ p: 2, border: '1px solid #e0e0e0', boxShadow: 'none' }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField fullWidth label="Remarks (applies to all rows)" size="small" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </Grid>
            </Grid>
          </Paper>

        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, backgroundColor: '#fff', borderTop: '1px solid #e0e0e0' }}>
          <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
          <Button onClick={() => handleSave(true)} disabled={dialogMode === 'edit' ? !hasEditPermission() : !hasAddPermission()} variant="outlined" color="primary" sx={{ px: 2 }} startIcon={<PrintIcon />}>Save & Print</Button>
          <Button onClick={() => handleSave(false)} disabled={dialogMode === 'edit' ? !hasEditPermission() : !hasAddPermission()} variant="contained" color="primary" size="large" sx={{ px: 3 }}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Confirm Deletion"
        itemName="this stock transfer record"
      />


      <PdfPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} pdfUrl={previewUrl} title="Stock Transfer Preview" />
    </Box>
  );
};

export default StockTransfer;
