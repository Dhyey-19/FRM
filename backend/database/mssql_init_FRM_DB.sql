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

-- Data for table: BrandMaster (4 rows)
SET IDENTITY_INSERT [dbo].[BrandMaster] ON;
INSERT INTO [dbo].[BrandMaster] ([BrandId], [BrandName]) VALUES
    (1, N'FlowPro'),
    (2, N'AquaPlumb'),
    (3, N'Valvetech'),
    (4, N'Zenith');
SET IDENTITY_INSERT [dbo].[BrandMaster] OFF;
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
    (N'FRM Precision Manufacturing Ltd', N'Plot No. 42-45, GIDC Industrial Estate', N'Phase II, Odhav', N'Ahmedabad', N'Gujarat', N'India', N'382415', N'Rajesh Sharma', N'079-22874512', N'9876543210', N'contact@frm.demo', N'https://www.frm.demo', N'24AAACF1234K1Z5', N'AAACF1234K', N'State Bank of India', N'Industrial Finance Branch', N'33889900112', N'SBIN0004052', N'frm@sbi', N'/assets/app_logo.jpeg');
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

-- Data for table: LedgerMaster (9 rows)
SET IDENTITY_INSERT [dbo].[LedgerMaster] ON;
INSERT INTO [dbo].[LedgerMaster] ([Id], [LedgerName], [AccountGroupID], [Address], [City], [State], [GSTIN], [MobileNo], [Email], [BankName], [AccountNo], [IFSC], [UPI], [OwnBrand], [OtherBrand], [Discount], [CD], [Bill], [PaymentTerm], [Transport], [OpeningBalance], [ClosingBalance], [Remark], [DeliveryDays]) VALUES
    (1, N'Acme Hardware & Pipe Fittings', 4, N'102 Industrial Area, Andheri East', N'Mumbai', N'Maharashtra', N'27AABCA1122D1Z1', N'9820011223', N'purchase@acme.demo', N'HDFC Bank', N'50200098765432', N'HDFC0000001', NULL, N'FlowPro', N'Standard', 5, 0, 1, 30, N'Navkar Roadlines', 45000, 46000, N'Regular Dealer A', 0),
    (2, N'Apex Sanitary Distributors', 4, N'B-45 Wholesale Market', N'Delhi', N'Delhi', N'07AABCA3344D1Z2', N'9811022334', N'info@apexdelhi.demo', N'ICICI Bank', N'001105001234', N'ICIC0000011', NULL, N'FlowPro', N'Standard', 3.5, 0, 1, 21, N'Delhi Gujarat Freight', 28000, 31500, N'North Region Distributor', 0),
    (3, N'Gujarat Metal Alloys Corp', 5, N'Plot 88 Industrial Zone', N'Jamnagar', N'Gujarat', N'24AABCG5566K1Z3', N'9825033445', N'sales@gujmetal.demo', N'SBI', N'110022334455', N'SBIN0001234', NULL, NULL, NULL, NULL, NULL, 1, 15, N'Direct Truck', -65000, -35351, N'Raw Material Supplier', 5),
    (4, N'Shreeji Brass Extrusions', 5, N'Shreeji Compound, Patel Nagar', N'Jamnagar', N'Gujarat', N'24AABCS7788P1Z4', N'9825044556', N'order@shreejibrass.demo', N'Bank of Baroda', N'01230200001234', N'BARB0JAMNAG', NULL, NULL, NULL, 0, 0, 1, 30, N'Patel Transport', -88000, -60000, N'Extrusion Rod Supplier', 0),
    (5, N'Prime Jobwork & Electroplaters', 5, N'Survey 14, Metoda GIDC', N'Rajkot', N'Gujarat', N'24AABCP9900M1Z5', N'9824055667', N'billing@primejob.demo', N'Axis Bank', N'912010012345678', N'UTIB0000123', NULL, NULL, NULL, 0, 0, 1, 15, N'Local Tempo', -12500, -8400, N'Casting & Nickel Plating Vendor', 0),
    (6, N'HDFC Current Bank A/C', 6, N'Navrangpura Branch', N'Ahmedabad', N'Gujarat', N'24AAACH1234A1Z0', N'0792658000', N'ahmedabad@hdfcbank.com', N'HDFC Bank', N'50200012345678', N'HDFC0000060', NULL, NULL, NULL, 0, 0, 1, 0, NULL, 350000, 412500, N'Primary Operating Account', 0),
    (7, N'Petty Cash Account', 6, N'Factory Office Counter', N'Ahmedabad', N'Gujarat', NULL, N'0792287451', N'cashier@frmbbp.demo', NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 1, 0, NULL, 25000, 18450, N'Factory Floor Petty Cash', 0),
    (8, N'Sales', 8, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, -44649, NULL, 0),
    (9, N'Purchase', 9, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1000, NULL, 0);
SET IDENTITY_INSERT [dbo].[LedgerMaster] OFF;
GO

-- Data for table: ItemMaster (11 rows)
INSERT INTO [dbo].[ItemMaster] ([ItemCode], [SubCode], [ItemName], [ItemType], [Category], [WarehouseNo], [Location], [Series], [StdWeight], [Costing], [MRP], [Unit], [OpeningStock], [ClosingStock], [HSNCode], [ReorderLevel], [DeadStockType], [DeadStockDays], [IsDeadStock]) VALUES
    (N'RM-BR01', N'', N'Brass Rod 25mm Round', N'RAW MATERIAL', N'BOP', N'WH-1', N'Rack-A', N'B-SERIES', 4.15, 480, 550, N'KGS', 2500, 2200, NULL, 2400, N'None', 0, 0),
    (N'RM-BR02', N'', N'Brass Hex Bar 19mm', N'RAW MATERIAL', N'BOP', N'WH-1', N'Rack-A', N'B-SERIES', 2.85, 495, 570, N'KGS', 1800, 1650, N'74072110', 2000, N'None', 0, 0),
    (N'RM-SS01', N'', N'Stainless Steel Rod 12mm', N'RAW MATERIAL', N'BOP', N'WH-1', N'Rack-A', N'SS-304', 0.89, 280, 340, N'KGS', 950, 900, NULL, 0, N'None', 0, 0),
    (N'SF-VB01', N'', N'Valve Body Cast 1/2" (Rough)', N'SEMI-FINISHED', N'SubContract', N'WH-1', N'Rack-A', N'VALVE-SF', 0.35, 190, 240, N'PCS', 500, 420, NULL, 0, N'None', 0, 0),
    (N'SF-SP01', N'', N'Spindle Stem Machined 1/2"', N'SEMI-FINISHED', N'SubContract', N'WH-1', N'Rack-A', N'VALVE-SF', 0.08, 45, 65, N'PCS', 600, 530, NULL, 0, N'None', 0, 0),
    (N'SF-BL01', N'', N'Brass Ball 1/2" Turned & Polished', N'SEMI-FINISHED', N'SubContract', N'WH-1', N'Rack-A', N'VALVE-SF', 0.065, 38, 55, N'PCS', 750, 680, NULL, 0, N'Manual', 0, 1),
    (N'FG-BV01', N'', N'Full Bore Brass Ball Valve 1/2"', N'FINISHED GOOD', N'Inhouse', N'WH-1', N'Rack-A', N'PREMIUM', 0.52, 320, 495, N'PCS', 300, 250, NULL, 0, N'None', 0, 0),
    (N'FG-PT01', N'', N'Quarter Turn Pillar Cock Chrome', N'FINISHED GOOD', N'Inhouse', N'WH-1', N'Rack-A', N'ELEGANCE', 0.68, 410, 680, N'PCS', 200, 160, NULL, 0, N'None', 0, 0),
    (N'FG-BT01', N'B1', N'Bib Tap with Wall Flange 15mm', N'FINISHED GOOD', N'Inhouse', N'WH-1', N'Rack-A', N'STANDARD', 0.44, 260, 425, N'PCS', 400, 240, NULL, 0, N'None', 0, 0),
    (N'SCRAP-BR', N'', N'Brass Turning & Boring Scrap', N'SCRAP', N'Inhouse', N'WH-1', N'Rack-A', N'SCRAP', 1, 360, 390, N'KGS', 650, 720, NULL, 0, N'None', 0, 0),
    (N'BOP-WSH01', N'', N'EPDM Washer & O-Ring 15mm', N'RAW MATERIAL', N'BOP', N'WH-02', N'BIN-W12', NULL, NULL, 15, 0, N'PCS', NULL, 50, NULL, 100, N'None', 0, 0);
GO

-- Data for table: BOM_Master (16 rows)
INSERT INTO [dbo].[BOM_Master] ([ParentItemCode], [ParentSubCode], [ChildItemCode], [ChildSubCode], [Quantity]) VALUES
    (N'FG-BV01', N'', N'SF-VB01', N'', 1),
    (N'FG-BV01', N'', N'SF-SP01', N'', 1),
    (N'FG-BV01', N'', N'SF-BL01', N'', 1),
    (N'SF-VB01', N'', N'RM-BR01', N'', 0.45),
    (N'SF-SP01', N'', N'RM-SS01', N'', 0.095),
    (N'SF-BL01', N'', N'RM-BR02', N'', 0.08),
    (N'FG-PT01', N'', N'SF-VB01', N'', 1),
    (N'FG-PT01', N'', N'SF-SP01', N'', 1),
    (N'FG-BT01', N'B1', N'SF-VB01', N'', 1),
    (N'FG-BT01', N'B1', N'SF-SP01', N'', 1),
    (N'FG-BT01', N'B1', N'SF-BL01', N'', 1),
    (N'FG-BT01', N'B1', N'BOP-WSH01', N'', 1),
    (N'FG-BT01', N'', N'SF-VB01', N'', 1),
    (N'FG-BT01', N'', N'SF-SP01', N'', 1),
    (N'FG-BT01', N'', N'SF-BL01', N'', 1),
    (N'FG-BT01', N'', N'BOP-WSH01', N'', 1);
GO

-- Data for table: DepartmentStock (9 rows)
INSERT INTO [dbo].[DepartmentStock] ([DeptID], [ItemCode], [SubCode], [Pcs], [Weight]) VALUES
    (1, N'RM-BR01', N'', 120, 498),
    (1, N'RM-SS01', N'', 80, 71.2),
    (2, N'RM-BR01', N'', 95, 394.25),
    (3, N'SF-VB01', N'', 180, 63),
    (3, N'SF-SP01', N'', 240, 19.2),
    (4, N'SF-BL01', N'', 300, 19.5),
    (5, N'FG-BV01', N'', 50, 26),
    (6, N'FG-BV01', N'', 250, 130),
    (6, N'FG-PT01', N'', 160, 108.8);
GO

-- Data for table: Assets (5 rows)
SET IDENTITY_INSERT [dbo].[Assets] ON;
INSERT INTO [dbo].[Assets] ([AssetId], [AssetName], [Quantity], [UnitValue], [TotalValue]) VALUES
    (1, N'CNC Turning Center', 2, 1850000, 3700000),
    (2, N'Hydraulic Press 50 Ton', 1, 650000, 650000),
    (3, N'Rotary Air Compressor 15HP', 2, 180000, 360000),
    (4, N'Heavy Duty Band Saw Machine', 3, 120000, 360000),
    (5, N'Forklift 2.5 Ton Diesel', 1, 920000, 920000);
SET IDENTITY_INSERT [dbo].[Assets] OFF;
GO

-- Data for table: InwardHeader (3 rows)
SET IDENTITY_INSERT [dbo].[InwardHeader] ON;
INSERT INTO [dbo].[InwardHeader] ([ID], [Bill], [INWARDNO], [INWARDDATE], [LEDGERID], [EXPENSE], [SGST], [CGST], [IGST], [GSTPER], [ROUNDOFF], [TOTALAMOUNT], [REMARK], [CREATEDBY], [UPDATEDBY], [PIID], [PINO]) VALUES
    (1, 1, N'INW-26-001', N'2026-10-05', 3, 500, 2646, 2646, 0, 18, 0, 35192, N'Brass rods batch receipt', N'admin', N'admin', NULL, NULL),
    (2, 1, N'INW-26-002', N'2026-10-12', 4, 350, 1978.02, 1978.02, 0, 18, 0, 26284.04, N'Hex bar supply receipt', N'operator', NULL, NULL, NULL),
    (3, 1, N'TEST-INW-1794032207306', N'2026-11-07', 1, 0, 0, 0, 0, 0, 0, 400, NULL, N'TestAgent - 07/11/2026 11:46', N'TestAgent - 07/11/2026 11:46', 1, N'TEST-PI-1794032207257');
SET IDENTITY_INSERT [dbo].[InwardHeader] OFF;
GO

-- Data for table: InwardDetail (3 rows)
SET IDENTITY_INSERT [dbo].[InwardDetail] ON;
INSERT INTO [dbo].[InwardDetail] ([ID], [INWARDID], [ITEMCODE], [GROSSWT], [NETWT], [QUANTITY], [UNIT], [RATE], [AMOUNT], [TENPCSWT], [SUBCODE], [PIDETAILID]) VALUES
    (1, 1, N'RM-BR01', 62.5, 61.25, 61.25, N'KGS', 480, 29400, 41.5, N'', NULL),
    (2, 2, N'RM-BR02', 45.2, 44.4, 44.4, N'KGS', 495, 21978, 28.5, N'', NULL),
    (3, 3, N'TEST-ITEM-PI', 0, 0, 4, N'PCS', 100, 400, NULL, N'SUB1', 1);
SET IDENTITY_INSERT [dbo].[InwardDetail] OFF;
GO

-- Data for table: OutwardHeader (3 rows)
SET IDENTITY_INSERT [dbo].[OutwardHeader] ON;
INSERT INTO [dbo].[OutwardHeader] ([ID], [Bill], [OUTWARDNO], [OUTWARDDATE], [LEDGERID], [EXPENSE], [SGST], [CGST], [IGST], [GSTPER], [ROUNDOFF], [TOTALAMOUNT], [REMARK], [CREATEDBY], [UPDATEDBY], [CDPER], [CDAMOUNT], [POID], [PONO], [IRN], [AckNo], [AckDate], [SignedQRCode], [SignedInvoice], [EInvoiceStatus], [EInvoiceCancelReason], [EInvoiceCancelDate], [CourierCompany], [AwbNo], [TransportMode], [DateOfPod], [PodRemarks]) VALUES
    (1, 1, N'OUT-26-001', N'2026-10-18', 1, 450, 2227.5, 2227.5, 0, 18, 0, 29655, N'Sales order dispatch to Acme', N'admin', N'admin', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'Pending', NULL, NULL, N'Blue Dart Express', N'BD987654321', N'Air', N'2026-11-09', N'Handed over to pickup executive'),
    (2, 1, N'OUT-26-002', N'2026-10-22', 2, 300, 0, 0, 4896, 18, 0, 32396, N'Interstate dispatch to Apex Delhi', N'operator', NULL, 0, 0, NULL, NULL, N'11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff', N'998877665544332', N'2026-10-22 10:15:00', N'TEST_SIGNED_QR_CODE', NULL, N'Generated', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (7, 1, N'1', N'2026-11-07', 3, 0, 3786.75, 3786.75, 0, 18, 0.5, 49649, NULL, N'admin - 07/11/2026 22:12', N'admin - 07/11/2026 22:12', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'Pending', NULL, NULL, N'Direct Truck', N'BD123', N'Road', NULL, NULL);
SET IDENTITY_INSERT [dbo].[OutwardHeader] OFF;
GO

-- Data for table: OutwardDetail (3 rows)
SET IDENTITY_INSERT [dbo].[OutwardDetail] ON;
INSERT INTO [dbo].[OutwardDetail] ([ID], [OUTWARDID], [ITEMCODE], [GROSSWT], [NETWT], [QUANTITY], [UNIT], [RATE], [AMOUNT], [DISCOUNT], [TENPCSWT], [SUBCODE], [PODETAILID]) VALUES
    (1, 1, N'FG-BV01', 26.5, 26, 50, N'PCS', 495, 24750, 0, 5.2, N'', NULL),
    (2, 2, N'FG-PT01', 27.5, 27.2, 40, N'PCS', 680, 27200, 0, 6.8, N'', NULL),
    (7, 7, N'FG-BT01', 0, 0, 100, N'PCS', 425, 42075, 1, NULL, N'B1', NULL);
SET IDENTITY_INSERT [dbo].[OutwardDetail] OFF;
GO

-- Data for table: PurchaseOrderHeader (1 rows)
SET IDENTITY_INSERT [dbo].[PurchaseOrderHeader] ON;
INSERT INTO [dbo].[PurchaseOrderHeader] ([ID], [PONO], [PODATE], [LEDGERID], [DELIVERYDATE], [STATUS], [TOTALQTY], [TOTALAMOUNT], [REMARK], [CREATEDBY], [UPDATEDBY], [CREATEDAT]) VALUES
    (6, N'PO-1', N'2026-11-07', 3, NULL, N'Pending', 500, 212500, NULL, N'admin - 07/11/2026 12:37', N'admin - 07/11/2026 12:37', N'2026-11-07 07:07:05');
SET IDENTITY_INSERT [dbo].[PurchaseOrderHeader] OFF;
GO

-- Data for table: PurchaseOrderDetail (1 rows)
SET IDENTITY_INSERT [dbo].[PurchaseOrderDetail] ON;
INSERT INTO [dbo].[PurchaseOrderDetail] ([ID], [POID], [ITEMCODE], [SUBCODE], [QUANTITY], [DELIVEREDQTY], [PENDINGQTY], [UNIT], [RATE], [AMOUNT], [REMARK]) VALUES
    (6, 6, N'FG-BT01', N'B1', 500, 0, 500, N'PCS', 425, 212500, NULL);
SET IDENTITY_INSERT [dbo].[PurchaseOrderDetail] OFF;
GO

-- Data for table: PerformaInvoiceHeader (1 rows)
SET IDENTITY_INSERT [dbo].[PerformaInvoiceHeader] ON;
INSERT INTO [dbo].[PerformaInvoiceHeader] ([ID], [PINO], [PIDATE], [LEDGERID], [CUSTOMERPOID], [CUSTOMERPONO], [DELIVERYDATE], [STATUS], [TOTALQTY], [TOTALAMOUNT], [REMARK], [CREATEDBY], [UPDATEDBY], [CREATEDAT]) VALUES
    (1, N'TEST-PI-1794032207257', N'2026-11-07', 1, NULL, N'TEST-CUST-PO-101', NULL, N'Partially Received', 10, 1000, N'Test Shortage PI', N'TestAgent - 07/11/2026 11:46', N'TestAgent - 07/11/2026 11:46', N'2026-11-07 06:16:47');
SET IDENTITY_INSERT [dbo].[PerformaInvoiceHeader] OFF;
GO

-- Data for table: PerformaInvoiceDetail (1 rows)
SET IDENTITY_INSERT [dbo].[PerformaInvoiceDetail] ON;
INSERT INTO [dbo].[PerformaInvoiceDetail] ([ID], [PIID], [ITEMCODE], [SUBCODE], [QUANTITY], [RECEIVEDQTY], [PENDINGQTY], [UNIT], [RATE], [AMOUNT], [REMARK]) VALUES
    (1, 1, N'TEST-ITEM-PI', N'SUB1', 10, 4, 6, N'PCS', 100, 1000, NULL);
SET IDENTITY_INSERT [dbo].[PerformaInvoiceDetail] OFF;
GO

-- Data for table: JobworkInHeader (1 rows)
SET IDENTITY_INSERT [dbo].[JobworkInHeader] ON;
INSERT INTO [dbo].[JobworkInHeader] ([ID], [JWINWARDNO], [JWINWARDDATE], [LEDGERID], [JWOUTWARDNO], [TOTALAMOUNT], [REMARK], [CREATEDBY], [UPDATEDBY], [Bill]) VALUES
    (1, N'JWI-26-001', N'2026-10-16', 5, N'JWO-26-001', 4200, N'Received forged valve bodies', N'admin', N'admin', 1);
SET IDENTITY_INSERT [dbo].[JobworkInHeader] OFF;
GO

-- Data for table: JobworkInDetail (1 rows)
SET IDENTITY_INSERT [dbo].[JobworkInDetail] ON;
INSERT INTO [dbo].[JobworkInDetail] ([ID], [JWINWARDID], [OUTITEMCODE], [INITEMCODE], [GROSSWT], [NETWT], [SCRAPITEMCODE], [SCRAPPCS], [SCRAPWT], [QUANTITY], [PROCESS], [UNIT], [RATE], [AMOUNT], [TENPCSWT], [OUTSUBCODE], [INSUBCODE], [SCRAPSUBCODE]) VALUES
    (1, 1, N'RM-BR01', N'SF-VB01', 88, 87.5, N'SCRAP-BR', 0, 32.5, 250, N'Casting & Forging', N'PCS', 16.8, 4200, 3.5, N'', N'', N'');
SET IDENTITY_INSERT [dbo].[JobworkInDetail] OFF;
GO

-- Data for table: JobworkOutHeader (2 rows)
SET IDENTITY_INSERT [dbo].[JobworkOutHeader] ON;
INSERT INTO [dbo].[JobworkOutHeader] ([ID], [JWOUTWARDNO], [JWOUTWARDDATE], [LEDGERID], [REMARK], [CREATEDBY], [UPDATEDBY], [Bill], [DeptID]) VALUES
    (1, N'JWO-26-001', N'2026-10-08', 5, N'Issue raw brass for rough body casting', N'admin', N'admin', 1, 2),
    (2, N'JWO-26-002', N'2026-10-14', 5, N'Issue turned balls for nickel-chrome plating', N'operator', NULL, 1, 4);
SET IDENTITY_INSERT [dbo].[JobworkOutHeader] OFF;
GO

-- Data for table: JobworkOutDetail (2 rows)
SET IDENTITY_INSERT [dbo].[JobworkOutDetail] ON;
INSERT INTO [dbo].[JobworkOutDetail] ([ID], [JWOUTWARDID], [ITEMCODE], [GROSSWT], [NETWT], [QUANTITY], [UNIT], [RATE], [PROCESS], [TENPCSWT], [SUBCODE]) VALUES
    (1, 1, N'RM-BR01', 125, 124.5, 124.5, N'KGS', 0, N'Casting & Forging', 41.5, N''),
    (2, 2, N'SF-BL01', 13.2, 13, 200, N'PCS', 0, N'Electroplating', 0.65, N'');
SET IDENTITY_INSERT [dbo].[JobworkOutDetail] OFF;
GO

-- Data for table: StockJournal (2 rows)
SET IDENTITY_INSERT [dbo].[StockJournal] ON;
INSERT INTO [dbo].[StockJournal] ([SJID], [SJDate], [SJType], [ItemCode], [Qty], [Remarks], [CreatedBy], [UpdatedBy], [SubCode]) VALUES
    (1, N'2026-10-25', N'PHYSICAL_VERIF', N'RM-BR01', 15, N'Stock audit physical verification surplus', N'manager', N'admin', N''),
    (2, N'2026-10-26', N'DAMAGE_SCRAP', N'SF-VB01', -3, N'Found casting porosity defect - scrapped', N'operator', N'manager', N'');
SET IDENTITY_INSERT [dbo].[StockJournal] OFF;
GO

-- Data for table: StockTransfer (2 rows)
SET IDENTITY_INSERT [dbo].[StockTransfer] ON;
INSERT INTO [dbo].[StockTransfer] ([MoveID], [TransferID], [MoveDate], [FromDeptID], [ToDeptID], [OutItemCode], [OutPcs], [OutWeight], [InItemCode], [InPcs], [InWeight], [ScrapItemCode], [ScrapPcs], [ScrapWeight], [LossWeight], [Remarks], [CreatedBy], [UpdatedBy], [Unit], [ManualChallanNo], [OutSubCode], [InSubCode], [ScrapSubCode]) VALUES
    (1, N'ST-26-001', N'2026-10-10', 1, 3, N'RM-BR01', 50, 207.5, N'SF-SP01', 450, 171, N'SCRAP-BR', 0, 34.2, 2.3, N'Spindle rod turning movement', N'operator', N'admin', N'PCS', N'CH-1001', N'', N'', N''),
    (2, N'ST-26-002', N'2026-10-19', 5, 6, N'FG-BV01', 50, 26, N'FG-BV01', 50, 26, NULL, 0, 0, 0, N'Transfer tested goods to Finished Goods store', N'operator', N'manager', N'PCS', N'CH-1002', N'', N'', N'');
SET IDENTITY_INSERT [dbo].[StockTransfer] OFF;
GO

-- Data for table: VoucherEntry (7 rows)
SET IDENTITY_INSERT [dbo].[VoucherEntry] ON;
INSERT INTO [dbo].[VoucherEntry] ([VoucherId], [VoucherType], [VoucherNo], [VoucherDate], [Mode], [LedgerId], [Amount], [Through], [Remark], [CREATEDBY], [UPDATEDBY], [Bill]) VALUES
    (1, N'RECEIPT', 1001, N'2026-10-20', N'BANK', 1, 25000, N'NEFT Ref #998877', N'Part payment received for Inv #OUT-26-001', N'accountant', N'admin', 1),
    (2, N'PAYMENT', 2001, N'2026-10-21', N'BANK', 3, 20000, N'RTGS Ref #112233', N'Payment against raw material purchase', N'accountant', N'admin', 1),
    (3, N'PAYMENT', 2002, N'2026-10-24', N'CASH', 5, 4200, N'Cash Voucher #89', N'Jobwork casting charges cleared', N'accountant', NULL, 1),
    (12, N'Purchase', 2003, N'2026-11-07', N'Debit', 9, 400, N'Inward', N'TEST-INW-1794032207306', N'TestAgent - 07/11/2026 11:46', N'TestAgent - 07/11/2026 11:46', 1),
    (13, N'Purchase', 2003, N'2026-11-07', N'Credit', 1, 400, N'Inward', N'TEST-INW-1794032207306', N'TestAgent - 07/11/2026 11:46', N'TestAgent - 07/11/2026 11:46', 1),
    (18, N'Sales', 2004, N'2026-11-07', N'Debit', 3, 49649, N'Outward', N'1', N'admin - 07/11/2026 22:12', N'admin - 07/11/2026 22:12', 1),
    (19, N'Sales', 2004, N'2026-11-07', N'Credit', 8, 49649, N'Outward', N'1', N'admin - 07/11/2026 22:12', N'admin - 07/11/2026 22:12', 1);
SET IDENTITY_INSERT [dbo].[VoucherEntry] OFF;
GO

-- Data for table: AssemblyTransactions (2 rows)
SET IDENTITY_INSERT [dbo].[AssemblyTransactions] ON;
INSERT INTO [dbo].[AssemblyTransactions] ([Id], [AssemblyNo], [AssemblyDate], [ItemCode], [Quantity], [Remark], [CreatedBy], [UpdatedBy], [SubCode]) VALUES
    (1, 101, N'2026-10-15', N'FG-BV01', 50, N'Batch A-101 assembled and pressure tested', N'operator', N'manager', N''),
    (2, 102, N'2026-10-20', N'FG-PT01', 40, N'Batch A-102 chrome pillar cock assembly', N'operator', N'admin', N'');
SET IDENTITY_INSERT [dbo].[AssemblyTransactions] OFF;
GO

-- Data for table: AttendanceMonthlySummary (23 rows)
SET IDENTITY_INSERT [dbo].[AttendanceMonthlySummary] ON;
INSERT INTO [dbo].[AttendanceMonthlySummary] ([Id], [MonthYear], [MonthName], [TotalDaysInMonth], [UserId], [BiometricCode], [EmployeeName], [Department], [Designation], [PresentDays], [AbsentDays], [HalfDays], [WeekOffDays], [PublicHolidays], [PaidLeaveDays], [UnpaidLeaveDays], [PayableDays], [TotalGrossHours], [TotalGrossHoursDecimal], [TotalBreakHours], [TotalBreakHoursDecimal], [TotalNetWorkHoursDecimal], [TotalOvertimeHoursDecimal], [SalaryType], [BaseSalary], [CalculatedSalary], [OvertimePay], [Deductions], [NetSalary], [UploadedFileName], [UploadedAt], [Remarks]) VALUES
    (24, N'2026-10', N'OCTOBER-2026', 31, 5, N'0001', N'AKSHAY LOKHIL', N'LABOUR', N'Designation-1', 12, 14, 16, 5, 0, 0, 0, 12, N'201:53', 201.88, N'10:00', 10, 191.88, 95.88, N'Hourly', 50, 4800, 7191, 0, 11991, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:00', NULL),
    (25, N'2026-10', N'OCTOBER-2026', 31, 6, N'0002', N'PURVAJEET RATHOD', N'LABOUR', N'Designation-1', 24.5, 1.5, 3, 5, 0, 0, 0, 29.5, N'268:00', 268, N'13:00', 13, 255, 0, N'Monthly', 15000, 14274, 0, 0, 14274, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:00', NULL),
    (26, N'2026-10', N'OCTOBER-2026', 31, 7, N'0003', N'KASAM', N'LABOUR', N'Designation-1', 13, 13, 10, 5, 0, 0, 0, 18, N'147:20', 147.33, N'07:00', 7, 140.33, 0, N'Monthly', 15000, 8710, 0, 0, 8710, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:01', NULL),
    (27, N'2026-10', N'OCTOBER-2026', 31, 8, N'0006', N'SAFIQ', N'LABOUR', N'Designation-1', 0, 26, 0, 5, 0, 0, 0, 0, N'00:00', 0, N'00:00', 0, 0, 0, N'Monthly', 15000, 0, 0, 0, 0, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:01', NULL),
    (28, N'2026-10', N'OCTOBER-2026', 31, 9, N'0007', N'KARAN', N'LABOUR', N'Designation-1', 24, 2, 2, 5, 0, 0, 0, 29, N'254:31', 254.52, N'12:00', 12, 242.52, 0, N'Monthly', 15000, 14032, 0, 0, 14032, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:01', NULL),
    (29, N'2026-10', N'OCTOBER-2026', 31, 10, N'0008', N'DEVABHAI', N'LABOUR', N'Designation-1', 24, 2, 2, 5, 0, 0, 0, 29, N'265:10', 265.17, N'12:30', 12.5, 252.67, 0, N'Monthly', 15000, 14032, 0, 0, 14032, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:01', NULL),
    (30, N'2026-10', N'OCTOBER-2026', 31, 11, N'0009', N'GULSAN', N'LABOUR', N'Designation-1', 15, 11, 5, 5, 0, 0, 0, 20, N'226:10', 226.17, N'07:30', 7.5, 218.67, 0, N'Monthly', 15000, 9677, 0, 0, 9677, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:01', NULL),
    (31, N'2026-10', N'OCTOBER-2026', 31, 12, N'0011', N'RAJNIKANT', N'LABOUR', N'Designation-1', 0, 26, 0, 5, 0, 0, 0, 0, N'00:00', 0, N'00:00', 0, 0, 0, N'Monthly', 15000, 0, 0, 0, 0, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:01', NULL),
    (32, N'2026-10', N'OCTOBER-2026', 31, 13, N'0012', N'KHIMAJI', N'LABOUR', N'Designation-1', 13, 13, 12, 5, 0, 0, 0, 18, N'157:32', 157.53, N'08:00', 8, 149.53, 0, N'Monthly', 15000, 8710, 0, 0, 8710, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:01', NULL),
    (33, N'2026-10', N'OCTOBER-2026', 31, 14, N'0014', N'GEETA', N'LABOUR', N'Designation-1', 23.5, 2.5, 3, 5, 0, 0, 0, 28.5, N'261:11', 261.18, N'12:30', 12.5, 248.68, 0, N'Monthly', 15000, 13790, 0, 0, 13790, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:02', NULL),
    (34, N'2026-10', N'OCTOBER-2026', 31, 15, N'0015', N'BINITA', N'LABOUR', N'Designation-1', 24.5, 1.5, 3, 5, 0, 0, 0, 29.5, N'271:46', 271.77, N'13:00', 13, 258.77, 0, N'Monthly', 15000, 14274, 0, 0, 14274, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:02', NULL),
    (35, N'2026-10', N'OCTOBER-2026', 31, 16, N'0016', N'CHANDA', N'LABOUR', N'Designation-1', 12.5, 13.5, 25, 5, 0, 0, 0, 17.5, N'245:09', 245.15, N'12:30', 12.5, 232.65, 0, N'Monthly', 15000, 8468, 0, 0, 8468, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:02', NULL),
    (36, N'2026-10', N'OCTOBER-2026', 31, 17, N'0019', N'VIMLA', N'LABOUR', N'Designation-1', 0, 26, 0, 5, 0, 0, 0, 0, N'00:00', 0, N'00:00', 0, 0, 0, N'Monthly', 15000, 0, 0, 0, 0, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:02', NULL),
    (37, N'2026-10', N'OCTOBER-2026', 31, 18, N'0023', N'RAJIV', N'LABOUR', N'Designation-1', 25, 1, 2, 5, 0, 0, 0, 30, N'268:31', 268.52, N'13:00', 13, 255.52, 0, N'Monthly', 15000, 14516, 0, 0, 14516, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:02', NULL),
    (38, N'2026-10', N'OCTOBER-2026', 31, 19, N'0024', N'DEEPU', N'LABOUR', N'Designation-1', 24, 2, 3, 5, 0, 0, 0, 29, N'257:45', 257.75, N'12:30', 12.5, 245.25, 0, N'Monthly', 15000, 14032, 0, 0, 14032, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:02', NULL),
    (39, N'2026-10', N'OCTOBER-2026', 31, 20, N'0026', N'HANSRAJ', N'LABOUR', N'Designation-1', 15, 11, 8, 5, 0, 0, 0, 20, N'204:14', 204.23, N'09:00', 9, 195.23, 0, N'Monthly', 15000, 9677, 0, 0, 9677, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:02', NULL),
    (40, N'2026-10', N'OCTOBER-2026', 31, 21, N'022', N'JOGENDRA', N'LABOUR', N'Designation-1', 6.5, 19.5, 1, 5, 0, 0, 0, 11.5, N'73:17', 73.28, N'03:30', 3.5, 69.78, 0, N'Monthly', 15000, 5565, 0, 0, 5565, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:02', NULL),
    (41, N'2026-10', N'OCTOBER-2026', 31, 22, N'027', N'MAMTA', N'LABOUR', N'Designation-1', 15.5, 10.5, 8, 5, 0, 0, 0, 20.5, N'211:06', 211.1, N'09:00', 9, 202.1, 0, N'Monthly', 15000, 9919, 0, 0, 9919, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:03', NULL),
    (42, N'2026-10', N'OCTOBER-2026', 31, 23, N'028', N'USHA', N'LABOUR', N'Designation-1', 24.5, 1.5, 3, 5, 0, 0, 0, 29.5, N'270:49', 270.82, N'13:00', 13, 257.82, 0, N'Monthly', 15000, 14274, 0, 0, 14274, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:03', NULL),
    (43, N'2026-10', N'OCTOBER-2026', 31, 24, N'029', N'JAYDEEP', N'OFFICE', N'Designation-1', 0, 26, 0, 5, 0, 0, 0, 0, N'00:00', 0, N'00:00', 0, 0, 0, N'Monthly', 20000, 0, 0, 0, 0, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:03', NULL),
    (44, N'2026-10', N'OCTOBER-2026', 31, 25, N'030', N'AKASH', N'OFFICE', N'Designation-1', 0, 26, 0, 5, 0, 0, 0, 0, N'00:00', 0, N'00:00', 0, 0, 0, N'Monthly', 20000, 0, 0, 0, 0, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:03', NULL),
    (45, N'2026-10', N'OCTOBER-2026', 31, 26, N'031', N'NEEL', N'OFFICE', N'Designation-1', 0, 26, 0, 5, 0, 0, 0, 0, N'174:19', 174.32, N'11:00', 11, 163.32, 0, N'Monthly', 20000, 0, 0, 0, 0, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:03', NULL),
    (46, N'2026-10', N'OCTOBER-2026', 31, 27, N'032', N'AJAY', N'LABOUR', N'Designation-1', 6.5, 19.5, 14, 5, 0, 0, 0, 11.5, N'126:18', 126.3, N'06:30', 6.5, 119.8, 0, N'Monthly', 15000, 5565, 0, 0, 5565, N'rptMonthlyLog.pdf', N'2026-11-08 11:53:03', NULL);
SET IDENTITY_INSERT [dbo].[AttendanceMonthlySummary] OFF;
GO

-- Data for table: AttendanceDailyLog (713 rows)
SET IDENTITY_INSERT [dbo].[AttendanceDailyLog] ON;
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (714, 24, N'2026-10', N'0001', N'2026-10-01', 1, N'Thu', N'GS', N'08:09', N'19:33', N'10:54', 10.9, N'00:30', 10.4, 0, N'PR', N'PR', N'P'),
    (715, 24, N'2026-10', N'0001', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (716, 24, N'2026-10', N'0001', N'2026-10-03', 3, N'Sat', N'GS', N'08:11', N'18:06', N'09:25', 9.42, N'00:30', 8.92, 0, N'PR', N'AB', N'HD'),
    (717, 24, N'2026-10', N'0001', N'2026-10-04', 4, N'Sun', N'GS', N'08:43', N'18:36', N'09:23', 9.38, N'00:30', 8.88, 0, N'PR', N'AB', N'HD'),
    (718, 24, N'2026-10', N'0001', N'2026-10-05', 5, N'Mon', N'GS', N'08:18', N'18:03', N'09:15', 9.25, N'00:30', 8.75, 0, N'PR', N'AB', N'HD'),
    (719, 24, N'2026-10', N'0001', N'2026-10-06', 6, N'Tue', N'GS', N'08:43', N'18:02', N'08:49', 8.82, N'00:30', 8.32, 0, N'PR', N'AB', N'HD'),
    (720, 24, N'2026-10', N'0001', N'2026-10-07', 7, N'Wed', N'GS', N'08:22', N'18:06', N'09:14', 9.23, N'00:30', 8.73, 0, N'PR', N'AB', N'HD'),
    (721, 24, N'2026-10', N'0001', N'2026-10-08', 8, N'Thu', N'GS', N'12:57', N'18:14', N'04:47', 4.78, N'00:30', 4.28, 0, N'AB', N'AB', N'A'),
    (722, 24, N'2026-10', N'0001', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (723, 24, N'2026-10', N'0001', N'2026-10-10', 10, N'Sat', N'GS', N'07:56', N'18:00', N'09:34', 9.57, N'00:30', 9.07, 0, N'PR', N'AB', N'HD'),
    (724, 24, N'2026-10', N'0001', N'2026-10-11', 11, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (725, 24, N'2026-10', N'0001', N'2026-10-12', 12, N'Mon', N'GS', N'08:33', N'18:07', N'09:04', 9.07, N'00:30', 8.57, 0, N'PR', N'AB', N'HD'),
    (726, 24, N'2026-10', N'0001', N'2026-10-13', 13, N'Tue', N'GS', N'08:26', N'18:08', N'09:12', 9.2, N'00:30', 8.7, 0, N'PR', N'AB', N'HD'),
    (727, 24, N'2026-10', N'0001', N'2026-10-14', 14, N'Wed', N'GS', N'08:32', N'18:03', N'09:01', 9.02, N'00:30', 8.52, 0, N'PR', N'AB', N'HD'),
    (728, 24, N'2026-10', N'0001', N'2026-10-15', 15, N'Thu', N'GS', N'08:33', N'18:07', N'09:04', 9.07, N'00:30', 8.57, 0, N'PR', N'AB', N'HD'),
    (729, 24, N'2026-10', N'0001', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (730, 24, N'2026-10', N'0001', N'2026-10-17', 17, N'Sat', N'GS', N'08:57', N'18:01', N'08:34', 8.57, N'00:30', 8.07, 0, N'PR', N'AB', N'HD'),
    (731, 24, N'2026-10', N'0001', N'2026-10-18', 18, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (732, 24, N'2026-10', N'0001', N'2026-10-19', 19, N'Mon', N'GS', N'08:30', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (733, 24, N'2026-10', N'0001', N'2026-10-20', 20, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (734, 24, N'2026-10', N'0001', N'2026-10-21', 21, N'Wed', N'GS', N'19:32', N'08:23', N'12:51', 12.85, N'00:00', 12.85, 0, N'AB', N'AB', N'A'),
    (735, 24, N'2026-10', N'0001', N'2026-10-22', 22, N'Thu', N'GS', N'19:40', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (736, 24, N'2026-10', N'0001', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (737, 24, N'2026-10', N'0001', N'2026-10-24', 24, N'Sat', N'GS', N'08:17', N'19:31', N'10:44', 10.73, N'00:30', 10.23, 0, N'PR', N'PR', N'P'),
    (738, 24, N'2026-10', N'0001', N'2026-10-25', 25, N'Sun', N'GS', N'08:05', N'19:02', N'10:27', 10.45, N'00:30', 9.95, 0, N'PR', N'AB', N'HD'),
    (739, 24, N'2026-10', N'0001', N'2026-10-26', 26, N'Mon', N'GS', N'08:09', N'18:05', N'09:26', 9.43, N'00:30', 8.93, 0, N'PR', N'AB', N'HD'),
    (740, 24, N'2026-10', N'0001', N'2026-10-27', 27, N'Tue', N'GS', N'08:16', N'19:32', N'10:46', 10.77, N'00:30', 10.27, 0, N'PR', N'PR', N'P'),
    (741, 24, N'2026-10', N'0001', N'2026-10-28', 28, N'Wed', N'GS', N'08:25', N'19:34', N'10:39', 10.65, N'00:30', 10.15, 0, N'PR', N'PR', N'P'),
    (742, 24, N'2026-10', N'0001', N'2026-10-29', 29, N'Thu', N'GS', N'08:12', N'19:36', N'10:54', 10.9, N'00:30', 10.4, 0, N'PR', N'PR', N'P'),
    (743, 24, N'2026-10', N'0001', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (744, 24, N'2026-10', N'0001', N'2026-10-31', 31, N'Sat', N'GS', N'08:08', N'18:28', N'09:50', 9.83, N'00:30', 9.33, 0, N'PR', N'AB', N'HD'),
    (745, 25, N'2026-10', N'0002', N'2026-10-01', 1, N'Thu', N'GS', N'08:28', N'19:37', N'10:39', 10.65, N'00:30', 10.15, 0, N'PR', N'PR', N'P'),
    (746, 25, N'2026-10', N'0002', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (747, 25, N'2026-10', N'0002', N'2026-10-03', 3, N'Sat', N'GS', N'08:39', N'19:36', N'10:27', 10.45, N'00:30', 9.95, 0, N'PR', N'PR', N'P'),
    (748, 25, N'2026-10', N'0002', N'2026-10-04', 4, N'Sun', N'GS', N'08:28', N'19:37', N'10:39', 10.65, N'00:30', 10.15, 0, N'PR', N'PR', N'P'),
    (749, 25, N'2026-10', N'0002', N'2026-10-05', 5, N'Mon', N'GS', N'08:30', N'19:37', N'10:37', 10.62, N'00:30', 10.12, 0, N'PR', N'PR', N'P'),
    (750, 25, N'2026-10', N'0002', N'2026-10-06', 6, N'Tue', N'GS', N'08:31', N'17:18', N'08:17', 8.28, N'00:30', 7.78, 0, N'PR', N'AB', N'HD'),
    (751, 25, N'2026-10', N'0002', N'2026-10-07', 7, N'Wed', N'GS', N'08:32', N'19:37', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (752, 25, N'2026-10', N'0002', N'2026-10-08', 8, N'Thu', N'GS', N'08:34', N'19:38', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (753, 25, N'2026-10', N'0002', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (754, 25, N'2026-10', N'0002', N'2026-10-10', 10, N'Sat', N'GS', N'08:35', N'19:37', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (755, 25, N'2026-10', N'0002', N'2026-10-11', 11, N'Sun', N'GS', N'08:30', N'19:37', N'10:37', 10.62, N'00:30', 10.12, 0, N'PR', N'PR', N'P'),
    (756, 25, N'2026-10', N'0002', N'2026-10-12', 12, N'Mon', N'GS', N'08:32', N'19:37', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (757, 25, N'2026-10', N'0002', N'2026-10-13', 13, N'Tue', N'GS', N'08:31', N'19:36', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (758, 25, N'2026-10', N'0002', N'2026-10-14', 14, N'Wed', N'GS', N'08:32', N'19:38', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (759, 25, N'2026-10', N'0002', N'2026-10-15', 15, N'Thu', N'GS', N'08:29', N'19:37', N'10:38', 10.63, N'00:30', 10.13, 0, N'PR', N'PR', N'P'),
    (760, 25, N'2026-10', N'0002', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (761, 25, N'2026-10', N'0002', N'2026-10-17', 17, N'Sat', N'GS', N'08:35', N'19:39', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (762, 25, N'2026-10', N'0002', N'2026-10-18', 18, N'Sun', N'GS', N'08:31', N'19:37', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (763, 25, N'2026-10', N'0002', N'2026-10-19', 19, N'Mon', N'GS', N'08:32', N'19:36', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P');
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (764, 25, N'2026-10', N'0002', N'2026-10-20', 20, N'Tue', N'GS', N'08:34', N'17:13', N'08:09', 8.15, N'00:30', 7.65, 0, N'PR', N'AB', N'HD'),
    (765, 25, N'2026-10', N'0002', N'2026-10-21', 21, N'Wed', N'GS', N'08:28', N'19:36', N'10:38', 10.63, N'00:30', 10.13, 0, N'PR', N'PR', N'P'),
    (766, 25, N'2026-10', N'0002', N'2026-10-22', 22, N'Thu', N'GS', N'08:28', N'19:38', N'10:40', 10.67, N'00:30', 10.17, 0, N'PR', N'PR', N'P'),
    (767, 25, N'2026-10', N'0002', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (768, 25, N'2026-10', N'0002', N'2026-10-24', 24, N'Sat', N'GS', N'08:33', N'19:35', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (769, 25, N'2026-10', N'0002', N'2026-10-25', 25, N'Sun', N'GS', N'08:30', N'19:36', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (770, 25, N'2026-10', N'0002', N'2026-10-26', 26, N'Mon', N'GS', N'08:33', N'19:36', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (771, 25, N'2026-10', N'0002', N'2026-10-27', 27, N'Tue', N'GS', N'08:28', N'19:34', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (772, 25, N'2026-10', N'0002', N'2026-10-28', 28, N'Wed', N'GS', N'08:31', N'19:35', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (773, 25, N'2026-10', N'0002', N'2026-10-29', 29, N'Thu', N'GS', N'08:28', N'17:01', N'08:03', 8.05, N'00:30', 7.55, 0, N'PR', N'AB', N'HD'),
    (774, 25, N'2026-10', N'0002', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (775, 25, N'2026-10', N'0002', N'2026-10-31', 31, N'Sat', N'GS', N'08:32', N'19:36', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (776, 26, N'2026-10', N'0003', N'2026-10-01', 1, N'Thu', N'GS', N'08:28', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (777, 26, N'2026-10', N'0003', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (778, 26, N'2026-10', N'0003', N'2026-10-03', 3, N'Sat', N'GS', N'07:53', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (779, 26, N'2026-10', N'0003', N'2026-10-04', 4, N'Sun', N'GS', N'08:24', N'19:39', N'10:45', 10.75, N'00:30', 10.25, 0, N'PR', N'PR', N'P'),
    (780, 26, N'2026-10', N'0003', N'2026-10-05', 5, N'Mon', N'GS', N'08:27', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (781, 26, N'2026-10', N'0003', N'2026-10-06', 6, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (782, 26, N'2026-10', N'0003', N'2026-10-07', 7, N'Wed', N'GS', N'08:30', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (783, 26, N'2026-10', N'0003', N'2026-10-08', 8, N'Thu', N'GS', N'08:27', N'19:43', N'10:46', 10.77, N'00:30', 10.27, 0, N'PR', N'PR', N'P'),
    (784, 26, N'2026-10', N'0003', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (785, 26, N'2026-10', N'0003', N'2026-10-10', 10, N'Sat', N'GS', N'08:36', N'19:38', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (786, 26, N'2026-10', N'0003', N'2026-10-11', 11, N'Sun', N'GS', N'08:30', N'19:39', N'10:39', 10.65, N'00:30', 10.15, 0, N'PR', N'PR', N'P'),
    (787, 26, N'2026-10', N'0003', N'2026-10-12', 12, N'Mon', N'GS', N'08:33', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (788, 26, N'2026-10', N'0003', N'2026-10-13', 13, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (789, 26, N'2026-10', N'0003', N'2026-10-14', 14, N'Wed', N'GS', N'08:32', N'19:17', N'10:15', 10.25, N'00:30', 9.75, 0, N'PR', N'AB', N'HD'),
    (790, 26, N'2026-10', N'0003', N'2026-10-15', 15, N'Thu', N'GS', N'08:30', N'19:38', N'10:38', 10.63, N'00:30', 10.13, 0, N'PR', N'PR', N'P'),
    (791, 26, N'2026-10', N'0003', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (792, 26, N'2026-10', N'0003', N'2026-10-17', 17, N'Sat', N'GS', N'08:32', N'19:40', N'10:38', 10.63, N'00:30', 10.13, 0, N'PR', N'PR', N'P'),
    (793, 26, N'2026-10', N'0003', N'2026-10-18', 18, N'Sun', N'GS', N'07:58', N'19:42', N'11:14', 11.23, N'00:30', 10.73, 0, N'PR', N'PR', N'P'),
    (794, 26, N'2026-10', N'0003', N'2026-10-19', 19, N'Mon', N'GS', N'08:25', N'19:36', N'10:41', 10.68, N'00:30', 10.18, 0, N'PR', N'PR', N'P'),
    (795, 26, N'2026-10', N'0003', N'2026-10-20', 20, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (796, 26, N'2026-10', N'0003', N'2026-10-21', 21, N'Wed', N'GS', N'08:27', N'19:37', N'10:40', 10.67, N'00:30', 10.17, 0, N'PR', N'PR', N'P'),
    (797, 26, N'2026-10', N'0003', N'2026-10-22', 22, N'Thu', N'GS', N'08:30', N'19:38', N'10:38', 10.63, N'00:30', 10.13, 0, N'PR', N'PR', N'P'),
    (798, 26, N'2026-10', N'0003', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (799, 26, N'2026-10', N'0003', N'2026-10-24', 24, N'Sat', N'GS', N'08:34', N'17:34', N'08:30', 8.5, N'00:30', 8, 0, N'PR', N'AB', N'HD'),
    (800, 26, N'2026-10', N'0003', N'2026-10-25', 25, N'Sun', N'GS', N'08:19', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (801, 26, N'2026-10', N'0003', N'2026-10-26', 26, N'Mon', N'GS', N'08:26', N'19:37', N'10:41', 10.68, N'00:30', 10.18, 0, N'PR', N'PR', N'P'),
    (802, 26, N'2026-10', N'0003', N'2026-10-27', 27, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (803, 26, N'2026-10', N'0003', N'2026-10-28', 28, N'Wed', N'GS', N'08:23', N'19:36', N'10:43', 10.72, N'00:30', 10.22, 0, N'PR', N'PR', N'P'),
    (804, 26, N'2026-10', N'0003', N'2026-10-29', 29, N'Thu', N'GS', N'08:25', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (805, 26, N'2026-10', N'0003', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (806, 26, N'2026-10', N'0003', N'2026-10-31', 31, N'Sat', N'GS', N'08:08', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (807, 27, N'2026-10', N'0006', N'2026-10-01', 1, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (808, 27, N'2026-10', N'0006', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (809, 27, N'2026-10', N'0006', N'2026-10-03', 3, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (810, 27, N'2026-10', N'0006', N'2026-10-04', 4, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (811, 27, N'2026-10', N'0006', N'2026-10-05', 5, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (812, 27, N'2026-10', N'0006', N'2026-10-06', 6, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (813, 27, N'2026-10', N'0006', N'2026-10-07', 7, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A');
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (814, 27, N'2026-10', N'0006', N'2026-10-08', 8, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (815, 27, N'2026-10', N'0006', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (816, 27, N'2026-10', N'0006', N'2026-10-10', 10, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (817, 27, N'2026-10', N'0006', N'2026-10-11', 11, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (818, 27, N'2026-10', N'0006', N'2026-10-12', 12, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (819, 27, N'2026-10', N'0006', N'2026-10-13', 13, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (820, 27, N'2026-10', N'0006', N'2026-10-14', 14, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (821, 27, N'2026-10', N'0006', N'2026-10-15', 15, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (822, 27, N'2026-10', N'0006', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (823, 27, N'2026-10', N'0006', N'2026-10-17', 17, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (824, 27, N'2026-10', N'0006', N'2026-10-18', 18, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (825, 27, N'2026-10', N'0006', N'2026-10-19', 19, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (826, 27, N'2026-10', N'0006', N'2026-10-20', 20, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (827, 27, N'2026-10', N'0006', N'2026-10-21', 21, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (828, 27, N'2026-10', N'0006', N'2026-10-22', 22, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (829, 27, N'2026-10', N'0006', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (830, 27, N'2026-10', N'0006', N'2026-10-24', 24, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (831, 27, N'2026-10', N'0006', N'2026-10-25', 25, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (832, 27, N'2026-10', N'0006', N'2026-10-26', 26, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (833, 27, N'2026-10', N'0006', N'2026-10-27', 27, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (834, 27, N'2026-10', N'0006', N'2026-10-28', 28, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (835, 27, N'2026-10', N'0006', N'2026-10-29', 29, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (836, 27, N'2026-10', N'0006', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (837, 27, N'2026-10', N'0006', N'2026-10-31', 31, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (838, 28, N'2026-10', N'0007', N'2026-10-01', 1, N'Thu', N'GS', N'08:28', N'19:45', N'10:47', 10.78, N'00:30', 10.28, 0, N'PR', N'PR', N'P'),
    (839, 28, N'2026-10', N'0007', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (840, 28, N'2026-10', N'0007', N'2026-10-03', 3, N'Sat', N'GS', N'08:35', N'19:38', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (841, 28, N'2026-10', N'0007', N'2026-10-04', 4, N'Sun', N'GS', N'08:28', N'19:39', N'10:41', 10.68, N'00:30', 10.18, 0, N'PR', N'PR', N'P'),
    (842, 28, N'2026-10', N'0007', N'2026-10-05', 5, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (843, 28, N'2026-10', N'0007', N'2026-10-06', 6, N'Tue', N'GS', N'08:32', N'19:43', N'10:41', 10.68, N'00:30', 10.18, 0, N'PR', N'PR', N'P'),
    (844, 28, N'2026-10', N'0007', N'2026-10-07', 7, N'Wed', N'GS', N'08:32', N'19:39', N'10:37', 10.62, N'00:30', 10.12, 0, N'PR', N'PR', N'P'),
    (845, 28, N'2026-10', N'0007', N'2026-10-08', 8, N'Thu', N'GS', N'08:35', N'19:41', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (846, 28, N'2026-10', N'0007', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (847, 28, N'2026-10', N'0007', N'2026-10-10', 10, N'Sat', N'GS', N'08:32', N'19:40', N'10:38', 10.63, N'00:30', 10.13, 0, N'PR', N'PR', N'P'),
    (848, 28, N'2026-10', N'0007', N'2026-10-11', 11, N'Sun', N'GS', N'08:34', N'19:39', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (849, 28, N'2026-10', N'0007', N'2026-10-12', 12, N'Mon', N'GS', N'08:32', N'19:39', N'10:37', 10.62, N'00:30', 10.12, 0, N'PR', N'PR', N'P'),
    (850, 28, N'2026-10', N'0007', N'2026-10-13', 13, N'Tue', N'GS', N'08:31', N'19:39', N'10:38', 10.63, N'00:30', 10.13, 0, N'PR', N'PR', N'P'),
    (851, 28, N'2026-10', N'0007', N'2026-10-14', 14, N'Wed', N'GS', N'08:32', N'19:40', N'10:38', 10.63, N'00:30', 10.13, 0, N'PR', N'PR', N'P'),
    (852, 28, N'2026-10', N'0007', N'2026-10-15', 15, N'Thu', N'GS', N'08:34', N'19:40', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (853, 28, N'2026-10', N'0007', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (854, 28, N'2026-10', N'0007', N'2026-10-17', 17, N'Sat', N'GS', N'08:32', N'19:40', N'10:38', 10.63, N'00:30', 10.13, 0, N'PR', N'PR', N'P'),
    (855, 28, N'2026-10', N'0007', N'2026-10-18', 18, N'Sun', N'GS', N'08:31', N'19:41', N'10:40', 10.67, N'00:30', 10.17, 0, N'PR', N'PR', N'P'),
    (856, 28, N'2026-10', N'0007', N'2026-10-19', 19, N'Mon', N'GS', N'08:32', N'19:38', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (857, 28, N'2026-10', N'0007', N'2026-10-20', 20, N'Tue', N'GS', N'08:34', N'17:12', N'08:08', 8.13, N'00:30', 7.63, 0, N'PR', N'AB', N'HD'),
    (858, 28, N'2026-10', N'0007', N'2026-10-21', 21, N'Wed', N'GS', N'08:36', N'19:38', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (859, 28, N'2026-10', N'0007', N'2026-10-22', 22, N'Thu', N'GS', N'08:34', N'19:42', N'10:38', 10.63, N'00:30', 10.13, 0, N'PR', N'PR', N'P'),
    (860, 28, N'2026-10', N'0007', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (861, 28, N'2026-10', N'0007', N'2026-10-24', 24, N'Sat', N'GS', N'08:31', N'10:38', N'02:07', 2.12, N'00:00', 2.12, 0, N'PR', N'AB', N'HD'),
    (862, 28, N'2026-10', N'0007', N'2026-10-25', 25, N'Sun', N'GS', N'08:31', N'19:37', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (863, 28, N'2026-10', N'0007', N'2026-10-26', 26, N'Mon', N'GS', N'08:32', N'19:39', N'10:37', 10.62, N'00:30', 10.12, 0, N'PR', N'PR', N'P');
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (864, 28, N'2026-10', N'0007', N'2026-10-27', 27, N'Tue', N'GS', N'08:37', N'19:38', N'10:31', 10.52, N'00:30', 10.02, 0, N'PR', N'PR', N'P'),
    (865, 28, N'2026-10', N'0007', N'2026-10-28', 28, N'Wed', N'GS', N'08:31', N'19:36', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (866, 28, N'2026-10', N'0007', N'2026-10-29', 29, N'Thu', N'GS', N'08:29', N'19:41', N'10:42', 10.7, N'00:30', 10.2, 0, N'PR', N'PR', N'P'),
    (867, 28, N'2026-10', N'0007', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (868, 28, N'2026-10', N'0007', N'2026-10-31', 31, N'Sat', N'GS', N'08:33', N'19:37', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (869, 29, N'2026-10', N'0008', N'2026-10-01', 1, N'Thu', N'GS', N'08:14', N'19:41', N'10:57', 10.95, N'00:30', 10.45, 0, N'PR', N'PR', N'P'),
    (870, 29, N'2026-10', N'0008', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (871, 29, N'2026-10', N'0008', N'2026-10-03', 3, N'Sat', N'GS', N'08:22', N'19:39', N'10:47', 10.78, N'00:30', 10.28, 0, N'PR', N'PR', N'P'),
    (872, 29, N'2026-10', N'0008', N'2026-10-04', 4, N'Sun', N'GS', N'08:11', N'19:40', N'10:59', 10.98, N'00:30', 10.48, 0, N'PR', N'PR', N'P'),
    (873, 29, N'2026-10', N'0008', N'2026-10-05', 5, N'Mon', N'GS', N'08:15', N'19:40', N'10:55', 10.92, N'00:30', 10.42, 0, N'PR', N'PR', N'P'),
    (874, 29, N'2026-10', N'0008', N'2026-10-06', 6, N'Tue', N'GS', N'08:31', N'19:42', N'10:41', 10.68, N'00:30', 10.18, 0, N'PR', N'PR', N'P'),
    (875, 29, N'2026-10', N'0008', N'2026-10-07', 7, N'Wed', N'GS', N'08:29', N'19:39', N'10:40', 10.67, N'00:30', 10.17, 0, N'PR', N'PR', N'P'),
    (876, 29, N'2026-10', N'0008', N'2026-10-08', 8, N'Thu', N'GS', N'08:27', N'19:41', N'10:44', 10.73, N'00:30', 10.23, 0, N'PR', N'PR', N'P'),
    (877, 29, N'2026-10', N'0008', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (878, 29, N'2026-10', N'0008', N'2026-10-10', 10, N'Sat', N'GS', N'08:19', N'19:38', N'10:49', 10.82, N'00:30', 10.32, 0, N'PR', N'PR', N'P'),
    (879, 29, N'2026-10', N'0008', N'2026-10-11', 11, N'Sun', N'GS', N'08:33', N'19:38', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (880, 29, N'2026-10', N'0008', N'2026-10-12', 12, N'Mon', N'GS', N'08:22', N'19:41', N'10:49', 10.82, N'00:30', 10.32, 0, N'PR', N'PR', N'P'),
    (881, 29, N'2026-10', N'0008', N'2026-10-13', 13, N'Tue', N'GS', N'08:25', N'19:37', N'10:42', 10.7, N'00:30', 10.2, 0, N'PR', N'PR', N'P'),
    (882, 29, N'2026-10', N'0008', N'2026-10-14', 14, N'Wed', N'GS', N'08:20', N'19:39', N'10:49', 10.82, N'00:30', 10.32, 0, N'PR', N'PR', N'P'),
    (883, 29, N'2026-10', N'0008', N'2026-10-15', 15, N'Thu', N'GS', N'08:25', N'19:40', N'10:45', 10.75, N'00:30', 10.25, 0, N'PR', N'PR', N'P'),
    (884, 29, N'2026-10', N'0008', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (885, 29, N'2026-10', N'0008', N'2026-10-17', 17, N'Sat', N'GS', N'08:39', N'19:40', N'10:31', 10.52, N'00:30', 10.02, 0, N'PR', N'PR', N'P'),
    (886, 29, N'2026-10', N'0008', N'2026-10-18', 18, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (887, 29, N'2026-10', N'0008', N'2026-10-19', 19, N'Mon', N'GS', N'09:47', N'19:40', N'09:23', 9.38, N'00:30', 8.88, 0, N'AB', N'PR', N'HD'),
    (888, 29, N'2026-10', N'0008', N'2026-10-20', 20, N'Tue', N'GS', N'08:25', N'17:14', N'08:19', 8.32, N'00:30', 7.82, 0, N'PR', N'AB', N'HD'),
    (889, 29, N'2026-10', N'0008', N'2026-10-21', 21, N'Wed', N'GS', N'08:26', N'19:37', N'10:41', 10.68, N'00:30', 10.18, 0, N'PR', N'PR', N'P'),
    (890, 29, N'2026-10', N'0008', N'2026-10-22', 22, N'Thu', N'GS', N'08:19', N'19:40', N'10:51', 10.85, N'00:30', 10.35, 0, N'PR', N'PR', N'P'),
    (891, 29, N'2026-10', N'0008', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (892, 29, N'2026-10', N'0008', N'2026-10-24', 24, N'Sat', N'GS', N'08:28', N'19:37', N'10:39', 10.65, N'00:30', 10.15, 0, N'PR', N'PR', N'P'),
    (893, 29, N'2026-10', N'0008', N'2026-10-25', 25, N'Sun', N'GS', N'08:24', N'19:37', N'10:43', 10.72, N'00:30', 10.22, 0, N'PR', N'PR', N'P'),
    (894, 29, N'2026-10', N'0008', N'2026-10-26', 26, N'Mon', N'GS', N'08:22', N'19:37', N'10:45', 10.75, N'00:30', 10.25, 0, N'PR', N'PR', N'P'),
    (895, 29, N'2026-10', N'0008', N'2026-10-27', 27, N'Tue', N'GS', N'08:17', N'19:36', N'10:49', 10.82, N'00:30', 10.32, 0, N'PR', N'PR', N'P'),
    (896, 29, N'2026-10', N'0008', N'2026-10-28', 28, N'Wed', N'GS', N'08:20', N'19:35', N'10:45', 10.75, N'00:30', 10.25, 0, N'PR', N'PR', N'P'),
    (897, 29, N'2026-10', N'0008', N'2026-10-29', 29, N'Thu', N'GS', N'08:17', N'19:38', N'10:51', 10.85, N'00:30', 10.35, 0, N'PR', N'PR', N'P'),
    (898, 29, N'2026-10', N'0008', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (899, 29, N'2026-10', N'0008', N'2026-10-31', 31, N'Sat', N'GS', N'08:26', N'19:37', N'10:41', 10.68, N'00:30', 10.18, 0, N'PR', N'PR', N'P'),
    (900, 30, N'2026-10', N'0009', N'2026-10-01', 1, N'Thu', N'GS', N'08:29', N'19:37', N'10:38', 10.63, N'00:30', 10.13, 0, N'PR', N'PR', N'P'),
    (901, 30, N'2026-10', N'0009', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (902, 30, N'2026-10', N'0009', N'2026-10-03', 3, N'Sat', N'GS', N'08:55', N'19:36', N'10:11', 10.18, N'00:30', 9.68, 0, N'PR', N'PR', N'P'),
    (903, 30, N'2026-10', N'0009', N'2026-10-04', 4, N'Sun', N'GS', N'08:24', N'19:38', N'10:44', 10.73, N'00:30', 10.23, 0, N'PR', N'PR', N'P'),
    (904, 30, N'2026-10', N'0009', N'2026-10-05', 5, N'Mon', N'GS', N'08:27', N'19:40', N'10:43', 10.72, N'00:30', 10.22, 0, N'PR', N'PR', N'P'),
    (905, 30, N'2026-10', N'0009', N'2026-10-06', 6, N'Tue', N'GS', N'08:28', N'19:34', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (906, 30, N'2026-10', N'0009', N'2026-10-07', 7, N'Wed', N'GS', N'18:22', N'08:29', N'14:07', 14.12, N'00:00', 14.12, 0, N'AB', N'AB', N'A'),
    (907, 30, N'2026-10', N'0009', N'2026-10-08', 8, N'Thu', N'GS', N'19:37', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (908, 30, N'2026-10', N'0009', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (909, 30, N'2026-10', N'0009', N'2026-10-10', 10, N'Sat', N'GS', N'19:33', N'08:28', N'12:55', 12.92, N'00:00', 12.92, 0, N'AB', N'AB', N'A'),
    (910, 30, N'2026-10', N'0009', N'2026-10-11', 11, N'Sun', N'GS', N'19:34', N'08:29', N'12:55', 12.92, N'00:00', 12.92, 0, N'AB', N'AB', N'A'),
    (911, 30, N'2026-10', N'0009', N'2026-10-12', 12, N'Mon', N'GS', N'19:40', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (912, 30, N'2026-10', N'0009', N'2026-10-13', 13, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (913, 30, N'2026-10', N'0009', N'2026-10-14', 14, N'Wed', N'GS', N'08:26', N'19:37', N'10:41', 10.68, N'00:30', 10.18, 0, N'PR', N'PR', N'P');
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (914, 30, N'2026-10', N'0009', N'2026-10-15', 15, N'Thu', N'GS', N'08:29', N'19:34', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (915, 30, N'2026-10', N'0009', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (916, 30, N'2026-10', N'0009', N'2026-10-17', 17, N'Sat', N'GS', N'08:29', N'19:33', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (917, 30, N'2026-10', N'0009', N'2026-10-18', 18, N'Sun', N'GS', N'08:28', N'19:34', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (918, 30, N'2026-10', N'0009', N'2026-10-19', 19, N'Mon', N'GS', N'08:30', N'19:36', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (919, 30, N'2026-10', N'0009', N'2026-10-20', 20, N'Tue', N'GS', N'18:08', N'08:27', N'14:19', 14.32, N'00:00', 14.32, 0, N'AB', N'AB', N'A'),
    (920, 30, N'2026-10', N'0009', N'2026-10-21', 21, N'Wed', N'GS', N'19:36', N'08:27', N'12:51', 12.85, N'00:00', 12.85, 0, N'AB', N'AB', N'A'),
    (921, 30, N'2026-10', N'0009', N'2026-10-22', 22, N'Thu', N'GS', N'19:35', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (922, 30, N'2026-10', N'0009', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (923, 30, N'2026-10', N'0009', N'2026-10-24', 24, N'Sat', N'GS', N'08:25', N'19:36', N'10:41', 10.68, N'00:30', 10.18, 0, N'PR', N'PR', N'P'),
    (924, 30, N'2026-10', N'0009', N'2026-10-25', 25, N'Sun', N'GS', N'08:30', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (925, 30, N'2026-10', N'0009', N'2026-10-26', 26, N'Mon', N'GS', N'08:26', N'19:34', N'10:38', 10.63, N'00:30', 10.13, 0, N'PR', N'PR', N'P'),
    (926, 30, N'2026-10', N'0009', N'2026-10-27', 27, N'Tue', N'GS', N'08:25', N'19:35', N'10:40', 10.67, N'00:30', 10.17, 0, N'PR', N'PR', N'P'),
    (927, 30, N'2026-10', N'0009', N'2026-10-28', 28, N'Wed', N'GS', N'08:29', N'19:33', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (928, 30, N'2026-10', N'0009', N'2026-10-29', 29, N'Thu', N'GS', N'08:28', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (929, 30, N'2026-10', N'0009', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (930, 30, N'2026-10', N'0009', N'2026-10-31', 31, N'Sat', N'GS', N'08:26', N'19:32', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (931, 31, N'2026-10', N'0011', N'2026-10-01', 1, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (932, 31, N'2026-10', N'0011', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (933, 31, N'2026-10', N'0011', N'2026-10-03', 3, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (934, 31, N'2026-10', N'0011', N'2026-10-04', 4, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (935, 31, N'2026-10', N'0011', N'2026-10-05', 5, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (936, 31, N'2026-10', N'0011', N'2026-10-06', 6, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (937, 31, N'2026-10', N'0011', N'2026-10-07', 7, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (938, 31, N'2026-10', N'0011', N'2026-10-08', 8, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (939, 31, N'2026-10', N'0011', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (940, 31, N'2026-10', N'0011', N'2026-10-10', 10, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (941, 31, N'2026-10', N'0011', N'2026-10-11', 11, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (942, 31, N'2026-10', N'0011', N'2026-10-12', 12, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (943, 31, N'2026-10', N'0011', N'2026-10-13', 13, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (944, 31, N'2026-10', N'0011', N'2026-10-14', 14, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (945, 31, N'2026-10', N'0011', N'2026-10-15', 15, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (946, 31, N'2026-10', N'0011', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (947, 31, N'2026-10', N'0011', N'2026-10-17', 17, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (948, 31, N'2026-10', N'0011', N'2026-10-18', 18, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (949, 31, N'2026-10', N'0011', N'2026-10-19', 19, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (950, 31, N'2026-10', N'0011', N'2026-10-20', 20, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (951, 31, N'2026-10', N'0011', N'2026-10-21', 21, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (952, 31, N'2026-10', N'0011', N'2026-10-22', 22, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (953, 31, N'2026-10', N'0011', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (954, 31, N'2026-10', N'0011', N'2026-10-24', 24, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (955, 31, N'2026-10', N'0011', N'2026-10-25', 25, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (956, 31, N'2026-10', N'0011', N'2026-10-26', 26, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (957, 31, N'2026-10', N'0011', N'2026-10-27', 27, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (958, 31, N'2026-10', N'0011', N'2026-10-28', 28, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (959, 31, N'2026-10', N'0011', N'2026-10-29', 29, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (960, 31, N'2026-10', N'0011', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (961, 31, N'2026-10', N'0011', N'2026-10-31', 31, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (962, 32, N'2026-10', N'0012', N'2026-10-01', 1, N'Thu', N'GS', N'12:15', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (963, 32, N'2026-10', N'0012', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO');
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (964, 32, N'2026-10', N'0012', N'2026-10-03', 3, N'Sat', N'GS', N'08:10', N'19:02', N'10:22', 10.37, N'00:30', 9.87, 0, N'PR', N'AB', N'HD'),
    (965, 32, N'2026-10', N'0012', N'2026-10-04', 4, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (966, 32, N'2026-10', N'0012', N'2026-10-05', 5, N'Mon', N'GS', N'08:37', N'19:38', N'10:31', 10.52, N'00:30', 10.02, 0, N'PR', N'PR', N'P'),
    (967, 32, N'2026-10', N'0012', N'2026-10-06', 6, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (968, 32, N'2026-10', N'0012', N'2026-10-07', 7, N'Wed', N'GS', N'08:24', N'19:41', N'10:47', 10.78, N'00:30', 10.28, 0, N'PR', N'PR', N'P'),
    (969, 32, N'2026-10', N'0012', N'2026-10-08', 8, N'Thu', N'GS', N'14:10', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (970, 32, N'2026-10', N'0012', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (971, 32, N'2026-10', N'0012', N'2026-10-10', 10, N'Sat', N'GS', N'08:30', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (972, 32, N'2026-10', N'0012', N'2026-10-11', 11, N'Sun', N'GS', N'08:30', N'14:13', N'05:13', 5.22, N'00:30', 4.72, 0, N'PR', N'AB', N'HD'),
    (973, 32, N'2026-10', N'0012', N'2026-10-12', 12, N'Mon', N'GS', N'08:33', N'19:41', N'10:38', 10.63, N'00:30', 10.13, 0, N'PR', N'PR', N'P'),
    (974, 32, N'2026-10', N'0012', N'2026-10-13', 13, N'Tue', N'GS', N'09:10', N'18:08', N'08:28', 8.47, N'00:30', 7.97, 0, N'PR', N'AB', N'HD'),
    (975, 32, N'2026-10', N'0012', N'2026-10-14', 14, N'Wed', N'GS', N'09:09', N'19:17', N'09:38', 9.63, N'00:30', 9.13, 0, N'PR', N'AB', N'HD'),
    (976, 32, N'2026-10', N'0012', N'2026-10-15', 15, N'Thu', N'GS', N'08:29', N'19:40', N'10:41', 10.68, N'00:30', 10.18, 0, N'PR', N'PR', N'P'),
    (977, 32, N'2026-10', N'0012', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (978, 32, N'2026-10', N'0012', N'2026-10-17', 17, N'Sat', N'GS', N'08:27', N'19:41', N'10:44', 10.73, N'00:30', 10.23, 0, N'PR', N'PR', N'P'),
    (979, 32, N'2026-10', N'0012', N'2026-10-18', 18, N'Sun', N'GS', N'08:46', N'19:38', N'10:22', 10.37, N'00:30', 9.87, 0, N'PR', N'PR', N'P'),
    (980, 32, N'2026-10', N'0012', N'2026-10-19', 19, N'Mon', N'GS', N'08:25', N'19:36', N'10:41', 10.68, N'00:30', 10.18, 0, N'PR', N'PR', N'P'),
    (981, 32, N'2026-10', N'0012', N'2026-10-20', 20, N'Tue', N'GS', N'08:43', N'17:15', N'08:02', 8.03, N'00:30', 7.53, 0, N'PR', N'AB', N'HD'),
    (982, 32, N'2026-10', N'0012', N'2026-10-21', 21, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (983, 32, N'2026-10', N'0012', N'2026-10-22', 22, N'Thu', N'GS', N'08:46', N'19:38', N'10:22', 10.37, N'00:30', 9.87, 0, N'PR', N'PR', N'P'),
    (984, 32, N'2026-10', N'0012', N'2026-10-23', 23, N'Fri', N'GS', N'08:17', NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (985, 32, N'2026-10', N'0012', N'2026-10-24', 24, N'Sat', N'GS', N'08:28', N'19:37', N'10:39', 10.65, N'00:30', 10.15, 0, N'PR', N'PR', N'P'),
    (986, 32, N'2026-10', N'0012', N'2026-10-25', 25, N'Sun', N'GS', N'08:06', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (987, 32, N'2026-10', N'0012', N'2026-10-26', 26, N'Mon', N'GS', N'08:10', N'18:06', N'09:26', 9.43, N'00:30', 8.93, 0, N'PR', N'AB', N'HD'),
    (988, 32, N'2026-10', N'0012', N'2026-10-27', 27, N'Tue', N'GS', N'08:10', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (989, 32, N'2026-10', N'0012', N'2026-10-28', 28, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (990, 32, N'2026-10', N'0012', N'2026-10-29', 29, N'Thu', N'GS', N'08:10', N'19:38', N'10:58', 10.97, N'00:30', 10.47, 0, N'PR', N'PR', N'P'),
    (991, 32, N'2026-10', N'0012', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (992, 32, N'2026-10', N'0012', N'2026-10-31', 31, N'Sat', N'GS', N'08:21', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (993, 33, N'2026-10', N'0014', N'2026-10-01', 1, N'Thu', N'GS', N'08:25', N'19:31', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (994, 33, N'2026-10', N'0014', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (995, 33, N'2026-10', N'0014', N'2026-10-03', 3, N'Sat', N'GS', N'08:27', N'19:02', N'10:05', 10.08, N'00:30', 9.58, 0, N'PR', N'AB', N'HD'),
    (996, 33, N'2026-10', N'0014', N'2026-10-04', 4, N'Sun', N'GS', N'08:28', N'19:32', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (997, 33, N'2026-10', N'0014', N'2026-10-05', 5, N'Mon', N'GS', N'08:26', N'19:31', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (998, 33, N'2026-10', N'0014', N'2026-10-06', 6, N'Tue', N'GS', N'08:27', N'19:31', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (999, 33, N'2026-10', N'0014', N'2026-10-07', 7, N'Wed', N'GS', N'08:28', N'19:31', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1000, 33, N'2026-10', N'0014', N'2026-10-08', 8, N'Thu', N'GS', N'08:28', N'19:31', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1001, 33, N'2026-10', N'0014', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1002, 33, N'2026-10', N'0014', N'2026-10-10', 10, N'Sat', N'GS', N'08:28', N'19:32', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1003, 33, N'2026-10', N'0014', N'2026-10-11', 11, N'Sun', N'GS', N'08:28', N'19:31', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1004, 33, N'2026-10', N'0014', N'2026-10-12', 12, N'Mon', N'GS', N'08:29', N'19:32', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1005, 33, N'2026-10', N'0014', N'2026-10-13', 13, N'Tue', N'GS', N'08:28', N'19:32', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1006, 33, N'2026-10', N'0014', N'2026-10-14', 14, N'Wed', N'GS', N'08:29', N'19:32', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1007, 33, N'2026-10', N'0014', N'2026-10-15', 15, N'Thu', N'GS', N'08:28', N'19:31', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1008, 33, N'2026-10', N'0014', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1009, 33, N'2026-10', N'0014', N'2026-10-17', 17, N'Sat', N'GS', N'08:28', N'19:31', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1010, 33, N'2026-10', N'0014', N'2026-10-18', 18, N'Sun', N'GS', N'08:30', N'19:31', N'10:31', 10.52, N'00:30', 10.02, 0, N'PR', N'PR', N'P'),
    (1011, 33, N'2026-10', N'0014', N'2026-10-19', 19, N'Mon', N'GS', N'08:26', N'19:31', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1012, 33, N'2026-10', N'0014', N'2026-10-20', 20, N'Tue', N'GS', N'08:27', N'17:02', N'08:05', 8.08, N'00:30', 7.58, 0, N'PR', N'AB', N'HD'),
    (1013, 33, N'2026-10', N'0014', N'2026-10-21', 21, N'Wed', N'GS', N'08:27', N'19:32', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P');
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (1014, 33, N'2026-10', N'0014', N'2026-10-22', 22, N'Thu', N'GS', N'08:27', N'19:32', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1015, 33, N'2026-10', N'0014', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1016, 33, N'2026-10', N'0014', N'2026-10-24', 24, N'Sat', N'GS', N'08:27', N'19:31', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1017, 33, N'2026-10', N'0014', N'2026-10-25', 25, N'Sun', N'GS', N'08:26', N'19:31', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1018, 33, N'2026-10', N'0014', N'2026-10-26', 26, N'Mon', N'GS', N'08:27', N'19:31', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1019, 33, N'2026-10', N'0014', N'2026-10-27', 27, N'Tue', N'GS', N'08:26', N'19:31', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1020, 33, N'2026-10', N'0014', N'2026-10-28', 28, N'Wed', N'GS', N'08:26', N'19:31', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1021, 33, N'2026-10', N'0014', N'2026-10-29', 29, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1022, 33, N'2026-10', N'0014', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1023, 33, N'2026-10', N'0014', N'2026-10-31', 31, N'Sat', N'GS', N'08:25', N'19:29', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'AB', N'HD'),
    (1024, 34, N'2026-10', N'0015', N'2026-10-01', 1, N'Thu', N'GS', N'08:25', N'19:31', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (1025, 34, N'2026-10', N'0015', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1026, 34, N'2026-10', N'0015', N'2026-10-03', 3, N'Sat', N'GS', N'08:27', N'19:02', N'10:05', 10.08, N'00:30', 9.58, 0, N'PR', N'AB', N'HD'),
    (1027, 34, N'2026-10', N'0015', N'2026-10-04', 4, N'Sun', N'GS', N'08:28', N'19:32', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1028, 34, N'2026-10', N'0015', N'2026-10-05', 5, N'Mon', N'GS', N'08:26', N'19:31', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1029, 34, N'2026-10', N'0015', N'2026-10-06', 6, N'Tue', N'GS', N'08:27', N'19:32', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1030, 34, N'2026-10', N'0015', N'2026-10-07', 7, N'Wed', N'GS', N'08:28', N'19:32', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1031, 34, N'2026-10', N'0015', N'2026-10-08', 8, N'Thu', N'GS', N'08:28', N'19:32', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1032, 34, N'2026-10', N'0015', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1033, 34, N'2026-10', N'0015', N'2026-10-10', 10, N'Sat', N'GS', N'08:28', N'19:32', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1034, 34, N'2026-10', N'0015', N'2026-10-11', 11, N'Sun', N'GS', N'08:28', N'19:31', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1035, 34, N'2026-10', N'0015', N'2026-10-12', 12, N'Mon', N'GS', N'08:29', N'19:32', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1036, 34, N'2026-10', N'0015', N'2026-10-13', 13, N'Tue', N'GS', N'08:28', N'19:32', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1037, 34, N'2026-10', N'0015', N'2026-10-14', 14, N'Wed', N'GS', N'08:29', N'19:32', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1038, 34, N'2026-10', N'0015', N'2026-10-15', 15, N'Thu', N'GS', N'08:28', N'19:31', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1039, 34, N'2026-10', N'0015', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1040, 34, N'2026-10', N'0015', N'2026-10-17', 17, N'Sat', N'GS', N'08:28', N'19:31', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1041, 34, N'2026-10', N'0015', N'2026-10-18', 18, N'Sun', N'GS', N'08:30', N'19:31', N'10:31', 10.52, N'00:30', 10.02, 0, N'PR', N'PR', N'P'),
    (1042, 34, N'2026-10', N'0015', N'2026-10-19', 19, N'Mon', N'GS', N'08:26', N'19:31', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1043, 34, N'2026-10', N'0015', N'2026-10-20', 20, N'Tue', N'GS', N'08:27', N'17:02', N'08:05', 8.08, N'00:30', 7.58, 0, N'PR', N'AB', N'HD'),
    (1044, 34, N'2026-10', N'0015', N'2026-10-21', 21, N'Wed', N'GS', N'08:27', N'19:32', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1045, 34, N'2026-10', N'0015', N'2026-10-22', 22, N'Thu', N'GS', N'08:27', N'19:32', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1046, 34, N'2026-10', N'0015', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1047, 34, N'2026-10', N'0015', N'2026-10-24', 24, N'Sat', N'GS', N'08:27', N'19:31', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1048, 34, N'2026-10', N'0015', N'2026-10-25', 25, N'Sun', N'GS', N'08:26', N'19:31', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1049, 34, N'2026-10', N'0015', N'2026-10-26', 26, N'Mon', N'GS', N'08:27', N'19:30', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1050, 34, N'2026-10', N'0015', N'2026-10-27', 27, N'Tue', N'GS', N'08:26', N'19:30', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1051, 34, N'2026-10', N'0015', N'2026-10-28', 28, N'Wed', N'GS', N'08:26', N'19:31', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1052, 34, N'2026-10', N'0015', N'2026-10-29', 29, N'Thu', N'GS', N'08:26', N'19:30', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1053, 34, N'2026-10', N'0015', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1054, 34, N'2026-10', N'0015', N'2026-10-31', 31, N'Sat', N'GS', N'08:25', N'19:29', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'AB', N'HD'),
    (1055, 35, N'2026-10', N'0016', N'2026-10-01', 1, N'Thu', N'GS', N'08:28', N'19:01', N'10:03', 10.05, N'00:30', 9.55, 0, N'PR', N'AB', N'HD'),
    (1056, 35, N'2026-10', N'0016', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1057, 35, N'2026-10', N'0016', N'2026-10-03', 3, N'Sat', N'GS', N'08:30', N'19:02', N'10:02', 10.03, N'00:30', 9.53, 0, N'PR', N'AB', N'HD'),
    (1058, 35, N'2026-10', N'0016', N'2026-10-04', 4, N'Sun', N'GS', N'08:29', N'19:02', N'10:03', 10.05, N'00:30', 9.55, 0, N'PR', N'AB', N'HD'),
    (1059, 35, N'2026-10', N'0016', N'2026-10-05', 5, N'Mon', N'GS', N'08:28', N'19:01', N'10:03', 10.05, N'00:30', 9.55, 0, N'PR', N'AB', N'HD'),
    (1060, 35, N'2026-10', N'0016', N'2026-10-06', 6, N'Tue', N'GS', N'08:28', N'17:02', N'08:04', 8.07, N'00:30', 7.57, 0, N'PR', N'AB', N'HD'),
    (1061, 35, N'2026-10', N'0016', N'2026-10-07', 7, N'Wed', N'GS', N'08:29', N'19:02', N'10:03', 10.05, N'00:30', 9.55, 0, N'PR', N'AB', N'HD'),
    (1062, 35, N'2026-10', N'0016', N'2026-10-08', 8, N'Thu', N'GS', N'08:28', N'19:01', N'10:03', 10.05, N'00:30', 9.55, 0, N'PR', N'AB', N'HD'),
    (1063, 35, N'2026-10', N'0016', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO');
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (1064, 35, N'2026-10', N'0016', N'2026-10-10', 10, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1065, 35, N'2026-10', N'0016', N'2026-10-11', 11, N'Sun', N'GS', N'08:31', N'19:01', N'10:00', 10, N'00:30', 9.5, 0, N'PR', N'AB', N'HD'),
    (1066, 35, N'2026-10', N'0016', N'2026-10-12', 12, N'Mon', N'GS', N'08:29', N'19:02', N'10:03', 10.05, N'00:30', 9.55, 0, N'PR', N'AB', N'HD'),
    (1067, 35, N'2026-10', N'0016', N'2026-10-13', 13, N'Tue', N'GS', N'08:28', N'17:03', N'08:05', 8.08, N'00:30', 7.58, 0, N'PR', N'AB', N'HD'),
    (1068, 35, N'2026-10', N'0016', N'2026-10-14', 14, N'Wed', N'GS', N'08:29', N'19:04', N'10:05', 10.08, N'00:30', 9.58, 0, N'PR', N'AB', N'HD'),
    (1069, 35, N'2026-10', N'0016', N'2026-10-15', 15, N'Thu', N'GS', N'08:29', N'19:02', N'10:03', 10.05, N'00:30', 9.55, 0, N'PR', N'AB', N'HD'),
    (1070, 35, N'2026-10', N'0016', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1071, 35, N'2026-10', N'0016', N'2026-10-17', 17, N'Sat', N'GS', N'08:29', N'19:01', N'10:02', 10.03, N'00:30', 9.53, 0, N'PR', N'AB', N'HD'),
    (1072, 35, N'2026-10', N'0016', N'2026-10-18', 18, N'Sun', N'GS', N'08:29', N'19:02', N'10:03', 10.05, N'00:30', 9.55, 0, N'PR', N'AB', N'HD'),
    (1073, 35, N'2026-10', N'0016', N'2026-10-19', 19, N'Mon', N'GS', N'08:28', N'19:02', N'10:04', 10.07, N'00:30', 9.57, 0, N'PR', N'AB', N'HD'),
    (1074, 35, N'2026-10', N'0016', N'2026-10-20', 20, N'Tue', N'GS', N'08:28', N'17:02', N'08:04', 8.07, N'00:30', 7.57, 0, N'PR', N'AB', N'HD'),
    (1075, 35, N'2026-10', N'0016', N'2026-10-21', 21, N'Wed', N'GS', N'08:29', N'19:01', N'10:02', 10.03, N'00:30', 9.53, 0, N'PR', N'AB', N'HD'),
    (1076, 35, N'2026-10', N'0016', N'2026-10-22', 22, N'Thu', N'GS', N'08:27', N'19:00', N'10:03', 10.05, N'00:30', 9.55, 0, N'PR', N'AB', N'HD'),
    (1077, 35, N'2026-10', N'0016', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1078, 35, N'2026-10', N'0016', N'2026-10-24', 24, N'Sat', N'GS', N'08:28', N'19:00', N'10:02', 10.03, N'00:30', 9.53, 0, N'PR', N'AB', N'HD'),
    (1079, 35, N'2026-10', N'0016', N'2026-10-25', 25, N'Sun', N'GS', N'08:28', N'19:01', N'10:03', 10.05, N'00:30', 9.55, 0, N'PR', N'AB', N'HD'),
    (1080, 35, N'2026-10', N'0016', N'2026-10-26', 26, N'Mon', N'GS', N'08:28', N'19:01', N'10:03', 10.05, N'00:30', 9.55, 0, N'PR', N'AB', N'HD'),
    (1081, 35, N'2026-10', N'0016', N'2026-10-27', 27, N'Tue', N'GS', N'08:28', N'19:00', N'10:02', 10.03, N'00:30', 9.53, 0, N'PR', N'AB', N'HD'),
    (1082, 35, N'2026-10', N'0016', N'2026-10-28', 28, N'Wed', N'GS', N'08:28', N'18:59', N'10:01', 10.02, N'00:30', 9.52, 0, N'PR', N'AB', N'HD'),
    (1083, 35, N'2026-10', N'0016', N'2026-10-29', 29, N'Thu', N'GS', N'08:28', N'19:00', N'10:02', 10.03, N'00:30', 9.53, 0, N'PR', N'AB', N'HD'),
    (1084, 35, N'2026-10', N'0016', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1085, 35, N'2026-10', N'0016', N'2026-10-31', 31, N'Sat', N'GS', N'08:28', N'18:59', N'10:01', 10.02, N'00:30', 9.52, 0, N'PR', N'AB', N'HD'),
    (1086, 36, N'2026-10', N'0019', N'2026-10-01', 1, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1087, 36, N'2026-10', N'0019', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1088, 36, N'2026-10', N'0019', N'2026-10-03', 3, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1089, 36, N'2026-10', N'0019', N'2026-10-04', 4, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1090, 36, N'2026-10', N'0019', N'2026-10-05', 5, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1091, 36, N'2026-10', N'0019', N'2026-10-06', 6, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1092, 36, N'2026-10', N'0019', N'2026-10-07', 7, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1093, 36, N'2026-10', N'0019', N'2026-10-08', 8, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1094, 36, N'2026-10', N'0019', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1095, 36, N'2026-10', N'0019', N'2026-10-10', 10, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1096, 36, N'2026-10', N'0019', N'2026-10-11', 11, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1097, 36, N'2026-10', N'0019', N'2026-10-12', 12, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1098, 36, N'2026-10', N'0019', N'2026-10-13', 13, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1099, 36, N'2026-10', N'0019', N'2026-10-14', 14, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1100, 36, N'2026-10', N'0019', N'2026-10-15', 15, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1101, 36, N'2026-10', N'0019', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1102, 36, N'2026-10', N'0019', N'2026-10-17', 17, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1103, 36, N'2026-10', N'0019', N'2026-10-18', 18, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1104, 36, N'2026-10', N'0019', N'2026-10-19', 19, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1105, 36, N'2026-10', N'0019', N'2026-10-20', 20, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1106, 36, N'2026-10', N'0019', N'2026-10-21', 21, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1107, 36, N'2026-10', N'0019', N'2026-10-22', 22, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1108, 36, N'2026-10', N'0019', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1109, 36, N'2026-10', N'0019', N'2026-10-24', 24, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1110, 36, N'2026-10', N'0019', N'2026-10-25', 25, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1111, 36, N'2026-10', N'0019', N'2026-10-26', 26, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1112, 36, N'2026-10', N'0019', N'2026-10-27', 27, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1113, 36, N'2026-10', N'0019', N'2026-10-28', 28, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A');
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (1114, 36, N'2026-10', N'0019', N'2026-10-29', 29, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1115, 36, N'2026-10', N'0019', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1116, 36, N'2026-10', N'0019', N'2026-10-31', 31, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1117, 37, N'2026-10', N'0023', N'2026-10-01', 1, N'Thu', N'GS', N'08:34', N'19:37', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1118, 37, N'2026-10', N'0023', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1119, 37, N'2026-10', N'0023', N'2026-10-03', 3, N'Sat', N'GS', N'08:33', N'19:35', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (1120, 37, N'2026-10', N'0023', N'2026-10-04', 4, N'Sun', N'GS', N'08:28', N'19:33', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1121, 37, N'2026-10', N'0023', N'2026-10-05', 5, N'Mon', N'GS', N'08:30', N'19:34', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1122, 37, N'2026-10', N'0023', N'2026-10-06', 6, N'Tue', N'GS', N'08:31', N'19:36', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1123, 37, N'2026-10', N'0023', N'2026-10-07', 7, N'Wed', N'GS', N'08:32', N'19:33', N'10:31', 10.52, N'00:30', 10.02, 0, N'PR', N'PR', N'P'),
    (1124, 37, N'2026-10', N'0023', N'2026-10-08', 8, N'Thu', N'GS', N'08:43', N'19:34', N'10:21', 10.35, N'00:30', 9.85, 0, N'PR', N'PR', N'P'),
    (1125, 37, N'2026-10', N'0023', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1126, 37, N'2026-10', N'0023', N'2026-10-10', 10, N'Sat', N'GS', N'08:32', N'19:36', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1127, 37, N'2026-10', N'0023', N'2026-10-11', 11, N'Sun', N'GS', N'08:32', N'19:36', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1128, 37, N'2026-10', N'0023', N'2026-10-12', 12, N'Mon', N'GS', N'08:33', N'19:35', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (1129, 37, N'2026-10', N'0023', N'2026-10-13', 13, N'Tue', N'GS', N'08:30', N'19:34', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1130, 37, N'2026-10', N'0023', N'2026-10-14', 14, N'Wed', N'GS', N'08:33', N'19:35', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (1131, 37, N'2026-10', N'0023', N'2026-10-15', 15, N'Thu', N'GS', N'08:30', N'19:35', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1132, 37, N'2026-10', N'0023', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1133, 37, N'2026-10', N'0023', N'2026-10-17', 17, N'Sat', N'GS', N'08:34', N'19:38', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1134, 37, N'2026-10', N'0023', N'2026-10-18', 18, N'Sun', N'GS', N'08:32', N'19:32', N'10:30', 10.5, N'00:30', 10, 0, N'PR', N'PR', N'P'),
    (1135, 37, N'2026-10', N'0023', N'2026-10-19', 19, N'Mon', N'GS', N'08:33', N'19:33', N'10:30', 10.5, N'00:30', 10, 0, N'PR', N'PR', N'P'),
    (1136, 37, N'2026-10', N'0023', N'2026-10-20', 20, N'Tue', N'GS', N'08:39', N'17:06', N'07:57', 7.95, N'00:30', 7.45, 0, N'PR', N'AB', N'HD'),
    (1137, 37, N'2026-10', N'0023', N'2026-10-21', 21, N'Wed', N'GS', N'08:34', N'19:33', N'10:29', 10.48, N'00:30', 9.98, 0, N'PR', N'PR', N'P'),
    (1138, 37, N'2026-10', N'0023', N'2026-10-22', 22, N'Thu', N'GS', N'08:30', N'19:33', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1139, 37, N'2026-10', N'0023', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1140, 37, N'2026-10', N'0023', N'2026-10-24', 24, N'Sat', N'GS', N'08:30', N'19:32', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (1141, 37, N'2026-10', N'0023', N'2026-10-25', 25, N'Sun', N'GS', N'08:34', N'19:31', N'10:27', 10.45, N'00:30', 9.95, 0, N'PR', N'PR', N'P'),
    (1142, 37, N'2026-10', N'0023', N'2026-10-26', 26, N'Mon', N'GS', N'08:35', N'19:31', N'10:26', 10.43, N'00:30', 9.93, 0, N'PR', N'PR', N'P'),
    (1143, 37, N'2026-10', N'0023', N'2026-10-27', 27, N'Tue', N'GS', N'08:40', N'19:33', N'10:23', 10.38, N'00:30', 9.88, 0, N'PR', N'PR', N'P'),
    (1144, 37, N'2026-10', N'0023', N'2026-10-28', 28, N'Wed', N'GS', N'08:37', N'19:32', N'10:25', 10.42, N'00:30', 9.92, 0, N'PR', N'PR', N'P'),
    (1145, 37, N'2026-10', N'0023', N'2026-10-29', 29, N'Thu', N'GS', N'08:36', N'17:30', N'08:24', 8.4, N'00:30', 7.9, 0, N'PR', N'AB', N'HD'),
    (1146, 37, N'2026-10', N'0023', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1147, 37, N'2026-10', N'0023', N'2026-10-31', 31, N'Sat', N'GS', N'08:44', N'19:33', N'10:19', 10.32, N'00:30', 9.82, 0, N'PR', N'PR', N'P'),
    (1148, 38, N'2026-10', N'0024', N'2026-10-01', 1, N'Thu', N'GS', N'19:33', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (1149, 38, N'2026-10', N'0024', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1150, 38, N'2026-10', N'0024', N'2026-10-03', 3, N'Sat', N'GS', N'08:33', N'19:34', N'10:31', 10.52, N'00:30', 10.02, 0, N'PR', N'PR', N'P'),
    (1151, 38, N'2026-10', N'0024', N'2026-10-04', 4, N'Sun', N'GS', N'08:28', N'19:40', N'10:42', 10.7, N'00:30', 10.2, 0, N'PR', N'PR', N'P'),
    (1152, 38, N'2026-10', N'0024', N'2026-10-05', 5, N'Mon', N'GS', N'08:30', N'19:33', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1153, 38, N'2026-10', N'0024', N'2026-10-06', 6, N'Tue', N'GS', N'08:54', N'19:33', N'10:09', 10.15, N'00:30', 9.65, 0, N'PR', N'PR', N'P'),
    (1154, 38, N'2026-10', N'0024', N'2026-10-07', 7, N'Wed', N'GS', N'08:32', N'19:33', N'10:31', 10.52, N'00:30', 10.02, 0, N'PR', N'PR', N'P'),
    (1155, 38, N'2026-10', N'0024', N'2026-10-08', 8, N'Thu', N'GS', N'08:43', N'19:32', N'10:19', 10.32, N'00:30', 9.82, 0, N'PR', N'PR', N'P'),
    (1156, 38, N'2026-10', N'0024', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1157, 38, N'2026-10', N'0024', N'2026-10-10', 10, N'Sat', N'GS', N'08:32', N'19:32', N'10:30', 10.5, N'00:30', 10, 0, N'PR', N'PR', N'P'),
    (1158, 38, N'2026-10', N'0024', N'2026-10-11', 11, N'Sun', N'GS', N'08:32', N'19:33', N'10:31', 10.52, N'00:30', 10.02, 0, N'PR', N'PR', N'P'),
    (1159, 38, N'2026-10', N'0024', N'2026-10-12', 12, N'Mon', N'GS', N'08:33', N'19:35', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (1160, 38, N'2026-10', N'0024', N'2026-10-13', 13, N'Tue', N'GS', N'08:30', N'19:34', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1161, 38, N'2026-10', N'0024', N'2026-10-14', 14, N'Wed', N'GS', N'08:33', N'19:33', N'10:30', 10.5, N'00:30', 10, 0, N'PR', N'PR', N'P'),
    (1162, 38, N'2026-10', N'0024', N'2026-10-15', 15, N'Thu', N'GS', N'08:30', N'19:34', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1163, 38, N'2026-10', N'0024', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO');
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (1164, 38, N'2026-10', N'0024', N'2026-10-17', 17, N'Sat', N'GS', N'08:34', N'19:38', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1165, 38, N'2026-10', N'0024', N'2026-10-18', 18, N'Sun', N'GS', N'08:32', N'19:32', N'10:30', 10.5, N'00:30', 10, 0, N'PR', N'PR', N'P'),
    (1166, 38, N'2026-10', N'0024', N'2026-10-19', 19, N'Mon', N'GS', N'08:33', N'19:36', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1167, 38, N'2026-10', N'0024', N'2026-10-20', 20, N'Tue', N'GS', N'08:39', N'17:02', N'07:53', 7.88, N'00:30', 7.38, 0, N'PR', N'AB', N'HD'),
    (1168, 38, N'2026-10', N'0024', N'2026-10-21', 21, N'Wed', N'GS', N'08:34', N'19:32', N'10:28', 10.47, N'00:30', 9.97, 0, N'PR', N'PR', N'P'),
    (1169, 38, N'2026-10', N'0024', N'2026-10-22', 22, N'Thu', N'GS', N'08:30', N'19:33', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1170, 38, N'2026-10', N'0024', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1171, 38, N'2026-10', N'0024', N'2026-10-24', 24, N'Sat', N'GS', N'08:30', N'19:31', N'10:31', 10.52, N'00:30', 10.02, 0, N'PR', N'PR', N'P'),
    (1172, 38, N'2026-10', N'0024', N'2026-10-25', 25, N'Sun', N'GS', N'08:34', N'19:31', N'10:27', 10.45, N'00:30', 9.95, 0, N'PR', N'PR', N'P'),
    (1173, 38, N'2026-10', N'0024', N'2026-10-26', 26, N'Mon', N'GS', N'08:35', N'19:32', N'10:27', 10.45, N'00:30', 9.95, 0, N'PR', N'PR', N'P'),
    (1174, 38, N'2026-10', N'0024', N'2026-10-27', 27, N'Tue', N'GS', N'08:32', N'19:30', N'10:28', 10.47, N'00:30', 9.97, 0, N'PR', N'PR', N'P'),
    (1175, 38, N'2026-10', N'0024', N'2026-10-28', 28, N'Wed', N'GS', N'08:32', N'19:32', N'10:30', 10.5, N'00:30', 10, 0, N'PR', N'PR', N'P'),
    (1176, 38, N'2026-10', N'0024', N'2026-10-29', 29, N'Thu', N'GS', N'08:36', N'17:31', N'08:25', 8.42, N'00:30', 7.92, 0, N'PR', N'AB', N'HD'),
    (1177, 38, N'2026-10', N'0024', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1178, 38, N'2026-10', N'0024', N'2026-10-31', 31, N'Sat', N'GS', N'08:30', N'19:30', N'10:30', 10.5, N'00:30', 10, 0, N'PR', N'PR', N'P'),
    (1179, 39, N'2026-10', N'0026', N'2026-10-01', 1, N'Thu', N'GS', N'08:29', N'19:41', N'10:42', 10.7, N'00:30', 10.2, 0, N'PR', N'PR', N'P'),
    (1180, 39, N'2026-10', N'0026', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1181, 39, N'2026-10', N'0026', N'2026-10-03', 3, N'Sat', N'GS', N'08:39', N'19:40', N'10:31', 10.52, N'00:30', 10.02, 0, N'PR', N'PR', N'P'),
    (1182, 39, N'2026-10', N'0026', N'2026-10-04', 4, N'Sun', N'GS', N'08:29', N'19:39', N'10:40', 10.67, N'00:30', 10.17, 0, N'PR', N'PR', N'P'),
    (1183, 39, N'2026-10', N'0026', N'2026-10-05', 5, N'Mon', N'GS', N'08:29', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (1184, 39, N'2026-10', N'0026', N'2026-10-06', 6, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1185, 39, N'2026-10', N'0026', N'2026-10-07', 7, N'Wed', N'GS', N'08:42', N'19:44', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (1186, 39, N'2026-10', N'0026', N'2026-10-08', 8, N'Thu', N'GS', N'08:54', N'19:04', N'09:40', 9.67, N'00:30', 9.17, 0, N'PR', N'AB', N'HD'),
    (1187, 39, N'2026-10', N'0026', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1188, 39, N'2026-10', N'0026', N'2026-10-10', 10, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1189, 39, N'2026-10', N'0026', N'2026-10-11', 11, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1190, 39, N'2026-10', N'0026', N'2026-10-12', 12, N'Mon', N'GS', N'09:17', N'19:41', N'09:54', 9.9, N'00:30', 9.4, 0, N'AB', N'PR', N'HD'),
    (1191, 39, N'2026-10', N'0026', N'2026-10-13', 13, N'Tue', N'GS', N'08:36', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (1192, 39, N'2026-10', N'0026', N'2026-10-14', 14, N'Wed', N'GS', N'08:28', N'19:40', N'10:42', 10.7, N'00:30', 10.2, 0, N'PR', N'PR', N'P'),
    (1193, 39, N'2026-10', N'0026', N'2026-10-15', 15, N'Thu', N'GS', N'08:27', N'19:41', N'10:44', 10.73, N'00:30', 10.23, 0, N'PR', N'PR', N'P'),
    (1194, 39, N'2026-10', N'0026', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1195, 39, N'2026-10', N'0026', N'2026-10-17', 17, N'Sat', N'GS', N'08:27', N'19:40', N'10:43', 10.72, N'00:30', 10.22, 0, N'PR', N'PR', N'P'),
    (1196, 39, N'2026-10', N'0026', N'2026-10-18', 18, N'Sun', N'GS', N'08:28', N'19:38', N'10:40', 10.67, N'00:30', 10.17, 0, N'PR', N'PR', N'P'),
    (1197, 39, N'2026-10', N'0026', N'2026-10-19', 19, N'Mon', N'GS', N'08:28', N'19:38', N'10:40', 10.67, N'00:30', 10.17, 0, N'PR', N'PR', N'P'),
    (1198, 39, N'2026-10', N'0026', N'2026-10-20', 20, N'Tue', N'GS', N'08:26', N'17:14', N'08:18', 8.3, N'00:30', 7.8, 0, N'PR', N'AB', N'HD'),
    (1199, 39, N'2026-10', N'0026', N'2026-10-21', 21, N'Wed', N'GS', N'08:28', N'19:37', N'10:39', 10.65, N'00:30', 10.15, 0, N'PR', N'PR', N'P'),
    (1200, 39, N'2026-10', N'0026', N'2026-10-22', 22, N'Thu', N'GS', N'08:27', N'19:39', N'10:42', 10.7, N'00:30', 10.2, 0, N'PR', N'PR', N'P'),
    (1201, 39, N'2026-10', N'0026', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1202, 39, N'2026-10', N'0026', N'2026-10-24', 24, N'Sat', N'GS', N'08:34', N'19:37', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1203, 39, N'2026-10', N'0026', N'2026-10-25', 25, N'Sun', N'GS', N'08:32', N'18:22', N'09:20', 9.33, N'00:30', 8.83, 0, N'PR', N'AB', N'HD'),
    (1204, 39, N'2026-10', N'0026', N'2026-10-26', 26, N'Mon', N'GS', N'16:44', N'08:26', N'02:53', 2.88, N'00:30', 2.38, 0, N'AB', N'IN', N'HD'),
    (1205, 39, N'2026-10', N'0026', N'2026-10-27', 27, N'Tue', N'GS', N'19:35', N'08:29', N'12:54', 12.9, N'00:00', 12.9, 0, N'AB', N'AB', N'A'),
    (1206, 39, N'2026-10', N'0026', N'2026-10-28', 28, N'Wed', N'GS', N'19:37', N'08:23', N'12:46', 12.77, N'00:00', 12.77, 0, N'AB', N'AB', N'A'),
    (1207, 39, N'2026-10', N'0026', N'2026-10-29', 29, N'Thu', N'GS', N'19:51', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (1208, 39, N'2026-10', N'0026', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1209, 39, N'2026-10', N'0026', N'2026-10-31', 31, N'Sat', N'GS', N'08:26', N'19:37', N'10:41', 10.68, N'00:30', 10.18, 0, N'PR', N'PR', N'P'),
    (1210, 40, N'2026-10', N'022', N'2026-10-01', 1, N'Thu', N'GS', N'08:27', N'19:32', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1211, 40, N'2026-10', N'022', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1212, 40, N'2026-10', N'022', N'2026-10-03', 3, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1213, 40, N'2026-10', N'022', N'2026-10-04', 4, N'Sun', N'GS', N'08:30', N'19:31', N'10:31', 10.52, N'00:30', 10.02, 0, N'PR', N'PR', N'P');
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (1214, 40, N'2026-10', N'022', N'2026-10-05', 5, N'Mon', N'GS', N'08:32', N'19:32', N'10:30', 10.5, N'00:30', 10, 0, N'PR', N'PR', N'P'),
    (1215, 40, N'2026-10', N'022', N'2026-10-06', 6, N'Tue', N'GS', N'08:29', N'19:33', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1216, 40, N'2026-10', N'022', N'2026-10-07', 7, N'Wed', N'GS', N'08:29', N'19:02', N'10:03', 10.05, N'00:30', 9.55, 0, N'PR', N'AB', N'HD'),
    (1217, 40, N'2026-10', N'022', N'2026-10-08', 8, N'Thu', N'GS', N'08:29', N'19:33', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1218, 40, N'2026-10', N'022', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1219, 40, N'2026-10', N'022', N'2026-10-10', 10, N'Sat', N'GS', N'08:32', N'19:32', N'10:30', 10.5, N'00:30', 10, 0, N'PR', N'PR', N'P'),
    (1220, 40, N'2026-10', N'022', N'2026-10-11', 11, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1221, 40, N'2026-10', N'022', N'2026-10-12', 12, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1222, 40, N'2026-10', N'022', N'2026-10-13', 13, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1223, 40, N'2026-10', N'022', N'2026-10-14', 14, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1224, 40, N'2026-10', N'022', N'2026-10-15', 15, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1225, 40, N'2026-10', N'022', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1226, 40, N'2026-10', N'022', N'2026-10-17', 17, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1227, 40, N'2026-10', N'022', N'2026-10-18', 18, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1228, 40, N'2026-10', N'022', N'2026-10-19', 19, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1229, 40, N'2026-10', N'022', N'2026-10-20', 20, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1230, 40, N'2026-10', N'022', N'2026-10-21', 21, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1231, 40, N'2026-10', N'022', N'2026-10-22', 22, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1232, 40, N'2026-10', N'022', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1233, 40, N'2026-10', N'022', N'2026-10-24', 24, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1234, 40, N'2026-10', N'022', N'2026-10-25', 25, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1235, 40, N'2026-10', N'022', N'2026-10-26', 26, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1236, 40, N'2026-10', N'022', N'2026-10-27', 27, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1237, 40, N'2026-10', N'022', N'2026-10-28', 28, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1238, 40, N'2026-10', N'022', N'2026-10-29', 29, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1239, 40, N'2026-10', N'022', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1240, 40, N'2026-10', N'022', N'2026-10-31', 31, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1241, 41, N'2026-10', N'027', N'2026-10-01', 1, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1242, 41, N'2026-10', N'027', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1243, 41, N'2026-10', N'027', N'2026-10-03', 3, N'Sat', N'GS', N'08:30', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (1244, 41, N'2026-10', N'027', N'2026-10-04', 4, N'Sun', N'GS', N'08:31', N'19:39', N'10:38', 10.63, N'00:30', 10.13, 0, N'PR', N'PR', N'P'),
    (1245, 41, N'2026-10', N'027', N'2026-10-05', 5, N'Mon', N'GS', N'08:29', N'19:32', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1246, 41, N'2026-10', N'027', N'2026-10-06', 6, N'Tue', N'GS', N'08:27', N'19:02', N'10:05', 10.08, N'00:30', 9.58, 0, N'PR', N'AB', N'HD'),
    (1247, 41, N'2026-10', N'027', N'2026-10-07', 7, N'Wed', N'GS', N'08:32', N'19:34', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (1248, 41, N'2026-10', N'027', N'2026-10-08', 8, N'Thu', N'GS', N'08:28', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (1249, 41, N'2026-10', N'027', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1250, 41, N'2026-10', N'027', N'2026-10-10', 10, N'Sat', N'GS', N'08:31', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (1251, 41, N'2026-10', N'027', N'2026-10-11', 11, N'Sun', N'GS', N'08:33', N'19:33', N'10:30', 10.5, N'00:30', 10, 0, N'PR', N'PR', N'P'),
    (1252, 41, N'2026-10', N'027', N'2026-10-12', 12, N'Mon', N'GS', N'08:29', N'19:33', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1253, 41, N'2026-10', N'027', N'2026-10-13', 13, N'Tue', N'GS', N'08:29', N'19:33', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1254, 41, N'2026-10', N'027', N'2026-10-14', 14, N'Wed', N'GS', N'08:33', N'19:35', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (1255, 41, N'2026-10', N'027', N'2026-10-15', 15, N'Thu', N'GS', N'08:29', N'19:34', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1256, 41, N'2026-10', N'027', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1257, 41, N'2026-10', N'027', N'2026-10-17', 17, N'Sat', N'GS', N'08:34', N'19:38', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1258, 41, N'2026-10', N'027', N'2026-10-18', 18, N'Sun', N'GS', N'08:33', N'19:33', N'10:30', 10.5, N'00:30', 10, 0, N'PR', N'PR', N'P'),
    (1259, 41, N'2026-10', N'027', N'2026-10-19', 19, N'Mon', N'GS', N'08:31', N'19:31', N'10:30', 10.5, N'00:30', 10, 0, N'PR', N'PR', N'P'),
    (1260, 41, N'2026-10', N'027', N'2026-10-20', 20, N'Tue', N'GS', N'08:31', N'17:01', N'08:00', 8, N'00:30', 7.5, 0, N'PR', N'AB', N'HD'),
    (1261, 41, N'2026-10', N'027', N'2026-10-21', 21, N'Wed', N'GS', N'08:29', N'19:33', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1262, 41, N'2026-10', N'027', N'2026-10-22', 22, N'Thu', N'GS', N'08:32', N'19:32', N'10:30', 10.5, N'00:30', 10, 0, N'PR', N'PR', N'P'),
    (1263, 41, N'2026-10', N'027', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO');
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (1264, 41, N'2026-10', N'027', N'2026-10-24', 24, N'Sat', N'GS', N'08:28', N'19:00', N'10:02', 10.03, N'00:30', 9.53, 0, N'PR', N'AB', N'HD'),
    (1265, 41, N'2026-10', N'027', N'2026-10-25', 25, N'Sun', N'GS', N'08:29', N'19:30', N'10:31', 10.52, N'00:30', 10.02, 0, N'PR', N'PR', N'P'),
    (1266, 41, N'2026-10', N'027', N'2026-10-26', 26, N'Mon', N'GS', N'09:11', N'19:00', N'09:19', 9.32, N'00:30', 8.82, 0, N'AB', N'AB', N'A'),
    (1267, 41, N'2026-10', N'027', N'2026-10-27', 27, N'Tue', N'GS', N'19:00', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (1268, 41, N'2026-10', N'027', N'2026-10-28', 28, N'Wed', N'GS', N'19:33', N'08:36', N'13:03', 13.05, N'00:00', 13.05, 0, N'AB', N'AB', N'A'),
    (1269, 41, N'2026-10', N'027', N'2026-10-29', 29, N'Thu', N'GS', N'19:30', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (1270, 41, N'2026-10', N'027', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1271, 41, N'2026-10', N'027', N'2026-10-31', 31, N'Sat', N'GS', N'19:30', N'08:30', N'13:00', 13, N'00:00', 13, 0, N'AB', N'AB', N'A'),
    (1272, 42, N'2026-10', N'028', N'2026-10-01', 1, N'Thu', N'GS', N'08:28', N'19:33', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1273, 42, N'2026-10', N'028', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1274, 42, N'2026-10', N'028', N'2026-10-03', 3, N'Sat', N'GS', N'08:30', N'19:34', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1275, 42, N'2026-10', N'028', N'2026-10-04', 4, N'Sun', N'GS', N'08:30', N'19:32', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (1276, 42, N'2026-10', N'028', N'2026-10-05', 5, N'Mon', N'GS', N'08:29', N'19:32', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1277, 42, N'2026-10', N'028', N'2026-10-06', 6, N'Tue', N'GS', N'08:27', N'19:32', N'10:35', 10.58, N'00:30', 10.08, 0, N'PR', N'PR', N'P'),
    (1278, 42, N'2026-10', N'028', N'2026-10-07', 7, N'Wed', N'GS', N'08:29', N'19:31', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (1279, 42, N'2026-10', N'028', N'2026-10-08', 8, N'Thu', N'GS', N'08:28', N'19:31', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1280, 42, N'2026-10', N'028', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1281, 42, N'2026-10', N'028', N'2026-10-10', 10, N'Sat', N'GS', N'08:30', N'19:02', N'10:02', 10.03, N'00:30', 9.53, 0, N'PR', N'AB', N'HD'),
    (1282, 42, N'2026-10', N'028', N'2026-10-11', 11, N'Sun', N'GS', N'08:31', N'19:33', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (1283, 42, N'2026-10', N'028', N'2026-10-12', 12, N'Mon', N'GS', N'08:29', N'19:32', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1284, 42, N'2026-10', N'028', N'2026-10-13', 13, N'Tue', N'GS', N'08:28', N'19:32', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1285, 42, N'2026-10', N'028', N'2026-10-14', 14, N'Wed', N'GS', N'08:29', N'19:31', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (1286, 42, N'2026-10', N'028', N'2026-10-15', 15, N'Thu', N'GS', N'08:29', N'19:35', N'10:36', 10.6, N'00:30', 10.1, 0, N'PR', N'PR', N'P'),
    (1287, 42, N'2026-10', N'028', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1288, 42, N'2026-10', N'028', N'2026-10-17', 17, N'Sat', N'GS', N'08:30', N'19:34', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1289, 42, N'2026-10', N'028', N'2026-10-18', 18, N'Sun', N'GS', N'08:31', N'19:32', N'10:31', 10.52, N'00:30', 10.02, 0, N'PR', N'PR', N'P'),
    (1290, 42, N'2026-10', N'028', N'2026-10-19', 19, N'Mon', N'GS', N'08:30', N'19:32', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (1291, 42, N'2026-10', N'028', N'2026-10-20', 20, N'Tue', N'GS', N'08:31', N'17:04', N'08:03', 8.05, N'00:30', 7.55, 0, N'PR', N'AB', N'HD'),
    (1292, 42, N'2026-10', N'028', N'2026-10-21', 21, N'Wed', N'GS', N'08:29', N'19:32', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1293, 42, N'2026-10', N'028', N'2026-10-22', 22, N'Thu', N'GS', N'08:30', N'19:01', N'10:01', 10.02, N'00:30', 9.52, 0, N'PR', N'AB', N'HD'),
    (1294, 42, N'2026-10', N'028', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1295, 42, N'2026-10', N'028', N'2026-10-24', 24, N'Sat', N'GS', N'08:28', N'19:32', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1296, 42, N'2026-10', N'028', N'2026-10-25', 25, N'Sun', N'GS', N'08:28', N'19:31', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1297, 42, N'2026-10', N'028', N'2026-10-26', 26, N'Mon', N'GS', N'08:28', N'19:31', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1298, 42, N'2026-10', N'028', N'2026-10-27', 27, N'Tue', N'GS', N'08:28', N'19:32', N'10:34', 10.57, N'00:30', 10.07, 0, N'PR', N'PR', N'P'),
    (1299, 42, N'2026-10', N'028', N'2026-10-28', 28, N'Wed', N'GS', N'08:28', N'19:31', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1300, 42, N'2026-10', N'028', N'2026-10-29', 29, N'Thu', N'GS', N'08:28', N'19:31', N'10:33', 10.55, N'00:30', 10.05, 0, N'PR', N'PR', N'P'),
    (1301, 42, N'2026-10', N'028', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1302, 42, N'2026-10', N'028', N'2026-10-31', 31, N'Sat', N'GS', N'08:28', N'19:30', N'10:32', 10.53, N'00:30', 10.03, 0, N'PR', N'PR', N'P'),
    (1303, 43, N'2026-10', N'029', N'2026-10-01', 1, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1304, 43, N'2026-10', N'029', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1305, 43, N'2026-10', N'029', N'2026-10-03', 3, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1306, 43, N'2026-10', N'029', N'2026-10-04', 4, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1307, 43, N'2026-10', N'029', N'2026-10-05', 5, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1308, 43, N'2026-10', N'029', N'2026-10-06', 6, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1309, 43, N'2026-10', N'029', N'2026-10-07', 7, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1310, 43, N'2026-10', N'029', N'2026-10-08', 8, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1311, 43, N'2026-10', N'029', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1312, 43, N'2026-10', N'029', N'2026-10-10', 10, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1313, 43, N'2026-10', N'029', N'2026-10-11', 11, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A');
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (1314, 43, N'2026-10', N'029', N'2026-10-12', 12, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1315, 43, N'2026-10', N'029', N'2026-10-13', 13, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1316, 43, N'2026-10', N'029', N'2026-10-14', 14, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1317, 43, N'2026-10', N'029', N'2026-10-15', 15, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1318, 43, N'2026-10', N'029', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1319, 43, N'2026-10', N'029', N'2026-10-17', 17, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1320, 43, N'2026-10', N'029', N'2026-10-18', 18, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1321, 43, N'2026-10', N'029', N'2026-10-19', 19, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1322, 43, N'2026-10', N'029', N'2026-10-20', 20, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1323, 43, N'2026-10', N'029', N'2026-10-21', 21, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1324, 43, N'2026-10', N'029', N'2026-10-22', 22, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1325, 43, N'2026-10', N'029', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1326, 43, N'2026-10', N'029', N'2026-10-24', 24, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1327, 43, N'2026-10', N'029', N'2026-10-25', 25, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1328, 43, N'2026-10', N'029', N'2026-10-26', 26, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1329, 43, N'2026-10', N'029', N'2026-10-27', 27, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1330, 43, N'2026-10', N'029', N'2026-10-28', 28, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1331, 43, N'2026-10', N'029', N'2026-10-29', 29, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1332, 43, N'2026-10', N'029', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1333, 43, N'2026-10', N'029', N'2026-10-31', 31, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1334, 44, N'2026-10', N'030', N'2026-10-01', 1, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1335, 44, N'2026-10', N'030', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1336, 44, N'2026-10', N'030', N'2026-10-03', 3, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1337, 44, N'2026-10', N'030', N'2026-10-04', 4, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1338, 44, N'2026-10', N'030', N'2026-10-05', 5, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1339, 44, N'2026-10', N'030', N'2026-10-06', 6, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1340, 44, N'2026-10', N'030', N'2026-10-07', 7, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1341, 44, N'2026-10', N'030', N'2026-10-08', 8, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1342, 44, N'2026-10', N'030', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1343, 44, N'2026-10', N'030', N'2026-10-10', 10, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1344, 44, N'2026-10', N'030', N'2026-10-11', 11, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1345, 44, N'2026-10', N'030', N'2026-10-12', 12, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1346, 44, N'2026-10', N'030', N'2026-10-13', 13, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1347, 44, N'2026-10', N'030', N'2026-10-14', 14, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1348, 44, N'2026-10', N'030', N'2026-10-15', 15, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1349, 44, N'2026-10', N'030', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1350, 44, N'2026-10', N'030', N'2026-10-17', 17, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1351, 44, N'2026-10', N'030', N'2026-10-18', 18, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1352, 44, N'2026-10', N'030', N'2026-10-19', 19, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1353, 44, N'2026-10', N'030', N'2026-10-20', 20, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1354, 44, N'2026-10', N'030', N'2026-10-21', 21, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1355, 44, N'2026-10', N'030', N'2026-10-22', 22, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1356, 44, N'2026-10', N'030', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1357, 44, N'2026-10', N'030', N'2026-10-24', 24, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1358, 44, N'2026-10', N'030', N'2026-10-25', 25, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1359, 44, N'2026-10', N'030', N'2026-10-26', 26, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1360, 44, N'2026-10', N'030', N'2026-10-27', 27, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1361, 44, N'2026-10', N'030', N'2026-10-28', 28, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1362, 44, N'2026-10', N'030', N'2026-10-29', 29, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1363, 44, N'2026-10', N'030', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO');
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (1364, 44, N'2026-10', N'030', N'2026-10-31', 31, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1365, 45, N'2026-10', N'031', N'2026-10-01', 1, N'Thu', N'GS', N'10:32', N'19:01', N'07:59', 7.98, N'00:30', 7.48, 0, N'AB', N'AB', N'A'),
    (1366, 45, N'2026-10', N'031', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1367, 45, N'2026-10', N'031', N'2026-10-03', 3, N'Sat', N'GS', N'10:35', N'19:01', N'07:56', 7.93, N'00:30', 7.43, 0, N'AB', N'AB', N'A'),
    (1368, 45, N'2026-10', N'031', N'2026-10-04', 4, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1369, 45, N'2026-10', N'031', N'2026-10-05', 5, N'Mon', N'GS', N'10:47', N'19:01', N'07:44', 7.73, N'00:30', 7.23, 0, N'AB', N'AB', N'A'),
    (1370, 45, N'2026-10', N'031', N'2026-10-06', 6, N'Tue', N'GS', N'10:34', N'19:00', N'07:56', 7.93, N'00:30', 7.43, 0, N'AB', N'AB', N'A'),
    (1371, 45, N'2026-10', N'031', N'2026-10-07', 7, N'Wed', N'GS', N'10:30', N'19:01', N'08:01', 8.02, N'00:30', 7.52, 0, N'AB', N'AB', N'A'),
    (1372, 45, N'2026-10', N'031', N'2026-10-08', 8, N'Thu', N'GS', N'10:29', N'19:00', N'08:01', 8.02, N'00:30', 7.52, 0, N'AB', N'AB', N'A'),
    (1373, 45, N'2026-10', N'031', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1374, 45, N'2026-10', N'031', N'2026-10-10', 10, N'Sat', N'GS', N'10:23', N'19:00', N'08:07', 8.12, N'00:30', 7.62, 0, N'AB', N'AB', N'A'),
    (1375, 45, N'2026-10', N'031', N'2026-10-11', 11, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1376, 45, N'2026-10', N'031', N'2026-10-12', 12, N'Mon', N'GS', N'10:30', N'19:00', N'08:00', 8, N'00:30', 7.5, 0, N'AB', N'AB', N'A'),
    (1377, 45, N'2026-10', N'031', N'2026-10-13', 13, N'Tue', N'GS', N'10:27', N'19:01', N'08:04', 8.07, N'00:30', 7.57, 0, N'AB', N'AB', N'A'),
    (1378, 45, N'2026-10', N'031', N'2026-10-14', 14, N'Wed', N'GS', N'10:25', N'19:01', N'08:06', 8.1, N'00:30', 7.6, 0, N'AB', N'AB', N'A'),
    (1379, 45, N'2026-10', N'031', N'2026-10-15', 15, N'Thu', N'GS', N'10:32', N'19:01', N'07:59', 7.98, N'00:30', 7.48, 0, N'AB', N'AB', N'A'),
    (1380, 45, N'2026-10', N'031', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1381, 45, N'2026-10', N'031', N'2026-10-17', 17, N'Sat', N'GS', N'10:28', N'19:01', N'08:03', 8.05, N'00:30', 7.55, 0, N'AB', N'AB', N'A'),
    (1382, 45, N'2026-10', N'031', N'2026-10-18', 18, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1383, 45, N'2026-10', N'031', N'2026-10-19', 19, N'Mon', N'GS', N'10:23', N'19:01', N'08:08', 8.13, N'00:30', 7.63, 0, N'AB', N'AB', N'A'),
    (1384, 45, N'2026-10', N'031', N'2026-10-20', 20, N'Tue', N'GS', N'10:25', N'17:03', N'06:08', 6.13, N'00:30', 5.63, 0, N'AB', N'AB', N'A'),
    (1385, 45, N'2026-10', N'031', N'2026-10-21', 21, N'Wed', N'GS', N'10:21', N'19:01', N'08:10', 8.17, N'00:30', 7.67, 0, N'AB', N'AB', N'A'),
    (1386, 45, N'2026-10', N'031', N'2026-10-22', 22, N'Thu', N'GS', N'10:23', N'19:01', N'08:08', 8.13, N'00:30', 7.63, 0, N'AB', N'AB', N'A'),
    (1387, 45, N'2026-10', N'031', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1388, 45, N'2026-10', N'031', N'2026-10-24', 24, N'Sat', N'GS', N'10:27', N'18:59', N'08:02', 8.03, N'00:30', 7.53, 0, N'AB', N'AB', N'A'),
    (1389, 45, N'2026-10', N'031', N'2026-10-25', 25, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1390, 45, N'2026-10', N'031', N'2026-10-26', 26, N'Mon', N'GS', N'10:27', N'19:01', N'08:04', 8.07, N'00:30', 7.57, 0, N'AB', N'AB', N'A'),
    (1391, 45, N'2026-10', N'031', N'2026-10-27', 27, N'Tue', N'GS', N'10:31', N'19:02', N'08:01', 8.02, N'00:30', 7.52, 0, N'AB', N'AB', N'A'),
    (1392, 45, N'2026-10', N'031', N'2026-10-28', 28, N'Wed', N'GS', N'10:36', N'18:59', N'07:53', 7.88, N'00:30', 7.38, 0, N'AB', N'AB', N'A'),
    (1393, 45, N'2026-10', N'031', N'2026-10-29', 29, N'Thu', N'GS', N'10:37', N'18:59', N'07:52', 7.87, N'00:30', 7.37, 0, N'AB', N'AB', N'A'),
    (1394, 45, N'2026-10', N'031', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1395, 45, N'2026-10', N'031', N'2026-10-31', 31, N'Sat', N'GS', N'10:32', N'18:59', N'07:57', 7.95, N'00:30', 7.45, 0, N'AB', N'AB', N'A'),
    (1396, 46, N'2026-10', N'032', N'2026-10-01', 1, N'Thu', N'GS', N'08:33', N'19:02', N'09:59', 9.98, N'00:30', 9.48, 0, N'PR', N'AB', N'HD'),
    (1397, 46, N'2026-10', N'032', N'2026-10-02', 2, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1398, 46, N'2026-10', N'032', N'2026-10-03', 3, N'Sat', N'GS', N'08:39', N'19:01', N'09:52', 9.87, N'00:30', 9.37, 0, N'PR', N'AB', N'HD'),
    (1399, 46, N'2026-10', N'032', N'2026-10-04', 4, N'Sun', N'GS', N'08:28', N'19:03', N'10:05', 10.08, N'00:30', 9.58, 0, N'PR', N'AB', N'HD'),
    (1400, 46, N'2026-10', N'032', N'2026-10-05', 5, N'Mon', N'GS', N'08:37', N'17:32', N'08:25', 8.42, N'00:30', 7.92, 0, N'PR', N'AB', N'HD'),
    (1401, 46, N'2026-10', N'032', N'2026-10-06', 6, N'Tue', N'GS', N'08:30', N'19:00', N'10:00', 10, N'00:30', 9.5, 0, N'PR', N'AB', N'HD'),
    (1402, 46, N'2026-10', N'032', N'2026-10-07', 7, N'Wed', N'GS', N'08:39', N'19:01', N'09:52', 9.87, N'00:30', 9.37, 0, N'PR', N'AB', N'HD'),
    (1403, 46, N'2026-10', N'032', N'2026-10-08', 8, N'Thu', N'GS', N'08:29', N'19:02', N'10:03', 10.05, N'00:30', 9.55, 0, N'PR', N'AB', N'HD'),
    (1404, 46, N'2026-10', N'032', N'2026-10-09', 9, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1405, 46, N'2026-10', N'032', N'2026-10-10', 10, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1406, 46, N'2026-10', N'032', N'2026-10-11', 11, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1407, 46, N'2026-10', N'032', N'2026-10-12', 12, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1408, 46, N'2026-10', N'032', N'2026-10-13', 13, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1409, 46, N'2026-10', N'032', N'2026-10-14', 14, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1410, 46, N'2026-10', N'032', N'2026-10-15', 15, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1411, 46, N'2026-10', N'032', N'2026-10-16', 16, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1412, 46, N'2026-10', N'032', N'2026-10-17', 17, N'Sat', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1413, 46, N'2026-10', N'032', N'2026-10-18', 18, N'Sun', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A');
INSERT INTO [dbo].[AttendanceDailyLog] ([Id], [SummaryId], [MonthYear], [BiometricCode], [AttendanceDate], [DayNumber], [DayOfWeek], [Shift], [FirstIn], [LastOut], [GrossHours], [GrossHoursDecimal], [BreakHours], [NetHoursDecimal], [OvertimeHoursDecimal], [FirstHalfStatus], [SecondHalfStatus], [FinalStatus]) VALUES
    (1414, 46, N'2026-10', N'032', N'2026-10-19', 19, N'Mon', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1415, 46, N'2026-10', N'032', N'2026-10-20', 20, N'Tue', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1416, 46, N'2026-10', N'032', N'2026-10-21', 21, N'Wed', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1417, 46, N'2026-10', N'032', N'2026-10-22', 22, N'Thu', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'AB', N'AB', N'A'),
    (1418, 46, N'2026-10', N'032', N'2026-10-23', 23, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1419, 46, N'2026-10', N'032', N'2026-10-24', 24, N'Sat', N'GS', N'08:21', N'19:02', N'10:11', 10.18, N'00:30', 9.68, 0, N'PR', N'AB', N'HD'),
    (1420, 46, N'2026-10', N'032', N'2026-10-25', 25, N'Sun', N'GS', N'08:28', NULL, N'00:00', 0, N'00:00', 0, 0, N'IN', N'AB', N'HD'),
    (1421, 46, N'2026-10', N'032', N'2026-10-26', 26, N'Mon', N'GS', N'08:34', N'18:02', N'08:58', 8.97, N'00:30', 8.47, 0, N'PR', N'AB', N'HD'),
    (1422, 46, N'2026-10', N'032', N'2026-10-27', 27, N'Tue', N'GS', N'08:56', N'19:00', N'09:34', 9.57, N'00:30', 9.07, 0, N'PR', N'AB', N'HD'),
    (1423, 46, N'2026-10', N'032', N'2026-10-28', 28, N'Wed', N'GS', N'08:34', N'19:05', N'10:01', 10.02, N'00:30', 9.52, 0, N'PR', N'AB', N'HD'),
    (1424, 46, N'2026-10', N'032', N'2026-10-29', 29, N'Thu', N'GS', N'08:42', N'19:00', N'09:48', 9.8, N'00:30', 9.3, 0, N'PR', N'AB', N'HD'),
    (1425, 46, N'2026-10', N'032', N'2026-10-30', 30, N'Fri', N'GS', NULL, NULL, N'00:00', 0, N'00:00', 0, 0, N'WO', N'WO', N'WO'),
    (1426, 46, N'2026-10', N'032', N'2026-10-31', 31, N'Sat', N'GS', N'08:28', N'18:28', N'09:30', 9.5, N'00:30', 9, 0, N'PR', N'AB', N'HD');
SET IDENTITY_INSERT [dbo].[AttendanceDailyLog] OFF;
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
