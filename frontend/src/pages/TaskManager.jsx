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
  Card,
  CardContent,
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
  AvatarGroup,
  Tabs,
  Tab,
  Alert,
  Snackbar,
  Menu,
  Divider
} from '@mui/material';
import {
  TaskAlt as TaskAltIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Flag as PriorityIcon,
  CheckCircle as CompleteIcon,
  HourglassEmpty as PendingIcon,
  PlayArrow as InProgressIcon,
  Pause as PauseIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  ArrowForward as ArrowForwardIcon,
  NotificationsActive as NotifIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PRIORITY_COLORS = {
  Urgent: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
  High: { bg: '#ffedd5', text: '#ea580c', border: '#fdba74' },
  Medium: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  Low: { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' }
};

const STATUS_CONFIG = {
  Pending: { label: 'Pending', color: 'default', bg: '#fef3c7', text: '#d97706', border: '#fde68a', icon: <PendingIcon sx={{ fontSize: 14 }} /> },
  Accepted: { label: 'Accepted', color: 'info', bg: '#e0f2fe', text: '#0284c7', border: '#bae6fd', icon: <TaskAltIcon sx={{ fontSize: 14 }} /> },
  'In Progress': { label: 'In Progress', color: 'primary', bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', icon: <InProgressIcon sx={{ fontSize: 14 }} /> },
  'On Hold': { label: 'On Hold', color: 'warning', bg: '#f3e8ff', text: '#9333ea', border: '#e9d5ff', icon: <PauseIcon sx={{ fontSize: 14 }} /> },
  Completed: { label: 'Completed', color: 'success', bg: '#dcfce7', text: '#15803d', border: '#86efac', icon: <CompleteIcon sx={{ fontSize: 14 }} /> }
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

  // Create / Edit Task Dialog State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    deadline: '',
    assignees: [] // array of selected user objects
  });

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
        setTasks(data.tasks || []);
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

  // Open Create Dialog
  const handleOpenCreate = () => {
    // Default deadline to tomorrow 5:00 PM
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
        const data = await res.json();
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

  // Update Task Status (Accept, In Progress, Completed, etc.)
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

    const formatted = d.toLocaleDateString('en-IN', {
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
      badgeText = daysOverdue === 1 ? 'Overdue by 1 day' : `Overdue by ${daysOverdue} days`;
    } else if (diffHours <= 24) {
      badgeText = `Due today (${Math.ceil(diffHours)}h left)`;
    } else if (diffHours <= 48) {
      badgeText = 'Due tomorrow';
    }

    return { formatted, isLate, badgeText };
  };

  const activeCount = tasks.filter(t => t.Status !== 'Completed').length;
  const completedCount = tasks.filter(t => t.Status === 'Completed').length;

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F3B66', letterSpacing: -0.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TaskAltIcon sx={{ fontSize: 36, color: '#2563eb' }} /> Task Manager
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.4 }}>
            Assign tasks, tag team members, track deadlines, and monitor real-time completion status.
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
              py: 0.9,
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
        <Box sx={{ px: { xs: 1.5, sm: 3 }, pt: 1, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <Tabs
            value={statusTab}
            onChange={(e, val) => setStatusTab(val)}
            sx={{
              '& .MuiTabs-indicator': { backgroundColor: '#F88A01', height: 3 },
              '& .MuiTab-root': {
                fontWeight: 700,
                fontSize: { xs: '0.85rem', sm: '0.92rem' },
                textTransform: 'none',
                minHeight: 48,
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
        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          {/* Left filters: Scope & Priority */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 150, bgcolor: '#ffffff' }}>
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

            <FormControl size="small" sx={{ minWidth: 130, bgcolor: '#ffffff' }}>
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
          <Box sx={{ width: { xs: '100%', sm: 260 } }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search tasks, assignees..."
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

        {/* Tasks List / Grid */}
        <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : tasks.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <TaskAltIcon sx={{ fontSize: 56, color: '#10b981', mb: 1.5, opacity: 0.8 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F3B66' }}>
                {statusTab === 'completed' ? 'No Completed Tasks Yet' : 'No Active Tasks Found'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                {searchTerm
                  ? 'No tasks match your search filter.'
                  : (statusTab === 'completed'
                      ? 'Tasks you complete will be automatically moved and displayed here.'
                      : 'All tasks are completed! Click "Create Task" above to assign new work.')}
              </Typography>
              {statusTab === 'active' && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate} sx={{ bgcolor: '#0F3B66', borderRadius: 2, textTransform: 'none' }}>
                  Create New Task
                </Button>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {tasks.map((task) => {
                const priorityStyle = PRIORITY_COLORS[task.Priority] || PRIORITY_COLORS.Medium;
                const statusStyle = STATUS_CONFIG[task.Status] || STATUS_CONFIG.Pending;
                const deadlineInfo = formatDeadline(task.Deadline);
                const isCompleted = task.Status === 'Completed';
                const isHighlighted = highlightedTaskId && String(highlightedTaskId) === String(task.TaskId);

                return (
                  <Paper
                    key={task.TaskId}
                    sx={{
                      p: { xs: 2, sm: 2.2 },
                      borderRadius: 2.5,
                      border: '1px solid',
                      borderColor: isHighlighted ? '#3b82f6' : (task.isOverdue ? '#fca5a5' : '#e2e8f0'),
                      borderLeft: `5px solid ${priorityStyle.text}`,
                      bgcolor: isHighlighted ? '#f8fafc' : (isCompleted ? '#fafbfc' : '#ffffff'),
                      boxShadow: isHighlighted ? '0 0 0 2px #3b82f6, 0 4px 12px rgba(59, 130, 246, 0.12)' : '0 2px 6px rgba(15, 59, 102, 0.03)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        boxShadow: '0 4px 16px rgba(15, 59, 102, 0.08)',
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between', gap: 2 }}>
                      {/* Left: Status, Priority, Title, Description, Created By */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {/* Status, Priority & Created By metadata */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip
                              icon={statusStyle.icon}
                              label={statusStyle.label}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                bgcolor: statusStyle.bg,
                                color: statusStyle.text,
                                border: `1px solid ${statusStyle.border}`
                              }}
                            />
                            <Chip
                              label={task.Priority}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                bgcolor: priorityStyle.bg,
                                color: priorityStyle.text,
                                border: `1px solid ${priorityStyle.border}`
                              }}
                            />
                            <Typography variant="caption" sx={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <span>Created by:</span>
                              <strong>{task.CreatedByUsername}</strong>
                              {task.isCreatedByMe && <span style={{ color: '#2563eb', fontWeight: 700 }}> (You)</span>}
                              <span>• {new Date(task.CreatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                            </Typography>
                          </Box>

                          {/* Mobile options button */}
                          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
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
                        </Box>

                        {/* Title */}
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 700,
                            color: isCompleted ? '#64748b' : '#0F3B66',
                            textDecoration: isCompleted ? 'line-through' : 'none',
                            lineHeight: 1.35,
                            mb: task.Description ? 0.4 : 0
                          }}
                        >
                          {task.Title}
                        </Typography>

                        {/* Description */}
                        {task.Description && (
                          <Typography
                            variant="body2"
                            sx={{
                              color: isCompleted ? '#94a3b8' : '#475569',
                              lineHeight: 1.45,
                              fontSize: '0.85rem'
                            }}
                          >
                            {task.Description}
                          </Typography>
                        )}
                      </Box>

                      {/* Middle 1: Tagged Users / Assignees */}
                      <Box sx={{ minWidth: { md: 180, lg: 220 }, maxWidth: { md: 260 } }}>
                        <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, display: 'block', mb: 0.5 }}>
                          Tagged Team ({task.assignees.length}):
                        </Typography>
                        {task.assignees.length === 0 ? (
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                            No members tagged
                          </Typography>
                        ) : (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {task.assignees.map((a) => {
                              const isMe = currentUser && (a.UserId === currentUser.UserId || (a.Username || '').toLowerCase() === (currentUser.Username || '').toLowerCase());

                              return (
                                <Chip
                                  key={a.AssigneeId || a.UserId}
                                  avatar={
                                    <Avatar sx={{ width: 18, height: 18, fontSize: '0.62rem', bgcolor: isMe ? '#2563eb' : '#64748b' }}>
                                      {(a.Username || 'U').charAt(0).toUpperCase()}
                                    </Avatar>
                                  }
                                  label={`${a.Username}${isMe ? ' (You)' : ''} • ${a.Status}`}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.68rem',
                                    fontWeight: 600,
                                    bgcolor: isMe ? '#eff6ff' : '#f1f5f9',
                                    color: isMe ? '#1d4ed8' : '#334155',
                                    border: `1px solid ${isMe ? '#bfdbfe' : '#e2e8f0'}`
                                  }}
                                />
                              );
                            })}
                          </Box>
                        )}
                      </Box>

                      {/* Middle 2: Deadline */}
                      <Box sx={{ minWidth: { md: 160, lg: 180 } }}>
                        <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, display: 'block', mb: 0.5 }}>
                          Deadline:
                        </Typography>
                        {deadlineInfo ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                              <CalendarIcon sx={{ fontSize: 16, color: task.isOverdue ? '#dc2626' : '#64748b' }} />
                              <Typography variant="caption" sx={{ color: task.isOverdue ? '#dc2626' : '#334155', fontWeight: 600 }}>
                                {deadlineInfo.formatted}
                              </Typography>
                            </Box>
                            {deadlineInfo.badgeText && (
                              <Box>
                                <Chip
                                  label={deadlineInfo.badgeText}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    bgcolor: task.isOverdue ? '#fee2e2' : '#fef3c7',
                                    color: task.isOverdue ? '#dc2626' : '#d97706',
                                    border: `1px solid ${task.isOverdue ? '#fca5a5' : '#fde68a'}`
                                  }}
                                />
                              </Box>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                            No deadline set
                          </Typography>
                        )}
                      </Box>

                      {/* Right: Actions & Options */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, alignSelf: { xs: 'stretch', md: 'center' }, justifyContent: { xs: 'flex-start', md: 'flex-end' }, minWidth: { md: 150 } }}>
                        {!isCompleted ? (
                          <>
                            {task.isAssignedToMe && task.myStatus === 'Pending' && (
                              <Button
                                size="small"
                                variant="contained"
                                color="info"
                                startIcon={<TaskAltIcon />}
                                onClick={() => handleStatusChange(task, 'Accepted')}
                                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, whiteSpace: 'nowrap' }}
                              >
                                Accept
                              </Button>
                            )}

                            {task.isAssignedToMe && task.myStatus === 'Accepted' && (
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                startIcon={<InProgressIcon />}
                                onClick={() => handleStatusChange(task, 'In Progress')}
                                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, whiteSpace: 'nowrap' }}
                              >
                                Start
                              </Button>
                            )}

                            {(task.isAssignedToMe || task.isCreatedByMe) && (
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<CompleteIcon />}
                                onClick={() => handleStatusChange(task, 'Completed')}
                                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, whiteSpace: 'nowrap' }}
                              >
                                Complete
                              </Button>
                            )}
                          </>
                        ) : (
                          <Chip
                            icon={<CompleteIcon sx={{ fontSize: 16 }} />}
                            label="Completed"
                            size="small"
                            variant="outlined"
                            color="success"
                            sx={{ fontWeight: 700 }}
                          />
                        )}

                        {/* Desktop options menu button */}
                        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
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
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Task Options Action Menu */}
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
              {/* Task Title */}
              <TextField
                required
                fullWidth
                label="Task Title"
                placeholder="e.g. Verify raw material inward delivery with vendor"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />

              {/* Description */}
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

              {/* Priority & Deadline row */}
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

              {/* Tag Users (Multi-select) */}
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
                  Tagged members will instantly receive an in-app notification and alert when this task is created.
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

