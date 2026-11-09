import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, 
  Autocomplete, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, IconButton, Alert, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  LinearProgress, Tabs, Tab
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon, FileUpload as ImportIcon, FileDownload as ExportIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { ensureNumericWorksheet } from '../utils/excelHelper';

const BOMMaster = () => {
  const [items, setItems] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedParent, setSelectedParent] = useState(null);
  const [bomItems, setBomItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Import States
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState({ added: [], updated: [], failed: [] });
  const [showImportResults, setShowImportResults] = useState(false);
  const [resultTab, setResultTab] = useState(0);

  // Fetch all items and classify them
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/items`);
        const data = await response.json();
        if (response.ok && Array.isArray(data)) {
          setItems(data);

          // Finished goods / assemblies are items where ItemType contains FINISH or ASSEMBLY, or Category is Inhouse/SubContract
          const finished = data.filter(item => {
            if (!item) return false;
            const type = (item.ItemType || '').trim().toUpperCase();
            const cat = (item.Category || '').trim().toUpperCase();
            return (
              type.includes('FINISH') ||
              type.includes('ASSEMBLY') ||
              type === 'FINISHED GOOD' ||
              type === 'SEMI-FINISHED' ||
              type === 'FINISHED' ||
              cat === 'INHOUSE' ||
              cat === 'SUBCONTRACT'
            );
          });

          // Always ensure finishedGoods has options (fallback to all items if none matched filter)
          const validFinished = finished.length > 0 ? finished : data;
          setFinishedGoods(validFinished);

          // Child parts / raw materials can be any item in the inventory (RM, Semi-Finished, BOP, Consumables, etc.)
          setRawMaterials(data);
        }
      } catch (error) {
        console.error('Error fetching items:', error);
        setError('Failed to load items.');
      }
    };
    fetchItems();
  }, []);

  // When navigated from BOM Report with edit state, auto-select the parent item
  useEffect(() => {
    if (location.state?.editParentCode && items.length > 0) {
      const targetCode = String(location.state.editParentCode).trim().toLowerCase();
      const targetSubCode = String(location.state.editParentSubCode || '').trim().toLowerCase();

      // 1. Try to find exact composite match (ItemCode and SubCode)
      let parentToEdit = items.find(it => 
        String(it.ItemCode || '').trim().toLowerCase() === targetCode &&
        String(it.SubCode || '').trim().toLowerCase() === targetSubCode
      );

      // 2. If not found with subcode, try match by ItemCode alone
      if (!parentToEdit) {
        parentToEdit = items.find(it => 
          String(it.ItemCode || '').trim().toLowerCase() === targetCode
        );
      }

      if (parentToEdit) {
        setSelectedParent(parentToEdit);
      }
    }
  }, [location.state, items]);

  // Fetch BOM when parent is selected
  useEffect(() => {
    const fetchBOM = async () => {
      if (!selectedParent) {
        setBomItems([]);
        return;
      }
      setLoading(true);
      try {
        const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bom/${encodeURIComponent(selectedParent.ItemCode)}?parentSubCode=${encodeURIComponent(selectedParent.SubCode || '')}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          // Map backend structure to frontend structure
          setBomItems(data.map(item => ({
            ChildItemCode: item.ChildItemCode,
            ChildSubCode: item.ChildSubCode || '',
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
    setBomItems([...bomItems, { ChildItemCode: null, ChildSubCode: '', Quantity: '' }]);
  };

  const handleRemoveRow = (index) => {
    const updated = [...bomItems];
    updated.splice(index, 1);
    setBomItems(updated);
  };

  const handleItemChange = (index, newValue) => {
    const updated = [...bomItems];
    updated[index].ChildItemCode = newValue ? newValue.ItemCode : null;
    updated[index].ChildSubCode = newValue ? (newValue.SubCode || '') : '';
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
      ParentSubCode: selectedParent.SubCode || '',
      items: validItems.map(item => ({
        ChildItemCode: item.ChildItemCode,
        ChildSubCode: item.ChildSubCode || '',
        Quantity: parseFloat(item.Quantity) || 0
      }))
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
        if (location.state?.editParentCode) {
          navigate(location.pathname, { replace: true, state: {} });
        }
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        const data = await response.json();
        setError(data.message || 'Error saving BOM.');
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bom/report`);
      const data = await response.json();
      if (response.ok) {
        const exportData = data.map(b => ({
          ParentItemCode: b.ParentItemCode,
          ParentSubCode: b.ParentSubCode || '',
          ChildItemCode: b.ChildItemCode,
          ChildSubCode: b.ChildSubCode || '',
          Quantity: Number(b.Quantity) || 0
        }));
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        ensureNumericWorksheet(worksheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "BOM");
        XLSX.writeFile(workbook, "BOMMaster.xlsx");
      }
    } catch (err) {
      console.error('Error exporting BOM:', err);
      setError('Failed to export BOM.');
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length > 0) {
          setImporting(true);
          setImportProgress(0);
          setImportResults({ added: [], updated: [], failed: [] });
          
          const BATCH_SIZE = 50;
          let processed = 0;
          const results = { added: [], updated: [], failed: [] };

          for (let i = 0; i < data.length; i += BATCH_SIZE) {
            const chunk = data.slice(i, i + BATCH_SIZE);
            
            try {
              const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bom/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chunk)
              });
              
              if (response.ok) {
                const resData = await response.json();
                results.added.push(...(resData.added || []));
                results.updated.push(...(resData.updated || []));
                results.failed.push(...(resData.failed || []));
              } else {
                const resData = await response.json();
                chunk.forEach(item => results.failed.push({ item, reason: resData.message || 'Server error' }));
              }
            } catch (err) {
              chunk.forEach(item => results.failed.push({ item, reason: err.message || 'Network error' }));
            }
            
            processed += chunk.length;
            setImportProgress(Math.round((processed / data.length) * 100));
          }
          
          setImportResults(results);
          setImporting(false);
          setShowImportResults(true);
          
          // Re-fetch BOM if a parent is selected
          if (selectedParent) {
            const fetchBOM = async () => {
              setLoading(true);
              try {
                const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bom/${encodeURIComponent(selectedParent.ItemCode)}?parentSubCode=${encodeURIComponent(selectedParent.SubCode || '')}`);
                if (response.ok) {
                  const data = await response.json();
                  setBomItems(data.map(item => ({ ChildItemCode: item.ChildItemCode, ChildSubCode: item.ChildSubCode || '', Quantity: item.Quantity })));
                }
              } catch (err) {} finally { setLoading(false); }
            };
            fetchBOM();
          }
        }
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Error parsing the Excel file.');
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // reset input
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1 }}>
          Bill of Materials (BOM)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <input
            accept=".xlsx, .xls"
            style={{ display: 'none' }}
            id="bom-import-file"
            type="file"
            onChange={handleImport}
          />
          <label htmlFor={hasAddPermission() ? "bom-import-file" : ""}>
            <Button disabled={!hasAddPermission()} 
              variant="outlined" 
              component="span"
              startIcon={<ImportIcon />}
              sx={{ boxShadow: 0 }}
            >
              Import
            </Button>
          </label>
          <Button 
            variant="outlined" 
            startIcon={<ExportIcon />}
            onClick={handleExport}
            sx={{ boxShadow: 0 }}
          >
            Export
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          1. Select Finished Good
        </Typography>
        <Autocomplete
          options={finishedGoods}
          getOptionLabel={(option) => {
            if (!option) return '';
            const sub = option.SubCode ? ` / ${option.SubCode}` : '';
            const type = option.ItemType ? ` [${option.ItemType}]` : '';
            return `${option.ItemCode}${sub} - ${option.ItemName}${type}`;
          }}
          isOptionEqualToValue={(option, value) => 
            option?.ItemCode === value?.ItemCode && 
            String(option?.SubCode || '').trim() === String(value?.SubCode || '').trim()
          }
          value={selectedParent}
          onChange={(event, newValue) => setSelectedParent(newValue)}
          renderInput={(params) => <TextField {...params} label="Select Finished Good / Manufactured Item" size="small" />}
          sx={{ maxWidth: '100%', width: { xs: '100%', sm: 500 } }}
          autoHighlight
        />
      </Paper>

      <Paper sx={{ p: 0, borderRadius: 2, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <Toolbar sx={{ pl: { xs: 1.5, sm: 2 }, pr: { xs: 1.5, sm: 2 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, pt: 2, pb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            2. Raw Materials Required
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, width: { xs: '100%', sm: 'auto' } }}>
            <Button 
              variant="outlined" 
              color="secondary" 
              startIcon={<AddIcon />}
              onClick={handleAddRow}
              disabled={!selectedParent || !hasAddPermission()}
              sx={{ flex: { xs: 1, sm: 'none' } }}
            >
              Add Material
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={!selectedParent || loading || !hasAddPermission()}
              sx={{ flex: { xs: 1, sm: 'none' } }}
            >
              Save
            </Button>
          </Box>
        </Toolbar>

        <Divider />

        <TableContainer>
          <Table size="small" sx={{ minWidth: 750, '& .MuiTableRow-root': { height: 32 } }} aria-labelledby="tableTitle">
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
                  const selectedChild = rawMaterials.find(rm => 
                    rm.ItemCode === row.ChildItemCode && 
                    String(rm.SubCode || '').trim() === String(row.ChildSubCode || '').trim()
                  ) || rawMaterials.find(rm => rm.ItemCode === row.ChildItemCode) || null;

                  return (
                    <TableRow hover key={index}>
                      <TableCell>
                        <Autocomplete
                          options={rawMaterials.filter(rm => !(selectedParent && rm.ItemCode === selectedParent.ItemCode && String(rm.SubCode || '').trim() === String(selectedParent.SubCode || '').trim()))}
                          getOptionLabel={(option) => {
                            if (!option) return '';
                            const sub = option.SubCode ? ` / ${option.SubCode}` : '';
                            const cat = option.Category ? ` (${option.Category})` : '';
                            return `${option.ItemCode}${sub} - ${option.ItemName}${cat}`;
                          }}
                          isOptionEqualToValue={(option, value) => 
                            option?.ItemCode === value?.ItemCode && 
                            String(option?.SubCode || '').trim() === String(value?.SubCode || '').trim()
                          }
                          value={selectedChild}
                          onChange={(e, val) => handleItemChange(index, val)}
                          renderInput={(params) => <TextField {...params} placeholder="Select Material / Child Part" size="small" />}
                          autoHighlight
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

      {/* Import Progress Dialog */}
      <Dialog open={importing} disableEscapeKeyDown>
        <DialogTitle>Importing BOM...</DialogTitle>
        <DialogContent sx={{ minWidth: 400 }}>
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress variant="determinate" value={importProgress} />
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
              {importProgress}% Complete
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Import Results Dialog */}
      <Dialog open={showImportResults} onClose={() => setShowImportResults(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import Results</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={resultTab} onChange={(e, val) => setResultTab(val)}>
              <Tab label={`Added (${importResults.added.length})`} />
              <Tab label={`Updated (${importResults.updated.length})`} />
              <Tab label={`Failed (${importResults.failed.length})`} sx={{ color: importResults.failed.length > 0 ? 'error.main' : 'inherit' }} />
            </Tabs>
          </Box>
          <Box sx={{ mt: 2 }}>
            {resultTab === 0 && (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ParentItemCode</TableCell>
                      <TableCell>ChildItemCode</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importResults.added.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.ParentItemCode}</TableCell>
                        <TableCell>{item.ChildItemCode}</TableCell>
                      </TableRow>
                    ))}
                    {importResults.added.length === 0 && <TableRow><TableCell colSpan={2} align="center">No items added</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {resultTab === 1 && (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ParentItemCode</TableCell>
                      <TableCell>ChildItemCode</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importResults.updated.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.ParentItemCode}</TableCell>
                        <TableCell>{item.ChildItemCode}</TableCell>
                      </TableRow>
                    ))}
                    {importResults.updated.length === 0 && <TableRow><TableCell colSpan={2} align="center">No items updated</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {resultTab === 2 && (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Parent</TableCell>
                      <TableCell>Child</TableCell>
                      <TableCell sx={{ color: 'error.main' }}>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importResults.failed.map((fail, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{fail.item?.ParentItemCode || 'Unknown'}</TableCell>
                        <TableCell>{fail.item?.ChildItemCode || 'Unknown'}</TableCell>
                        <TableCell sx={{ color: 'error.main' }}>{fail.reason}</TableCell>
                      </TableRow>
                    ))}
                    {importResults.failed.length === 0 && <TableRow><TableCell colSpan={3} align="center">No failed items</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportResults(false)} variant="contained">Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BOMMaster;
