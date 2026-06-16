import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import {
    Box, Typography, Paper, Grid, TextField, Autocomplete, Button, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, FormControl, InputLabel, Select, MenuItem,
    Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Divider
} from '@mui/material';
import { ListAlt as JournalIcon, Edit as EditIcon, Delete as DeleteIcon, Visibility as ViewIcon, Close as CloseIcon, Description as DescriptionIcon, Print as PrintIcon } from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import PdfPreviewModal from '../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const VoucherPreview = ({ row, companyProfile, copyType }) => {
    const compName = companyProfile && companyProfile.CompanyName ? companyProfile.CompanyName : 'FACTORY FLOW ERP';
    let addressParts = '';
    let phonePart = '';
    
    if (companyProfile) {
        addressParts = [companyProfile.Address1, companyProfile.Address2, companyProfile.City, companyProfile.StateName, companyProfile.Pincode].filter(Boolean).join(', ');
        if (companyProfile.PhoneNo) phonePart = 'Ph: ' + companyProfile.PhoneNo;
    }

    return (
        <div style={{
            padding: '15px',
            border: '2px solid #1e293b',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '15px',
            boxSizing: 'border-box',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            fontFamily: "'Helvetica', 'Arial', sans-serif",
            textAlign: 'left'
        }}>
            <div style={{
                textAlign: 'center',
                borderBottom: '2px solid #e2e8f0',
                paddingBottom: '10px',
                marginBottom: '15px',
                position: 'relative'
            }}>
                <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#64748b'
                }}>GSTIN: {companyProfile && companyProfile.GSTIN ? companyProfile.GSTIN : ''}</div>
                <div style={{
                    fontSize: '18px',
                    fontWeight: '800',
                    color: '#0f3b66',
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                }}>{compName}</div>
                {companyProfile && (
                    <div style={{
                        fontSize: '11px',
                        color: '#475569',
                        marginTop: '4px',
                        marginBottom: '8px',
                        lineHeight: '1.4'
                    }}>
                        {addressParts}
                        {phonePart && <br />}
                        {phonePart}
                    </div>
                )}
                <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    marginTop: '5px'
                }}>STOCK JOURNAL VOUCHER</div>
                <div style={{
                    position: 'absolute',
                    top: '0',
                    right: '0',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#64748b'
                }}>({copyType})</div>
            </div>
            
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                marginBottom: '15px'
            }}>
                <div style={{ width: '48%', marginBottom: '5px', fontSize: '13px' }}>
                    <strong>Journal ID:</strong> {row.SJID || 'N/A'}
                </div>
                <div style={{ width: '48%', marginBottom: '5px', fontSize: '13px' }}>
                    <strong>Date:</strong> {row.SJDate ? new Date(row.SJDate).toLocaleDateString() : ''}
                </div>
                <div style={{ width: '48%', marginBottom: '5px', fontSize: '13px' }}>
                    <strong>Type:</strong> {row.SJType === 'Production' ? 'Production (+)' : 'Consumption (-)'}
                </div>
                <div style={{ width: '48%', marginBottom: '5px', fontSize: '13px' }}>
                    <strong>Created By:</strong> {row.CreatedBy || 'Admin'}
                </div>
            </div>
            
            <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginBottom: '15px'
            }}>
                <thead>
                    <tr>
                        <th style={{
                            backgroundColor: 'transparent',
                            color: '#1e293b',
                            textAlign: 'left',
                            padding: '8px',
                            fontSize: '12px',
                            borderTop: '1px solid #cbd5e1',
                            borderBottom: '2px solid #1e293b',
                            fontWeight: 'bold',
                            width: '1%',
                            whiteSpace: 'nowrap'
                        }}>Item Code</th>
                        <th style={{
                            backgroundColor: 'transparent',
                            color: '#1e293b',
                            textAlign: 'left',
                            padding: '8px',
                            fontSize: '12px',
                            borderTop: '1px solid #cbd5e1',
                            borderBottom: '2px solid #1e293b',
                            fontWeight: 'bold'
                        }}>Item Name</th>
                        <th style={{
                            backgroundColor: 'transparent',
                            color: '#1e293b',
                            textAlign: 'right',
                            padding: '8px',
                            fontSize: '12px',
                            borderTop: '1px solid #cbd5e1',
                            borderBottom: '2px solid #1e293b',
                            fontWeight: 'bold',
                            width: '1%',
                            whiteSpace: 'nowrap'
                        }}>Quantity</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style={{ padding: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>{row.ItemCode || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '600' }}>{row.ItemName || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #cbd5e1', fontSize: '12px', textAlign: 'right', fontWeight: 'bold' }}>{row.Qty || 0}</td>
                    </tr>
                </tbody>
            </table>

            {row.Remarks ? (
                <div style={{
                    fontSize: '12px',
                    padding: '10px',
                    backgroundColor: 'transparent',
                    border: '1px dashed #94a3b8',
                    borderRadius: '4px',
                    marginBottom: '15px'
                }}>
                    <strong>Remarks:</strong> {row.Remarks}
                </div>
            ) : null}
            
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '30px',
                paddingTop: '10px'
            }}>
                <div style={{
                    borderTop: '1px solid #333',
                    width: '40%',
                    textAlign: 'center',
                    fontSize: '11px',
                    fontWeight: '600',
                    paddingTop: '5px'
                }}>Prepared By</div>
                <div style={{
                    borderTop: '1px solid #333',
                    width: '40%',
                    textAlign: 'center',
                    fontSize: '11px',
                    fontWeight: '600',
                    paddingTop: '5px'
                }}>Authorized Signatory</div>
            </div>
        </div>
    );
};

const StockJournal = ({ user }) => {
    const [items, setItems] = useState([]);
    const [journals, setJournals] = useState([]);
    const [companyProfile, setCompanyProfile] = useState(null);
    
    // Form State
    const todayDate = new Date().toISOString().split('T')[0];
    const [sjDate, setSjDate] = useState(todayDate);
    const [sjType, setSjType] = useState('Production');
    const [selectedItem, setSelectedItem] = useState(null);
    const [qty, setQty] = useState('');
    const [remarks, setRemarks] = useState('');
    
    const [editingId, setEditingId] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [journalToDelete, setJournalToDelete] = useState(null);



    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchItems();
        fetchJournals();
        fetchCompanyProfile();
    }, []);

    const fetchCompanyProfile = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/company-profile`);
            if (response.ok) {
                const data = await response.json();
                setCompanyProfile(data);
            }
        } catch (err) {
            console.error('Error fetching company profile', err);
        }
    };

    const fetchItems = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items`);
            if (response.ok) {
                const data = await response.json();
                setItems(data);
            }
        } catch (err) {
            console.error('Error fetching items', err);
        }
    };

    const fetchJournals = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/stock-journal`);
            if (response.ok) {
                const data = await response.json();
                setJournals(data);
            }
        } catch (err) {
            console.error('Error fetching journals', err);
        }
    };

    const handleSubmit = async (printAfter = false) => {
        setError('');
        setSuccess('');

        if (!sjDate || !sjType || !selectedItem || !qty || parseFloat(qty) <= 0) {
            setError('Please fill all required fields with valid values.');
            return;
        }

        const payload = {
            SJDate: sjDate,
            SJType: sjType,
            ItemCode: selectedItem.ItemCode,
            Qty: parseFloat(qty),
            Remarks: remarks,
            CreatedBy: user?.username || 'Admin',
            UpdatedBy: user?.username || 'Admin'
        };

        try {
            const url = editingId 
                ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/stock-journal/${editingId}`
                : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/stock-journal`;
                
            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                if (printAfter) {
                    const printData = {
                        SJID: editingId || 'NEW',
                        SJDate: sjDate,
                        SJType: sjType,
                        ItemCode: selectedItem.ItemCode,
                        ItemName: selectedItem.ItemName,
                        Qty: qty,
                        Remarks: remarks,
                        CreatedBy: user?.username || 'Admin'
                    };
                    printVoucher(printData);
                }

                setSuccess(editingId ? 'Stock Journal updated successfully!' : 'Stock Journal saved successfully!');
                setSelectedItem(null);
                setQty('');
                setRemarks('');
                setEditingId(null);
                fetchJournals();
                fetchItems(); // Refresh stock
            } else {
                const data = await response.json();
                setError(data.message || 'Error saving journal entry');
            }
        } catch (err) {
            console.error('Error saving journal:', err);
            setError('Action failed. See console for details.');
        }
    };

    const printVoucher = (row) => {
        const doc = new jsPDF();
        const compName = companyProfile && companyProfile.CompanyName ? companyProfile.CompanyName : 'FACTORY FLOW ERP';
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(compName, 14, 20);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('STOCK JOURNAL VOUCHER', 14, 28);
        
        doc.text(`Journal ID: ${row.SJID || 'N/A'}`, 14, 38);
        doc.text(`Date: ${row.SJDate ? new Date(row.SJDate).toLocaleDateString() : ''}`, 14, 44);
        doc.text(`Type: ${row.SJType === 'Production' ? 'Production (+)' : 'Consumption (-)'}`, 100, 38);
        doc.text(`Created By: ${row.CreatedBy || 'Admin'}`, 100, 44);
        
        const details = Array.isArray(row.Details) ? row.Details : [row];
        
        autoTable(doc, {
            startY: 50,
            head: [['Item Code', 'Item Name', 'Qty', 'Remarks']],
            body: details.map(d => [
                d.ItemCode || row.ItemCode || '-',
                d.ItemName || row.ItemName || '-',
                d.Qty || row.Qty || '-',
                d.Remarks || row.Remarks || '-'
            ]),
            theme: 'grid',
            headStyles: { fillColor: [15, 59, 102] }
        });
        
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewOpen(true);
    };

    const handleEdit = (row) => {
        setEditingId(row.SJID);
        setSjDate(new Date(row.SJDate).toISOString().split('T')[0]);
        setSjType(row.SJType);
        setQty(row.Qty);
        setRemarks(row.Remarks || '');
        
        const parentItem = items.find(i => String(i.ItemCode).trim().toLowerCase() === String(row.ItemCode).trim().toLowerCase());
        setSelectedItem(parentItem || null);
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };



    const handleDeleteClick = (row) => {
        setJournalToDelete(row);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!journalToDelete) return;
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/stock-journal/${journalToDelete.SJID}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                setSuccess('Stock Journal deleted successfully');
                fetchJournals();
                fetchItems(); // refresh stock
                
                if (editingId === journalToDelete.SJID) {
                    setEditingId(null);
                    setSelectedItem(null);
                    setQty('');
                    setRemarks('');
                }
            } else {
                const data = await response.json();
                setError(data.message || 'Error deleting journal');
            }
        } catch (err) {
            console.error('Error deleting:', err);
            setError('Action failed. See console for details.');
        } finally {
            setDeleteDialogOpen(false);
            setJournalToDelete(null);
        }
    };

    const maxItemLength = items.length > 0 ? Math.max(...items.map(i => (`${i.ItemCode} - ${i.ItemName}`).length)) : 15;

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <JournalIcon /> Stock Journal
                </Typography>
            </Box>

            <Paper sx={{ width: '100%', mb: 4, p: 3, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

                <Grid container spacing={2}>
                    <Grid item xs={12} sm={2}>
                        <TextField
                            fullWidth
                            label="Journal Date"
                            type="date"
                            size="small"
                            value={sjDate}
                            onChange={(e) => setSjDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            required
                        />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Journal Type</InputLabel>
                            <Select
                                value={sjType}
                                label="Journal Type"
                                onChange={(e) => setSjType(e.target.value)}
                            >
                                <MenuItem value="Production">Production (+)</MenuItem>
                                <MenuItem value="Consumption">Consumption (-)</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={1}>
                        <TextField
                            fullWidth
                            label="Quantity"
                            type="number"
                            size="small"
                            value={qty}
                            onChange={(e) => setQty(e.target.value)}
                            required
                        />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Autocomplete
                            fullWidth
                            options={items}
                            getOptionLabel={(option) => option ? `${option.ItemCode} - ${option.ItemName}` : ''}
                            value={selectedItem}
                            onChange={(e, newValue) => setSelectedItem(newValue)}
                            renderInput={(params) => <TextField {...params} label="Select Item" size="small" required />}
                            sx={{ minWidth: `${Math.max(20, maxItemLength) + 6}ch` }}
                            slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={1}>
                        <TextField
                            fullWidth
                            label="Remarks (Optional)"
                            size="small"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </Grid>
                    <Grid item xs={12} sm={3} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                        <Button 
                            variant="outlined" 
                            color="primary" 
                            onClick={() => handleSubmit(true)}
                            disabled={(editingId ? !hasEditPermission() : !hasAddPermission()) || !selectedItem || !qty || parseFloat(qty) <= 0}
                            fullWidth
                            sx={{ height: '40px' }}
                            startIcon={<PrintIcon />}
                        >
                            Save & Print
                        </Button>
                        <Button 
                            variant="contained" 
                            color="primary" 
                            onClick={() => handleSubmit(false)}
                            disabled={(editingId ? !hasEditPermission() : !hasAddPermission()) || !selectedItem || !qty || parseFloat(qty) <= 0}
                            fullWidth
                            sx={{ height: '40px' }}
                        >
                            {editingId ? 'Update' : 'Save'}
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            <Paper sx={{ width: '100%', p: 3, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#0F3B66', mb: 2 }}>
                    Recent Stock Journals
                </Typography>
                <TableContainer>
                    <Table size="small">
                        <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell><strong>ID</strong></TableCell>
                                <TableCell><strong>Date</strong></TableCell>
                                <TableCell><strong>Type</strong></TableCell>
                                <TableCell><strong>Item</strong></TableCell>
                                <TableCell align="right"><strong>Qty</strong></TableCell>
                                <TableCell><strong>Remarks</strong></TableCell>
                                <TableCell align="center"><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {journals.length > 0 ? journals.map((row) => (
                                <TableRow key={row.SJID}>
                                    <TableCell>{row.SJID}</TableCell>
                                    <TableCell>{new Date(row.SJDate).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        <Typography 
                                            variant="body2" 
                                            fontWeight="bold" 
                                            color={row.SJType === 'Production' ? 'success.main' : 'error.main'}
                                        >
                                            {row.SJType === 'Production' ? 'Production (+)' : (row.SJType === 'Consumption' ? 'Consumption (-)' : row.SJType)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>{row.ItemCode} - {row.ItemName}</TableCell>
                                    <TableCell align="right">{row.Qty}</TableCell>
                                    <TableCell>{row.Remarks || '-'}</TableCell>
                                    <TableCell align="center">

                                        <IconButton color="secondary" size="small" onClick={() => printVoucher(row)} title="Print Voucher">
                                            <PrintIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton color="primary" size="small" onClick={() => handleEdit(row)} disabled={!hasEditPermission()} title="Edit">
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton color="error" size="small" onClick={() => handleDeleteClick(row)} disabled={!hasDeletePermission()}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={7} align="center">No journals found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <DeleteConfirmModal
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={confirmDelete}
                title="Confirm Deletion"
                itemName={`Stock Journal #${journalToDelete?.SJID}`}
            />


          <PdfPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} pdfUrl={previewUrl} title="Stock Journal Preview" />
        </Box>
    );
};

export default StockJournal;
