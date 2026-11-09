import React, { useState, useEffect, useMemo, useRef } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import {
    Box, Typography, Paper, Toolbar, Button, TextField,
    Grid, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Divider, Tabs, Tab,
    Popover, InputAdornment, Tooltip, Chip
} from '@mui/material';
import { 
    BuildCircle as BuildIcon, Edit as EditIcon, Delete as DeleteIcon, Visibility as ViewIcon, Close as CloseIcon, Description as DescriptionIcon,
    Search as SearchIcon, ArrowDropDown as ArrowDropDownIcon, TableChart as TableChartIcon
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

    // Dropdown & Search state for Parent Item
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [itemModalOpen, setItemModalOpen] = useState(false);
    const anchorRef = useRef(null);

    // Parent items eligible for assembly (FG, SF, Inhouse)
    const parentItems = useMemo(() => {
        return items.filter(item => {
            const t = (item.ItemType || '').trim().toLowerCase();
            return ['fg', 'sf', 'finished', 'finished good', 'semi-finished'].includes(t) || item.Category === 'Inhouse';
        });
    }, [items]);

    // Filtered parent items based on search query
    const filteredParentItems = useMemo(() => {
        if (!searchQuery.trim()) return parentItems;
        const q = searchQuery.toLowerCase().trim();
        return parentItems.filter(item => 
            (item.ItemCode || '').toLowerCase().includes(q) ||
            (item.SubCode || '').toLowerCase().includes(q) ||
            (item.ItemName || '').toLowerCase().includes(q) ||
            (item.ItemType || '').toLowerCase().includes(q)
        );
    }, [parentItems, searchQuery]);
    
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
            SubCode: selectedItem.SubCode || '',
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
        const parentSub = String(selectedItem.SubCode || '').trim().toLowerCase();
        
        return bomList
            .filter(b => String(b.ParentItemCode).trim().toLowerCase() === parentCode && String(b.ParentSubCode || '').trim().toLowerCase() === parentSub)
            .map(b => {
                const childCode = String(b.ChildItemCode).trim().toLowerCase();
                const childSub = String(b.ChildSubCode || '').trim().toLowerCase();
                const itemObj = items.find(i => String(i.ItemCode).trim().toLowerCase() === childCode && String(i.SubCode || '').trim().toLowerCase() === childSub);
                return {
                    ChildItemCode: b.ChildItemCode,
                    ChildSubCode: b.ChildSubCode || '',
                    ChildItemName: itemObj ? itemObj.ItemName : (b.ChildItemName || 'Unknown'),
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
        
        const parentItem = items.find(i => 
            String(i.ItemCode).trim().toLowerCase() === String(row.ItemCode).trim().toLowerCase() &&
            String(i.SubCode || '').trim().toLowerCase() === String(row.SubCode || '').trim().toLowerCase()
        );
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

                <Grid container spacing={2} alignItems="center">
                    {/* Row 1: Document details */}
                    <Grid item xs={6} sm={3} md={2}>
                        <TextField
                            fullWidth
                            label="Assembly No"
                            size="small"
                            value={assemblyNo}
                            InputProps={{ readOnly: true }}
                            disabled
                        />
                    </Grid>
                    <Grid item xs={6} sm={3} md={2}>
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
                    <Grid item xs={12} sm={6} md={8}>
                        <TextField
                            fullWidth
                            label="Remark (Optional)"
                            size="small"
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                        />
                    </Grid>

                    {/* Row 2: Select Parent Item (Wide Searchable Table-Style Dropdown & Modal Picker) & Quantity */}
                    <Grid item xs={12} sm={9} md={10}>
                        <Box ref={anchorRef} sx={{ width: '100%', position: 'relative' }}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Select Parent Item (Finished Goods / Semi-Finished)"
                                required
                                value={dropdownOpen ? searchQuery : (selectedItem ? `${selectedItem.ItemCode}${selectedItem.SubCode ? ` / ${selectedItem.SubCode}` : ''} - ${selectedItem.ItemName}` : '')}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    if (!dropdownOpen) setDropdownOpen(true);
                                }}
                                onClick={() => {
                                    if (!dropdownOpen) {
                                        setSearchQuery('');
                                        setDropdownOpen(true);
                                    }
                                }}
                                placeholder={selectedItem ? `${selectedItem.ItemCode}${selectedItem.SubCode ? ` / ${selectedItem.SubCode}` : ''} - ${selectedItem.ItemName}` : "Click or type to search Parent Item by code, subcode, or name..."}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ color: '#0F3B66', fontSize: 20 }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end" sx={{ gap: 0.5 }}>
                                            {selectedItem && (
                                                <Chip
                                                    label={selectedItem.ItemType || 'FG'}
                                                    size="small"
                                                    sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700, bgcolor: '#e0f2fe', color: '#0369a1' }}
                                                />
                                            )}
                                            {selectedItem && (
                                                <Tooltip title="Clear selection">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedItem(null);
                                                            setSearchQuery('');
                                                        }}
                                                    >
                                                        <CloseIcon sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            <Tooltip title="Open full item table picker">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDropdownOpen(false);
                                                        setItemModalOpen(true);
                                                    }}
                                                    sx={{ color: '#0F3B66' }}
                                                >
                                                    <TableChartIcon sx={{ fontSize: 18 }} />
                                                </IconButton>
                                            </Tooltip>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDropdownOpen(prev => !prev);
                                                }}
                                            >
                                                <ArrowDropDownIcon />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                                sx={{
                                    bgcolor: '#ffffff',
                                    borderRadius: 1.5,
                                    '& .MuiInputBase-input': {
                                        fontWeight: selectedItem && !dropdownOpen ? 600 : 400,
                                        color: selectedItem && !dropdownOpen ? '#0F3B66' : '#1e293b',
                                        fontSize: '0.92rem'
                                    }
                                }}
                            />

                            {/* Dropdown Popover */}
                            <Popover
                                open={dropdownOpen}
                                anchorEl={anchorRef.current}
                                onClose={() => setDropdownOpen(false)}
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                                disableAutoFocus
                                disableEnforceFocus
                                PaperProps={{
                                    sx: {
                                        width: anchorRef.current ? Math.max(anchorRef.current.clientWidth, 820) : 820,
                                        maxWidth: '96vw',
                                        maxHeight: 440,
                                        boxShadow: '0 16px 36px rgba(15, 59, 102, 0.22)',
                                        borderRadius: 2,
                                        border: '1px solid #cbd5e1',
                                        mt: 0.8,
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }
                                }}
                            >
                                {/* Header bar inside dropdown */}
                                <Box sx={{ px: 2, py: 1.2, bgcolor: '#0F3B66', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <SearchIcon sx={{ fontSize: 16 }} /> Select Parent Item ({filteredParentItems.length} items)
                                    </Typography>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<TableChartIcon sx={{ fontSize: 14 }} />}
                                        onClick={() => {
                                            setDropdownOpen(false);
                                            setItemModalOpen(true);
                                        }}
                                        sx={{ 
                                            color: '#ffffff', 
                                            borderColor: 'rgba(255,255,255,0.4)', 
                                            textTransform: 'none', 
                                            fontSize: '0.75rem', 
                                            py: 0.2,
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', borderColor: '#ffffff' }
                                        }}
                                    >
                                        Full Table View
                                    </Button>
                                </Box>

                                {/* Column headers inside dropdown */}
                                <Box sx={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: '130px 90px 1fr 80px 100px', 
                                    bgcolor: '#f1f5f9', 
                                    px: 2, 
                                    py: 1, 
                                    borderBottom: '2px solid #e2e8f0', 
                                    fontWeight: 700, 
                                    fontSize: '0.75rem', 
                                    color: '#475569',
                                    letterSpacing: 0.5
                                }}>
                                    <Box>ITEM CODE</Box>
                                    <Box>SUB CODE</Box>
                                    <Box>FULL ITEM NAME & SPECIFICATION</Box>
                                    <Box sx={{ textAlign: 'center' }}>TYPE</Box>
                                    <Box sx={{ textAlign: 'right' }}>STOCK</Box>
                                </Box>

                                {/* Rows */}
                                <Box sx={{ overflowY: 'auto', flex: 1, maxHeight: 350 }}>
                                    {filteredParentItems.length === 0 ? (
                                        <Box sx={{ p: 4, textAlign: 'center', color: '#64748b' }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                No manufactured/parent items match "{searchQuery}"
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: '#94a3b8', mt: 0.5, display: 'block' }}>
                                                Only Finished Goods (FG) and Semi-Finished (SF) items can be assembled.
                                            </Typography>
                                        </Box>
                                    ) : (
                                        filteredParentItems.map((item) => {
                                            const isSelected = selectedItem?.ItemCode === item.ItemCode && (selectedItem?.SubCode || '') === (item.SubCode || '');
                                            return (
                                                <Box
                                                    key={`${item.ItemCode}-${item.SubCode || ''}`}
                                                    onClick={() => {
                                                        setSelectedItem(item);
                                                        setDropdownOpen(false);
                                                        setSearchQuery('');
                                                    }}
                                                    sx={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '130px 90px 1fr 80px 100px',
                                                        alignItems: 'center',
                                                        px: 2,
                                                        py: 1.2,
                                                        cursor: 'pointer',
                                                        bgcolor: isSelected ? '#eff6ff' : '#ffffff',
                                                        borderBottom: '1px solid #f1f5f9',
                                                        transition: 'background-color 0.15s ease',
                                                        '&:hover': {
                                                            bgcolor: isSelected ? '#dbeafe' : '#f8fafc'
                                                        }
                                                    }}
                                                >
                                                    <Typography sx={{ fontWeight: 700, color: '#0F3B66', fontSize: '0.86rem' }}>
                                                        {item.ItemCode}
                                                    </Typography>
                                                    <Typography sx={{ color: '#0284c7', fontSize: '0.84rem', fontWeight: 600 }}>
                                                        {item.SubCode || '—'}
                                                    </Typography>
                                                    <Typography sx={{ color: '#1e293b', fontSize: '0.88rem', fontWeight: 600, pr: 2 }}>
                                                        {item.ItemName}
                                                    </Typography>
                                                    <Box sx={{ textAlign: 'center' }}>
                                                        <Chip
                                                            label={item.ItemType || 'FG'}
                                                            size="small"
                                                            sx={{
                                                                height: 20,
                                                                fontSize: '0.68rem',
                                                                fontWeight: 700,
                                                                bgcolor: (item.ItemType || '').toLowerCase() === 'sf' ? '#fef3c7' : '#dcfce7',
                                                                color: (item.ItemType || '').toLowerCase() === 'sf' ? '#b45309' : '#15803d'
                                                            }}
                                                        />
                                                    </Box>
                                                    <Typography sx={{ textAlign: 'right', fontWeight: 700, color: (item.ClosingStock || 0) > 0 ? '#16a34a' : '#dc2626', fontSize: '0.86rem' }}>
                                                        {item.ClosingStock ?? 0} {item.Unit || ''}
                                                    </Typography>
                                                </Box>
                                            );
                                        })
                                    )}
                                </Box>
                            </Popover>
                        </Box>
                    </Grid>
                    <Grid item xs={6} sm={3} md={2}>
                        <TextField
                            fullWidth
                            label="Quantity"
                            type="number"
                            size="small"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            required
                            inputProps={{ min: 1, step: 'any', style: { textAlign: 'right' } }}
                            sx={{
                                maxWidth: 140,
                                '& input': { fontWeight: 600 }
                            }}
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
                                                <TableCell>{row.ChildItemCode}{row.ChildSubCode ? ` / ${row.ChildSubCode}` : ''} - {row.ChildItemName}</TableCell>
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
                                        <TableCell>{row.ItemCode}{row.SubCode ? ` / ${row.SubCode}` : ''} - {row.ItemName}</TableCell>
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

            {/* Full Item Selection Modal Dialog */}
            <Dialog
                open={itemModalOpen}
                onClose={() => setItemModalOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#0F3B66', color: '#ffffff', py: 1.5, px: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TableChartIcon /> Select Parent Item for Assembly
                    </Typography>
                    <IconButton onClick={() => setItemModalOpen(false)} sx={{ color: '#ffffff' }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 2.5 }}>
                    <TextField
                        fullWidth
                        size="small"
                        autoFocus
                        placeholder="Filter by item code, subcode, name, type..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ color: '#0F3B66' }} />
                                </InputAdornment>
                            )
                        }}
                        sx={{ mb: 2 }}
                    />
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow sx={{ '& th': { bgcolor: '#f8fafc', fontWeight: 700, color: '#334155' } }}>
                                    <TableCell>Item Code</TableCell>
                                    <TableCell>Sub Code</TableCell>
                                    <TableCell>Item Name</TableCell>
                                    <TableCell align="center">Type</TableCell>
                                    <TableCell align="right">Current Stock</TableCell>
                                    <TableCell align="center">Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredParentItems.map((item) => (
                                    <TableRow 
                                        key={`${item.ItemCode}-${item.SubCode || ''}`}
                                        hover
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => {
                                            setSelectedItem(item);
                                            setItemModalOpen(false);
                                            setSearchQuery('');
                                        }}
                                    >
                                        <TableCell sx={{ fontWeight: 700, color: '#0F3B66' }}>{item.ItemCode}</TableCell>
                                        <TableCell sx={{ color: '#0284c7', fontWeight: 600 }}>{item.SubCode || '—'}</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>{item.ItemName}</TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={item.ItemType || 'FG'}
                                                size="small"
                                                sx={{ 
                                                    height: 20, 
                                                    fontSize: '0.68rem', 
                                                    fontWeight: 700,
                                                    bgcolor: (item.ItemType || '').toLowerCase() === 'sf' ? '#fef3c7' : '#dcfce7',
                                                    color: (item.ItemType || '').toLowerCase() === 'sf' ? '#b45309' : '#15803d'
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: (item.ClosingStock || 0) > 0 ? '#16a34a' : '#dc2626' }}>
                                            {item.ClosingStock ?? 0} {item.Unit || ''}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Button
                                                size="small"
                                                variant="contained"
                                                sx={{ bgcolor: '#0F3B66', textTransform: 'none', py: 0.3, px: 1.8, borderRadius: 1.5, fontWeight: 700 }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedItem(item);
                                                    setItemModalOpen(false);
                                                    setSearchQuery('');
                                                }}
                                            >
                                                Select
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredParentItems.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#64748b' }}>
                                            No manufactured/parent items match your search.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 1.5, bgcolor: '#f8fafc', display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Showing {filteredParentItems.length} available parent items (Finished Goods & Semi-Finished)
                    </Typography>
                    <Button onClick={() => setItemModalOpen(false)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>



        </Box>
    );
};

export default Assembly;
