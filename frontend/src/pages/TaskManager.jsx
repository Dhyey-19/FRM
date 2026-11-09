import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Tooltip,
  CircularProgress,
  Avatar,
  Tabs,
  Tab,
  Snackbar,
  Alert,
  Menu,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  TaskAlt as TaskAltIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  CalendarMonth as CalendarIcon,
  Group as GroupIcon,
  CheckCircle as CompleteIcon,
  HourglassEmpty as PendingIcon,
  PlayArrow as InProgressIcon,
  Pause as PauseIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PRIORITY_COLORS = {
  Urgent: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
  High: { bg: '#ffedd5', text: '#ea580c', border: '#fdba74' },
  Medium: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  Low: { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' }
};

const STATUS_CONFIG = {
  Pending: { label: 'Pending', bg: '#fef3c7', text: '#d97706', border: '#fde68a', icon: <PendingIcon sx={{ fontSize: 13 }} /> },
  Accepted: { label: 'Accepted', bg: '#e0f2fe', text: '#0284c7', border: '#bae6fd', icon: <TaskAltIcon sx={{ fontSize: 13 }} /> },
  'In Progress': { label: 'In Progress', bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', icon: <InProgressIcon sx={{ fontSize: 13 }} /> },
  'On Hold': { label: 'On Hold', bg: '#f3e8ff', text: '#9333ea', border: '#e9d5ff', icon: <PauseIcon sx={{ fontSize: 13 }} /> },
  Completed: { label: 'Completed', bg: '#dcfce7', text: '#15803d', border: '#86efac', icon: <CompleteIcon sx={{ fontSize: 13 }} /> }
};

const TaskManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightedTaskId = searchParams.get('taskId');

  // Logged-in user info
  const currentUser = useMemo(() => {
    try {
      const uStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      return uStr ? JSON.parse(uStr) : null;
    } catch {
      return null;
    }
  }, []);

  const [tasks, setTasks] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusTab, setStatusTab] = useState('active'); // 'active' | 'completed' | 'all'
  const [scopeFilter, setScopeFilter] = useState('all'); // 'all' | 'assigned_to_me' | 'created_by_me'
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Create Task Dialog State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    deadline: '',
    assignees: [] // array of selected user objects
  });

  // Task Details Dialog State (Opened when a row is clicked)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Action Menu State
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [actionTask, setActionTask] = useState(null);

  // Snackbar Toast
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Fetch tasks
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        statusTab,
        scope: scopeFilter,
        priority: priorityFilter,
        search: searchTerm
      });

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/tasks?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const fetchedTasks = data.tasks || [];
        setTasks(fetchedTasks);

        // If a task detail is open, refresh its data in the modal
        if (selectedTask) {
          const updated = fetchedTasks.find(t => t.TaskId === selectedTask.TaskId);
          if (updated) setSelectedTask(updated);
        }
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch active users for tagging
  const fetchActiveUsers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/tasks/users`);
      if (res.ok) {
        const data = await res.json();
        setActiveUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error fetching active users:', err);
    }
  };

  useEffect(() => {
    fetchActiveUsers();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [statusTab, scopeFilter, priorityFilter, searchTerm]);

  // Auto-open highlighted task from notification query param
  useEffect(() => {
    if (highlightedTaskId && tasks.length > 0) {
      const match = tasks.find(t => String(t.TaskId) === String(highlightedTaskId));
      if (match) {
        setSelectedTask(match);
        setDetailDialogOpen(true);
      }
    }
  }, [highlightedTaskId, tasks]);

  // Open Create Dialog
  const handleOpenCreate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const defaultLocalIso = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);

    setFormData({
      title: '',
      description: '',
      priority: 'Medium',
      deadline: defaultLocalIso,
      assignees: []
    });
    setCreateDialogOpen(true);
  };

  // Open Detail Dialog on row click
  const handleOpenDetails = (task) => {
    setSelectedTask(task);
    setDetailDialogOpen(true);
  };

  // Submit New Task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setSnackbar({ open: true, message: 'Please enter a task title.', severity: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
        assigneeUserIds: formData.assignees.map(u => u.UserId)
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSnackbar({ open: true, message: 'Task created successfully! Tagged team members have been notified.', severity: 'success' });
        setCreateDialogOpen(false);
        await fetchTasks();
      } else {
        const err = await res.json();
        setSnackbar({ open: true, message: err.message || 'Failed to create task.', severity: 'error' });
      }
    } catch (err) {
      console.error('Error creating task:', err);
      setSnackbar({ open: true, message: 'Server communication error.', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Update Task Status
  const handleStatusChange = async (task, newStatus) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/tasks/${task.TaskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        setSnackbar({ open: true, message: `Task status updated to "${newStatus}".`, severity: 'success' });
        setMenuAnchor(null);
        setActionTask(null);
        await fetchTasks();
      } else {
        const err = await res.json();
        setSnackbar({ open: true, message: err.message || 'Failed to update status.', severity: 'error' });
      }
    } catch (err) {
      console.error('Error updating status:', err);
      setSnackbar({ open: true, message: 'Server communication error.', severity: 'error' });
    }
  };

  // Delete Task
  const handleDeleteTask = async (task) => {
    if (!window.confirm(`Are you sure you want to delete task "${task.Title}"?`)) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/tasks/${task.TaskId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setSnackbar({ open: true, message: 'Task deleted successfully.', severity: 'success' });
        setMenuAnchor(null);
        setActionTask(null);
        if (detailDialogOpen && selectedTask?.TaskId === task.TaskId) {
          setDetailDialogOpen(false);
        }
        await fetchTasks();
      } else {
        const err = await res.json();
        setSnackbar({ open: true, message: err.message || 'Failed to delete task.', severity: 'error' });
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      setSnackbar({ open: true, message: 'Server error deleting task.', severity: 'error' });
    }
  };

  // Format Date and calculate overdue / deadline string
  const formatDeadline = (deadlineVal) => {
    if (!deadlineVal) return null;
    const d = new Date(deadlineVal);
    if (isNaN(d.getTime())) return null;

    const formattedShort = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short'
    });

    const formattedFull = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const now = new Date();
    const diffHours = (d.getTime() - now.getTime()) / (1000 * 60 * 60);

    let badgeText = '';
    let isLate = false;

    if (diffHours < 0) {
      isLate = true;
      const daysOverdue = Math.ceil(Math.abs(diffHours) / 24);
      badgeText = daysOverdue === 1 ? 'Overdue 1d' : `Overdue ${daysOverdue}d`;
    } else if (diffHours <= 24) {
      badgeText = `Due today (${Math.ceil(diffHours)}h)`;
    } else if (diffHours <= 48) {
      badgeText = 'Due tomorrow';
    }

    return { formattedShort, formattedFull, isLate, badgeText };
  };

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F3B66', letterSpacing: -0.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TaskAltIcon sx={{ fontSize: 34, color: '#2563eb' }} /> Task Manager
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.3 }}>
            Assign tasks, tag team members, track deadlines, and click any row to inspect complete details.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={{
              bgcolor: '#0F3B66',
              color: '#ffffff',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 2,
              px: 2.2,
              py: 0.85,
              boxShadow: '0 2px 8px rgba(15, 59, 102, 0.25)',
              '&:hover': { bgcolor: '#F88A01' }
            }}
          >
            Create Task
          </Button>

          <Tooltip title="Refresh Tasks">
            <IconButton
              onClick={fetchTasks}
              sx={{
                bgcolor: '#ffffff',
                color: '#0F3B66',
                border: '1px solid #cbd5e1',
                borderRadius: 2,
                '&:hover': { bgcolor: '#f1f5f9', color: '#F88A01' }
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Main Container */}
      <Paper sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(15, 59, 102, 0.04)', overflow: 'hidden' }}>
        {/* Active vs Completed Tasks Primary Tabs */}
        <Box sx={{ px: { xs: 1.5, sm: 3 }, pt: 0.5, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <Tabs
            value={statusTab}
            onChange={(e, val) => setStatusTab(val)}
            sx={{
              '& .MuiTabs-indicator': { backgroundColor: '#F88A01', height: 3 },
              '& .MuiTab-root': {
                fontWeight: 700,
                fontSize: { xs: '0.85rem', sm: '0.9rem' },
                textTransform: 'none',
                minHeight: 46,
                color: '#64748b',
                '&.Mui-selected': { color: '#0F3B66' }
              }
            }}
          >
            <Tab 
              value="active" 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>Active Tasks</span>
                  {statusTab === 'active' && (
                    <Chip label={tasks.length} size="small" sx={{ height: 20, fontSize: '0.72rem', fontWeight: 800, bgcolor: '#eff6ff', color: '#2563eb' }} />
                  )}
                </Box>
              } 
            />
            <Tab 
              value="completed" 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>Completed Tasks</span>
                  {statusTab === 'completed' && (
                    <Chip label={tasks.length} size="small" sx={{ height: 20, fontSize: '0.72rem', fontWeight: 800, bgcolor: '#dcfce7', color: '#15803d' }} />
                  )}
                </Box>
              } 
            />
            <Tab value="all" label="All Tasks" />
          </Tabs>
        </Box>

        {/* Filter Controls Toolbar */}
        <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          {/* Left filters: Scope & Priority */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 140, bgcolor: '#ffffff' }}>
              <InputLabel>View Scope</InputLabel>
              <Select
                value={scopeFilter}
                label="View Scope"
                onChange={(e) => setScopeFilter(e.target.value)}
                sx={{ borderRadius: 1.5 }}
              >
                <MenuItem value="all">All Tasks</MenuItem>
                <MenuItem value="assigned_to_me">Assigned to Me</MenuItem>
                <MenuItem value="created_by_me">Created by Me</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120, bgcolor: '#ffffff' }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priorityFilter}
                label="Priority"
                onChange={(e) => setPriorityFilter(e.target.value)}
                sx={{ borderRadius: 1.5 }}
              >
                <MenuItem value="all">All Priorities</MenuItem>
                <MenuItem value="Urgent">Urgent</MenuItem>
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="Low">Low</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Right search input */}
          <Box sx={{ width: { xs: '100%', sm: 250 } }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search tasks, members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" fontSize="small" />
                  </InputAdornment>
                )
              }}
              sx={{ bgcolor: '#ffffff', borderRadius: 1.5 }}
            />
          </Box>
        </Box>

        {/* Tasks Data Table (Clean, Compact Single Row Records) */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : tasks.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <TaskAltIcon sx={{ fontSize: 52, color: '#10b981', mb: 1.5, opacity: 0.8 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66' }}>
              {statusTab === 'completed' ? 'No Completed Tasks' : 'No Active Tasks'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              {searchTerm
                ? 'No tasks match your search filter.'
                : (statusTab === 'completed'
                    ? 'Completed tasks will be recorded here.'
                    : 'Click "Create Task" above to assign new work.')}
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 800 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#0F3B66', '& th': { color: '#ffffff', fontWeight: 700, fontSize: '0.82rem', py: 1.2 } }}>
                  <TableCell sx={{ width: 60 }}>#</TableCell>
                  <TableCell>Task Title</TableCell>
                  <TableCell align="center" sx={{ width: 100 }}>Priority</TableCell>
                  <TableCell align="center" sx={{ width: 110 }}>Status</TableCell>
                  <TableCell sx={{ width: 140 }}>Assigned By</TableCell>
                  <TableCell sx={{ width: 180 }}>Tagged To</TableCell>
                  <TableCell sx={{ width: 150 }}>Deadline</TableCell>
                  <TableCell align="right" sx={{ width: 150 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map((task) => {
                  const priorityStyle = PRIORITY_COLORS[task.Priority] || PRIORITY_COLORS.Medium;
                  const statusStyle = STATUS_CONFIG[task.Status] || STATUS_CONFIG.Pending;
                  const deadlineInfo = formatDeadline(task.Deadline);
                  const isCompleted = task.Status === 'Completed';
                  const isHighlighted = highlightedTaskId && String(highlightedTaskId) === String(task.TaskId);

                  return (
                    <TableRow
                      key={task.TaskId}
                      hover
                      onClick={() => handleOpenDetails(task)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: isHighlighted ? '#eff6ff' : (isCompleted ? '#fafbfc' : '#ffffff'),
                        borderLeft: `4px solid ${priorityStyle.text}`,
                        transition: 'background-color 0.15s ease',
                        '&:hover': {
                          bgcolor: isHighlighted ? '#e0f2fe' : '#f8fafc'
                        }
                      }}
                    >
                      {/* # ID */}
                      <TableCell sx={{ fontWeight: 700, color: '#64748b' }}>
                        #{task.TaskId}
                      </TableCell>

                      {/* Task Title (Single Line, Truncated if long) */}
                      <TableCell sx={{ minWidth: 220, maxWidth: 360 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              color: isCompleted ? '#64748b' : '#0F3B66',
                              textDecoration: isCompleted ? 'line-through' : 'none',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontSize: '0.86rem'
                            }}
                          >
                            {task.Title}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Priority Chip */}
                      <TableCell align="center">
                        <Chip
                          label={task.Priority}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            bgcolor: priorityStyle.bg,
                            color: priorityStyle.text,
                            border: `1px solid ${priorityStyle.border}`
                          }}
                        />
                      </TableCell>

                      {/* Status Chip */}
                      <TableCell align="center">
                        <Chip
                          icon={statusStyle.icon}
                          label={statusStyle.label}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            bgcolor: statusStyle.bg,
                            color: statusStyle.text,
                            border: `1px solid ${statusStyle.border}`
                          }}
                        />
                      </TableCell>

                      {/* Assigned By */}
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <Avatar sx={{ width: 20, height: 20, fontSize: '0.62rem', bgcolor: '#0F3B66' }}>
                            {(task.CreatedByUsername || 'U').charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>
                            {task.CreatedByUsername}
                            {task.isCreatedByMe && <span style={{ color: '#2563eb' }}> (You)</span>}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Tagged To (Compact Chips / Count) */}
                      <TableCell sx={{ minWidth: 160 }}>
                        {task.assignees.length === 0 ? (
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>None</Typography>
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
                            {task.assignees.slice(0, 2).map((a) => (
                              <Chip
                                key={a.AssigneeId || a.UserId}
                                size="small"
                                label={a.Username}
                                sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#334155' }}
                              />
                            ))}
                            {task.assignees.length > 2 && (
                              <Chip
                                size="small"
                                label={`+${task.assignees.length - 2}`}
                                sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#e2e8f0', color: '#475569' }}
                              />
                            )}
                          </Box>
                        )}
                      </TableCell>

                      {/* Deadline */}
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {deadlineInfo ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: task.isOverdue ? '#dc2626' : '#475569' }}>
                              {deadlineInfo.formattedShort}
                            </Typography>
                            {deadlineInfo.badgeText && (
                              <Chip
                                label={deadlineInfo.badgeText}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.62rem',
                                  fontWeight: 700,
                                  bgcolor: task.isOverdue ? '#fee2e2' : '#fef3c7',
                                  color: task.isOverdue ? '#dc2626' : '#d97706',
                                  border: `1px solid ${task.isOverdue ? '#fca5a5' : '#fde68a'}`
                                }}
                              />
                            )}
                          </Box>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#94a3b8' }}>—</Typography>
                        )}
                      </TableCell>

                      {/* Quick Actions & Menu (Click stopped propagation so row doesn't trigger open) */}
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
                          {!isCompleted && task.isAssignedToMe && task.myStatus === 'Pending' && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="info"
                              onClick={() => handleStatusChange(task, 'Accepted')}
                              sx={{ textTransform: 'none', fontWeight: 700, py: 0.2, px: 0.9, minWidth: 54, fontSize: '0.72rem', borderRadius: 1.5 }}
                            >
                              Accept
                            </Button>
                          )}

                          {!isCompleted && (task.isAssignedToMe || task.isCreatedByMe) && (
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              onClick={() => handleStatusChange(task, 'Completed')}
                              sx={{ textTransform: 'none', fontWeight: 700, py: 0.2, px: 1, minWidth: 64, fontSize: '0.72rem', borderRadius: 1.5 }}
                            >
                              Done
                            </Button>
                          )}

                          <Tooltip title="View Full Details">
                            <IconButton size="small" onClick={() => handleOpenDetails(task)}>
                              <ViewIcon fontSize="small" sx={{ color: '#0F3B66' }} />
                            </IconButton>
                          </Tooltip>

                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setMenuAnchor(e.currentTarget);
                              setActionTask(task);
                            }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Task Details Dialog (Opens on row click to show full details) */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        {selectedTask && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', py: 1.8 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <TaskAltIcon sx={{ color: '#2563eb', fontSize: 26 }} />
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F3B66', fontSize: '1.1rem' }}>
                  Task Details #{selectedTask.TaskId}
                </Typography>
              </Box>
              <IconButton onClick={() => setDetailDialogOpen(false)} size="small">
                <CloseIcon fontSize="small" />
              </IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
              {/* Badges: Priority, Status, and Overdue / Deadline */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={`Priority: ${selectedTask.Priority}`}
                  size="small"
                  sx={{
                    fontWeight: 800,
                    bgcolor: PRIORITY_COLORS[selectedTask.Priority]?.bg || '#f1f5f9',
                    color: PRIORITY_COLORS[selectedTask.Priority]?.text || '#64748b',
                    border: `1px solid ${PRIORITY_COLORS[selectedTask.Priority]?.border || '#cbd5e1'}`
                  }}
                />
                <Chip
                  icon={STATUS_CONFIG[selectedTask.Status]?.icon}
                  label={`Status: ${selectedTask.Status}`}
                  size="small"
                  sx={{
                    fontWeight: 800,
                    bgcolor: STATUS_CONFIG[selectedTask.Status]?.bg || '#f1f5f9',
                    color: STATUS_CONFIG[selectedTask.Status]?.text || '#64748b',
                    border: `1px solid ${STATUS_CONFIG[selectedTask.Status]?.border || '#cbd5e1'}`
                  }}
                />
                {selectedTask.Deadline && (
                  <Chip
                    icon={<CalendarIcon sx={{ fontSize: 14 }} />}
                    label={`Due: ${new Date(selectedTask.Deadline).toLocaleString('en-IN')}`}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      bgcolor: selectedTask.isOverdue ? '#fee2e2' : '#f1f5f9',
                      color: selectedTask.isOverdue ? '#dc2626' : '#334155'
                    }}
                  />
                )}
              </Box>

              {/* Title */}
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F3B66', mb: 1 }}>
                {selectedTask.Title}
              </Typography>

              {/* Description Box */}
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', mb: 2.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 0.5 }}>
                  Description & Instructions:
                </Typography>
                <Typography variant="body2" sx={{ color: '#334155', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                  {selectedTask.Description || 'No description provided.'}
                </Typography>
              </Box>

              {/* Author & Timeline Info */}
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontWeight: 600 }}>
                      Created By:
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#0F3B66' }}>
                        {(selectedTask.CreatedByUsername || 'U').charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                          {selectedTask.CreatedByUsername}
                          {selectedTask.isCreatedByMe && <span style={{ color: '#2563eb' }}> (You)</span>}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {new Date(selectedTask.CreatedAt).toLocaleString('en-IN')}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontWeight: 600 }}>
                      {selectedTask.Status === 'Completed' ? 'Completed At:' : 'Deadline Timeline:'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: selectedTask.isOverdue ? '#dc2626' : '#1e293b', mt: 0.5 }}>
                      {selectedTask.Status === 'Completed'
                        ? `${new Date(selectedTask.CompletedAt || selectedTask.UpdatedAt).toLocaleString('en-IN')} by ${selectedTask.CompletedByUsername || 'User'}`
                        : (selectedTask.Deadline ? new Date(selectedTask.Deadline).toLocaleString('en-IN') : 'No deadline set')}
                    </Typography>
                    {selectedTask.isOverdue && selectedTask.Status !== 'Completed' && (
                      <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 700 }}>
                        ⚠️ This task is past its due date.
                      </Typography>
                    )}
                  </Box>
                </Grid>
              </Grid>

              {/* Tagged Team Members */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <GroupIcon sx={{ fontSize: 18, color: '#2563eb' }} /> Tagged Team Members ({selectedTask.assignees.length}):
                </Typography>
                {selectedTask.assignees.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                    No team members were tagged in this task.
                  </Typography>
                ) : (
                  <Grid container spacing={1.5}>
                    {selectedTask.assignees.map((a) => {
                      const isMe = currentUser && (a.UserId === currentUser.UserId || (a.Username || '').toLowerCase() === (currentUser.Username || '').toLowerCase());
                      const aStatusStyle = STATUS_CONFIG[a.Status] || STATUS_CONFIG.Pending;

                      return (
                        <Grid item xs={12} sm={6} key={a.AssigneeId || a.UserId}>
                          <Paper sx={{ p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: isMe ? '#f0f9ff' : '#ffffff' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 30, height: 30, fontSize: '0.75rem', bgcolor: isMe ? '#2563eb' : '#64748b' }}>
                                {(a.Username || 'U').charAt(0).toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: isMe ? '#1d4ed8' : '#1e293b' }}>
                                  {a.Username} {a.FullName ? `(${a.FullName})` : ''} {isMe && '(You)'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                  {a.UserRole || 'Member'}
                                </Typography>
                              </Box>
                            </Box>
                            <Chip
                              icon={aStatusStyle.icon}
                              label={a.Status}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                bgcolor: aStatusStyle.bg,
                                color: aStatusStyle.text,
                                border: `1px solid ${aStatusStyle.border}`
                              }}
                            />
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}
              </Box>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 1.8, bgcolor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {selectedTask.Status !== 'Completed' && selectedTask.isAssignedToMe && selectedTask.myStatus === 'Pending' && (
                  <Button
                    variant="contained"
                    color="info"
                    size="small"
                    startIcon={<TaskAltIcon />}
                    onClick={() => handleStatusChange(selectedTask, 'Accepted')}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                  >
                    Accept Task
                  </Button>
                )}

                {selectedTask.Status !== 'Completed' && selectedTask.isAssignedToMe && selectedTask.myStatus === 'Accepted' && (
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<InProgressIcon />}
                    onClick={() => handleStatusChange(selectedTask, 'In Progress')}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                  >
                    Start Working
                  </Button>
                )}

                {selectedTask.Status !== 'Completed' && (selectedTask.isAssignedToMe || selectedTask.isCreatedByMe) && (
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<CompleteIcon />}
                    onClick={() => handleStatusChange(selectedTask, 'Completed')}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                  >
                    Mark as Completed
                  </Button>
                )}
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleDeleteTask(selectedTask)}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                >
                  Delete Task
                </Button>
                <Button
                  variant="contained"
                  onClick={() => setDetailDialogOpen(false)}
                  sx={{ bgcolor: '#0F3B66', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                >
                  Close
                </Button>
              </Box>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Task Options Menu (Change status / Delete) */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' } }}
      >
        <Typography variant="caption" sx={{ px: 2, py: 0.5, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
          Change Status
        </Typography>
        <MenuItem onClick={() => handleStatusChange(actionTask, 'Pending')}>
          <PendingIcon sx={{ fontSize: 16, mr: 1, color: '#d97706' }} /> Mark as Pending
        </MenuItem>
        <MenuItem onClick={() => handleStatusChange(actionTask, 'Accepted')}>
          <TaskAltIcon sx={{ fontSize: 16, mr: 1, color: '#0284c7' }} /> Mark as Accepted
        </MenuItem>
        <MenuItem onClick={() => handleStatusChange(actionTask, 'In Progress')}>
          <InProgressIcon sx={{ fontSize: 16, mr: 1, color: '#2563eb' }} /> Mark as In Progress
        </MenuItem>
        <MenuItem onClick={() => handleStatusChange(actionTask, 'On Hold')}>
          <PauseIcon sx={{ fontSize: 16, mr: 1, color: '#9333ea' }} /> Put On Hold
        </MenuItem>
        <MenuItem onClick={() => handleStatusChange(actionTask, 'Completed')}>
          <CompleteIcon sx={{ fontSize: 16, mr: 1, color: '#15803d' }} /> Mark Completed
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => handleDeleteTask(actionTask)} sx={{ color: '#dc2626' }}>
          <DeleteIcon sx={{ fontSize: 16, mr: 1 }} /> Delete Task
        </MenuItem>
      </Menu>

      {/* Create Task Modal Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => !submitting && setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <form onSubmit={handleCreateTask}>
          <DialogTitle sx={{ fontWeight: 800, color: '#0F3B66', display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddIcon sx={{ color: '#F88A01' }} /> Create New Task
          </DialogTitle>
          <DialogContent dividers sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                required
                fullWidth
                label="Task Title"
                placeholder="e.g. Verify raw material inward delivery with vendor"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description & Instructions"
                placeholder="Provide detailed instructions, references, or specific requirements..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={formData.priority}
                      label="Priority"
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="Urgent">🔴 Urgent</MenuItem>
                      <MenuItem value="High">🟠 High</MenuItem>
                      <MenuItem value="Medium">🔵 Medium</MenuItem>
                      <MenuItem value="Low">⚪ Low</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="datetime-local"
                    label="Deadline (Due Date & Time)"
                    InputLabelProps={{ shrink: true }}
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Grid>
              </Grid>

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F3B66', mb: 1, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <GroupIcon sx={{ fontSize: 18, color: '#2563eb' }} /> Tag Team Members ({formData.assignees.length} selected):
                </Typography>
                <Autocomplete
                  multiple
                  options={activeUsers}
                  getOptionLabel={(option) => `${option.Username}${option.FullName ? ` (${option.FullName})` : ''} - ${option.UserRole || 'User'}`}
                  value={formData.assignees}
                  onChange={(event, newValue) => {
                    setFormData({ ...formData, assignees: newValue });
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={formData.assignees.length === 0 ? "Select 1 or more team members..." : ""}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        avatar={
                          <Avatar sx={{ width: 20, height: 20, fontSize: '0.65rem' }}>
                            {(option.Username || 'U').charAt(0).toUpperCase()}
                          </Avatar>
                        }
                        label={`${option.Username} (${option.UserRole || 'User'})`}
                        {...getTagProps({ index })}
                        key={option.UserId}
                        size="small"
                        sx={{ bgcolor: '#eff6ff', color: '#1e40af', fontWeight: 600 }}
                      />
                    ))
                  }
                />
                <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, display: 'block' }}>
                  Tagged members will instantly receive an in-app notification when this task is created.
                </Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f8fafc' }}>
            <Button onClick={() => setCreateDialogOpen(false)} disabled={submitting} sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600 }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              sx={{
                bgcolor: '#0F3B66',
                color: '#ffffff',
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2,
                px: 3,
                '&:hover': { bgcolor: '#F88A01' }
              }}
            >
              {submitting ? <CircularProgress size={20} color="inherit" /> : 'Create Task'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Snackbar notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%', borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TaskManager;
