const fs = require('fs');

const file = 'e:/FactoryFlow/frontend/src/pages/InwardEntry.jsx';
const content = fs.readFileSync(file, 'utf8');

const newTop = `import React, { useState, useEffect } from 'react';
import { hasAddPermission, hasEditPermission, hasDeletePermission } from '../utils/auth';
import { 
  Box, Typography, Paper, Toolbar, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Autocomplete, Grid, Divider
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, Edit as EditIcon, Delete as DeleteIcon, Input as InputIcon, Visibility as ViewIcon, Close as CloseIcon, Description as DescriptionIcon, Print as PrintIcon } from '@mui/icons-material';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import PdfPreviewModal from '../components/common/PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const emptyRow = {
  ITEMCODE: '',
  GROSSWT: '',
  NETWT: '',
  SAMPLEPCS: '',
  SAMPLEWT: '',
  QUANTITY: '',
  UNIT: '',
  RATE: '',
  AMOUNT: ''
};

const InwardEntry = () => {`;

const replaced = content.replace(/^.*?const InwardEntry = \(\) => \{/s, newTop);

fs.writeFileSync(file, replaced);
console.log("Fixed InwardEntry.jsx");
