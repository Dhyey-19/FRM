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
  const [gridRows, setGridRows] = useState([{ ...emptyRow }]);
  
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
    setDialogMode('add');
    setDialogError('');
    setEditingId(null);
    setMoveDate(todayDate);
    setFromDeptId(null);
    setToDeptId(null);
    setRemarks('');
    setGridRows([{ ...emptyRow }]);
    setOpenDialog(true);
  };

  const handleEditTransfer = (transfer) => {
    setDialogMode('edit');
    setDialogError('');
    setEditingId(transfer.MoveID);
    setMoveDate(transfer.MoveDate ? transfer.MoveDate.split('T')[0] : todayDate);
    setFromDeptId(transfer.FromDeptID);
    setToDeptId(transfer.ToDeptID);
    setRemarks(transfer.Remarks || '');
    
    // In edit mode, we are editing a single flat row
    setGridRows([{
      OutItemCode: transfer.OutItemCode || '',
      OutPcs: transfer.OutPcs !== null ? transfer.OutPcs.toString() : '',
      OutWeight: transfer.OutWeight !== null ? transfer.OutWeight.toString() : '',
      InItemCode: transfer.InItemCode || '',
      InPcs: transfer.InPcs !== null ? transfer.InPcs.toString() : '',
      InWeight: transfer.InWeight !== null ? transfer.InWeight.toString() : '',
      ScrapItemCode: transfer.ScrapItemCode || '',
      ScrapPcs: transfer.ScrapPcs !== null ? transfer.ScrapPcs.toString() : '',
      ScrapWeight: transfer.ScrapWeight !== null ? transfer.ScrapWeight.toString() : '',
      LossWeight: transfer.LossWeight !== null ? transfer.LossWeight.toFixed(3) : '0.00'
    }]);
    
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setDialogError('');
  };



  const handleRowChange = (index, field, value) => {
    const newRows = [...gridRows];
    newRows[index][field] = value;

    // Auto-copy Out Pcs to In Pcs
    if (field === 'OutPcs') {
      newRows[index].InPcs = value;
    }
    
    // Auto-copy Out Weight to In Weight
    if (field === 'OutWeight') {
      newRows[index].InWeight = value;
    }
    
    // Auto calculate Scrap Pcs
    if (['OutPcs', 'InPcs'].includes(field)) {
      const outPcs = parseFloat(newRows[index].OutPcs) || 0;
      const inPcs = parseFloat(newRows[index].InPcs) || 0;
      newRows[index].ScrapPcs = Math.max(0, outPcs - inPcs).toString();
    }

    // Auto calculate Scrap Weight & reset Loss Weight
    if (['OutWeight', 'InWeight'].includes(field)) {
      const outWt = parseFloat(newRows[index].OutWeight) || 0;
      const inWt = parseFloat(newRows[index].InWeight) || 0;
      const diffWt = outWt - inWt;
      
      newRows[index].ScrapWeight = Math.max(0, diffWt).toString();
      newRows[index].LossWeight = '0.000'; // Since Scrap absorbs all diff, Loss is 0
    }
    
    // Calculate Loss Weight only when Scrap Weight is explicitly modified
    if (field === 'ScrapWeight') {
      const outWt = parseFloat(newRows[index].OutWeight) || 0;
      const inWt = parseFloat(newRows[index].InWeight) || 0;
      const scrapWt = parseFloat(newRows[index].ScrapWeight) || 0;
      const computedLoss = Math.max(0, outWt - inWt - scrapWt);
      newRows[index].LossWeight = computedLoss.toFixed(3);
    }
    
    setGridRows(newRows);
  };

  const handleItemSelect = (index, field, item) => {
    const newRows = [...gridRows];
    newRows[index][field] = item ? item.ItemCode : '';
    
    // Auto-copy Out Item to In Item
    if (field === 'OutItemCode') {
      newRows[index].InItemCode = item ? item.ItemCode : '';
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

  const handleSave = async (printAfter = false) => {
    if (!moveDate || !fromDeptId || !toDeptId) {
      setDialogError('Date, From Dept, and To Dept are required.');
      return;
    }

    if (fromDeptId === toDeptId) {
      setDialogError('Source and Destination Department cannot be the same.');
      return;
    }

    const validRows = gridRows.filter(r => r.OutItemCode && r.InItemCode);
    if (validRows.length === 0) {
      setDialogError('Please fill in at least one valid row with Out Item and In Item.');
      return;
    }

    // Validation: Stock In (pcs / weight) must be <= Stock Out (pcs / weight)
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      const outPcs = parseFloat(r.OutPcs) || 0;
      const inPcs = parseFloat(r.InPcs) || 0;
      const outWt = parseFloat(r.OutWeight) || 0;
      const inWt = parseFloat(r.InWeight) || 0;

      if (inPcs > outPcs) {
        setDialogError(`Row ${i + 1}: Stock In Pcs (${inPcs}) cannot be greater than Stock Out Pcs (${outPcs}).`);
        return;
      }
      if (inWt > outWt) {
        setDialogError(`Row ${i + 1}: Stock In Weight (${inWt}) cannot be greater than Stock Out Weight (${outWt}).`);
        return;
      }
    }

    const payload = {
      MoveDate: moveDate,
      FromDeptID: fromDeptId,
      ToDeptID: toDeptId,
      Remarks: remarks,
      CreatedBy: user?.username || 'Admin',
      UpdatedBy: user?.username || 'Admin',
      Details: validRows.map(r => ({
        OutItemCode: r.OutItemCode,
        OutPcs: parseFloat(r.OutPcs) || 0,
        OutWeight: parseFloat(r.OutWeight) || 0,
        InItemCode: r.InItemCode,
        InPcs: parseFloat(r.InPcs) || 0,
        InWeight: parseFloat(r.InWeight) || 0,
        ScrapItemCode: r.ScrapItemCode || null,
        ScrapPcs: parseFloat(r.ScrapPcs) || 0,
        ScrapWeight: parseFloat(r.ScrapWeight) || 0,
        LossWeight: parseFloat(r.LossWeight) || 0
      }))
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
          const groupData = {
            TransferID: returnedId,
            MoveDate: moveDate,
            FromDeptName: departments.find(d => d.DeptID === fromDeptId)?.DeptName || '',
            ToDeptName: departments.find(d => d.DeptID === toDeptId)?.DeptName || '',
            Remarks: remarks,
            details: validRows.map(r => ({
              OutItemName: availableOutItems.find(i => i.ItemCode === r.OutItemCode)?.ItemName || items.find(i => i.ItemCode === r.OutItemCode)?.ItemName || r.OutItemCode,
              OutPcs: r.OutPcs,
              OutWeight: r.OutWeight,
              InItemName: items.find(i => i.ItemCode === r.InItemCode)?.ItemName || r.InItemCode,
              InPcs: r.InPcs,
              InWeight: r.InWeight,
              ScrapItemName: items.find(i => i.ItemCode === r.ScrapItemCode)?.ItemName || r.ScrapItemCode,
              ScrapPcs: r.ScrapPcs,
              ScrapWeight: r.ScrapWeight,
              LossWeight: r.LossWeight
            }))
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
    const tableCols = [
      'Out Item', 'Pcs', 'Weight',
      'In Item', 'Pcs', 'Weight',
      'Scrap Item', 'Pcs', 'Weight',
      'Loss Wt'
    ];
    
    const tableRows = group.details.map(r => [
      r.OutItemName || '-',
      r.OutPcs || '0',
      r.OutWeight || '0.00',
      r.InItemName || '-',
      r.InPcs || '0',
      r.InWeight || '0.00',
      r.ScrapItemName || '-',
      r.ScrapItemName ? (r.ScrapPcs || '0') : '',
      r.ScrapItemName ? (r.ScrapWeight || '0.00') : '',
      r.LossWeight || '0.00'
    ]);

    const fmt = (val) => (parseFloat(val) || 0).toFixed(2);
    const totalOutPcs = group.details.reduce((sum, row) => sum + (parseFloat(row.OutPcs) || 0), 0);
    const totalOutWt = group.details.reduce((sum, row) => sum + (parseFloat(row.OutWeight) || 0), 0);
    const totalInPcs = group.details.reduce((sum, row) => sum + (parseFloat(row.InPcs) || 0), 0);
    const totalInWt = group.details.reduce((sum, row) => sum + (parseFloat(row.InWeight) || 0), 0);
    const totalScrapPcs = group.details.reduce((sum, row) => sum + (parseFloat(row.ScrapPcs) || 0), 0);
    const totalScrapWt = group.details.reduce((sum, row) => sum + (parseFloat(row.ScrapWeight) || 0), 0);
    const totalLossWt = group.details.reduce((sum, row) => sum + (parseFloat(row.LossWeight) || 0), 0);

    tableRows.push([
      'TOTAL',
      fmt(totalOutPcs),
      fmt(totalOutWt),
      '',
      fmt(totalInPcs),
      fmt(totalInWt),
      '',
      fmt(totalScrapPcs),
      fmt(totalScrapWt),
      fmt(totalLossWt)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [tableCols],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 59, 102], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' }
      },
      willDrawCell: (data) => {
        if (data.row.index === tableRows.length - 1) {
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
                <TableCell sx={{ fontWeight: 600 }}>Out Item (Pcs/Wt)</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>In Item (Pcs/Wt)</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Scrap Item (Pcs/Wt)</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Loss Weight</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedGroups.map((group) => (
                <React.Fragment key={group.TransferID}>
                  <TableRow sx={{ backgroundColor: '#e0f2fe' }}>
                    <TableCell colSpan={5} sx={{ py: 1.5 }}>
                      <Box sx={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0369a1' }}>Transfer ID: {group.TransferID}</Typography>
                        <Typography variant="body2" sx={{ color: '#0369a1' }}><strong>Date:</strong> {group.MoveDate ? group.MoveDate.split('T')[0] : ''}</Typography>
                        <Typography variant="body2" sx={{ color: '#0369a1' }}><strong>From:</strong> {group.FromDeptName}</Typography>
                        <Typography variant="body2" sx={{ color: '#0369a1' }}><strong>To:</strong> {group.ToDeptName}</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                  {group.details.map(row => (
                    <TableRow hover key={row.MoveID} sx={{ '& td': { borderBottom: '1px solid #f1f5f9' } }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{row.OutItemName}</Typography>
                        <Typography variant="caption" color="textSecondary">({row.OutPcs || 0} / {row.OutWeight || 0})</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{row.InItemName}</Typography>
                        <Typography variant="caption" color="textSecondary">({row.InPcs || 0} / {row.InWeight || 0})</Typography>
                      </TableCell>
                      <TableCell>
                        {row.ScrapItemName ? (
                          <Box>
                            <Typography variant="body2" fontWeight={500}>{row.ScrapItemName}</Typography>
                            <Typography variant="caption" color="textSecondary">({row.ScrapPcs || 0} / {row.ScrapWeight || 0})</Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="textSecondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>{row.LossWeight || 0}</TableCell>
                      <TableCell align="center">

                        <IconButton color="secondary" size="small" onClick={() => printVoucher(group)} title="Print Voucher">
                          <PrintIcon fontSize="small" />
                        </IconButton>
                        <IconButton color="primary" size="small" onClick={() => handleEditTransfer(row)} disabled={!hasEditPermission()} title="Edit">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton color="error" size="small" onClick={() => openDeleteConfirm(row.MoveID)} disabled={!hasDeletePermission()}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
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
          <TableContainer component={Paper} sx={{ mb: 2, maxHeight: '40vh', border: '1px solid #e0e0e0', boxShadow: 'none' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 80 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, minWidth: 200 }}>Item</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 100 }}>Pcs</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 120 }}>Weight</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 120 }}>Loss Wt</TableCell>
                  <TableCell sx={{ width: 50 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gridRows.map((row, index) => (
                  <React.Fragment key={index}>
                    {/* Out Row */}
                    <TableRow sx={{ '& td': { py: 0.5, px: 0.5, borderBottom: 'none' } }}>
                      <TableCell align="center" sx={{ fontWeight: 600, color: '#d32f2f' }}>OUT</TableCell>
                      <TableCell>
                        <Autocomplete
                          options={availableOutItems}
                          isOptionEqualToValue={(option, value) => option.ItemCode === value.ItemCode}
                          getOptionLabel={(option) => option ? `${option.ItemCode} - ${option.ItemName} (${option.Pcs || 0} Pcs | ${option.Weight || 0} Wt)` : ''}
                          value={availableOutItems.find(i => i.ItemCode === row.OutItemCode) || items.find(i => i.ItemCode === row.OutItemCode) || null}
                          onChange={(e, newValue) => handleItemSelect(index, 'OutItemCode', newValue)}
                          renderInput={(params) => <TextField {...params} placeholder="Out Item" size="small" />}
                          fullWidth
                          slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                        />
                      </TableCell>
                      <TableCell><TextField type="number" size="small" value={row.OutPcs} onChange={(e) => handleRowChange(index, 'OutPcs', e.target.value)} fullWidth /></TableCell>
                      <TableCell><TextField type="number" size="small" value={row.OutWeight} onChange={(e) => handleRowChange(index, 'OutWeight', e.target.value)} fullWidth /></TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                    
                    {/* In Row */}
                    <TableRow sx={{ '& td': { py: 0.5, px: 0.5, borderBottom: 'none' } }}>
                      <TableCell align="center" sx={{ fontWeight: 600, color: '#2e7d32' }}>IN</TableCell>
                      <TableCell>
                        <Autocomplete
                          options={items}
                          getOptionLabel={(option) => option ? `${option.ItemCode} - ${option.ItemName}` : ''}
                          value={items.find(i => i.ItemCode === row.InItemCode) || null}
                          onChange={(e, newValue) => handleItemSelect(index, 'InItemCode', newValue)}
                          renderInput={(params) => <TextField {...params} placeholder="In Item" size="small" />}
                          fullWidth
                          slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                        />
                      </TableCell>
                      <TableCell><TextField type="number" size="small" value={row.InPcs} onChange={(e) => handleRowChange(index, 'InPcs', e.target.value)} fullWidth /></TableCell>
                      <TableCell><TextField type="number" size="small" value={row.InWeight} onChange={(e) => handleRowChange(index, 'InWeight', e.target.value)} fullWidth /></TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                    
                    {/* Scrap Row */}
                    <TableRow sx={{ '& td': { py: 0.5, px: 0.5, borderBottom: '2px solid #e0e0e0' } }}>
                      <TableCell align="center" sx={{ fontWeight: 600, color: '#ed6c02' }}>SCRAP</TableCell>
                      <TableCell>
                        <Autocomplete
                          options={items.filter(i => i.ItemType && i.ItemType.toLowerCase() === 'scrap')}
                          getOptionLabel={(option) => option ? `${option.ItemCode} - ${option.ItemName}` : ''}
                          value={items.find(i => i.ItemCode === row.ScrapItemCode) || null}
                          onChange={(e, newValue) => handleItemSelect(index, 'ScrapItemCode', newValue)}
                          renderInput={(params) => <TextField {...params} placeholder="Scrap Item" size="small" />}
                          fullWidth
                          slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                        />
                      </TableCell>
                      <TableCell><TextField type="number" size="small" value={row.ScrapPcs} onChange={(e) => handleRowChange(index, 'ScrapPcs', e.target.value)} fullWidth /></TableCell>
                      <TableCell><TextField type="number" size="small" value={row.ScrapWeight} onChange={(e) => handleRowChange(index, 'ScrapWeight', e.target.value)} fullWidth /></TableCell>
                      
                      <TableCell sx={{ px: 1 }}>
                        <TextField type="number" size="small" value={row.LossWeight} InputProps={{ readOnly: true, sx: { bgcolor: '#f0f0f0' } }} fullWidth />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton color="error" size="small" onClick={() => removeGridRow(index)} disabled={!hasDeletePermission() || gridRows.length === 1 || dialogMode === 'edit'}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>

                    {/* Spacer Row */}
                    {index < gridRows.length - 1 && (
                      <TableRow sx={{ height: 24, bgcolor: '#f8fafc' }}>
                        <TableCell colSpan={6} sx={{ borderBottom: 'none' }}></TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {dialogMode !== 'edit' && (
            <Button variant="text" color="primary" onClick={addGridRow} sx={{ fontWeight: 700, mb: 2 }}>
              + Add Row
            </Button>
          )}

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
