-- 014_dept_costing_and_item_costing_decimals.sql
-- 1. Ensure ItemMaster.Costing and MRP have 2 decimal places
ALTER TABLE [dbo].[ItemMaster] ALTER COLUMN [Costing] DECIMAL(15, 2);
ALTER TABLE [dbo].[ItemMaster] ALTER COLUMN [MRP] DECIMAL(15, 2);

-- 2. Add Costing column to DepartmentMaster if it does not exist
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[DepartmentMaster]') 
      AND name = N'Costing'
)
BEGIN
    ALTER TABLE [dbo].[DepartmentMaster] ADD [Costing] DECIMAL(15, 2) NOT NULL DEFAULT 0;
END
GO

-- 3. Remove Rate, Amount, LossRate, LossAmount from StockTransfer
-- First drop any default constraints on these columns
DECLARE @dropConstraintsSql NVARCHAR(MAX) = N'';
SELECT @dropConstraintsSql += N'ALTER TABLE [dbo].[StockTransfer] DROP CONSTRAINT [' + dc.name + N'];' + CHAR(13)
FROM sys.default_constraints dc
JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[StockTransfer]')
  AND c.name IN (N'Rate', N'Amount', N'LossRate', N'LossAmount');

IF LEN(@dropConstraintsSql) > 0
BEGIN
    EXEC sp_executesql @dropConstraintsSql;
END
GO

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[StockTransfer]') AND name = N'Rate')
BEGIN
    ALTER TABLE [dbo].[StockTransfer] DROP COLUMN [Rate];
END
GO

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[StockTransfer]') AND name = N'Amount')
BEGIN
    ALTER TABLE [dbo].[StockTransfer] DROP COLUMN [Amount];
END
GO

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[StockTransfer]') AND name = N'LossRate')
BEGIN
    ALTER TABLE [dbo].[StockTransfer] DROP COLUMN [LossRate];
END
GO

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[StockTransfer]') AND name = N'LossAmount')
BEGIN
    ALTER TABLE [dbo].[StockTransfer] DROP COLUMN [LossAmount];
END
GO
