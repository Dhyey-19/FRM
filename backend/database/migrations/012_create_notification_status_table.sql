-- Migration 012: Create NotificationLogStatus table for tracking notification status (Open/Closed)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationLogStatus')
BEGIN
    CREATE TABLE [dbo].[NotificationLogStatus] (
        [NotificationId] VARCHAR(150) NOT NULL PRIMARY KEY,
        [NotificationType] VARCHAR(50) NULL,
        [Title] NVARCHAR(255) NULL,
        [Message] NVARCHAR(1000) NULL,
        [Status] VARCHAR(20) NOT NULL DEFAULT 'Open',
        [GeneratedAt] DATETIME NOT NULL DEFAULT GETDATE(),
        [ClosedAt] DATETIME NULL,
        [ClosedBy] VARCHAR(100) NULL,
        [ClosedReason] NVARCHAR(500) NULL,
        [UpdatedAt] DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

