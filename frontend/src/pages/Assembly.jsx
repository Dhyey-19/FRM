import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import {
    Box, Typography, Paper, Toolbar, Button, TextField, Autocomplete,
    Grid, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Divider, Tabs, Tab
} from '@mui/material';
import { 
    BuildCircle as BuildIcon, Edit as EditIcon, Delete as DeleteIcon, Visibility as ViewIcon, Close as CloseIcon, Description as DescriptionIcon
} from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';

const Assembly = ({ user }) => {
    const [items, setItems] = useState([]);
    const [bomList, setBomList] = useState([]); // List of child items for preview

    // Form state
    const todayDate = new Date().toISOString().split('T')[0];
    const [assemblyDate, setAssemblyDate] = useState(todayDate);
    const [assemblyNo, setAssemblyNo] = useState('');
    const [selectedItem, setSelectedItem] = useState(null); // Parent item
    const [quantity, setQuantity] = useState('');
    const [remark, setRemark] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    const [todayAssemblies, setTodayAssemblies] = useState([]);
    const [filterFromDate, setFilterFromDate] = useState(todayDate);
    const [filterToDate, setFilterToDate] = useState(todayDate);
    const [editingId, setEditingId] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [assemblyToDelete, setAssemblyToDelete] = useState(null);




    const fetchTodayAssemblies = async () => {
        try {
            const queryParams = new URLSearchParams({
                fromDate: filterFromDate,
                toDate: filterToDate
            }).toString();
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/assembly/filter?${queryParams}`);
            if (response.ok) {
                const data = await response.json();
                setTodayAssemblies(data);
            }
        } catch (err) {
            console.error('Error fetching today assemblies', err);
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

    const fetchNextAssemblyNo = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/assembly/next-no`);
            if (response.ok) {
                const data = await response.json();
                setAssemblyNo(data.nextNo);
            }
        } catch (err) {
            console.error('Error fetching next assembly no', err);
        }
    };

    const fetchBomMaster = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bom/report`);
            if (response.ok) {
                const data = await response.json();
                setBomList(data);
            }
        } catch (err) {
            console.error('Error fetching BOM', err);
        }
    };

    useEffect(() => {
        fetchItems();
        fetchNextAssemblyNo();
        fetchBomMaster();
    }, []);

    useEffect(() => {
        fetchTodayAssemblies();
    }, [filterFromDate, filterToDate]);


    const handleSubmit = async () => {
        setError('');
        setSuccess('');

        if (!assemblyDate || !selectedItem || !quantity || quantity <= 0) {
            setError('Please fill all required fields with valid values.');
            return;
        }

        const payload = {
            AssemblyNo: assemblyNo,
            AssemblyDate: assemblyDate,
            ItemCode: selectedItem.ItemCode,
            Quantity: parseFloat(quantity),
            Remark: remark,
            CreatedBy: user?.username || user?.Username || 'Admin',
            UpdatedBy: user?.username || user?.Username || 'Admin'
        };

        try {
            const url = editingId 
                ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/assembly/${editingId}`
                : `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/assembly`;

            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setSuccess(editingId ? 'Assembly transaction updated successfully!' : 'Assembly transaction completed successfully!');
                setSelectedItem(null);
                setQuantity('');
                setRemark('');
                setEditingId(null);
                fetchNextAssemblyNo();
                fetchTodayAssemblies();
                fetchItems(); // refresh stock
            } else {
                const data = await response.json();
                setError(data.message || 'Error processing transaction');
            }
        } catch (err) {
            console.error('Error saving assembly:', err);
            setError('Action failed. See console for details.');
        }
    };

    const getRequiredChildItems = () => {
        if (!selectedItem) return [];
        const q = parseFloat(quantity) || 0;
        const parentCode = String(selectedItem.ItemCode).trim().toLowerCase();
        
        return bomList
            .filter(b => String(b.ParentItemCode).trim().toLowerCase() === parentCode)
            .map(b => {
                const childCode = String(b.ChildItemCode).trim().toLowerCase();
                const itemObj = items.find(i => String(i.ItemCode).trim().toLowerCase() === childCode);
                return {
                    ChildItemCode: b.ChildItemCode,
                    ChildItemName: itemObj ? itemObj.ItemName : 'Unknown',
                    BOMQuantity: b.Quantity,
                    RequiredQuantity: b.Quantity * q,
                    CurrentStock: itemObj ? itemObj.ClosingStock : 0
                };
            });
    };

    const requiredItems = getRequiredChildItems();

    const handleEdit = (row) => {
        setEditingId(row.Id);
        setAssemblyNo(row.AssemblyNo);
        setAssemblyDate(new Date(row.AssemblyDate).toISOString().split('T')[0]);
        setQuantity(row.Quantity);
        setRemark(row.Remark || '');
        
        const parentItem = items.find(i => String(i.ItemCode).trim().toLowerCase() === String(row.ItemCode).trim().toLowerCase());
        setSelectedItem(parentItem || null);
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };



    const handleDeleteClick = (row) => {
        setAssemblyToDelete(row);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!assemblyToDelete) return;
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/assembly/${assemblyToDelete.Id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                setSuccess('Assembly transaction deleted successfully');
                fetchTodayAssemblies();
                fetchItems(); // refresh stock
                
                if (editingId === assemblyToDelete.Id) {
                    setEditingId(null);
                    setSelectedItem(null);
                    setQuantity('');
                    setRemark('');
                    fetchNextAssemblyNo();
                }
            } else {
                const data = await response.json();
                setError(data.message || 'Error deleting transaction');
            }
        } catch (err) {
            console.error('Error deleting:', err);
            setError('Action failed. See console for details.');
        } finally {
            setDeleteDialogOpen(false);
            setAssemblyToDelete(null);
        }
    };



    const maxItemLength = items.length > 0 ? Math.max(...items.map(i => (`${i.ItemCode} - ${i.ItemName}`).length)) : 15;

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BuildIcon /> Assembly Transaction
                </Typography>
            </Box>

            <Paper sx={{ width: '100%', mb: 2, p: 3, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

                <Grid container spacing={2}>
                    <Grid item xs={12} sm={2}>
                        <TextField
                            fullWidth
                            label="Assembly No"
                            size="small"
                            value={assemblyNo}
                            InputProps={{ readOnly: true }}
                            disabled
                        />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                        <TextField
                            fullWidth
                            label="Assembly Date"
                            type="date"
                            size="small"
                            value={assemblyDate}
                            onChange={(e) => setAssemblyDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            required
                        />
                    </Grid>
                    <Grid item xs={12} sm={1}>
                        <TextField
                            fullWidth
                            label="Quantity"
                            type="number"
                            size="small"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            required
                        />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Autocomplete
                            fullWidth
                            options={items.filter(item => item.ItemType && item.ItemType.toLowerCase() === 'finished')}
                            getOptionLabel={(option) => option ? `${option.ItemCode} - ${option.ItemName}` : ''}
                            value={selectedItem}
                            onChange={(e, newValue) => setSelectedItem(newValue)}
                            renderInput={(params) => <TextField {...params} label="Select Parent Item" size="small" required />}
                            sx={{ minWidth: `${Math.max(20, maxItemLength) + 6}ch` }}
                            slotProps={{ paper: { sx: { width: 'max-content', minWidth: '100%' } } }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <TextField
                            fullWidth
                            label="Remark (Optional)"
                            size="small"
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                        />
                    </Grid>
                </Grid>

                {selectedItem && (
                    <Box sx={{ mt: 4 }}>
                        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: '#0F3B66' }}>
                            Required Child Items (BOM)
                        </Typography>
                        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                            <Table size="small">
                                <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                                    <TableRow>
                                        <TableCell><strong>Child Item</strong></TableCell>
                                        <TableCell align="right"><strong>BOM Qty</strong></TableCell>
                                        <TableCell align="right"><strong>Required Qty</strong></TableCell>
                                        <TableCell align="right"><strong>Current Stock</strong></TableCell>
                                        <TableCell align="center"><strong>Status</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {requiredItems.length > 0 ? requiredItems.map((row, index) => {
                                        const isShort = row.CurrentStock < row.RequiredQuantity;
                                        return (
                                            <TableRow key={index} sx={{ backgroundColor: isShort ? '#ffebee' : 'inherit' }}>
                                                <TableCell>{row.ChildItemCode} - {row.ChildItemName}</TableCell>
                                                <TableCell align="right">{row.BOMQuantity}</TableCell>
                                                <TableCell align="right">{row.RequiredQuantity}</TableCell>
                                                <TableCell align="right">{row.CurrentStock}</TableCell>
                                                <TableCell align="center">
                                                    {isShort && quantity > 0 ? (
                                                        <Typography color="error" variant="caption" fontWeight="bold">Insufficient</Typography>
                                                    ) : (
                                                        <Typography color="success.main" variant="caption" fontWeight="bold">OK</Typography>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }) : (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center">No BOM defined for this item.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={handleSubmit}
                        disabled={(editingId ? !hasEditPermission() : !hasAddPermission()) || !selectedItem || !quantity || quantity <= 0 || requiredItems.length === 0 || requiredItems.some(r => r.CurrentStock < r.RequiredQuantity)}
                    >
                        {editingId ? 'Update Assembly' : 'Assemble'}
                    </Button>
                </Box>
            </Paper>

            <Paper sx={{ width: '100%', p: 3, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#0F3B66' }}>
                        Assembly Transactions
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            label="From Date"
                            type="date"
                            size="small"
                            value={filterFromDate}
                            onChange={(e) => setFilterFromDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                            label="To Date"
                            type="date"
                            size="small"
                            value={filterToDate}
                            onChange={(e) => setFilterToDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Box>
                </Box>
                <TableContainer>
                        <Table size="small">
                            <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                                <TableRow>
                                    <TableCell><strong>Assembly No</strong></TableCell>
                                    <TableCell><strong>Item</strong></TableCell>
                                    <TableCell align="right"><strong>Quantity</strong></TableCell>
                                    <TableCell align="center"><strong>Actions</strong></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {todayAssemblies.map((row) => (
                                    <TableRow key={row.Id}>
                                        <TableCell>{row.AssemblyNo}</TableCell>
                                        <TableCell>{row.ItemCode} - {row.ItemName}</TableCell>
                                        <TableCell align="right">{row.Quantity}</TableCell>
                                        <TableCell align="center">

                                            <IconButton color="primary" size="small" onClick={() => handleEdit(row)} disabled={!hasEditPermission()}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton color="error" size="small" onClick={() => handleDeleteClick(row)} disabled={!hasDeletePermission()}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {todayAssemblies.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center">No transactions found.</TableCell>
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
                itemName={`Assembly Transaction #${assemblyToDelete?.AssemblyNo}`}
            />



        </Box>
    );
};

export default Assembly;
