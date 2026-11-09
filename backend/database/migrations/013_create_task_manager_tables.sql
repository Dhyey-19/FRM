-- Migration 013: Create Task Manager and Task Notifications tables
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tasks')
BEGIN
    CREATE TABLE [dbo].[Tasks] (
        [TaskId] INT IDENTITY(1,1) PRIMARY KEY,
        [Title] NVARCHAR(255) NOT NULL,
        [Description] NVARCHAR(MAX) NULL,
        [Priority] VARCHAR(20) NOT NULL DEFAULT 'Medium', -- 'Low', 'Medium', 'High', 'Urgent'
        [Deadline] DATETIME NULL,
        [Status] VARCHAR(30) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Accepted', 'In Progress', 'Completed', 'Cancelled'
        [CreatedByUserId] INT NOT NULL,
        [CreatedByUsername] NVARCHAR(100) NOT NULL,
        [CreatedAt] DATETIME NOT NULL DEFAULT GETDATE(),
        [UpdatedAt] DATETIME NOT NULL DEFAULT GETDATE(),
        [CompletedAt] DATETIME NULL,
        [CompletedByUserId] INT NULL,
        [CompletedByUsername] NVARCHAR(100) NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TaskAssignees')
BEGIN
    CREATE TABLE [dbo].[TaskAssignees] (
        [AssigneeId] INT IDENTITY(1,1) PRIMARY KEY,
        [TaskId] INT NOT NULL CONSTRAINT [FK_TaskAssignees_TaskId] REFERENCES [dbo].[Tasks]([TaskId]) ON DELETE CASCADE,
        [UserId] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL,
        [Status] VARCHAR(30) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Accepted', 'In Progress', 'Completed'
        [AssignedAt] DATETIME NOT NULL DEFAULT GETDATE(),
        [AcceptedAt] DATETIME NULL,
        [UpdatedAt] DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TaskNotifications')
BEGIN
    CREATE TABLE [dbo].[TaskNotifications] (
        [NotificationId] INT IDENTITY(1,1) PRIMARY KEY,
        [TaskId] INT NOT NULL,
        [UserId] INT NOT NULL, -- Target recipient user
        [FromUserId] INT NOT NULL, -- Action performer
        [FromUsername] NVARCHAR(100) NOT NULL,
        [Type] VARCHAR(50) NOT NULL, -- 'TASK_ASSIGNED', 'TASK_STATUS_UPDATED', 'TASK_COMPLETED'
        [Title] NVARCHAR(255) NOT NULL,
        [Message] NVARCHAR(1000) NOT NULL,
        [Status] VARCHAR(20) NOT NULL DEFAULT 'Open',
        [CreatedAt] DATETIME NOT NULL DEFAULT GETDATE(),
        [ClosedAt] DATETIME NULL,
        [ClosedBy] NVARCHAR(100) NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TaskNotifications_User_Status')
BEGIN
    CREATE INDEX [IX_TaskNotifications_User_Status] ON [dbo].[TaskNotifications]([UserId], [Status]);
END
GO

