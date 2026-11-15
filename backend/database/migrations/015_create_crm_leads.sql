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

    -- Seed initial data from SALES for ERP
    INSERT INTO [dbo].[CRM_Leads] 
    ([DateAdded], [Customer], [Country], [Contact], [ProductRequirement], [Stage], [NextAction], [FollowUpDate], [DealValue], [Remarks], [Source], [QtyAsked], [OurPrice], [TargetPrice], [BuyerType], [CanWeMake], [LostReason], [ItemCode])
    VALUES
    ('2026-10-05', N'Sunrise Sanitaryware', N'India', N'Rakesh Mehta 98765 43210', N'SS304 chain shower tube 1.5M', N'Won', NULL, NULL, 185000, N'PO received 20-Oct', N'India Mart', 5000, 37, 35, N'Dealer', N'Yes - in stock', NULL, 'SS321'),
    ('2026-10-12', N'Al Noor Trading', N'UAE', N'Omar Farouk (WhatsApp)', N'SS304 chain shower tube 1M', N'Lost', NULL, NULL, 0, N'Customer found a cheaper China supplier', N'Ali Baba', 3000, 52, 44, N'Distributor', N'Yes - in stock', N'Price too high', 'SS316'),
    ('2026-10-14', N'Delta Bath Fittings', N'India', N'Anil Shah 98765 22222', N'Chain pullout tube 1.5M', N'Sample', N'Already Mail Sent', '2026-11-20', 0, N'Sample couriered 05-Nov', N'India Mart', 2000, 26, NULL, N'OEM / Manufacturer', N'Partly', NULL, 'SS21P'),
    ('2026-10-20', N'Bhavani Hardware', N'India', N'Suresh Patel 98765 11111', N'Pullout tube 1.2M SS304', N'Negotiation', N'Price Mismatch', '2026-11-10', 240000, N'Wants Rs 27, we quoted Rs 30', N'Trade India', 8000, 30, 27, N'Retailer', N'Yes - make to order', NULL, 'SS325P'),
    ('2026-10-26', N'Metro Plumbing Supplies', N'Kenya', N'Peter Otieno', N'Shower tube 1M SS201', N'Quotation', N'Quote Shared', '2026-11-12', 96000, N'Waiting for sample feedback', N'Ali Baba', 6000, 16, 15, N'Distributor', N'Yes - in stock', NULL, 'SS16'),
    ('2026-11-02', N'Royal Sanitary Mart', N'India', N'Imran Khan 98765 33333', N'SS304 chain tube 1M', N'Qualified', N'Share Quote', '2026-11-14', 0, N'Repeat buyer, wants best rate', N'India Mart', 4000, NULL, 33, N'Retailer', N'Yes - in stock', NULL, 'SS316'),
    ('2026-11-04', N'Kamdhenu Hardware', N'India', N'Prakash Rao 98765 88888', N'Pullout tube 1M SS201', N'Lost', NULL, NULL, 0, N'Buys from a local vendor', N'India Mart', 1500, NULL, NULL, N'Retailer', N'Yes - in stock', N'Local supplier', 'SS16P'),
    ('2026-11-05', N'Global Hardware LLC', N'USA', N'Mike Turner', N'Brass FOV 1/2 inch', N'Contacted', N'Share Quote', '2026-11-16', 0, N'Asked for catalogue and MOQ', N'Source', 1000, NULL, NULL, N'Distributor', N'Yes - make to order', NULL, NULL),
    ('2026-11-06', N'Horizon Imports', N'UK', N'Sarah Collins', N'Chain shower tube 1.5M SS304', N'Quotation', N'Quote Shared', '2026-11-18', 275000, N'Quote sent 09-Nov', N'Ali Baba', 5000, 55, 50, N'Distributor', N'Yes - make to order', NULL, 'SS321'),
    ('2026-11-09', N'Vishal Enterprises', N'India', N'Vishal Joshi 98765 44444', N'Health faucet HF-110', N'New', N'Share Quote', '2026-11-13', 0, NULL, N'India Mart', 250, NULL, NULL, N'Dealer', N'Yes - in stock', NULL, NULL),
    ('2026-11-10', N'Zenith Plumbing', N'India', N'Kiran Desai 98765 55555', N'Alloy CP shower tube', N'New', NULL, NULL, 0, NULL, N'Trade India', NULL, NULL, NULL, N'Dealer', NULL, NULL, NULL),
    ('2026-11-11', N'Arabian Tubes Co', N'Saudi Arabia', N'Hassan Ali', N'SS304 pullout tube 1.5M', N'Qualified', N'Share Quote', '2026-11-15', 0, N'Needs price per container', N'Ali Baba', 10000, NULL, 28, N'Distributor', N'Yes - make to order', NULL, 'SS330P'),
    ('2026-11-12', N'Shree Ganesh Traders', N'India', N'Mahesh Gupta 98765 66666', N'PVC CP shower tube 1.5M', N'New', N'Share Quote', '2026-11-14', 0, NULL, N'India Mart', 5000, NULL, NULL, N'Dealer', N'Yes - in stock', NULL, NULL),
    ('2026-11-12', N'Prime Fittings', N'India', N'Dinesh Verma 98765 77777', N'SS304 chain tube 1M', N'Won', NULL, NULL, 132000, N'Advance received', N'Source', 4000, 33, 33, N'Dealer', N'Yes - in stock', NULL, 'SS316');
END
