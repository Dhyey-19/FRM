-- Migration 011: Update ItemTypeMaster system values to FG, RM, SF, BOP
-- fg = finished good
-- rm = raw material
-- sf = semi-finished
-- bop = bought out part

-- 1. Ensure Description column exists in ItemTypeMaster
IF NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'ItemTypeMaster' AND COLUMN_NAME = 'Description'
)
BEGIN
  ALTER TABLE [dbo].[ItemTypeMaster] ADD [Description] NVARCHAR(100) NULL;
END
GO

-- 2. Update existing items in ItemMaster to use the new standard codes
UPDATE [dbo].[ItemMaster]
SET ItemType = 'FG'
WHERE UPPER(LTRIM(RTRIM(ISNULL(ItemType, '')))) IN ('FINISHED GOOD', 'FINISHED GOODS', 'FINISHED');

UPDATE [dbo].[ItemMaster]
SET ItemType = 'RM'
WHERE UPPER(LTRIM(RTRIM(ISNULL(ItemType, '')))) IN ('RAW MATERIAL', 'RAW MATERIALS');

UPDATE [dbo].[ItemMaster]
SET ItemType = 'SF'
WHERE UPPER(LTRIM(RTRIM(ISNULL(ItemType, '')))) IN ('SEMI-FINISHED', 'SEMI FINISHED', 'SEMI FINISHED GOOD', 'SEMI-FINISHED GOOD');

-- 3. Remove old system values from ItemTypeMaster
DELETE FROM [dbo].[ItemTypeMaster]
WHERE UPPER(LTRIM(RTRIM(ItemType))) IN ('FINISHED GOOD', 'FINISHED GOODS', 'RAW MATERIAL', 'RAW MATERIALS', 'SEMI-FINISHED', 'SEMI FINISHED');

-- 4. Mark SCRAP as non-system if present
UPDATE [dbo].[ItemTypeMaster]
SET IsSystem = 0
WHERE UPPER(LTRIM(RTRIM(ItemType))) = 'SCRAP';
GO

-- 5. Insert or update the 4 requested system values
IF NOT EXISTS (SELECT 1 FROM [dbo].[ItemTypeMaster] WHERE ItemType = 'FG')
  INSERT INTO [dbo].[ItemTypeMaster] (ItemType, [Description], IsSystem) VALUES ('FG', 'Finished Good', 1);
ELSE
  UPDATE [dbo].[ItemTypeMaster] SET [Description] = 'Finished Good', IsSystem = 1 WHERE ItemType = 'FG';

IF NOT EXISTS (SELECT 1 FROM [dbo].[ItemTypeMaster] WHERE ItemType = 'RM')
  INSERT INTO [dbo].[ItemTypeMaster] (ItemType, [Description], IsSystem) VALUES ('RM', 'Raw Material', 1);
ELSE
  UPDATE [dbo].[ItemTypeMaster] SET [Description] = 'Raw Material', IsSystem = 1 WHERE ItemType = 'RM';

IF NOT EXISTS (SELECT 1 FROM [dbo].[ItemTypeMaster] WHERE ItemType = 'SF')
  INSERT INTO [dbo].[ItemTypeMaster] (ItemType, [Description], IsSystem) VALUES ('SF', 'Semi-Finished', 1);
ELSE
  UPDATE [dbo].[ItemTypeMaster] SET [Description] = 'Semi-Finished', IsSystem = 1 WHERE ItemType = 'SF';

IF NOT EXISTS (SELECT 1 FROM [dbo].[ItemTypeMaster] WHERE ItemType = 'BOP')
  INSERT INTO [dbo].[ItemTypeMaster] (ItemType, [Description], IsSystem) VALUES ('BOP', 'Bought Out Part', 1);
ELSE
  UPDATE [dbo].[ItemTypeMaster] SET [Description] = 'Bought Out Part', IsSystem = 1 WHERE ItemType = 'BOP';
GO
