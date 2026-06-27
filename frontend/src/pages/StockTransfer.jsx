import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Alert,
  Autocomplete, Grid, Divider
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
  Print as PrintIcon
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import PdfPreviewModal from '../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const emptyRow = {
  OutItemCode: '',
  OutPcs: '',
  OutWeight: '',
  InItemCode: '',
  InPcs: '',
  InWeight: '',
  ScrapItemCode: '',
  ScrapPcs: '',
  ScrapWeight: '',
  LossWeight: '0.00'
};

const StockTransfer = ({ user }) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [transfers, setTransfers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [items, setItems] = useState([]);
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
  const [remarks, setRemarks] = useState('');
  
  // Grid State
  const [outItems, setOutItems] = useState([{ ItemCode: '', Pcs: '', Weight: '' }]);
  const [inItems, setInItems] = useState([{ ItemCode: '', Pcs: '', Weight: '' }]);
  const [scrapItems, setScrapItems] = useState([]);
  const [lossWeight, setLossWeight] = useState('0.000');
  
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
      (t.OutItemName && t.OutItemName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.InItemName && t.InItemName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.FromDeptName && t.FromDeptName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.ToDeptName && t.ToDeptName.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const dateStr = t.MoveDate ? t.MoveDate.split('T')[0] : '';
    let matchesDate = true;
    if (fromDate && dateStr < fromDate) matchesDate = false;
    if (toDate && dateStr > toDate) matchesDate = false;
    
    return matchesSearch && matchesDate;
  });

  const handleOpenDialog = () => {
    setDialogMode('add');
    setDialogError('');
    setEditingId(null);
    setMoveDate(todayDate);
    setFromDeptId(null);
    setToDeptId(null);
    setRemarks('');
    setOutItems([{ ItemCode: '', Pcs: '', Weight: '' }]);
    setInItems([{ ItemCode: '', Pcs: '', Weight: '' }]);
    setScrapItems([]);
    setLossWeight('0.000');
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
    setRemarks(firstDetail.Remarks || group.Remarks || '');
    
    const outs = [];
    const ins = [];
    const scraps = [];
    let totalLoss = 0;

    const detailsArray = group.details || [group];
    detailsArray.forEach(d => {
      if (d.OutItemCode) outs.push({ ItemCode: d.OutItemCode, Pcs: d.OutPcs !== null ? d.OutPcs.toString() : '', Weight: d.OutWeight !== null ? d.OutWeight.toString() : '' });
      if (d.InItemCode) ins.push({ ItemCode: d.InItemCode, Pcs: d.InPcs !== null ? d.InPcs.toString() : '', Weight: d.InWeight !== null ? d.InWeight.toString() : '' });
      if (d.ScrapItemCode) scraps.push({ ItemCode: d.ScrapItemCode, Pcs: d.ScrapPcs !== null ? d.ScrapPcs.toString() : '', Weight: d.ScrapWeight !== null ? d.ScrapWeight.toString() : '' });
      if (d.LossWeight) totalLoss += d.LossWeight;
    });

    if (outs.length === 0) outs.push({ ItemCode: '', Pcs: '', Weight: '' });
    if (ins.length === 0) ins.push({ ItemCode: '', Pcs: '', Weight: '' });

    setOutItems(outs);
    setInItems(ins);
    setScrapItems(scraps);
    setLossWeight(totalLoss.toFixed(3));
    
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setDialogError('');
  };



  useEffect(() => {
    const totalOut = outItems.reduce((sum, item) => sum + (parseFloat(item.Weight) || 0), 0);
    const totalIn = inItems.reduce((sum, item) => sum + (parseFloat(item.Weight) || 0), 0);
    const totalScrap = scrapItems.reduce((sum, item) => sum + (parseFloat(item.Weight) || 0), 0);
    const diff = totalOut - totalIn - totalScrap;
    setLossWeight(Math.max(0, diff).toFixed(3));
  }, [outItems, inItems, scrapItems]);

  const handleArrayChange = (setter, itemsArray, index, field, value) => {
    const newArr = [...itemsArray];
    newArr[index][field] = value;
    setter(newArr);
  };

  const handleArrayItemSelect = (setter, itemsArray, index, item) => {
    const newArr = [...itemsArray];
    newArr[index].ItemCode = item ? item.ItemCode : '';
    setter(newArr);
  };

  const addArrayRow = (setter, itemsArray) => setter([...itemsArray, { ItemCode: '', Pcs: '', Weight: '' }]);
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
      Remarks: remarks,
      CreatedBy: user?.username || 'Admin',
      UpdatedBy: user?.username || 'Admin',
      outItems: validOuts,
      inItems: validIns,
      scrapItems: validScraps,
      LossWeight: lossWeight
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
          validOuts.forEach(r => detailsList.push({ OutItemCode: r.ItemCode, OutItemName: getOutName(r.ItemCode), OutPcs: r.Pcs, OutWeight: r.Weight }));
          validIns.forEach(r => detailsList.push({ InItemCode: r.ItemCode, InItemName: getInName(r.ItemCode), InPcs: r.Pcs, InWeight: r.Weight }));
          validScraps.forEach(r => detailsList.push({ ScrapItemCode: r.ItemCode, ScrapItemName: getInName(r.ItemCode), ScrapPcs: r.Pcs, ScrapWeight: r.Weight }));
          if (detailsList.length > 0) detailsList[0].LossWeight = lossWeight;

          const groupData = {
            TransferID: returnedId,
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
    const compName = companyProfile && companyProfile.CompanyName ? companyProfile.CompanyName : 'FACTORY FLOW ERP';
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
    doc.text(group.TransferID?.toString() || 'N/A', 40, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('Date:', 130, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(group.MoveDate ? group.MoveDate.split('T')[0] : '', 145, yPos);

    yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('From Dept:', 14, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(group.FromDeptName || '', 40, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('To Dept:', 130, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(group.ToDeptName || '', 145, yPos);

    yPos += 10;

    // Table
    const tableCols = ['Type', 'Item Name', 'Pcs', 'Weight'];
    const tableRows = [];
    let totalOutPcs = 0, totalOutWt = 0;
    let totalInPcs = 0, totalInWt = 0;
    let totalScrapPcs = 0, totalScrapWt = 0;
    let totalLossWt = 0;

    group.details.forEach(d => {
      if (d.OutItemCode) {
        tableRows.push(['OUT', d.OutItemName || d.OutItemCode, d.OutPcs || '0', d.OutWeight || '0.00']);
        totalOutPcs += parseFloat(d.OutPcs) || 0;
        totalOutWt += parseFloat(d.OutWeight) || 0;
      }
      if (d.InItemCode) {
        tableRows.push(['IN', d.InItemName || d.InItemCode, d.InPcs || '0', d.InWeight || '0.00']);
        totalInPcs += parseFloat(d.InPcs) || 0;
        totalInWt += parseFloat(d.InWeight) || 0;
      }
      if (d.ScrapItemCode) {
        tableRows.push(['SCRAP', d.ScrapItemName || d.ScrapItemCode, d.ScrapPcs || '0', d.ScrapWeight || '0.00']);
        totalScrapPcs += parseFloat(d.ScrapPcs) || 0;
        totalScrapWt += parseFloat(d.ScrapWeight) || 0;
      }
      if (d.LossWeight) {
        totalLossWt += parseFloat(d.LossWeight) || 0;
      }
    });

    const fmt = (val) => (parseFloat(val) || 0).toFixed(2);
    
    // Add Summary Rows
    tableRows.push(['', '', '', '']); // empty separator
    tableRows.push(['TOTAL OUT', '', fmt(totalOutPcs), fmt(totalOutWt)]);
    tableRows.push(['TOTAL IN', '', fmt(totalInPcs), fmt(totalInWt)]);
    tableRows.push(['TOTAL SCRAP', '', fmt(totalScrapPcs), fmt(totalScrapWt)]);
    tableRows.push(['BATCH LOSS WT', '', '', fmt(totalLossWt)]);

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
        3: { halign: 'right' }
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

  const groupedTransfers = {};
  filteredTransfers.forEach(transfer => {
    if (!groupedTransfers[transfer.TransferID]) {
      groupedTransfers[transfer.TransferID] = {
        TransferID: transfer.TransferID,
        MoveDate: transfer.MoveDate,
        FromDeptName: transfer.FromDeptName,
        ToDeptName: transfer.ToDeptName,
        details: []
      };
    }
    groupedTransfers[transfer.TransferID].details.push(transfer);
  });
  const groupedArray = Object.values(groupedTransfers);
  const paginatedGroups = groupedArray.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TransferIcon /> Stock Transfer
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, display: 'flex', justifyContent: 'space-between', pt: 2, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search transfers..."
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
            Add Transfer
          </Button>
        </Toolbar>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 1000 }}>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Item Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Pcs</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Weight</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedGroups.map((group) => {
                const batchLoss = group.details.reduce((sum, d) => sum + (d.LossWeight || 0), 0);
                return (
                <React.Fragment key={group.TransferID}>
                  <TableRow sx={{ backgroundColor: '#e0f2fe' }}>
                    <TableCell colSpan={4} sx={{ py: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0369a1' }}>Transfer ID: {group.TransferID}</Typography>
                          <Typography variant="body2" sx={{ color: '#0369a1' }}><strong>Date:</strong> {group.MoveDate ? group.MoveDate.split('T')[0] : ''}</Typography>
                          <Typography variant="body2" sx={{ color: '#0369a1' }}><strong>From:</strong> {group.FromDeptName}</Typography>
                          <Typography variant="body2" sx={{ color: '#0369a1' }}><strong>To:</strong> {group.ToDeptName}</Typography>
                        </Box>
                        <Box>
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
                          <TableCell>{row.OutPcs || 0}</TableCell>
                          <TableCell>{row.OutWeight || 0}</TableCell>
                        </TableRow>
                      )}
                      {row.InItemCode && (
                        <TableRow hover sx={{ '& td': { borderBottom: '1px solid #f1f5f9' } }}>
                          <TableCell sx={{ color: '#2e7d32', fontWeight: 'bold' }}>IN</TableCell>
                          <TableCell>{row.InItemName || row.InItemCode}</TableCell>
                          <TableCell>{row.InPcs || 0}</TableCell>
                          <TableCell>{row.InWeight || 0}</TableCell>
                        </TableRow>
                      )}
                      {row.ScrapItemCode && (
                        <TableRow hover sx={{ '& td': { borderBottom: '1px solid #f1f5f9' } }}>
                          <TableCell sx={{ color: '#ed6c02', fontWeight: 'bold' }}>SCRAP</TableCell>
                          <TableCell>{row.ScrapItemName || row.ScrapItemCode}</TableCell>
                          <TableCell>{row.ScrapPcs || 0}</TableCell>
                          <TableCell>{row.ScrapWeight || 0}</TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                  <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                    <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold', color: '#0f172a' }}>Batch Loss Weight:</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#0f172a' }}>{batchLoss.toFixed(3)}</TableCell>
                  </TableRow>
                </React.Fragment>
              )})}
              {groupedArray.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>No stock transfers found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
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
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Transfer Date" type="date" size="small" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} InputLabelProps={{ shrink: true }} required />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Autocomplete
                  options={departments.filter(d => d.DeptID !== toDeptId)}
                  getOptionLabel={(option) => option.DeptName || ''}
                  value={departments.find(d => d.DeptID === fromDeptId) || null}
                  onChange={(e, newValue) => setFromDeptId(newValue ? newValue.DeptID : null)}
                  renderInput={(params) => <TextField {...params} label="From Department" size="small" required fullWidth />}
                  fullWidth
                  sx={{ minWidth: `${Math.max(20, maxDeptLength) + 6}ch` }}
                  slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Autocomplete
                  options={departments.filter(d => d.DeptID !== fromDeptId)}
                  getOptionLabel={(option) => option.DeptName || ''}
                  value={departments.find(d => d.DeptID === toDeptId) || null}
                  onChange={(e, newValue) => setToDeptId(newValue ? newValue.DeptID : null)}
                  renderInput={(params) => <TextField {...params} label="To Department" size="small" required fullWidth />}
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
                  <TableCell align="center" sx={{ fontWeight: 700, width: 80 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, minWidth: 200 }}>Item</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 100 }}>Pcs</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 120 }}>Weight</TableCell>
                  <TableCell sx={{ width: 50 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* OUT ITEMS */}
                {outItems.map((row, index) => (
                  <TableRow key={`out-${index}`} sx={{ '& td': { py: 0.5, px: 0.5, borderBottom: '1px solid #f1f5f9' } }}>
                    <TableCell align="center" sx={{ fontWeight: 600, color: '#d32f2f', bgcolor: '#fce4e4' }}>OUT</TableCell>
                    <TableCell>
                      <Autocomplete
                        options={availableOutItems}
                        isOptionEqualToValue={(option, value) => option.ItemCode === value.ItemCode}
                        getOptionLabel={(option) => option ? `${option.ItemCode} - ${option.ItemName} (${option.Pcs || 0} Pcs | ${option.Weight || 0} Wt)` : ''}
                        value={availableOutItems.find(i => i.ItemCode === row.ItemCode) || items.find(i => i.ItemCode === row.ItemCode) || null}
                        onChange={(e, newValue) => handleArrayItemSelect(setOutItems, outItems, index, newValue)}
                        renderInput={(params) => <TextField {...params} placeholder="Out Item" size="small" />}
                        fullWidth
                        slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                      />
                    </TableCell>
                    <TableCell><TextField type="number" size="small" value={row.Pcs} onChange={(e) => handleArrayChange(setOutItems, outItems, index, 'Pcs', e.target.value)} fullWidth /></TableCell>
                    <TableCell><TextField type="number" size="small" value={row.Weight} onChange={(e) => handleArrayChange(setOutItems, outItems, index, 'Weight', e.target.value)} fullWidth /></TableCell>
                    <TableCell align="center">
                      <IconButton color="error" size="small" onClick={() => removeArrayRow(setOutItems, outItems, index)} disabled={!hasDeletePermission() || outItems.length === 1}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 1, borderBottom: '2px solid #e0e0e0' }}>
                    <Button size="small" color="error" onClick={() => addArrayRow(setOutItems, outItems)}>+ Add Out Row</Button>
                  </TableCell>
                </TableRow>

                {/* IN ITEMS */}
                {inItems.map((row, index) => (
                  <TableRow key={`in-${index}`} sx={{ '& td': { py: 0.5, px: 0.5, borderBottom: '1px solid #f1f5f9' } }}>
                    <TableCell align="center" sx={{ fontWeight: 600, color: '#2e7d32', bgcolor: '#e8f5e9' }}>IN</TableCell>
                    <TableCell>
                      <Autocomplete
                        options={items}
                        getOptionLabel={(option) => option ? `${option.ItemCode} - ${option.ItemName}` : ''}
                        value={items.find(i => i.ItemCode === row.ItemCode) || null}
                        onChange={(e, newValue) => handleArrayItemSelect(setInItems, inItems, index, newValue)}
                        renderInput={(params) => <TextField {...params} placeholder="In Item" size="small" />}
                        fullWidth
                        slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                      />
                    </TableCell>
                    <TableCell><TextField type="number" size="small" value={row.Pcs} onChange={(e) => handleArrayChange(setInItems, inItems, index, 'Pcs', e.target.value)} fullWidth /></TableCell>
                    <TableCell><TextField type="number" size="small" value={row.Weight} onChange={(e) => handleArrayChange(setInItems, inItems, index, 'Weight', e.target.value)} fullWidth /></TableCell>
                    <TableCell align="center">
                      <IconButton color="error" size="small" onClick={() => removeArrayRow(setInItems, inItems, index)} disabled={!hasDeletePermission() || inItems.length === 1}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 1, borderBottom: '2px solid #e0e0e0' }}>
                    <Button size="small" color="success" onClick={() => addArrayRow(setInItems, inItems)}>+ Add In Row</Button>
                  </TableCell>
                </TableRow>

                {/* SCRAP ITEMS */}
                {scrapItems.map((row, index) => (
                  <TableRow key={`scrap-${index}`} sx={{ '& td': { py: 0.5, px: 0.5, borderBottom: '1px solid #f1f5f9' } }}>
                    <TableCell align="center" sx={{ fontWeight: 600, color: '#ed6c02', bgcolor: '#fff3e0' }}>SCRAP</TableCell>
                    <TableCell>
                      <Autocomplete
                        options={items.filter(i => i.ItemType && i.ItemType.toLowerCase() === 'scrap')}
                        getOptionLabel={(option) => option ? `${option.ItemCode} - ${option.ItemName}` : ''}
                        value={items.find(i => i.ItemCode === row.ItemCode) || null}
                        onChange={(e, newValue) => handleArrayItemSelect(setScrapItems, scrapItems, index, newValue)}
                        renderInput={(params) => <TextField {...params} placeholder="Scrap Item" size="small" />}
                        fullWidth
                        slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                      />
                    </TableCell>
                    <TableCell><TextField type="number" size="small" value={row.Pcs} onChange={(e) => handleArrayChange(setScrapItems, scrapItems, index, 'Pcs', e.target.value)} fullWidth /></TableCell>
                    <TableCell><TextField type="number" size="small" value={row.Weight} onChange={(e) => handleArrayChange(setScrapItems, scrapItems, index, 'Weight', e.target.value)} fullWidth /></TableCell>
                    <TableCell align="center">
                      <IconButton color="error" size="small" onClick={() => removeArrayRow(setScrapItems, scrapItems, index)} disabled={!hasDeletePermission()}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 1, borderBottom: '2px solid #e0e0e0' }}>
                    <Button size="small" color="warning" onClick={() => addArrayRow(setScrapItems, scrapItems)}>+ Add Scrap Row</Button>
                  </TableCell>
                </TableRow>

                {/* LOSS WEIGHT SUM */}
                <TableRow sx={{ backgroundColor: '#f0f0f0' }}>
                  <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>Batch Loss Weight:</TableCell>
                  <TableCell>
                    <TextField type="number" size="small" value={lossWeight} InputProps={{ readOnly: true, sx: { fontWeight: 'bold', bgcolor: '#fff' } }} fullWidth />
                  </TableCell>
                  <TableCell></TableCell>
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
