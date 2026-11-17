-- Migration 017: Add ItemCategory to ItemMaster and ensure Size column is removed
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ItemMaster]') AND name = N'ItemCategory')
BEGIN
    ALTER TABLE [dbo].[ItemMaster] ADD [ItemCategory] NVARCHAR(100) NULL;
END
GO

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ItemMaster]') AND name = N'Size')
BEGIN
    ALTER TABLE [dbo].[ItemMaster] DROP COLUMN [Size];
END
GO
