-- =========================================================
-- FRM Database Schema & Data Migration for MS SQL Server
-- Generated on: 2026-11-09T11:24:39.919Z
-- =========================================================
USE [FRM_DB];
GO

-- =========================================================
-- SECTION 1: CREATE TABLES
-- =========================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AccountGroup')
BEGIN
    CREATE TABLE [dbo].[AccountGroup] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [GroupName] NVARCHAR(30) NOT NULL CONSTRAINT [UQ_AccountGroup_GroupName] UNIQUE,
        [IsSystem] INT NOT NULL DEFAULT 0
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DepartmentMaster')
BEGIN
    CREATE TABLE [dbo].[DepartmentMaster] (
        [DeptID] INT IDENTITY(1,1) PRIMARY KEY,
        [DeptName] NVARCHAR(20) NOT NULL,
        [Costing] DECIMAL(15, 2) NOT NULL DEFAULT 0,
        [IsSystem] INT NOT NULL DEFAULT 0
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BrandMaster')
BEGIN
    CREATE TABLE [dbo].[BrandMaster] (
        [BrandId] INT IDENTITY(1,1) PRIMARY KEY,
        [BrandName] NVARCHAR(15) NOT NULL CONSTRAINT [UQ_BrandMaster_BrandName] UNIQUE
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ItemTypeMaster')
BEGIN
    CREATE TABLE [dbo].[ItemTypeMaster] (
        [ItemType] NVARCHAR(15) PRIMARY KEY NOT NULL,
        [IsSystem] INT NOT NULL DEFAULT 0
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UnitMaster')
BEGIN
    CREATE TABLE [dbo].[UnitMaster] (
        [Unit] NVARCHAR(10) PRIMARY KEY NOT NULL,
        [IsSystem] INT NOT NULL DEFAULT 0
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CompanyProfile')
BEGIN
    CREATE TABLE [dbo].[CompanyProfile] (
        [CompanyName] NVARCHAR(200) NOT NULL,
        [Address1] NVARCHAR(250),
        [Address2] NVARCHAR(250),
        [City] NVARCHAR(100),
        [StateName] NVARCHAR(100),
        [CountryName] NVARCHAR(100),
        [Pincode] NVARCHAR(20),
        [ContactPerson] NVARCHAR(100),
        [PhoneNo] NVARCHAR(50),
        [MobileNo] NVARCHAR(50),
        [EmailID] NVARCHAR(150),
        [Website] NVARCHAR(200),
        [GSTIN] NVARCHAR(20),
        [PANNo] NVARCHAR(20),
        [BankName] NVARCHAR(150),
        [BranchName] NVARCHAR(150),
        [AccountNo] NVARCHAR(50),
        [IFSCCode] NVARCHAR(20),
        [UPI] NVARCHAR(50),
        [LogoPath] NVARCHAR(500)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PaymentQR')
BEGIN
    CREATE TABLE [dbo].[PaymentQR] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [Label] NVARCHAR(100) NOT NULL,
        [UpiId] NVARCHAR(100) NOT NULL,
        [PayeeName] NVARCHAR(100),
        [BankName] NVARCHAR(100),
        [AccountNo] NVARCHAR(50),
        [IFSC] NVARCHAR(20),
        [IsPrimary] INT DEFAULT 0,
        [CreatedAt] DATETIME DEFAULT GETDATE()
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EInvoiceSettings')
BEGIN
    CREATE TABLE [dbo].[EInvoiceSettings] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [IsEnabled] INT DEFAULT 1,
        [Environment] NVARCHAR(20) DEFAULT 'sandbox',
        [Gstin] NVARCHAR(20),
        [ClientId] NVARCHAR(100),
        [ClientSecret] NVARCHAR(200),
        [Username] NVARCHAR(100),
        [Password] NVARCHAR(200),
        [BaseUrl] NVARCHAR(255) DEFAULT 'https://einv-apisandbox.nic.in/eivital/v1.03',
        [AuthToken] NVARCHAR(MAX) DEFAULT NULL,
        [TokenExpiry] NVARCHAR(50) DEFAULT NULL,
        [Sek] NVARCHAR(MAX) DEFAULT NULL,
        [PublicKeyCert] NVARCHAR(MAX) DEFAULT NULL,
        [UpdatedAt] DATETIME DEFAULT GETDATE()
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE [dbo].[Users] (
        [UserId] INT IDENTITY(1,1) PRIMARY KEY,
        [Username] NVARCHAR(30) NOT NULL CONSTRAINT [UQ_Users_Username] UNIQUE,
        [Password] NVARCHAR(50) NOT NULL,
        [MobileNo] NVARCHAR(15),
        [UserRole] NVARCHAR(20) NOT NULL DEFAULT 'OPERATOR',
        [IsActive] INT NOT NULL DEFAULT 0,
        [IsAdd] INT NOT NULL DEFAULT 0,
        [IsEdit] INT NOT NULL DEFAULT 0,
        [IsDelete] INT NOT NULL DEFAULT 0,
        [AllowedMenus] NVARCHAR(MAX),
        [FullName] NVARCHAR(100) DEFAULT NULL,
        [BiometricCode] NVARCHAR(30) DEFAULT NULL,
        [Department] NVARCHAR(50) DEFAULT 'LABOUR',
        [Designation] NVARCHAR(50) DEFAULT 'Operator',
        [SalaryType] NVARCHAR(20) DEFAULT 'Monthly',
        [MonthlySalary] DECIMAL(12, 2) DEFAULT 15000.00,
        [DailyRate] DECIMAL(10, 2) DEFAULT 600.00,
        [HourlyRate] DECIMAL(10, 2) DEFAULT 75.00,
        [OvertimeRatePerHour] DECIMAL(10, 2) DEFAULT 100.00,
        [StandardWorkingHours] DECIMAL(4, 2) DEFAULT 8.00
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LedgerMaster')
BEGIN
    CREATE TABLE [dbo].[LedgerMaster] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [LedgerName] NVARCHAR(100) NOT NULL CONSTRAINT [UQ_LedgerMaster_LedgerName] UNIQUE,
        [AccountGroupID] INT NOT NULL,
        [Address] NVARCHAR(255),
        [City] NVARCHAR(50),
        [State] NVARCHAR(50),
        [GSTIN] NVARCHAR(20),
        [MobileNo] NVARCHAR(20),
        [Email] NVARCHAR(100),
        [BankName] NVARCHAR(100),
        [AccountNo] NVARCHAR(50),
        [IFSC] NVARCHAR(20),
        [UPI] NVARCHAR(50),
        [OwnBrand] NVARCHAR(50),
        [OtherBrand] NVARCHAR(50),
        [Discount] DECIMAL(5, 2),
        [CD] DECIMAL(5, 2),
        [Bill] DECIMAL(5, 2),
        [PaymentTerm] DECIMAL(5, 0),
        [Transport] NVARCHAR(100),
        [OpeningBalance] DECIMAL(12, 2),
        [ClosingBalance] DECIMAL(12, 2),
        [Remark] NVARCHAR(255),
        [DeliveryDays] INT DEFAULT 0
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ItemMaster')
BEGIN
    CREATE TABLE [dbo].[ItemMaster] (
        [ItemCode] NVARCHAR(50) NOT NULL,
        [SubCode] NVARCHAR(50) NOT NULL DEFAULT '',
        [ItemName] NVARCHAR(100) NOT NULL,
        [ItemType] NVARCHAR(50),
        [Category] NVARCHAR(50) DEFAULT 'Inhouse',
        [ItemCategory] NVARCHAR(100),
        [WarehouseNo] NVARCHAR(50),
        [Location] NVARCHAR(100),
        [Series] NVARCHAR(50),
        [StdWeight] DECIMAL(12, 3),
        [Costing] DECIMAL(15, 2) DEFAULT 0,
        [MRP] DECIMAL(15, 2) DEFAULT 0,
        [Unit] NVARCHAR(20) NOT NULL,
        [OpeningStock] DECIMAL(12, 3),
        [ClosingStock] DECIMAL(12, 3),
        [HSNCode] NVARCHAR(20),
        [ReorderLevel] DECIMAL(12, 3) DEFAULT 0,
        [DeadStockType] NVARCHAR(20) DEFAULT 'None',
        [DeadStockDays] INT DEFAULT 0,
        [IsDeadStock] INT DEFAULT 0,
        PRIMARY KEY ([ItemCode], [SubCode])
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BOM_Master')
BEGIN
    CREATE TABLE [dbo].[BOM_Master] (
        [ParentItemCode] NVARCHAR(50) NOT NULL,
        [ParentSubCode] NVARCHAR(50) NOT NULL DEFAULT '',
        [ChildItemCode] NVARCHAR(50) NOT NULL,
        [ChildSubCode] NVARCHAR(50) NOT NULL DEFAULT '',
        [Quantity] DECIMAL(10, 3) NOT NULL DEFAULT 0,
        PRIMARY KEY ([ParentItemCode], [ParentSubCode], [ChildItemCode], [ChildSubCode])
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DepartmentStock')
BEGIN
    CREATE TABLE [dbo].[DepartmentStock] (
        [DeptID] INT NOT NULL,
        [ItemCode] NVARCHAR(50) NOT NULL,
        [SubCode] NVARCHAR(50) NOT NULL DEFAULT '',
        [Pcs] DECIMAL(10, 3) NOT NULL DEFAULT 0,
        [Weight] DECIMAL(10, 3) NOT NULL DEFAULT 0,
        PRIMARY KEY ([DeptID], [ItemCode], [SubCode])
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Assets')
BEGIN
    CREATE TABLE [dbo].[Assets] (
        [AssetId] INT IDENTITY(1,1) PRIMARY KEY,
        [AssetName] NVARCHAR(100) NOT NULL,
        [Quantity] INT NOT NULL DEFAULT 0,
        [UnitValue] DECIMAL(15, 2) NOT NULL DEFAULT 0,
        [TotalValue] DECIMAL(26, 2)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'InwardHeader')
BEGIN
    CREATE TABLE [dbo].[InwardHeader] (
        [ID] INT IDENTITY(1,1) PRIMARY KEY,
        [Bill] INT NOT NULL DEFAULT 1,
        [INWARDNO] NVARCHAR(50) NOT NULL CONSTRAINT [UQ_InwardHeader_INWARDNO] UNIQUE,
        [INWARDDATE] DATE NOT NULL,
        [LEDGERID] DECIMAL(10, 0) NOT NULL,
        [EXPENSE] DECIMAL(10, 2) DEFAULT 0,
        [SGST] DECIMAL(10, 2) DEFAULT 0,
        [CGST] DECIMAL(10, 2) DEFAULT 0,
        [IGST] DECIMAL(10, 2) DEFAULT 0,
        [GSTPER] DECIMAL(10, 2) DEFAULT 0,
        [ROUNDOFF] DECIMAL(10, 2) DEFAULT 0,
        [TOTALAMOUNT] DECIMAL(12, 2) DEFAULT 0,
        [REMARK] NVARCHAR(255),
        [CREATEDBY] NVARCHAR(50) NOT NULL,
        [UPDATEDBY] NVARCHAR(50),
        [PIID] INT,
        [PINO] NVARCHAR(50)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'InwardDetail')
BEGIN
    CREATE TABLE [dbo].[InwardDetail] (
        [ID] INT IDENTITY(1,1) PRIMARY KEY,
        [INWARDID] DECIMAL(10, 0) NOT NULL,
        [ITEMCODE] NVARCHAR(50) NOT NULL,
        [GROSSWT] DECIMAL(10, 3),
        [NETWT] DECIMAL(10, 3),
        [QUANTITY] DECIMAL(10, 2),
        [UNIT] NVARCHAR(20),
        [RATE] DECIMAL(10, 2),
        [AMOUNT] DECIMAL(12, 2),
        [TENPCSWT] DECIMAL(10, 3),
        [SUBCODE] NVARCHAR(50) DEFAULT '',
        [PIDETAILID] INT
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OutwardHeader')
BEGIN
    CREATE TABLE [dbo].[OutwardHeader] (
        [ID] INT IDENTITY(1,1) PRIMARY KEY,
        [Bill] INT NOT NULL DEFAULT 1,
        [OUTWARDNO] NVARCHAR(50) NOT NULL CONSTRAINT [UQ_OutwardHeader_OUTWARDNO] UNIQUE,
        [OUTWARDDATE] DATE NOT NULL,
        [LEDGERID] DECIMAL(10, 0) NOT NULL,
        [EXPENSE] DECIMAL(10, 2) NOT NULL DEFAULT 0,
        [SGST] DECIMAL(10, 2) DEFAULT 0,
        [CGST] DECIMAL(10, 2) DEFAULT 0,
        [IGST] DECIMAL(10, 2) DEFAULT 0,
        [GSTPER] DECIMAL(10, 2) NOT NULL DEFAULT 0,
        [ROUNDOFF] DECIMAL(10, 2) NOT NULL DEFAULT 0,
        [TOTALAMOUNT] DECIMAL(12, 2) NOT NULL DEFAULT 0,
        [REMARK] NVARCHAR(255),
        [CREATEDBY] NVARCHAR(50) NOT NULL,
        [UPDATEDBY] NVARCHAR(50),
        [CDPER] DECIMAL(5, 2) DEFAULT 0,
        [CDAMOUNT] DECIMAL(12, 2) DEFAULT 0,
        [POID] INT,
        [PONO] NVARCHAR(50),
        [IRN] NVARCHAR(64) DEFAULT NULL,
        [AckNo] NVARCHAR(30) DEFAULT NULL,
        [AckDate] NVARCHAR(30) DEFAULT NULL,
        [SignedQRCode] NVARCHAR(MAX) DEFAULT NULL,
        [SignedInvoice] NVARCHAR(MAX) DEFAULT NULL,
        [EInvoiceStatus] NVARCHAR(20) DEFAULT 'Pending',
        [EInvoiceCancelReason] NVARCHAR(100) DEFAULT NULL,
        [EInvoiceCancelDate] NVARCHAR(30) DEFAULT NULL,
        [CourierCompany] NVARCHAR(100) DEFAULT NULL,
        [AwbNo] NVARCHAR(100) DEFAULT NULL,
        [TransportMode] NVARCHAR(50) DEFAULT NULL,
        [DateOfPod] NVARCHAR(20) DEFAULT NULL,
        [PodRemarks] NVARCHAR(255) DEFAULT NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OutwardDetail')
BEGIN
    CREATE TABLE [dbo].[OutwardDetail] (
        [ID] INT IDENTITY(1,1) PRIMARY KEY,
        [OUTWARDID] DECIMAL(10, 0) NOT NULL,
        [ITEMCODE] NVARCHAR(50) NOT NULL,
        [GROSSWT] DECIMAL(10, 3),
        [NETWT] DECIMAL(10, 3),
        [QUANTITY] DECIMAL(10, 2),
        [UNIT] NVARCHAR(20),
        [RATE] DECIMAL(10, 2),
        [AMOUNT] DECIMAL(12, 2),
        [DISCOUNT] DECIMAL(5, 2) DEFAULT 0,
        [TENPCSWT] DECIMAL(10, 3),
        [SUBCODE] NVARCHAR(50) DEFAULT '',
        [PODETAILID] INT
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PurchaseOrderHeader')
BEGIN
    CREATE TABLE [dbo].[PurchaseOrderHeader] (
        [ID] INT IDENTITY(1,1) PRIMARY KEY,
        [PONO] NVARCHAR(50) NOT NULL CONSTRAINT [UQ_PurchaseOrderHeader_PONO] UNIQUE,
        [PODATE] DATE NOT NULL,
        [LEDGERID] DECIMAL(10, 0) NOT NULL,
        [DELIVERYDATE] DATE,
        [STATUS] NVARCHAR(25) NOT NULL DEFAULT 'Pending',
        [TOTALQTY] DECIMAL(12, 3) DEFAULT 0,
        [TOTALAMOUNT] DECIMAL(12, 2) DEFAULT 0,
        [REMARK] NVARCHAR(255),
        [CREATEDBY] NVARCHAR(50) NOT NULL,
        [UPDATEDBY] NVARCHAR(50),
        [CREATEDAT] DATETIME DEFAULT GETDATE()
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PurchaseOrderDetail')
BEGIN
    CREATE TABLE [dbo].[PurchaseOrderDetail] (
        [ID] INT IDENTITY(1,1) PRIMARY KEY,
        [POID] INT NOT NULL,
        [ITEMCODE] NVARCHAR(50) NOT NULL,
        [SUBCODE] NVARCHAR(50) DEFAULT '',
        [QUANTITY] DECIMAL(10, 2) NOT NULL DEFAULT 0,
        [DELIVEREDQTY] DECIMAL(10, 2) NOT NULL DEFAULT 0,
        [PENDINGQTY] DECIMAL(10, 2) NOT NULL DEFAULT 0,
        [UNIT] NVARCHAR(20),
        [RATE] DECIMAL(10, 2) DEFAULT 0,
        [AMOUNT] DECIMAL(12, 2) DEFAULT 0,
        [REMARK] NVARCHAR(100)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PerformaInvoiceHeader')
BEGIN
    CREATE TABLE [dbo].[PerformaInvoiceHeader] (
        [ID] INT IDENTITY(1,1) PRIMARY KEY,
        [PINO] NVARCHAR(50) NOT NULL CONSTRAINT [UQ_PerformaInvoiceHeader_PINO] UNIQUE,
        [PIDATE] DATE NOT NULL,
        [LEDGERID] DECIMAL(10, 0) NOT NULL,
        [CUSTOMERPOID] INT,
        [CUSTOMERPONO] NVARCHAR(50),
        [DELIVERYDATE] DATE,
        [STATUS] NVARCHAR(25) NOT NULL DEFAULT 'Draft',
        [TOTALQTY] DECIMAL(12, 3) DEFAULT 0,
        [TOTALAMOUNT] DECIMAL(12, 2) DEFAULT 0,
        [REMARK] NVARCHAR(255),
        [CREATEDBY] NVARCHAR(50) NOT NULL,
        [UPDATEDBY] NVARCHAR(50),
        [CREATEDAT] DATETIME DEFAULT GETDATE()
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PerformaInvoiceDetail')
BEGIN
    CREATE TABLE [dbo].[PerformaInvoiceDetail] (
        [ID] INT IDENTITY(1,1) PRIMARY KEY,
        [PIID] INT NOT NULL,
        [ITEMCODE] NVARCHAR(50) NOT NULL,
        [SUBCODE] NVARCHAR(50) DEFAULT '',
        [QUANTITY] DECIMAL(10, 2) NOT NULL DEFAULT 0,
        [RECEIVEDQTY] DECIMAL(10, 2) NOT NULL DEFAULT 0,
        [PENDINGQTY] DECIMAL(10, 2) NOT NULL DEFAULT 0,
        [UNIT] NVARCHAR(20),
        [RATE] DECIMAL(10, 2) DEFAULT 0,
        [AMOUNT] DECIMAL(12, 2) DEFAULT 0,
        [REMARK] NVARCHAR(100)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'JobworkInHeader')
BEGIN
    CREATE TABLE [dbo].[JobworkInHeader] (
        [ID] INT IDENTITY(1,1) PRIMARY KEY,
        [JWINWARDNO] NVARCHAR(50) NOT NULL CONSTRAINT [UQ_JobworkInHeader_JWINWARDNO] UNIQUE,
        [JWINWARDDATE] DATE NOT NULL,
        [LEDGERID] DECIMAL(10, 0) NOT NULL,
        [JWOUTWARDNO] NVARCHAR(50),
        [TOTALAMOUNT] DECIMAL(12, 2) DEFAULT 0,
        [REMARK] NVARCHAR(255),
        [CREATEDBY] NVARCHAR(50) NOT NULL,
        [UPDATEDBY] NVARCHAR(50),
        [Bill] INT DEFAULT 1
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'JobworkInDetail')
BEGIN
    CREATE TABLE [dbo].[JobworkInDetail] (
        [ID] INT IDENTITY(1,1) PRIMARY KEY,
        [JWINWARDID] DECIMAL(10, 0) NOT NULL,
        [OUTITEMCODE] NVARCHAR(50) NOT NULL,
        [INITEMCODE] NVARCHAR(50) NOT NULL,
        [GROSSWT] DECIMAL(10, 3),
        [NETWT] DECIMAL(10, 3),
        [SCRAPITEMCODE] NVARCHAR(50),
        [SCRAPPCS] DECIMAL(5, 2),
        [SCRAPWT] DECIMAL(10, 3),
        [QUANTITY] DECIMAL(10, 2),
        [PROCESS] NVARCHAR(50),
        [UNIT] NVARCHAR(20),
        [RATE] DECIMAL(10, 2),
        [AMOUNT] DECIMAL(12, 2),
        [TENPCSWT] DECIMAL(10, 3),
        [OUTSUBCODE] NVARCHAR(50) DEFAULT '',
        [INSUBCODE] NVARCHAR(50) DEFAULT '',
        [SCRAPSUBCODE] NVARCHAR(50) DEFAULT ''
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'JobworkOutHeader')
BEGIN
    CREATE TABLE [dbo].[JobworkOutHeader] (
        [ID] INT IDENTITY(1,1) PRIMARY KEY,
        [JWOUTWARDNO] NVARCHAR(50) NOT NULL CONSTRAINT [UQ_JobworkOutHeader_JWOUTWARDNO] UNIQUE,
        [JWOUTWARDDATE] DATE NOT NULL,
        [LEDGERID] DECIMAL(10, 0) NOT NULL,
        [REMARK] NVARCHAR(255),
        [CREATEDBY] NVARCHAR(50) NOT NULL,
        [UPDATEDBY] NVARCHAR(50),
        [Bill] INT DEFAULT 1,
        [DeptID] INT
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'JobworkOutDetail')
BEGIN
    CREATE TABLE [dbo].[JobworkOutDetail] (
        [ID] INT IDENTITY(1,1) PRIMARY KEY,
        [JWOUTWARDID] DECIMAL(10, 0) NOT NULL,
        [ITEMCODE] NVARCHAR(50) NOT NULL,
        [GROSSWT] DECIMAL(10, 3),
        [NETWT] DECIMAL(10, 3),
        [QUANTITY] DECIMAL(10, 2),
        [UNIT] NVARCHAR(20),
        [RATE] DECIMAL(10, 2),
        [PROCESS] NVARCHAR(50),
        [TENPCSWT] DECIMAL(10, 3),
        [SUBCODE] NVARCHAR(50) DEFAULT ''
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StockJournal')
BEGIN
    CREATE TABLE [dbo].[StockJournal] (
        [SJID] INT IDENTITY(1,1) PRIMARY KEY,
        [SJDate] DATE NOT NULL,
        [SJType] NVARCHAR(20) NOT NULL,
        [ItemCode] NVARCHAR(50) NOT NULL,
        [Qty] DECIMAL(10, 3) NOT NULL,
        [Remarks] NVARCHAR(255),
        [CreatedBy] NVARCHAR(50) NOT NULL,
        [UpdatedBy] NVARCHAR(50),
        [SubCode] NVARCHAR(50) DEFAULT ''
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StockTransfer')
BEGIN
    CREATE TABLE [dbo].[StockTransfer] (
        [MoveID] INT IDENTITY(1,1) PRIMARY KEY,
        [TransferID] NVARCHAR(50) NOT NULL,
        [MoveDate] DATE NOT NULL,
        [FromDeptID] INT NOT NULL,
        [ToDeptID] INT NOT NULL,
        [OutItemCode] NVARCHAR(50),
        [OutPcs] DECIMAL(10, 3) DEFAULT 0,
        [OutWeight] DECIMAL(10, 3) DEFAULT 0,
        [InItemCode] NVARCHAR(50),
        [InPcs] DECIMAL(10, 3) DEFAULT 0,
        [InWeight] DECIMAL(10, 3) DEFAULT 0,
        [ScrapItemCode] NVARCHAR(50),
        [ScrapPcs] DECIMAL(8, 3) DEFAULT 0,
        [ScrapWeight] DECIMAL(8, 3) DEFAULT 0,
        [LossWeight] DECIMAL(8, 3) DEFAULT 0,
        [Remarks] NVARCHAR(255),
        [CreatedBy] NVARCHAR(50),
        [UpdatedBy] NVARCHAR(50),
        [Unit] NVARCHAR(20),
        [ManualChallanNo] NVARCHAR(50),
        [OutSubCode] NVARCHAR(50) DEFAULT '',
        [InSubCode] NVARCHAR(50) DEFAULT '',
        [ScrapSubCode] NVARCHAR(50) DEFAULT ''
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VoucherEntry')
BEGIN
    CREATE TABLE [dbo].[VoucherEntry] (
        [VoucherId] INT IDENTITY(1,1) PRIMARY KEY,
        [VoucherType] NVARCHAR(20),
        [VoucherNo] DECIMAL(10, 0) NOT NULL,
        [VoucherDate] DATE NOT NULL,
        [Mode] NVARCHAR(20) NOT NULL,
        [LedgerId] DECIMAL(10, 0) NOT NULL,
        [Amount] DECIMAL(12, 2) NOT NULL,
        [Through] NVARCHAR(50),
        [Remark] NVARCHAR(255),
        [CREATEDBY] NVARCHAR(50) NOT NULL DEFAULT 'System',
        [UPDATEDBY] NVARCHAR(50),
        [Bill] INT DEFAULT 1
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AssemblyTransactions')
BEGIN
    CREATE TABLE [dbo].[AssemblyTransactions] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [AssemblyNo] DECIMAL(10, 0) NOT NULL,
        [AssemblyDate] DATE NOT NULL,
        [ItemCode] NVARCHAR(50) NOT NULL,
        [Quantity] DECIMAL(10, 0) NOT NULL,
        [Remark] NVARCHAR(255),
        [CreatedBy] NVARCHAR(50),
        [UpdatedBy] NVARCHAR(50),
        [SubCode] NVARCHAR(50) DEFAULT ''
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AttendanceMonthlySummary')
BEGIN
    CREATE TABLE [dbo].[AttendanceMonthlySummary] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [MonthYear] NVARCHAR(10) NOT NULL,
        [MonthName] NVARCHAR(30),
        [TotalDaysInMonth] INT DEFAULT 31,
        [UserId] INT NULL,
        [BiometricCode] NVARCHAR(30) NOT NULL,
        [EmployeeName] NVARCHAR(100) NOT NULL,
        [Department] NVARCHAR(50),
        [Designation] NVARCHAR(50),
        [PresentDays] DECIMAL(5, 2) DEFAULT 0,
        [AbsentDays] DECIMAL(5, 2) DEFAULT 0,
        [HalfDays] DECIMAL(5, 2) DEFAULT 0,
        [WeekOffDays] DECIMAL(5, 2) DEFAULT 0,
        [PublicHolidays] DECIMAL(5, 2) DEFAULT 0,
        [PaidLeaveDays] DECIMAL(5, 2) DEFAULT 0,
        [UnpaidLeaveDays] DECIMAL(5, 2) DEFAULT 0,
        [PayableDays] DECIMAL(5, 2) DEFAULT 0,
        [TotalGrossHours] NVARCHAR(20) DEFAULT '00:00',
        [TotalGrossHoursDecimal] DECIMAL(8, 2) DEFAULT 0.00,
        [TotalBreakHours] NVARCHAR(20) DEFAULT '00:00',
        [TotalBreakHoursDecimal] DECIMAL(8, 2) DEFAULT 0.00,
        [TotalNetWorkHoursDecimal] DECIMAL(8, 2) DEFAULT 0.00,
        [TotalOvertimeHoursDecimal] DECIMAL(8, 2) DEFAULT 0.00,
        [SalaryType] NVARCHAR(20) DEFAULT 'Monthly',
        [BaseSalary] DECIMAL(12, 2) DEFAULT 0.00,
        [CalculatedSalary] DECIMAL(12, 2) DEFAULT 0.00,
        [OvertimePay] DECIMAL(12, 2) DEFAULT 0.00,
        [Deductions] DECIMAL(12, 2) DEFAULT 0.00,
        [NetSalary] DECIMAL(12, 2) DEFAULT 0.00,
        [UploadedFileName] NVARCHAR(255),
        [UploadedAt] DATETIME DEFAULT GETDATE(),
        [Remarks] NVARCHAR(MAX)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AttendanceDailyLog')
BEGIN
    CREATE TABLE [dbo].[AttendanceDailyLog] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [SummaryId] INT NOT NULL,
        [MonthYear] NVARCHAR(10) NOT NULL,
        [BiometricCode] NVARCHAR(30) NOT NULL,
        [AttendanceDate] NVARCHAR(20) NOT NULL,
        [DayNumber] INT NOT NULL,
        [DayOfWeek] NVARCHAR(10),
        [Shift] NVARCHAR(20),
        [FirstIn] NVARCHAR(10),
        [LastOut] NVARCHAR(10),
        [GrossHours] NVARCHAR(10),
        [GrossHoursDecimal] DECIMAL(5, 2) DEFAULT 0.00,
        [BreakHours] NVARCHAR(10),
        [NetHoursDecimal] DECIMAL(5, 2) DEFAULT 0.00,
        [OvertimeHoursDecimal] DECIMAL(5, 2) DEFAULT 0.00,
        [FirstHalfStatus] NVARCHAR(10),
        [SecondHalfStatus] NVARCHAR(10),
        [FinalStatus] NVARCHAR(10)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '_Migrations')
BEGIN
    CREATE TABLE [dbo].[_Migrations] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [name] NVARCHAR(255) NOT NULL CONSTRAINT [UQ_Migrations_name] UNIQUE,
        [executed_at] DATETIME DEFAULT GETDATE()
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '_SystemSettings')
BEGIN
    CREATE TABLE [dbo].[_SystemSettings] (
        [Key] NVARCHAR(100) PRIMARY KEY,
        [Value] NVARCHAR(MAX),
        [UpdatedAt] DATETIME DEFAULT GETDATE()
    );
END
GO

-- =========================================================
-- SECTION 2: MIGRATE EXISTING DATA FROM SQLITE
-- =========================================================

-- Data for table: AccountGroup (9 rows)
SET IDENTITY_INSERT [dbo].[AccountGroup] ON;
INSERT INTO [dbo].[AccountGroup] ([Id], [GroupName], [IsSystem]) VALUES
    (1, N'Capital Account', 1),
    (2, N'Current Assets', 1),
    (3, N'Current Liabilities', 1),
    (4, N'Sundry Debtors', 0),
    (5, N'Sundry Creditors', 0),
    (6, N'Bank Accounts', 0),
    (7, N'Direct Expenses', 0),
    (8, N'Sales Accounts', 0),
    (9, N'Purchase Accounts', 0);
SET IDENTITY_INSERT [dbo].[AccountGroup] OFF;
GO

-- Data for table: DepartmentMaster (6 rows)
SET IDENTITY_INSERT [dbo].[DepartmentMaster] ON;
INSERT INTO [dbo].[DepartmentMaster] ([DeptID], [DeptName], [IsSystem]) VALUES
    (1, N'Cutting & Sawing', 0),
    (2, N'Forging & Casting', 0),
    (3, N'Machining & CNC', 0),
    (4, N'Polishing & Plating', 0),
    (5, N'Assembly & Testing', 0),
    (6, N'Finished Goods Store', 0);
SET IDENTITY_INSERT [dbo].[DepartmentMaster] OFF;
GO

-- Data for table: ItemTypeMaster (5 rows)
INSERT INTO [dbo].[ItemTypeMaster] ([ItemType], [IsSystem]) VALUES
    (N'RAW MATERIAL', 1),
    (N'SEMI-FINISHED', 1),
    (N'FINISHED GOOD', 1),
    (N'CONSUMABLE', 0),
    (N'SCRAP', 1);
GO

-- Data for table: UnitMaster (5 rows)
INSERT INTO [dbo].[UnitMaster] ([Unit], [IsSystem]) VALUES
    (N'PCS', 1),
    (N'KGS', 1),
    (N'MTR', 0),
    (N'BOX', 0),
    (N'SET', 0);
GO

-- Data for table: CompanyProfile (1 rows)
INSERT INTO [dbo].[CompanyProfile] ([CompanyName], [Address1], [Address2], [City], [StateName], [CountryName], [Pincode], [ContactPerson], [PhoneNo], [MobileNo], [EmailID], [Website], [GSTIN], [PANNo], [BankName], [BranchName], [AccountNo], [IFSCCode], [UPI], [LogoPath]) VALUES
    (N'FRM-BBP', NULL, NULL, NULL, NULL, N'India', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'/assets/app_logo.jpeg');
GO

-- Data for table: PaymentQR (1 rows)
SET IDENTITY_INSERT [dbo].[PaymentQR] ON;
INSERT INTO [dbo].[PaymentQR] ([Id], [Label], [UpiId], [PayeeName], [BankName], [AccountNo], [IFSC], [IsPrimary], [CreatedAt]) VALUES
    (4, N'DTech', N'dhyeyshah009@okhdfcbank', N'Dhyey Shah', N'HDFC BANK', N'99999724277321', N'HDFC0000177', 1, N'2026-11-04 13:43:49');
SET IDENTITY_INSERT [dbo].[PaymentQR] OFF;
GO

-- Data for table: EInvoiceSettings (1 rows)
SET IDENTITY_INSERT [dbo].[EInvoiceSettings] ON;
INSERT INTO [dbo].[EInvoiceSettings] ([Id], [IsEnabled], [Environment], [Gstin], [ClientId], [ClientSecret], [Username], [Password], [BaseUrl], [AuthToken], [TokenExpiry], [Sek], [PublicKeyCert], [UpdatedAt]) VALUES
    (1, 1, N'simulation', N'', N'', N'', N'', N'', N'https://einv-apisandbox.nic.in/eivital/v1.03', NULL, NULL, NULL, NULL, N'2026-11-07 16:51:25');
SET IDENTITY_INSERT [dbo].[EInvoiceSettings] OFF;
GO

-- Data for table: Users (27 rows)
SET IDENTITY_INSERT [dbo].[Users] ON;
INSERT INTO [dbo].[Users] ([UserId], [Username], [Password], [MobileNo], [UserRole], [IsActive], [IsAdd], [IsEdit], [IsDelete], [AllowedMenus], [FullName], [BiometricCode], [Department], [Designation], [SalaryType], [MonthlySalary], [DailyRate], [HourlyRate], [OvertimeRatePerHour], [StandardWorkingHours]) VALUES
    (1, N'admin', N'admin123', N'9876500001', N'ADMIN', 1, 1, 1, 1, N'*', NULL, NULL, N'LABOUR', N'Operator', N'Monthly', 15000, 600, 75, 0, 10),
    (2, N'manager', N'mgr123', N'9876500002', N'MANAGER', 1, 1, 1, 1, N'Dashboard,Masters,Entries,Reports', NULL, NULL, N'LABOUR', N'Operator', N'Monthly', 15000, 600, 75, 0, 8),
    (3, N'operator', N'oper123', N'9876500003', N'OPERATOR', 1, 1, 0, 0, N'/dashboard/inwards,/dashboard/outwards', NULL, NULL, N'LABOUR', N'Operator', N'Monthly', 15000, 600, 75, 0, 8),
    (4, N'accountant', N'acct123', N'9876500004', N'ACCOUNTANT', 1, 1, 1, 0, N'Vouchers,Reports', NULL, NULL, N'LABOUR', N'Operator', N'Monthly', 15000, 600, 75, 0, 8),
    (5, N'emp_0001', N'123456', N'', N'OPERATOR', 1, 0, 0, 0, N'', N'AKSHAY LOKHIL', N'0001', N'LABOUR', N'Designation-1', N'Hourly', 15000, 600, 50, 75, 8),
    (6, N'emp_0002', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'PURVAJEET RATHOD', N'0002', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (7, N'emp_0003', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'KASAM', N'0003', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (8, N'emp_0006', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'SAFIQ', N'0006', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (9, N'emp_0007', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'KARAN', N'0007', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (10, N'emp_0008', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'DEVABHAI', N'0008', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (11, N'emp_0009', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'GULSAN', N'0009', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (12, N'emp_0011', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'RAJNIKANT', N'0011', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (13, N'emp_0012', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'KHIMAJI', N'0012', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (14, N'emp_0014', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'GEETA', N'0014', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (15, N'emp_0015', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'BINITA', N'0015', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (16, N'emp_0016', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'CHANDA', N'0016', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (17, N'emp_0019', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'VIMLA', N'0019', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (18, N'emp_0023', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'RAJIV', N'0023', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (19, N'emp_0024', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'DEEPU', N'0024', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (20, N'emp_0026', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'HANSRAJ', N'0026', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (21, N'emp_022', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'JOGENDRA', N'022', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (22, N'emp_027', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'MAMTA', N'027', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (23, N'emp_028', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'USHA', N'028', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8),
    (24, N'emp_029', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'JAYDEEP', N'029', N'OFFICE', N'Designation-1', N'Monthly', 20000, 600, 75, 0, 8),
    (25, N'emp_030', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'AKASH', N'030', N'OFFICE', N'Designation-1', N'Monthly', 20000, 600, 75, 0, 8),
    (26, N'emp_031', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'NEEL', N'031', N'OFFICE', N'Designation-1', N'Monthly', 20000, 600, 75, 0, 8),
    (27, N'emp_032', N'123456', NULL, N'OPERATOR', 1, 0, 0, 0, N'', N'AJAY', N'032', N'LABOUR', N'Designation-1', N'Monthly', 15000, 600, 75, 0, 8);
SET IDENTITY_INSERT [dbo].[Users] OFF;
GO

-- Data for table: _Migrations (10 rows)
SET IDENTITY_INSERT [dbo].[_Migrations] ON;
INSERT INTO [dbo].[_Migrations] ([id], [name], [executed_at]) VALUES
    (1, N'001_sample_check.sql', N'2026-11-03 18:03:56'),
    (2, N'002_add_hsn_reorder_delivery_days.sql', N'2026-11-06 15:57:56'),
    (3, N'003_add_subcode_warehouse_category.sql', N'2026-11-07 04:29:28'),
    (4, N'004_create_purchase_order_tables.sql', N'2026-11-07 05:38:55'),
    (5, N'005_create_performa_invoice_tables.sql', N'2026-11-07 06:16:02'),
    (6, N'006_add_dead_stock_to_itemmaster.sql', N'2026-11-07 06:26:43'),
    (7, N'007_add_einvoice_fields_to_outward.sql', N'2026-11-07 16:27:11'),
    (8, N'008_create_einvoice_settings.sql', N'2026-11-07 16:48:54'),
    (9, N'009_create_attendance_and_user_salary_fields.sql', N'2026-11-08 06:10:23'),
    (10, N'010_add_dispatch_pod_fields_to_outward.sql', N'2026-11-09 08:27:33');
SET IDENTITY_INSERT [dbo].[_Migrations] OFF;
GO

-- Table: CRM_Leads
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
GO

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
