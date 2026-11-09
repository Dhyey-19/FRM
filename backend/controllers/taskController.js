const { connectDB } = require('../config/db');

/**
 * GET /api/tasks
 * Fetch tasks with assignees and optional filters (scope, statusTab, priority, search)
 */
exports.getTasks = async (req, res) => {
  try {
    const pool = await connectDB();
    const currentUserId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
    const currentUsername = (req.headers['x-username'] || '').trim().toLowerCase();

    const { scope = 'all', statusTab = 'active', priority = 'all', search = '' } = req.query;

    // 1. Fetch base tasks
    let query = `
      SELECT 
        t.TaskId,
        t.Title,
        t.Description,
        t.Priority,
        t.Deadline,
        t.Status,
        t.CreatedByUserId,
        t.CreatedByUsername,
        t.CreatedAt,
        t.UpdatedAt,
        t.CompletedAt,
        t.CompletedByUserId,
        t.CompletedByUsername,
        u.FullName AS CreatedByFullName
      FROM Tasks t
      LEFT JOIN Users u ON t.CreatedByUserId = u.UserId
      WHERE 1=1
    `;

    // Filter by active vs completed
    if (statusTab === 'active') {
      query += ` AND t.Status != 'Completed'`;
    } else if (statusTab === 'completed') {
      query += ` AND t.Status = 'Completed'`;
    }

    // Filter by priority
    if (priority && priority !== 'all') {
      query += ` AND t.Priority = '${priority.replace(/'/g, "''")}'`;
    }

    query += ` ORDER BY 
      CASE WHEN t.Status != 'Completed' AND t.Deadline IS NOT NULL AND t.Deadline < GETDATE() THEN 0 ELSE 1 END,
      CASE WHEN t.Status != 'Completed' THEN 0 ELSE 1 END,
      t.Deadline ASC,
      t.CreatedAt DESC
    `;

    const tasksResult = await pool.request().query(query);
    const rawTasks = tasksResult.recordset || [];

    if (rawTasks.length === 0) {
      return res.status(200).json({ success: true, tasks: [] });
    }

    // 2. Fetch assignees for all retrieved tasks
    const taskIds = rawTasks.map(t => t.TaskId);
    const assigneesResult = await pool.request().query(`
      SELECT 
        ta.AssigneeId,
        ta.TaskId,
        ta.UserId,
        ta.Username,
        ta.Status,
        ta.AssignedAt,
        ta.AcceptedAt,
        ta.UpdatedAt,
        u.FullName,
        u.UserRole
      FROM TaskAssignees ta
      LEFT JOIN Users u ON ta.UserId = u.UserId
      WHERE ta.TaskId IN (${taskIds.join(',')})
      ORDER BY ta.TaskId ASC, ta.Username ASC
    `);

    const assigneesByTask = {};
    (assigneesResult.recordset || []).forEach(a => {
      if (!assigneesByTask[a.TaskId]) {
        assigneesByTask[a.TaskId] = [];
      }
      assigneesByTask[a.TaskId].push(a);
    });

    // 3. Assemble and apply scope / search filtering
    let processedTasks = rawTasks.map(t => {
      const assignees = assigneesByTask[t.TaskId] || [];
      const isOverdue = t.Status !== 'Completed' && t.Deadline && new Date(t.Deadline) < new Date();
      const isAssignedToMe = currentUserId 
        ? assignees.some(a => a.UserId === currentUserId) 
        : (currentUsername ? assignees.some(a => (a.Username || '').toLowerCase() === currentUsername) : false);
      const isCreatedByMe = currentUserId 
        ? t.CreatedByUserId === currentUserId 
        : (currentUsername ? (t.CreatedByUsername || '').toLowerCase() === currentUsername : false);

      const myAssigneeRecord = currentUserId 
        ? assignees.find(a => a.UserId === currentUserId) 
        : (currentUsername ? assignees.find(a => (a.Username || '').toLowerCase() === currentUsername) : null);

      return {
        ...t,
        assignees,
        isOverdue,
        isAssignedToMe,
        isCreatedByMe,
        myStatus: myAssigneeRecord ? myAssigneeRecord.Status : null,
        myAcceptedAt: myAssigneeRecord ? myAssigneeRecord.AcceptedAt : null
      };
    });

    // Scope filter: assigned_to_me | created_by_me | all
    if (scope === 'assigned_to_me') {
      processedTasks = processedTasks.filter(t => t.isAssignedToMe);
    } else if (scope === 'created_by_me') {
      processedTasks = processedTasks.filter(t => t.isCreatedByMe);
    }

    // Search filter
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      processedTasks = processedTasks.filter(t => {
        const inTitle = (t.Title || '').toLowerCase().includes(term);
        const inDesc = (t.Description || '').toLowerCase().includes(term);
        const inCreator = (t.CreatedByUsername || '').toLowerCase().includes(term) || (t.CreatedByFullName || '').toLowerCase().includes(term);
        const inAssignees = t.assignees.some(a => (a.Username || '').toLowerCase().includes(term) || (a.FullName || '').toLowerCase().includes(term));
        return inTitle || inDesc || inCreator || inAssignees;
      });
    }

    res.status(200).json({
      success: true,
      tasks: processedTasks
    });
  } catch (error) {
    console.error('Error in getTasks:', error);
    res.status(500).json({ success: false, message: 'Server error fetching tasks' });
  }
};

/**
 * GET /api/tasks/kpis
 * Fetch Task KPI metrics for the current user
 */
exports.getTaskKpis = async (req, res) => {
  try {
    const pool = await connectDB();
    const currentUserId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
    const currentUsername = (req.headers['x-username'] || '').trim().toLowerCase();

    // Query all tasks and assignees
    const tasksRes = await pool.request().query(`
      SELECT 
        t.TaskId,
        t.Status,
        t.Deadline,
        t.CreatedByUserId,
        t.CreatedByUsername
      FROM Tasks t
    `);

    const assigneesRes = await pool.request().query(`
      SELECT TaskId, UserId, Username, Status FROM TaskAssignees
    `);

    const assigneesByTask = {};
    (assigneesRes.recordset || []).forEach(a => {
      if (!assigneesByTask[a.TaskId]) assigneesByTask[a.TaskId] = [];
      assigneesByTask[a.TaskId].push(a);
    });

    const now = new Date();
    let totalTasks = 0;
    let activeCount = 0;
    let assignedToMeCount = 0;
    let createdByMeCount = 0;
    let completedCount = 0;
    let overdueCount = 0;

    (tasksRes.recordset || []).forEach(t => {
      const assignees = assigneesByTask[t.TaskId] || [];
      const isAssignedToMe = currentUserId 
        ? assignees.some(a => a.UserId === currentUserId) 
        : (currentUsername ? assignees.some(a => (a.Username || '').toLowerCase() === currentUsername) : false);
      const isCreatedByMe = currentUserId 
        ? t.CreatedByUserId === currentUserId 
        : (currentUsername ? (t.CreatedByUsername || '').toLowerCase() === currentUsername : false);

      const isRelevant = !currentUserId && !currentUsername ? true : (isAssignedToMe || isCreatedByMe);

      if (isRelevant) {
        totalTasks++;
        if (t.Status === 'Completed') {
          completedCount++;
        } else {
          activeCount++;
          if (isAssignedToMe) assignedToMeCount++;
          if (isCreatedByMe) createdByMeCount++;
          if (t.Deadline && new Date(t.Deadline) < now) {
            overdueCount++;
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      kpis: {
        totalTasks,
        activeCount,
        assignedToMeCount,
        createdByMeCount,
        completedCount,
        overdueCount
      }
    });
  } catch (error) {
    console.error('Error in getTaskKpis:', error);
    res.status(500).json({ success: false, message: 'Server error fetching task KPIs' });
  }
};

/**
 * POST /api/tasks
 * Create a new task and notify all tagged users
 */
exports.createTask = async (req, res) => {
  try {
    const { title, description, priority = 'Medium', deadline, assigneeUserIds = [] } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required.' });
    }

    const pool = await connectDB();
    const currentUserId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : (req.body.createdByUserId || 1);
    const currentUsername = req.headers['x-username'] || req.body.createdByUsername || 'User';

    // 1. Fetch user records for tagged users
    let taggedUsers = [];
    if (assigneeUserIds && assigneeUserIds.length > 0) {
      const userIdsList = assigneeUserIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (userIdsList.length > 0) {
        const usersRes = await pool.request().query(`
          SELECT UserId, Username, FullName FROM Users WHERE UserId IN (${userIdsList.join(',')})
        `);
        taggedUsers = usersRes.recordset || [];
      }
    }

    // 2. Insert main task
    const parsedDeadline = deadline ? new Date(deadline) : null;
    const taskInsertRes = await pool.request()
      .input('Title', title.trim())
      .input('Description', description ? description.trim() : null)
      .input('Priority', priority || 'Medium')
      .input('Deadline', parsedDeadline)
      .input('CreatedByUserId', currentUserId)
      .input('CreatedByUsername', currentUsername)
      .query(`
        INSERT INTO Tasks (Title, Description, Priority, Deadline, Status, CreatedByUserId, CreatedByUsername, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.TaskId
        VALUES (@Title, @Description, @Priority, @Deadline, 'Pending', @CreatedByUserId, @CreatedByUsername, GETDATE(), GETDATE())
      `);

    const newTaskId = taskInsertRes.recordset[0].TaskId;

    // 3. Insert assignees & notifications
    const formattedDeadline = parsedDeadline 
      ? parsedDeadline.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
      : 'No deadline';

    for (const u of taggedUsers) {
      await pool.request()
        .input('TaskId', newTaskId)
        .input('UserId', u.UserId)
        .input('Username', u.Username)
        .query(`
          INSERT INTO TaskAssignees (TaskId, UserId, Username, Status, AssignedAt, UpdatedAt)
          VALUES (@TaskId, @UserId, @Username, 'Pending', GETDATE(), GETDATE())
        `);

      // Notify tagged user (if not the creator themselves)
      if (u.UserId !== currentUserId) {
        await pool.request()
          .input('TaskId', newTaskId)
          .input('UserId', u.UserId)
          .input('FromUserId', currentUserId)
          .input('FromUsername', currentUsername)
          .input('Title', `Task Assigned: ${title.trim().slice(0, 100)}`)
          .input('Message', `${currentUsername} tagged you in task "${title.trim()}". Priority: ${priority}. Deadline: ${formattedDeadline}.`)
          .query(`
            INSERT INTO TaskNotifications (TaskId, UserId, FromUserId, FromUsername, Type, Title, Message, Status, CreatedAt)
            VALUES (@TaskId, @UserId, @FromUserId, @FromUsername, 'TASK_ASSIGNED', @Title, @Message, 'Open', GETDATE())
          `);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Task created successfully and notifications dispatched to tagged users.',
      taskId: newTaskId
    });
  } catch (error) {
    console.error('Error in createTask:', error);
    res.status(500).json({ success: false, message: 'Server error creating task' });
  }
};

/**
 * PUT /api/tasks/:id/status
 * Update status of task (e.g. Accepted, In Progress, Completed) and notify assigner & team
 */
exports.updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    const pool = await connectDB();
    const currentUserId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
    const currentUsername = req.headers['x-username'] || 'User';

    // 1. Fetch task
    const taskRes = await pool.request()
      .input('TaskId', id)
      .query(`SELECT TaskId, Title, Status, CreatedByUserId, CreatedByUsername FROM Tasks WHERE TaskId = @TaskId`);
    
    if (!taskRes.recordset || taskRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }
    const task = taskRes.recordset[0];

    // 2. Update task record
    if (status === 'Completed') {
      await pool.request()
        .input('TaskId', id)
        .input('CompletedByUserId', currentUserId)
        .input('CompletedByUsername', currentUsername)
        .query(`
          UPDATE Tasks 
          SET Status = 'Completed',
              CompletedAt = GETDATE(),
              CompletedByUserId = @CompletedByUserId,
              CompletedByUsername = @CompletedByUsername,
              UpdatedAt = GETDATE()
          WHERE TaskId = @TaskId
        `);
    } else {
      await pool.request()
        .input('TaskId', id)
        .input('Status', status)
        .query(`
          UPDATE Tasks 
          SET Status = @Status,
              CompletedAt = NULL,
              CompletedByUserId = NULL,
              CompletedByUsername = NULL,
              UpdatedAt = GETDATE()
          WHERE TaskId = @TaskId
        `);
    }

    // 3. Update current user's assignee status if assigned
    if (currentUserId) {
      await pool.request()
        .input('TaskId', id)
        .input('UserId', currentUserId)
        .input('Status', status)
        .query(`
          UPDATE TaskAssignees
          SET Status = @Status,
              AcceptedAt = CASE WHEN @Status IN ('Accepted', 'In Progress') AND AcceptedAt IS NULL THEN GETDATE() ELSE AcceptedAt END,
              UpdatedAt = GETDATE()
          WHERE TaskId = @TaskId AND UserId = @UserId
        `);
    }

    // 4. Send status update notifications to creator and other assignees
    const assigneesRes = await pool.request()
      .input('TaskId', id)
      .query(`SELECT UserId, Username FROM TaskAssignees WHERE TaskId = @TaskId`);
    
    const recipients = new Set();
    // Add creator if not current user
    if (task.CreatedByUserId && task.CreatedByUserId !== currentUserId) {
      recipients.add(task.CreatedByUserId);
    }
    // Add other assignees if not current user
    (assigneesRes.recordset || []).forEach(a => {
      if (a.UserId !== currentUserId) {
        recipients.add(a.UserId);
      }
    });

    const notifType = status === 'Completed' ? 'TASK_COMPLETED' : 'TASK_STATUS_UPDATED';
    const notifTitle = `Task Status: ${task.Title.slice(0, 80)}`;
    const notifMsg = `${currentUsername} updated the status of task "${task.Title}" to ${status}.`;

    for (const recipientId of recipients) {
      await pool.request()
        .input('TaskId', id)
        .input('UserId', recipientId)
        .input('FromUserId', currentUserId || 0)
        .input('FromUsername', currentUsername)
        .input('Type', notifType)
        .input('Title', notifTitle)
        .input('Message', notifMsg)
        .query(`
          INSERT INTO TaskNotifications (TaskId, UserId, FromUserId, FromUsername, Type, Title, Message, Status, CreatedAt)
          VALUES (@TaskId, @UserId, @FromUserId, @FromUsername, @Type, @Title, @Message, 'Open', GETDATE())
        `);
    }

    res.status(200).json({
      success: true,
      message: `Task status updated to ${status}.`
    });
  } catch (error) {
    console.error('Error in updateTaskStatus:', error);
    res.status(500).json({ success: false, message: 'Server error updating task status' });
  }
};

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await connectDB();
    await pool.request()
      .input('TaskId', id)
      .query(`
        DELETE FROM TaskNotifications WHERE TaskId = @TaskId;
        DELETE FROM TaskAssignees WHERE TaskId = @TaskId;
        DELETE FROM Tasks WHERE TaskId = @TaskId;
      `);

    res.status(200).json({ success: true, message: 'Task deleted successfully.' });
  } catch (error) {
    console.error('Error in deleteTask:', error);
    res.status(500).json({ success: false, message: 'Server error deleting task' });
  }
};

/**
 * GET /api/tasks/users
 * Fetch list of active users to tag in tasks
 */
exports.getActiveUsers = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT UserId, Username, FullName, UserRole, Department, Designation
      FROM Users
      WHERE IsActive = 1
      ORDER BY Username ASC
    `);

    res.status(200).json({
      success: true,
      users: result.recordset || []
    });
  } catch (error) {
    console.error('Error in getActiveUsers:', error);
    res.status(500).json({ success: false, message: 'Server error fetching active users' });
  }
};

