import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, 
  Autocomplete, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, IconButton, Alert, Divider
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';

const BOMMaster = () => {
  const [items, setItems] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  
  const [selectedParent, setSelectedParent] = useState(null);
  const [bomItems, setBomItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch all items and classify them
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items`);
        const data = await response.json();
        if (response.ok && Array.isArray(data)) {
          setItems(data);
          // Finished goods are items where ItemType is Finished
          setFinishedGoods(data.filter(item => item.ItemType === 'Finished'));
          // Raw materials are items where ItemType is not Finished
          setRawMaterials(data.filter(item => item.ItemType !== 'Finished'));
        }
      } catch (error) {
        console.error('Error fetching items:', error);
        setError('Failed to load items.');
      }
    };
    fetchItems();
  }, []);

  // Fetch BOM when parent is selected
  useEffect(() => {
    const fetchBOM = async () => {
      if (!selectedParent) {
        setBomItems([]);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bom/${selectedParent.ItemCode}`);
        if (response.ok) {
          const data = await response.json();
          // Map backend structure to frontend structure
          setBomItems(data.map(item => ({
            ChildItemCode: item.ChildItemCode,
            Quantity: item.Quantity
          })));
        } else {
          setBomItems([]);
        }
      } catch (err) {
        console.error('Error fetching BOM:', err);
        setError('Failed to fetch existing BOM.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchBOM();
  }, [selectedParent]);

  const handleAddRow = () => {
    setBomItems([...bomItems, { ChildItemCode: null, Quantity: '' }]);
  };

  const handleRemoveRow = (index) => {
    const updated = [...bomItems];
    updated.splice(index, 1);
    setBomItems(updated);
  };

  const handleItemChange = (index, newValue) => {
    const updated = [...bomItems];
    updated[index].ChildItemCode = newValue ? newValue.ItemCode : null;
    setBomItems(updated);
  };

  const handleQuantityChange = (index, value) => {
    const updated = [...bomItems];
    updated[index].Quantity = value;
    setBomItems(updated);
  };

  const handleSave = async () => {
    setError('');
    setSuccessMessage('');

    if (!selectedParent) {
      setError('Please select a Finished Good first.');
      return;
    }

    // Filter out invalid rows
    const validItems = bomItems.filter(item => item.ChildItemCode && parseFloat(item.Quantity) > 0);
    
    if (bomItems.length > 0 && validItems.length !== bomItems.length) {
      setError('Please ensure all added materials have a valid item selected and quantity > 0. Remove empty rows.');
      return;
    }

    const payload = {
      ParentItemCode: selectedParent.ItemCode,
      items: validItems
    };

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setSuccessMessage('Bill of Materials saved successfully!');
        setSelectedParent(null);
        setBomItems([]);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        const data = await response.json();
        setError(data.message || 'Error saving BOM.');
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
          Bill of Materials (BOM)
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          1. Select Finished Good
        </Typography>
        <Autocomplete
          options={finishedGoods}
          getOptionLabel={(option) => `${option.ItemCode} - ${option.ItemName}`}
          value={selectedParent}
          onChange={(event, newValue) => setSelectedParent(newValue)}
          renderInput={(params) => <TextField {...params} label="Finished Good (Items with Series)" size="small" />}
          sx={{ maxWidth: 500 }}
          autoHighlight
        />
      </Paper>

      <Paper sx={{ p: 0, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 2 }, display: 'flex', justifyContent: 'space-between', pt: 2, pb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            2. Raw Materials Required
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button 
              variant="outlined" 
              color="secondary" 
              startIcon={<AddIcon />}
              onClick={handleAddRow}
              disabled={!selectedParent || !hasAddPermission()}
            >
              Add Material
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={!selectedParent || loading || !hasAddPermission()}
            >
              Save
            </Button>
          </Box>
        </Toolbar>

        <Divider />

        <TableContainer sx={{ p: 2 }}>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 40 } }} aria-labelledby="tableTitle">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, width: '60%' }}>Raw Material</TableCell>
                <TableCell sx={{ fontWeight: 600, width: '20%' }}>Quantity</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: '10%' }}>Unit</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: '10%' }}>Remove</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!selectedParent ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    Please select a Finished Good to view or add raw materials.
                  </TableCell>
                </TableRow>
              ) : bomItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    No raw materials added yet. Click "Add Material" to build the recipe.
                  </TableCell>
                </TableRow>
              ) : (
                bomItems.map((row, index) => {
                  const selectedChild = rawMaterials.find(rm => rm.ItemCode === row.ChildItemCode) || null;
                  return (
                    <TableRow hover key={index}>
                      <TableCell>
                        <Autocomplete
                          options={rawMaterials}
                          getOptionLabel={(option) => `${option.ItemCode} - ${option.ItemName}`}
                          value={selectedChild}
                          onChange={(e, val) => handleItemChange(index, val)}
                          renderInput={(params) => <TextField {...params} placeholder="Select Material" size="small" />}
                          autoHighlight
                          disableClearable
                        />
                      </TableCell>
                      <TableCell>
                        <TextField 
                          type="number"
                          size="small"
                          value={row.Quantity}
                          onChange={(e) => handleQuantityChange(index, e.target.value)}
                          onWheel={(e) => e.target.blur()}
                          placeholder="0.000"
                          fullWidth
                          sx={{
                            '& input[type=number]': {
                              '-moz-appearance': 'textfield'
                            },
                            '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                              '-webkit-appearance': 'none',
                              margin: 0
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {selectedChild ? selectedChild.Unit : '-'}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton color="error" size="small" onClick={() => handleRemoveRow(index)} disabled={!hasDeletePermission()}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default BOMMaster;
