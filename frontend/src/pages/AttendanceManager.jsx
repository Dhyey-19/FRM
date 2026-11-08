import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link as MuiLink,
  Paper,
  Tabs,
  Tab,
  Toolbar,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Alert,
  Card,
  CardContent,
  Grid,
  Tooltip,
  CircularProgress,
  Divider,
  TableSortLabel
} from '@mui/material';
import {
  Home as HomeIcon,
  CloudUpload as UploadIcon,
  Search as SearchIcon,
  Assessment as ReportsIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as TimeIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileDownload as DownloadIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Calculate as CalculateIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const AttendanceManager = () => {
  const [currentTab, setCurrentTab] = useState(0);

  // Data states
  const [loading, setLoading] = useState(false);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Summary report data
  const [summaryStats, setSummaryStats] = useState({
    totalEmployees: 0,
    totalPresentDays: 0,
    totalAbsentDays: 0,
    totalWeekOffDays: 0,
    totalNetHours: 0,
    totalCalculatedSalary: 0,
    totalOvertimePay: 0,
    totalNetSalary: 0
  });
  const [records, setRecords] = useState([]);

  // Matrix view data
  const [matrixData, setMatrixData] = useState({ daysInMonth: 31, employees: [] });
  const [matrixLoading, setMatrixLoading] = useState(false);

  // Single employee daily punches view
  const [selectedEmpCode, setSelectedEmpCode] = useState('');
  const [employeeDetail, setEmployeeDetail] = useState(null);
  const [dailyLogsLoading, setDailyLogsLoading] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Salary Override Modal
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideRecord, setOverrideRecord] = useState(null);
  const [overrideForm, setOverrideForm] = useState({
    PayableDays: 0,
    BaseSalary: 0,
    CalculatedSalary: 0,
    OvertimePay: 0,
    Deductions: 0,
    NetSalary: 0,
    Remarks: ''
  });

  // Sorting for summary table
  const [sortConfig, setSortConfig] = useState({ key: 'BiometricCode', direction: 'asc' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Recalculate as per master state
  const [recalculating, setRecalculating] = useState(false);
  const [recalculateMessage, setRecalculateMessage] = useState('');

  const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/attendance`;

  // Recalculate all employee salaries for the selected month as per current User Master
  const handleRecalculateAsPerMaster = async () => {
    if (!selectedMonth) return;
    setRecalculating(true);
    setRecalculateMessage('');
    try {
      const res = await fetch(`${API_BASE}/recalculate-master`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthYear: selectedMonth })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRecalculateMessage(data.message || 'Salaries successfully recalculated as per User Master.');
        fetchSummary(selectedMonth, selectedDept, searchTerm);
        if (currentTab === 1) fetchMatrix(selectedMonth);
      } else {
        alert(data.message || 'Error recalculating salaries');
      }
    } catch (err) {
      console.error('Error recalculating salaries:', err);
      alert('Error recalculating salaries: ' + err.message);
    } finally {
      setRecalculating(false);
    }
  };

  // Fetch summary report for selected month
  const fetchSummary = async (monthToFetch = selectedMonth, dept = selectedDept, search = searchTerm) => {
    setLoading(true);
    try {
      let url = `${API_BASE}/summary?`;
      if (monthToFetch) url += `monthYear=${encodeURIComponent(monthToFetch)}&`;
      if (dept && dept !== 'ALL') url += `department=${encodeURIComponent(dept)}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setAvailableMonths(data.availableMonths || []);
        if (!selectedMonth && data.selectedMonth) {
          setSelectedMonth(data.selectedMonth);
        }
        setDepartments(data.departments || []);
        setSummaryStats(data.stats || {});
        setRecords(data.records || []);
      }
    } catch (err) {
      console.error('Error fetching attendance summary:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch matrix view
  const fetchMatrix = async (month = selectedMonth) => {
    if (!month) return;
    setMatrixLoading(true);
    try {
      const res = await fetch(`${API_BASE}/matrix/${encodeURIComponent(month)}`);
      const data = await res.json();
      if (res.ok) {
        setMatrixData(data);
      }
    } catch (err) {
      console.error('Error fetching matrix:', err);
    } finally {
      setMatrixLoading(false);
    }
  };

  // Fetch single employee daily punches
  const fetchEmployeeDailyLogs = async (bioCode, month = selectedMonth) => {
    if (!bioCode || !month) return;
    setDailyLogsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/daily-log/${encodeURIComponent(bioCode)}/${encodeURIComponent(month)}`);
      const data = await res.json();
      if (res.ok) {
        setEmployeeDetail(data);
      }
    } catch (err) {
      console.error('Error fetching employee daily log:', err);
    } finally {
      setDailyLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      if (currentTab === 0) fetchSummary(selectedMonth, selectedDept, searchTerm);
      if (currentTab === 1) fetchMatrix(selectedMonth);
      if (currentTab === 3 && selectedEmpCode) fetchEmployeeDailyLogs(selectedEmpCode, selectedMonth);
    }
  }, [selectedMonth, currentTab]);

  const handleMonthChange = (e) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    fetchSummary(newMonth, selectedDept, searchTerm);
    if (currentTab === 1) fetchMatrix(newMonth);
  };

  const handleDeptChange = (e) => {
    const newDept = e.target.value;
    setSelectedDept(newDept);
    fetchSummary(selectedMonth, newDept, searchTerm);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    fetchSummary(selectedMonth, selectedDept, val);
  };

  // Handle file drop & selection
  const handleFileSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setUploadError('Only PDF files (.pdf) generated by biometric machine are supported.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setUploadError('');
      setUploadResult(null);
    }
  };

  // Process upload
  const handleUploadSubmit = async (useSample = false) => {
    setUploading(true);
    setUploadError('');
    setUploadResult(null);

    try {
      let res;
      if (useSample) {
        res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ useSample: true })
        });
      } else {
        if (!selectedFile) {
          setUploadError('Please select a biometric PDF file first.');
          setUploading(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', selectedFile);

        res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          body: formData
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setUploadResult(data);
        setSelectedMonth(data.monthYear);
        fetchSummary(data.monthYear, 'ALL', '');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setUploadError(data.message || 'Error processing attendance file.');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError('Network error uploading file: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Open Salary Override Modal
  const handleOpenOverride = (record) => {
    setOverrideRecord(record);
    setOverrideForm({
      PayableDays: parseFloat(record.PayableDays) || 0,
      BaseSalary: parseFloat(record.BaseSalary) || 0,
      CalculatedSalary: parseFloat(record.CalculatedSalary) || 0,
      OvertimePay: parseFloat(record.OvertimePay) || 0,
      Deductions: parseFloat(record.Deductions) || 0,
      NetSalary: parseFloat(record.NetSalary) || 0,
      Remarks: record.Remarks || ''
    });
    setOverrideModalOpen(true);
  };

  const handleOverrideFieldChange = (field, value) => {
    const updated = { ...overrideForm, [field]: value };

    // Auto-recalculate if user changes PayableDays, BaseSalary, OT, or Deductions
    const pDays = field === 'PayableDays' ? parseFloat(value) || 0 : parseFloat(updated.PayableDays) || 0;
    const bSal = field === 'BaseSalary' ? parseFloat(value) || 0 : parseFloat(updated.BaseSalary) || 0;
    const ot = field === 'OvertimePay' ? parseFloat(value) || 0 : parseFloat(updated.OvertimePay) || 0;
    const ded = field === 'Deductions' ? parseFloat(value) || 0 : parseFloat(updated.Deductions) || 0;

    let calcSal = updated.CalculatedSalary;
    if (field === 'PayableDays' || field === 'BaseSalary') {
      const totalDays = overrideRecord.TotalDaysInMonth || 31;
      if (overrideRecord.SalaryType === 'Daily') {
        calcSal = Math.round(bSal * pDays);
      } else if (overrideRecord.SalaryType === 'Hourly') {
        calcSal = Math.round(bSal * (overrideRecord.TotalNetWorkHoursDecimal || 0));
      } else {
        calcSal = Math.round((bSal / totalDays) * pDays);
      }
      updated.CalculatedSalary = calcSal;
    }

    updated.NetSalary = Math.round((parseFloat(updated.CalculatedSalary) || 0) + ot - ded);
    setOverrideForm(updated);
  };

  const handleSaveOverride = async () => {
    if (!overrideRecord) return;
    try {
      const res = await fetch(`${API_BASE}/summary/${overrideRecord.Id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrideForm)
      });
      if (res.ok) {
        setOverrideModalOpen(false);
        fetchSummary(selectedMonth, selectedDept, searchTerm);
      } else {
        const d = await res.json();
        alert(d.message || 'Failed to update record');
      }
    } catch (e) {
      console.error(e);
      alert('Error updating: ' + e.message);
    }
  };

  // View specific employee daily punch logs
  const handleViewEmployeeLogs = (bioCode) => {
    setSelectedEmpCode(bioCode);
    setCurrentTab(3);
    fetchEmployeeDailyLogs(bioCode, selectedMonth);
  };

  // Sorting
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedRecords = [...records].sort((a, b) => {
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];
    if (sortConfig.key === 'BiometricCode') {
      valA = parseInt(valA, 10) || 0;
      valB = parseInt(valB, 10) || 0;
    }
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Export to Excel
  const handleExportExcel = () => {
    if (!records || records.length === 0) return;
    const excelRows = records.map((r, i) => ({
      'Sr. No': i + 1,
      'Biometric ID': r.BiometricCode,
      'Employee Name': r.EmployeeName,
      'Department': r.Department,
      'Designation': r.Designation,
      'Total Month Days': r.TotalDaysInMonth,
      'Present Days': r.PresentDays,
      'Absent Days': r.AbsentDays,
      'Half Days': r.HalfDays,
      'Week-Offs': r.WeekOffDays,
      'Payable Days': r.PayableDays,
      'Gross Hours': r.TotalGrossHours,
      'Net Work Hours': r.TotalNetWorkHoursDecimal,
      'Overtime Hours': r.TotalOvertimeHoursDecimal,
      'Salary Type': r.SalaryType,
      'Base Salary (₹)': r.BaseSalary,
      'Calculated Salary (₹)': r.CalculatedSalary,
      'Overtime Pay (₹)': r.OvertimePay,
      'Deductions (₹)': r.Deductions,
      'Net Salary (₹)': r.NetSalary,
      'Remarks': r.Remarks || ''
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance_Salary');
    XLSX.writeFile(wb, `Attendance_Salary_${selectedMonth || 'Report'}.xlsx`);
  };

  // Export Muster Roll Matrix to Excel
  const handleExportMatrixExcel = () => {
    if (!matrixData.employees || matrixData.employees.length === 0) return;
    const daysCount = matrixData.daysInMonth || 31;
    const rows = matrixData.employees.map((emp, idx) => {
      const row = {
        'Sr. No': idx + 1,
        'Biometric ID': emp.BiometricCode,
        'Employee Name': emp.EmployeeName,
        'Department': emp.Department
      };
      for (let d = 1; d <= daysCount; d++) {
        row[`D${d}`] = emp.days[d] ? emp.days[d].status : '-';
      }
      row['Present'] = emp.PresentDays;
      row['Absent'] = emp.AbsentDays;
      row['Week-Off'] = emp.WeekOffDays;
      row['Half Day'] = emp.HalfDays;
      row['Net Salary (₹)'] = emp.NetSalary;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Muster_Roll');
    XLSX.writeFile(wb, `Muster_Roll_${selectedMonth || 'Report'}.xlsx`);
  };

  // PDF Export
  const handleExportPDF = () => {
    if (!records || records.length === 0) return;
    const doc = new jsPDF('landscape');
    doc.setFontSize(14);
    doc.text(`Monthly Attendance & Salary Report - ${selectedMonth || ''}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Total Employees: ${summaryStats.totalEmployees} | Total Net Salary: ₹${summaryStats.totalNetSalary.toLocaleString('en-IN')}`, 14, 22);

    const tableCols = [
      '#', 'Bio ID', 'Employee Name', 'Dept', 'Present', 'Absent', 'WO', 'Gross Hrs', 'Payable Days', 'Base Sal (₹)', 'OT Pay (₹)', 'Net Sal (₹)'
    ];

    const tableRows = records.map((r, i) => [
      i + 1,
      r.BiometricCode,
      r.EmployeeName,
      r.Department,
      r.PresentDays,
      r.AbsentDays,
      r.WeekOffDays,
      r.TotalGrossHours,
      r.PayableDays,
      r.BaseSalary,
      r.OvertimePay,
      r.NetSalary
    ]);

    autoTable(doc, {
      head: [tableCols],
      body: tableRows,
      startY: 26,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 59, 102], textColor: 255 }
    });

    doc.save(`Attendance_Salary_${selectedMonth || 'Report'}.pdf`);
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: '100%' }}>
      {/* Breadcrumbs & Header */}
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
          <MuiLink underline="hover" color="inherit" href="#/dashboard" sx={{ display: 'flex', alignItems: 'center' }}>
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Dashboard
          </MuiLink>
          <Typography color="text.primary" sx={{ fontWeight: 600 }}>Attendance & Payroll</Typography>
        </Breadcrumbs>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66' }}>
              Biometric Attendance & Salary Manager
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Monthly biometric machine log parsing, muster roll, working hour stats & automated payroll calculation.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => setCurrentTab(2)}
              sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#0a2744' }, fontWeight: 600 }}
            >
              Upload Biometric Log (PDF)
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Tabs Navigation */}
      <Paper sx={{ mb: 2.5, borderRadius: 2 }}>
        <Tabs
          value={currentTab}
          onChange={(e, val) => setCurrentTab(val)}
          indicatorColor="primary"
          textColor="primary"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab icon={<ReportsIcon fontSize="small" />} iconPosition="start" label="Monthly Attendance & Salary Report" sx={{ fontWeight: 600 }} />
          <Tab icon={<CalendarIcon fontSize="small" />} iconPosition="start" label="Monthly Attendance Sheet (Matrix View)" sx={{ fontWeight: 600 }} />
          <Tab icon={<UploadIcon fontSize="small" />} iconPosition="start" label="Upload Machine Log (PDF)" sx={{ fontWeight: 600 }} />
          <Tab icon={<TimeIcon fontSize="small" />} iconPosition="start" label="Employee Daily Punch Detail" sx={{ fontWeight: 600 }} />
        </Tabs>
      </Paper>

      {/* TAB 0: Monthly Attendance & Salary Report */}
      {currentTab === 0 && (
        <Box>
          {/* Filter Bar */}
          <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                <TextField
                  select
                  size="small"
                  label="Select Month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  sx={{ minWidth: 200 }}
                >
                  {availableMonths.map((m) => (
                    <MenuItem key={m.MonthYear} value={m.MonthYear}>
                      {m.MonthName || m.MonthYear} ({m.MonthYear})
                    </MenuItem>
                  ))}
                  {availableMonths.length === 0 && (
                    <MenuItem value="" disabled>No months uploaded yet</MenuItem>
                  )}
                </TextField>

                <TextField
                  select
                  size="small"
                  label="Department"
                  value={selectedDept}
                  onChange={handleDeptChange}
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value="ALL">All Departments</MenuItem>
                  {departments.map((d) => (
                    <MenuItem key={d} value={d}>{d}</MenuItem>
                  ))}
                </TextField>

                <TextField
                  size="small"
                  placeholder="Search Employee / Code..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                      </InputAdornment>
                    )
                  }}
                  sx={{ minWidth: 220 }}
                />

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={() => fetchSummary(selectedMonth, selectedDept, searchTerm)}
                >
                  Refresh
                </Button>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={recalculating ? <CircularProgress size={16} color="inherit" /> : <CalculateIcon />}
                  onClick={handleRecalculateAsPerMaster}
                  disabled={recalculating || records.length === 0}
                  sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#0a2744' }, fontWeight: 700 }}
                >
                  {recalculating ? 'Calculating...' : 'Calculate Salary as per Master'}
                </Button>
                <Button
                  variant="outlined"
                  color="success"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportExcel}
                  disabled={records.length === 0}
                >
                  Export Excel
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={<ReportsIcon />}
                  onClick={handleExportPDF}
                  disabled={records.length === 0}
                >
                  Download PDF
                </Button>
              </Box>
            </Box>
          </Paper>

          {recalculateMessage && (
            <Alert
              severity="success"
              onClose={() => setRecalculateMessage('')}
              sx={{ mb: 2, fontWeight: 600 }}
            >
              {recalculateMessage}
            </Alert>
          )}

          {/* Metrics Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 2 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 700, textTransform: 'uppercase' }}>
                    Total Workforce
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#0c4a6e', my: 0.5 }}>
                    {summaryStats.totalEmployees || 0} Employees
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#0284c7', fontSize: '0.8rem' }}>
                    Present: {summaryStats.totalPresentDays || 0}d • Absent: {summaryStats.totalAbsentDays || 0}d
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 700, textTransform: 'uppercase' }}>
                    Net Working Hours
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#14532d', my: 0.5 }}>
                    {(summaryStats.totalNetHours || 0).toLocaleString()} hrs
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#16a34a', fontSize: '0.8rem' }}>
                    Week-Offs: {summaryStats.totalWeekOffDays || 0}d across staff
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 2 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 700, textTransform: 'uppercase' }}>
                    Calculated Overtime
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#78350f', my: 0.5 }}>
                    ₹{(summaryStats.totalOvertimePay || 0).toLocaleString('en-IN')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#d97706', fontSize: '0.8rem' }}>
                    Base Salary: ₹{(summaryStats.totalCalculatedSalary || 0).toLocaleString('en-IN')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 2 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" sx={{ color: '#7e22ce', fontWeight: 700, textTransform: 'uppercase' }}>
                    Total Net Payable Salary
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#581c87', my: 0.5 }}>
                    ₹{(summaryStats.totalNetSalary || 0).toLocaleString('en-IN')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9333ea', fontSize: '0.8rem' }}>
                    Total payable for {selectedMonth || 'current month'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Main Attendance & Salary Table */}
          <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small" aria-label="attendance salary table">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#0F3B66', color: '#fff', fontWeight: 700, py: 1.2 } }}>
                    <TableCell sx={{ color: '#fff' }}>Sr</TableCell>
                    <TableCell sx={{ color: '#fff' }}>
                      <TableSortLabel
                        active={sortConfig.key === 'BiometricCode'}
                        direction={sortConfig.key === 'BiometricCode' ? sortConfig.direction : 'asc'}
                        onClick={() => handleSort('BiometricCode')}
                        sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#fff !important' } }}
                      >
                        Bio ID
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ color: '#fff' }}>
                      <TableSortLabel
                        active={sortConfig.key === 'EmployeeName'}
                        direction={sortConfig.key === 'EmployeeName' ? sortConfig.direction : 'asc'}
                        onClick={() => handleSort('EmployeeName')}
                        sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#fff !important' } }}
                      >
                        Employee Name
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ color: '#fff' }}>Dept / Desig</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>Present</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>Absent</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>Half Days</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>Week-Off</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>Payable Days</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>Gross Hours</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>Net Hours</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>OT Hours</TableCell>
                    <TableCell align="right" sx={{ color: '#fff' }}>Base Rate (₹)</TableCell>
                    <TableCell align="right" sx={{ color: '#fff' }}>Earned (₹)</TableCell>
                    <TableCell align="right" sx={{ color: '#fff' }}>OT Pay (₹)</TableCell>
                    <TableCell align="right" sx={{ color: '#fff' }}>Deductions (₹)</TableCell>
                    <TableCell align="right" sx={{ color: '#fff' }}>Net Salary (₹)</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={18} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={36} />
                        <Typography variant="body2" sx={{ mt: 1 }}>Loading attendance & salary data...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : sortedRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={18} align="center" sx={{ py: 6 }}>
                        <Typography variant="subtitle1" color="text.secondary">
                          No attendance records found for this selection.
                        </Typography>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<UploadIcon />}
                          onClick={() => setCurrentTab(2)}
                          sx={{ mt: 2 }}
                        >
                          Upload Biometric Log PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedRecords
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((row, index) => (
                        <TableRow hover key={row.Id || index} sx={{ '&:nth-of-type(even)': { bgcolor: '#f8fafc' } }}>
                          <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                          <TableCell>
                            <Chip
                              label={row.BiometricCode}
                              size="small"
                              sx={{ fontWeight: 700, bgcolor: '#e0f2fe', color: '#0369a1' }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, color: '#0F3B66' }}>
                            {row.EmployeeName}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{row.Department}</Typography>
                            <Typography variant="caption" color="text.secondary">{row.Designation}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={row.PresentDays} size="small" color="success" variant="outlined" sx={{ fontWeight: 700, minWidth: 38 }} />
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={row.AbsentDays} size="small" color={row.AbsentDays > 0 ? "error" : "default"} variant="outlined" sx={{ fontWeight: 700, minWidth: 38 }} />
                          </TableCell>
                          <TableCell align="center">{row.HalfDays || 0}</TableCell>
                          <TableCell align="center">{row.WeekOffDays || 0}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                            {row.PayableDays}
                          </TableCell>
                          <TableCell align="center">{row.TotalGrossHours || '00:00'}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>
                            {row.TotalNetWorkHoursDecimal ? `${row.TotalNetWorkHoursDecimal}h` : '0h'}
                          </TableCell>
                          <TableCell align="center" sx={{ color: row.TotalOvertimeHoursDecimal > 0 ? '#b45309' : 'inherit', fontWeight: row.TotalOvertimeHoursDecimal > 0 ? 700 : 400 }}>
                            {row.TotalOvertimeHoursDecimal ? `${row.TotalOvertimeHoursDecimal}h` : '-'}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              ₹{(row.BaseSalary || 0).toLocaleString('en-IN')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.SalaryType || 'Monthly'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            <Tooltip
                              title={
                                row.SalaryType === 'Daily'
                                  ? `Daily Wage: ₹${row.BaseSalary} × ${row.PayableDays} present days = ₹${row.CalculatedSalary}`
                                  : row.SalaryType === 'Hourly'
                                  ? `Hourly Rate: ₹${row.BaseSalary} × ${row.TotalNetWorkHoursDecimal || 0} hrs = ₹${row.CalculatedSalary}`
                                  : `Monthly: (₹${row.BaseSalary} / ${row.TotalDaysInMonth || 31} days) × ${row.PayableDays} payable days = ₹${row.CalculatedSalary}`
                              }
                              arrow
                            >
                              <Box sx={{ cursor: 'help' }}>
                                ₹{(row.CalculatedSalary || 0).toLocaleString('en-IN')}
                              </Box>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="right" sx={{ color: row.OvertimePay > 0 ? '#b45309' : 'inherit', fontWeight: row.OvertimePay > 0 ? 700 : 400 }}>
                            {row.OvertimePay > 0 ? `+₹${row.OvertimePay.toLocaleString('en-IN')}` : '₹0'}
                          </TableCell>
                          <TableCell align="right" sx={{ color: row.Deductions > 0 ? '#dc2626' : 'inherit' }}>
                            {row.Deductions > 0 ? `-₹${row.Deductions.toLocaleString('en-IN')}` : '₹0'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: '#15803d', fontSize: '0.95rem' }}>
                            <Tooltip
                              title={`Net Salary = Base Earned (₹${row.CalculatedSalary || 0}) + OT (₹${row.OvertimePay || 0}) - Deductions (₹${row.Deductions || 0}) = ₹${row.NetSalary || 0}`}
                              arrow
                            >
                              <Box sx={{ cursor: 'help' }}>
                                ₹{(row.NetSalary || 0).toLocaleString('en-IN')}
                              </Box>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Edit / Adjust Salary & Days">
                              <IconButton size="small" color="primary" onClick={() => handleOpenOverride(row)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="View Daily Punches">
                              <IconButton size="small" color="info" onClick={() => handleViewEmployeeLogs(row.BiometricCode)}>
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[25, 50, 100]}
              component="div"
              count={records.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </Paper>
        </Box>
      )}

      {/* TAB 1: Monthly Attendance Sheet (Muster Roll Matrix View) */}
      {currentTab === 1 && (
        <Box>
          <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                <TextField
                  select
                  size="small"
                  label="Select Month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  sx={{ minWidth: 200 }}
                >
                  {availableMonths.map((m) => (
                    <MenuItem key={m.MonthYear} value={m.MonthYear}>
                      {m.MonthName || m.MonthYear}
                    </MenuItem>
                  ))}
                </TextField>

                {/* Legend Chips */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 2, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>LEGEND:</Typography>
                  <Chip label="P = Present" size="small" sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700 }} />
                  <Chip label="A = Absent" size="small" sx={{ bgcolor: '#fee2e2', color: '#b91c1c', fontWeight: 700 }} />
                  <Chip label="WO = Week Off" size="small" sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }} />
                  <Chip label="HD = Half Day" size="small" sx={{ bgcolor: '#ffedd5', color: '#c2410c', fontWeight: 700 }} />
                </Box>
              </Box>

              <Button
                variant="outlined"
                color="success"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={handleExportMatrixExcel}
                disabled={!matrixData.employees || matrixData.employees.length === 0}
              >
                Export Muster Roll (Excel)
              </Button>
            </Box>
          </Paper>

          {/* Matrix Table */}
          <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
            <TableContainer sx={{ maxHeight: 650 }}>
              <Table stickyHeader size="small" sx={{ minWidth: 1600 }}>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#0F3B66', color: '#fff', fontWeight: 700, py: 1 } }}>
                    <TableCell sx={{ color: '#fff', position: 'sticky', left: 0, zIndex: 10, bgcolor: '#0F3B66' }}>
                      Emp ID
                    </TableCell>
                    <TableCell sx={{ color: '#fff', position: 'sticky', left: 80, zIndex: 10, bgcolor: '#0F3B66', minWidth: 160 }}>
                      Employee Name
                    </TableCell>
                    <TableCell sx={{ color: '#fff' }}>Dept</TableCell>
                    {Array.from({ length: matrixData.daysInMonth || 31 }, (_, i) => i + 1).map((day) => (
                      <TableCell key={day} align="center" sx={{ color: '#fff', minWidth: 32, px: 0.5 }}>
                        {day}
                      </TableCell>
                    ))}
                    <TableCell align="center" sx={{ color: '#fff' }}>PR</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>AB</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>WO</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>Gross Hrs</TableCell>
                    <TableCell align="right" sx={{ color: '#fff' }}>Net Sal (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matrixLoading ? (
                    <TableRow>
                      <TableCell colSpan={40} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={36} />
                        <Typography variant="body2" sx={{ mt: 1 }}>Loading muster roll matrix...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (!matrixData.employees || matrixData.employees.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={40} align="center" sx={{ py: 6 }}>
                        <Typography variant="body1" color="text.secondary">No matrix records found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    matrixData.employees.map((emp, idx) => (
                      <TableRow hover key={emp.BiometricCode || idx} sx={{ '&:nth-of-type(even)': { bgcolor: '#f8fafc' } }}>
                        <TableCell sx={{ position: 'sticky', left: 0, bgcolor: '#fff', fontWeight: 700, zIndex: 5 }}>
                          {emp.BiometricCode}
                        </TableCell>
                        <TableCell sx={{ position: 'sticky', left: 80, bgcolor: '#fff', fontWeight: 600, color: '#0F3B66', zIndex: 5 }}>
                          {emp.EmployeeName}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{emp.Department}</TableCell>
                        {Array.from({ length: matrixData.daysInMonth || 31 }, (_, i) => i + 1).map((day) => {
                          const log = emp.days[day];
                          const status = log ? log.status : 'A';
                          let chipColor = { bg: '#fee2e2', text: '#b91c1c' };
                          if (status === 'P') chipColor = { bg: '#dcfce7', text: '#15803d' };
                          else if (status === 'WO') chipColor = { bg: '#dbeafe', text: '#1d4ed8' };
                          else if (status === 'HD') chipColor = { bg: '#ffedd5', text: '#c2410c' };

                          const tooltipTitle = log
                            ? `${log.dayOfWeek} Day ${day}: Status ${status} | IN: ${log.firstIn || '--'} | OUT: ${log.lastOut || '--'} | Gross: ${log.gross || '00:00'}`
                            : `Day ${day}: No punch`;

                          return (
                            <TableCell key={day} align="center" sx={{ px: 0.25, py: 0.5 }}>
                              <Tooltip title={tooltipTitle} arrow>
                                <Box
                                  sx={{
                                    bgcolor: chipColor.bg,
                                    color: chipColor.text,
                                    borderRadius: 1,
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    py: 0.25,
                                    px: 0.5,
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                  }}
                                >
                                  {status}
                                </Box>
                              </Tooltip>
                            </TableCell>
                          );
                        })}
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#15803d' }}>{emp.PresentDays}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#b91c1c' }}>{emp.AbsentDays}</TableCell>
                        <TableCell align="center">{emp.WeekOffDays}</TableCell>
                        <TableCell align="center">{emp.TotalGrossHours || '00:00'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#15803d' }}>
                          ₹{(emp.NetSalary || 0).toLocaleString('en-IN')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* TAB 2: Upload Biometric Machine PDF Log */}
      {currentTab === 2 && (
        <Box sx={{ maxWidth: 900, mx: 'auto', mt: 2 }}>
          <Paper sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <UploadIcon sx={{ fontSize: 56, color: '#0F3B66', mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                Upload Monthly Biometric Attendance Log
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Upload the monthly attendance PDF report exported directly from your factory biometric machine.
                The system will automatically parse all employees, in/out punches, working hours, and compute salaries.
              </Typography>
            </Box>

            {/* Drag & Drop Area */}
            <Box
              sx={{
                border: '2px dashed #94a3b8',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                bgcolor: '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: '#f1f5f9', borderColor: '#0F3B66' }
              }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#334155' }}>
                {selectedFile ? selectedFile.name : 'Click to Browse or Drag & Drop Biometric PDF File'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Supported format: Standard Biometric Machine PDF Log (e.g. rptMonthlyLog.pdf)
              </Typography>
              {selectedFile && (
                <Chip
                  label={`${(selectedFile.size / 1024).toFixed(1)} KB`}
                  color="primary"
                  size="small"
                  sx={{ mt: 1.5, fontWeight: 600 }}
                />
              )}
            </Box>

            {uploadError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {uploadError}
              </Alert>
            )}

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
                onClick={() => handleUploadSubmit(false)}
                disabled={!selectedFile || uploading}
                sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#0a2744' }, px: 4, py: 1.2, fontWeight: 700 }}
              >
                {uploading ? 'Processing File...' : 'Upload & Process Attendance'}
              </Button>

              <Button
                variant="outlined"
                size="large"
                onClick={() => handleUploadSubmit(true)}
                disabled={uploading}
                sx={{ px: 3, py: 1.2, fontWeight: 600 }}
              >
                Process Sample File (rptMonthlyLog.pdf)
              </Button>
            </Box>

            {/* Upload Results Success Box */}
            {uploadResult && (
              <Box sx={{ mt: 4, p: 3, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CheckIcon color="success" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#166534' }}>
                    Attendance Successfully Processed!
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#15803d', mb: 2 }}>
                  {uploadResult.message}
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Organization</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{uploadResult.organization}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Month Processed</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{uploadResult.monthName}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Employees Inserted</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{uploadResult.processedEmployees} Employees</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Total Days</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{uploadResult.totalDaysInMonth} Days</Typography>
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    color="success"
                    sx={{ fontWeight: 700 }}
                    onClick={() => setCurrentTab(0)}
                  >
                    View Attendance & Salary Report →
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CalculateIcon />}
                    sx={{ fontWeight: 600, color: '#0F3B66', borderColor: '#0F3B66' }}
                    onClick={() => {
                      setCurrentTab(0);
                      handleRecalculateAsPerMaster();
                    }}
                  >
                    Calculate Salary as per Master
                  </Button>
                </Box>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* TAB 3: Employee Daily Punch Detail */}
      {currentTab === 3 && (
        <Box>
          <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <TextField
                select
                size="small"
                label="Select Employee"
                value={selectedEmpCode}
                onChange={(e) => {
                  setSelectedEmpCode(e.target.value);
                  fetchEmployeeDailyLogs(e.target.value, selectedMonth);
                }}
                sx={{ minWidth: 280 }}
              >
                {records.map((r) => (
                  <MenuItem key={r.BiometricCode} value={r.BiometricCode}>
                    #{r.BiometricCode} - {r.EmployeeName} ({r.Department})
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                label="Select Month"
                value={selectedMonth}
                onChange={handleMonthChange}
                sx={{ minWidth: 180 }}
              >
                {availableMonths.map((m) => (
                  <MenuItem key={m.MonthYear} value={m.MonthYear}>
                    {m.MonthName || m.MonthYear}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Paper>

          {employeeDetail && employeeDetail.summary && (
            <Card sx={{ mb: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <Typography variant="caption" color="text.secondary">Employee</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                      #{employeeDetail.summary.BiometricCode} - {employeeDetail.summary.EmployeeName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {employeeDetail.summary.Department} • {employeeDetail.summary.Designation}
                    </Typography>
                  </Grid>

                  <Grid item xs={6} sm={2}>
                    <Typography variant="caption" color="text.secondary">Attendance</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a' }}>
                      Present: {employeeDetail.summary.PresentDays}d
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#dc2626' }}>
                      Absent: {employeeDetail.summary.AbsentDays}d • WO: {employeeDetail.summary.WeekOffDays}d
                    </Typography>
                  </Grid>

                  <Grid item xs={6} sm={2}>
                    <Typography variant="caption" color="text.secondary">Hours Logged</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Gross: {employeeDetail.summary.TotalGrossHours}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Net Work: {employeeDetail.summary.TotalNetWorkHoursDecimal}h
                    </Typography>
                  </Grid>

                  <Grid item xs={6} sm={2}>
                    <Typography variant="caption" color="text.secondary">Salary Basis</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      ₹{employeeDetail.summary.BaseSalary} ({employeeDetail.summary.SalaryType})
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Payable: {employeeDetail.summary.PayableDays} days
                    </Typography>
                  </Grid>

                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Net Calculated Salary</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#15803d' }}>
                      ₹{(employeeDetail.summary.NetSalary || 0).toLocaleString('en-IN')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      OT Pay: ₹{employeeDetail.summary.OvertimePay} • Ded: ₹{employeeDetail.summary.Deductions}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Day-by-Day punches table */}
          <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
            <TableContainer sx={{ maxHeight: 550 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#0F3B66', color: '#fff', fontWeight: 700, py: 1.2 } }}>
                    <TableCell sx={{ color: '#fff' }}>Day</TableCell>
                    <TableCell sx={{ color: '#fff' }}>Date</TableCell>
                    <TableCell sx={{ color: '#fff' }}>Day of Week</TableCell>
                    <TableCell sx={{ color: '#fff' }}>Shift</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>First IN</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>Last OUT</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>Gross Hours</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>Break</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>Net Hours</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>1st Half</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>2nd Half</TableCell>
                    <TableCell align="center" sx={{ color: '#fff' }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dailyLogsLoading ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={32} />
                        <Typography variant="body2" sx={{ mt: 1 }}>Loading daily punch logs...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (!employeeDetail || !employeeDetail.dailyLogs || employeeDetail.dailyLogs.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                        <Typography variant="body1" color="text.secondary">
                          Please select an employee above to inspect their daily biometric logs.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    employeeDetail.dailyLogs.map((log) => {
                      let chipBg = '#fee2e2';
                      let chipColor = '#b91c1c';
                      if (log.FinalStatus === 'P') { chipBg = '#dcfce7'; chipColor = '#15803d'; }
                      else if (log.FinalStatus === 'WO') { chipBg = '#dbeafe'; chipColor = '#1d4ed8'; }
                      else if (log.FinalStatus === 'HD') { chipBg = '#ffedd5'; chipColor = '#c2410c'; }

                      return (
                        <TableRow hover key={log.Id || log.DayNumber}>
                          <TableCell sx={{ fontWeight: 600 }}>{log.DayNumber}</TableCell>
                          <TableCell>{log.AttendanceDate}</TableCell>
                          <TableCell sx={{ fontWeight: 500, color: log.DayOfWeek === 'Sun' ? '#2563eb' : 'inherit' }}>
                            {log.DayOfWeek}
                          </TableCell>
                          <TableCell>{log.Shift || 'GS'}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: log.FirstIn ? 700 : 400 }}>
                            {log.FirstIn || '--'}
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: log.LastOut ? 700 : 400 }}>
                            {log.LastOut || '--'}
                          </TableCell>
                          <TableCell align="center">{log.GrossHours || '00:00'}</TableCell>
                          <TableCell align="center">{log.BreakHours || '00:00'}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: log.NetHoursDecimal > 0 ? 700 : 400 }}>
                            {log.NetHoursDecimal > 0 ? `${log.NetHoursDecimal}h` : '0h'}
                          </TableCell>
                          <TableCell align="center">{log.FirstHalfStatus || '-'}</TableCell>
                          <TableCell align="center">{log.SecondHalfStatus || '-'}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={log.FinalStatus}
                              size="small"
                              sx={{ bgcolor: chipBg, color: chipColor, fontWeight: 700, minWidth: 36 }}
                            />
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
      )}

      {/* Salary & Days Override Modal */}
      <Dialog open={overrideModalOpen} onClose={() => setOverrideModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#0F3B66' }}>
          Adjust Attendance & Salary Override
        </DialogTitle>
        <DialogContent dividers>
          {overrideRecord && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                  #{overrideRecord.BiometricCode} - {overrideRecord.EmployeeName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Dept: {overrideRecord.Department} | Machine Present: {overrideRecord.PresentDays}d | Machine Absent: {overrideRecord.AbsentDays}d
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Payable Days"
                    type="number"
                    size="small"
                    fullWidth
                    value={overrideForm.PayableDays}
                    onChange={(e) => handleOverrideFieldChange('PayableDays', e.target.value)}
                    helperText={`Total days in month: ${overrideRecord.TotalDaysInMonth || 31}`}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Base Salary / Rate (₹)"
                    type="number"
                    size="small"
                    fullWidth
                    value={overrideForm.BaseSalary}
                    onChange={(e) => handleOverrideFieldChange('BaseSalary', e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Calculated Base Salary (₹)"
                    type="number"
                    size="small"
                    fullWidth
                    value={overrideForm.CalculatedSalary}
                    onChange={(e) => handleOverrideFieldChange('CalculatedSalary', e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Overtime Pay (₹)"
                    type="number"
                    size="small"
                    fullWidth
                    value={overrideForm.OvertimePay}
                    onChange={(e) => handleOverrideFieldChange('OvertimePay', e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Deductions / Advances (₹)"
                    type="number"
                    size="small"
                    fullWidth
                    value={overrideForm.Deductions}
                    onChange={(e) => handleOverrideFieldChange('Deductions', e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Net Payable Salary (₹)"
                    type="number"
                    size="small"
                    fullWidth
                    value={overrideForm.NetSalary}
                    onChange={(e) => handleOverrideFieldChange('NetSalary', e.target.value)}
                    sx={{ input: { fontWeight: 700, color: '#15803d' } }}
                  />
                </Grid>
              </Grid>

              <TextField
                label="Remarks / Notes"
                size="small"
                fullWidth
                multiline
                rows={2}
                value={overrideForm.Remarks}
                onChange={(e) => handleOverrideFieldChange('Remarks', e.target.value)}
                placeholder="Reason for adjustment (e.g. advance deduction, manual approval)"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOverrideModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveOverride} sx={{ bgcolor: '#0F3B66', '&:hover': { bgcolor: '#0a2744' } }}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AttendanceManager;

