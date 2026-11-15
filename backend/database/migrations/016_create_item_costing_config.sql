-- Migration 016: Create ItemCostingConfig table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ItemCostingConfig')
BEGIN
    CREATE TABLE [dbo].[ItemCostingConfig] (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [ConfigKey] NVARCHAR(50) NOT NULL CONSTRAINT [UQ_ItemCostingConfig_ConfigKey] UNIQUE,
        [PipeRatePerMeter] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_PipeRate] DEFAULT (23.0000),
        [BrassRatePerKg] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_BrassRate] DEFAULT (950.0000),
        [HcpPipeRatePerMeter] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_HcpPipeRate] DEFAULT (27.0000),
        [NylonInsertRate] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_NylonInsert] DEFAULT (1.5000),
        [NylonNutRate] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_NylonNut] DEFAULT (2.5000),
        [SS201NutRate] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_SS201Nut] DEFAULT (5.2500),
        [SS304NutRate] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_SS304Nut] DEFAULT (8.0000),
        [SSInnerRate] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_SSInner] DEFAULT (2.5000),
        [BrassInsertConv] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_BrassInsertConv] DEFAULT (300.0000),
        [BrassInsertWeight] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_BrassInsertWeight] DEFAULT (0.0040),
        [BrassNutNConv] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_BrassNutNConv] DEFAULT (230.0000),
        [BrassNutNWeight] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_BrassNutNWeight] DEFAULT (0.0110),
        [BrassNutPCConv] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_BrassNutPCConv] DEFAULT (350.0000),
        [BrassNutPCWeight] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_BrassNutPCWeight] DEFAULT (0.0120),
        [CapRate] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_CapRate] DEFAULT (2.5000),
        [KeyRate] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_KeyRate] DEFAULT (1.0000),
        [WasherRate] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_WasherRate] DEFAULT (0.8000),
        [LabourRate] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_LabourRate] DEFAULT (2.0000),
        [PackingRate] DECIMAL(12, 4) NOT NULL CONSTRAINT [DF_ItemCostingConfig_PackingRate] DEFAULT (1.0000),
        [MarginsJson] NVARCHAR(MAX) NULL,
        [UpdatedAt] DATETIME NOT NULL CONSTRAINT [DF_ItemCostingConfig_UpdatedAt] DEFAULT (GETDATE())
    );

    INSERT INTO [dbo].[ItemCostingConfig] (
        [ConfigKey], [PipeRatePerMeter], [BrassRatePerKg], [HcpPipeRatePerMeter],
        [NylonInsertRate], [NylonNutRate], [SS201NutRate], [SS304NutRate], [SSInnerRate],
        [BrassInsertConv], [BrassInsertWeight], [BrassNutNConv], [BrassNutNWeight],
        [BrassNutPCConv], [BrassNutPCWeight], [CapRate], [KeyRate], [WasherRate],
        [LabourRate], [PackingRate]
    ) VALUES (
        'DEFAULT', 23.0000, 950.0000, 27.0000,
        1.5000, 2.5000, 5.2500, 8.0000, 2.5000,
        300.0000, 0.0040, 230.0000, 0.0110,
        350.0000, 0.0120, 2.5000, 1.0000, 0.8000,
        2.0000, 1.0000
    );
END
GO
