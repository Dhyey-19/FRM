import React, { useState } from 'react';
import { Button, Menu, MenuItem, Box, TextField, Popover, Typography } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';

const TransactionFilter = ({ onFilterChange }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const [filterType, setFilterType] = useState('today'); // 'today', 'last50', 'custom'
    const today = new Date().toISOString().split('T')[0];
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);

    const handleClick = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const applyFilter = (type) => {
        setFilterType(type);
        if (type === 'custom') {
            onFilterChange({ filter: 'custom', fromDate, toDate });
        } else {
            onFilterChange({ filter: type });
        }
        handleClose();
    };

    const getButtonText = () => {
        if (filterType === 'today') return 'Today';
        if (filterType === 'last50') return 'Last 50 Records';
        if (filterType === 'custom') return 'Custom Range';
        if (filterType === 'custom_menu') return 'Custom Range';
        return 'Show Entries';
    };

    return (
        <Box>
            <Button variant="outlined" onClick={handleClick} startIcon={<FilterListIcon />}>
                Show Entries: {getButtonText()}
            </Button>
            <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
            >
                <Box p={2} display="flex" flexDirection="column" gap={1} minWidth={200}>
                    <Button 
                        variant={filterType === 'today' ? 'contained' : 'outlined'} 
                        onClick={() => applyFilter('today')}
                        fullWidth
                    >
                        Today
                    </Button>
                    <Button 
                        variant={filterType === 'last50' ? 'contained' : 'outlined'} 
                        onClick={() => applyFilter('last50')}
                        fullWidth
                    >
                        Last 50 Records
                    </Button>
                    <Button 
                        variant={filterType === 'custom' || filterType === 'custom_menu' ? 'contained' : 'outlined'} 
                        onClick={() => setFilterType('custom_menu')}
                        fullWidth
                    >
                        Custom Range
                    </Button>
                    
                    {(filterType === 'custom' || filterType === 'custom_menu') && (
                        <Box display="flex" flexDirection="column" gap={1} mt={1} pt={1} borderTop="1px solid #eee">
                            <Typography variant="caption" color="textSecondary">Select Date Range:</Typography>
                            <TextField 
                                type="date" 
                                label="From" 
                                value={fromDate} 
                                onChange={(e) => setFromDate(e.target.value)} 
                                size="small" 
                                InputLabelProps={{ shrink: true }} 
                                fullWidth
                            />
                            <TextField 
                                type="date" 
                                label="To" 
                                value={toDate} 
                                onChange={(e) => setToDate(e.target.value)} 
                                size="small" 
                                InputLabelProps={{ shrink: true }} 
                                fullWidth
                            />
                            <Button 
                                variant="contained" 
                                color="secondary" 
                                onClick={() => applyFilter('custom')}
                                fullWidth
                            >
                                Apply
                            </Button>
                        </Box>
                    )}
                </Box>
            </Popover>
        </Box>
    );
};

export default TransactionFilter;
