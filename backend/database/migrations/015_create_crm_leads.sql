-- Migration 015: Create CRM_Leads table and seed initial pipeline records from SALES for ERP.xlsx

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CRM_Leads')
BEGIN
    CREATE TABLE [dbo].[CRM_Leads] (
        [LeadID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [DateAdded] DATE NOT NULL CONSTRAINT [DF_CRM_Leads_DateAdded] DEFAULT (CAST(GETDATE() AS DATE)),
        [Customer] NVARCHAR(200) NOT NULL,
        [Country] NVARCHAR(100) NULL CONSTRAINT [DF_CRM_Leads_Country] DEFAULT ('India'),
        [Contact] NVARCHAR(200) NULL,
        [ProductRequirement] NVARCHAR(500) NULL,
        [ItemCode] VARCHAR(50) NULL,
        [Stage] NVARCHAR(50) NOT NULL CONSTRAINT [DF_CRM_Leads_Stage] DEFAULT ('New'),
        [NextAction] NVARCHAR(200) NULL,
        [FollowUpDate] DATE NULL,
        [DealValue] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_CRM_Leads_DealValue] DEFAULT (0),
        [Remarks] NVARCHAR(MAX) NULL,
        [Source] NVARCHAR(100) NULL,
        [QtyAsked] DECIMAL(15, 2) NULL,
        [OurPrice] DECIMAL(15, 2) NULL,
        [TargetPrice] DECIMAL(15, 2) NULL,
        [BuyerType] NVARCHAR(100) NULL,
        [CanWeMake] NVARCHAR(100) NULL,
        [LostReason] NVARCHAR(250) NULL,
        [CreatedBy] NVARCHAR(100) NULL CONSTRAINT [DF_CRM_Leads_CreatedBy] DEFAULT ('Admin'),
        [UpdatedBy] NVARCHAR(100) NULL CONSTRAINT [DF_CRM_Leads_UpdatedBy] DEFAULT ('Admin'),
        [CreatedAt] DATETIME NOT NULL CONSTRAINT [DF_CRM_Leads_CreatedAt] DEFAULT (GETDATE()),
        [UpdatedAt] DATETIME NOT NULL CONSTRAINT [DF_CRM_Leads_UpdatedAt] DEFAULT (GETDATE())
    );

    CREATE INDEX [IX_CRM_Leads_DateAdded] ON [dbo].[CRM_Leads] ([DateAdded]);
    CREATE INDEX [IX_CRM_Leads_Stage] ON [dbo].[CRM_Leads] ([Stage]);
    CREATE INDEX [IX_CRM_Leads_FollowUpDate] ON [dbo].[CRM_Leads] ([FollowUpDate]);
    CREATE INDEX [IX_CRM_Leads_Customer] ON [dbo].[CRM_Leads] ([Customer]);
END
