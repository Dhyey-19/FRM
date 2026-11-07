-- =====================================================================
-- FRM - Factory Resource Manager Local Database Schema (SQLite)
-- Total Tables: 28
-- =====================================================================

PRAGMA foreign_keys = ON;

-- Table: AccountGroup
CREATE TABLE IF NOT EXISTS "AccountGroup" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "GroupName" VARCHAR(30) NOT NULL,
    "IsSystem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UQ_AccountGroup_GroupName" UNIQUE ("GroupName")
);

-- Table: DepartmentMaster
CREATE TABLE IF NOT EXISTS "DepartmentMaster" (
    "DeptID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "DeptName" VARCHAR(20) NOT NULL,
    "IsSystem" INTEGER NOT NULL DEFAULT 0
);

-- Table: BrandMaster
CREATE TABLE IF NOT EXISTS "BrandMaster" (
    "BrandId" INTEGER PRIMARY KEY AUTOINCREMENT,
    "BrandName" VARCHAR(15) NOT NULL,
    CONSTRAINT "UQ_BrandMaster_BrandName" UNIQUE ("BrandName")
);

-- Table: ItemTypeMaster
CREATE TABLE IF NOT EXISTS "ItemTypeMaster" (
    "ItemType" VARCHAR(15) PRIMARY KEY NOT NULL,
    "IsSystem" INTEGER NOT NULL DEFAULT 0
);

-- Table: UnitMaster
CREATE TABLE IF NOT EXISTS "UnitMaster" (
    "Unit" VARCHAR(10) PRIMARY KEY NOT NULL,
    "IsSystem" INTEGER NOT NULL DEFAULT 0
);

-- Table: CompanyProfile
CREATE TABLE IF NOT EXISTS "CompanyProfile" (
    "CompanyName" VARCHAR(200) NOT NULL,
    "Address1" VARCHAR(250),
    "Address2" VARCHAR(250),
    "City" VARCHAR(100),
    "StateName" VARCHAR(100),
    "CountryName" VARCHAR(100),
    "Pincode" VARCHAR(20),
    "ContactPerson" VARCHAR(100),
    "PhoneNo" VARCHAR(50),
    "MobileNo" VARCHAR(50),
    "EmailID" VARCHAR(150),
    "Website" VARCHAR(200),
    "GSTIN" VARCHAR(20),
    "PANNo" VARCHAR(20),
    "BankName" VARCHAR(150),
    "BranchName" VARCHAR(150),
    "AccountNo" VARCHAR(50),
    "IFSCCode" VARCHAR(20),
    "UPI" VARCHAR(50),
    "LogoPath" VARCHAR(500)
);

-- Table: PaymentQR
CREATE TABLE IF NOT EXISTS "PaymentQR" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "Label" VARCHAR(100) NOT NULL,
    "UpiId" VARCHAR(100) NOT NULL,
    "PayeeName" VARCHAR(100),
    "BankName" VARCHAR(100),
    "AccountNo" VARCHAR(50),
    "IFSC" VARCHAR(20),
    "IsPrimary" INTEGER DEFAULT 0,
    "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: Users
CREATE TABLE IF NOT EXISTS "Users" (
    "UserId" INTEGER PRIMARY KEY AUTOINCREMENT,
    "Username" VARCHAR(30) NOT NULL,
    "Password" VARCHAR(10) NOT NULL,
    "MobileNo" VARCHAR(10),
    "UserRole" VARCHAR(15) NOT NULL DEFAULT 'OPERATOR',
    "IsActive" INTEGER NOT NULL DEFAULT 0,
    "IsAdd" INTEGER NOT NULL DEFAULT 0,
    "IsEdit" INTEGER NOT NULL DEFAULT 0,
    "IsDelete" INTEGER NOT NULL DEFAULT 0,
    "AllowedMenus" TEXT,
    CONSTRAINT "UQ_Users_Username" UNIQUE ("Username")
);

-- Table: Assets
CREATE TABLE IF NOT EXISTS "Assets" (
    "AssetId" INTEGER PRIMARY KEY AUTOINCREMENT,
    "AssetName" VARCHAR(30) NOT NULL,
    "Quantity" INTEGER NOT NULL DEFAULT 0,
    "UnitValue" DECIMAL(15, 0) NOT NULL DEFAULT 0,
    "TotalValue" DECIMAL(26, 0)
);

-- Table: ItemMaster
CREATE TABLE IF NOT EXISTS "ItemMaster" (
    "ItemCode" VARCHAR(50) NOT NULL,
    "SubCode" VARCHAR(50) NOT NULL DEFAULT '',
    "ItemName" VARCHAR(50) NOT NULL,
    "ItemType" VARCHAR(15),
    "Category" VARCHAR(20) DEFAULT 'Inhouse',
    "WarehouseNo" VARCHAR(50),
    "Location" VARCHAR(100),
    "Series" VARCHAR(15),
    "StdWeight" DECIMAL(12, 3),
    "Costing" DECIMAL(10, 0) DEFAULT 0,
    "MRP" DECIMAL(10, 0) DEFAULT 0,
    "Unit" VARCHAR(10) NOT NULL,
    "OpeningStock" DECIMAL(12, 3),
    "ClosingStock" DECIMAL(12, 3),
    "HSNCode" VARCHAR(8),
    "ReorderLevel" DECIMAL(12, 3) DEFAULT 0,
    "DeadStockType" VARCHAR(20) DEFAULT 'None',
    "DeadStockDays" INTEGER DEFAULT 0,
    "IsDeadStock" INTEGER DEFAULT 0,
    PRIMARY KEY ("ItemCode", "SubCode")
);

-- Table: LedgerMaster
CREATE TABLE IF NOT EXISTS "LedgerMaster" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "LedgerName" VARCHAR(100) NOT NULL,
    "AccountGroupID" INTEGER NOT NULL,
    "Address" VARCHAR(255),
    "City" VARCHAR(20),
    "State" VARCHAR(20),
    "GSTIN" VARCHAR(15),
    "MobileNo" VARCHAR(10),
    "Email" VARCHAR(50),
    "BankName" VARCHAR(100),
    "AccountNo" VARCHAR(30),
    "IFSC" VARCHAR(15),
    "UPI" VARCHAR(50),
    "OwnBrand" VARCHAR(15),
    "OtherBrand" VARCHAR(15),
    "Discount" DECIMAL(5, 2),
    "CD" DECIMAL(3, 0),
    "Bill" DECIMAL(5, 2),
    "PaymentTerm" DECIMAL(3, 0),
    "Transport" VARCHAR(50),
    "DeliveryDays" INTEGER DEFAULT 0,
    "OpeningBalance" DECIMAL(12, 2),
    "ClosingBalance" DECIMAL(12, 2),
    "Remark" VARCHAR(100),
    CONSTRAINT "UQ_LedgerMaster_LedgerName" UNIQUE ("LedgerName"),
    FOREIGN KEY ("AccountGroupID") REFERENCES "AccountGroup" ("Id")
);

-- Table: AssemblyTransactions
CREATE TABLE IF NOT EXISTS "AssemblyTransactions" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "AssemblyNo" DECIMAL(8, 0) NOT NULL,
    "AssemblyDate" DATE NOT NULL,
    "ItemCode" VARCHAR(50) NOT NULL,
    "SubCode" VARCHAR(50) DEFAULT '',
    "Quantity" DECIMAL(8, 0) NOT NULL,
    "Remark" VARCHAR(50),
    "CreatedBy" VARCHAR(40),
    "UpdatedBy" VARCHAR(40)
);

-- Table: BOM_Master
CREATE TABLE IF NOT EXISTS "BOM_Master" (
    "ParentItemCode" VARCHAR(50) NOT NULL,
    "ParentSubCode" VARCHAR(50) NOT NULL DEFAULT '',
    "ChildItemCode" VARCHAR(50) NOT NULL,
    "ChildSubCode" VARCHAR(50) NOT NULL DEFAULT '',
    "Quantity" DECIMAL(5, 3) NOT NULL DEFAULT 0,
    PRIMARY KEY ("ParentItemCode", "ParentSubCode", "ChildItemCode", "ChildSubCode")
);

-- Table: DepartmentStock
CREATE TABLE IF NOT EXISTS "DepartmentStock" (
    "DeptID" INTEGER NOT NULL,
    "ItemCode" VARCHAR(50) NOT NULL,
    "SubCode" VARCHAR(50) NOT NULL DEFAULT '',
    "Pcs" DECIMAL(10, 3) NOT NULL DEFAULT 0,
    "Weight" DECIMAL(10, 3) NOT NULL DEFAULT 0,
    PRIMARY KEY ("DeptID", "ItemCode", "SubCode"),
    FOREIGN KEY ("DeptID") REFERENCES "DepartmentMaster" ("DeptID")
);

-- Table: PerformaInvoiceHeader
CREATE TABLE IF NOT EXISTS "PerformaInvoiceHeader" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "PINO" VARCHAR(50) NOT NULL UNIQUE,
    "PIDATE" DATE NOT NULL,
    "LEDGERID" DECIMAL(10, 0) NOT NULL,
    "CUSTOMERPOID" INTEGER,
    "CUSTOMERPONO" VARCHAR(50),
    "DELIVERYDATE" DATE,
    "STATUS" VARCHAR(25) NOT NULL DEFAULT 'Draft',
    "TOTALQTY" DECIMAL(12, 3) DEFAULT 0,
    "TOTALAMOUNT" DECIMAL(12, 2) DEFAULT 0,
    "REMARK" VARCHAR(255),
    "CREATEDBY" VARCHAR(40) NOT NULL,
    "UPDATEDBY" VARCHAR(40),
    "CREATEDAT" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("LEDGERID") REFERENCES "LedgerMaster" ("Id"),
    FOREIGN KEY ("CUSTOMERPOID") REFERENCES "PurchaseOrderHeader" ("ID")
);

-- Table: PerformaInvoiceDetail
CREATE TABLE IF NOT EXISTS "PerformaInvoiceDetail" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "PIID" INTEGER NOT NULL,
    "ITEMCODE" VARCHAR(50) NOT NULL,
    "SUBCODE" VARCHAR(50) DEFAULT '',
    "QUANTITY" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "RECEIVEDQTY" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "PENDINGQTY" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "UNIT" VARCHAR(10),
    "RATE" DECIMAL(10, 2) DEFAULT 0,
    "AMOUNT" DECIMAL(12, 2) DEFAULT 0,
    "REMARK" VARCHAR(100),
    FOREIGN KEY ("PIID") REFERENCES "PerformaInvoiceHeader" ("ID")
);

-- Table: InwardHeader
CREATE TABLE IF NOT EXISTS "InwardHeader" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "Bill" INTEGER NOT NULL DEFAULT 1,
    "INWARDNO" VARCHAR(10) NOT NULL,
    "INWARDDATE" DATE NOT NULL,
    "LEDGERID" DECIMAL(10, 0) NOT NULL,
    "EXPENSE" DECIMAL(10, 2) DEFAULT 0,
    "SGST" DECIMAL(10, 2) DEFAULT 0,
    "CGST" DECIMAL(10, 2) DEFAULT 0,
    "IGST" DECIMAL(10, 2) DEFAULT 0,
    "GSTPER" DECIMAL(10, 2) DEFAULT 0,
    "ROUNDOFF" DECIMAL(10, 2) DEFAULT 0,
    "TOTALAMOUNT" DECIMAL(12, 2) DEFAULT 0,
    "REMARK" VARCHAR(100),
    "CREATEDBY" VARCHAR(40) NOT NULL,
    "UPDATEDBY" VARCHAR(40),
    "PIID" INTEGER,
    "PINO" VARCHAR(50),
    CONSTRAINT "UQ_InwardHeader_INWARDNO" UNIQUE ("INWARDNO"),
    FOREIGN KEY ("LEDGERID") REFERENCES "LedgerMaster" ("Id"),
    FOREIGN KEY ("PIID") REFERENCES "PerformaInvoiceHeader" ("ID")
);

-- Table: InwardDetail
CREATE TABLE IF NOT EXISTS "InwardDetail" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "INWARDID" DECIMAL(8, 0) NOT NULL,
    "ITEMCODE" VARCHAR(50) NOT NULL,
    "SUBCODE" VARCHAR(50) DEFAULT '',
    "GROSSWT" DECIMAL(10, 3),
    "NETWT" DECIMAL(10, 3),
    "QUANTITY" DECIMAL(10, 2),
    "UNIT" VARCHAR(10),
    "RATE" DECIMAL(10, 2),
    "AMOUNT" DECIMAL(12, 2),
    "TENPCSWT" DECIMAL(10, 3),
    "PIDETAILID" INTEGER,
    FOREIGN KEY ("INWARDID") REFERENCES "InwardHeader" ("ID"),
    FOREIGN KEY ("PIDETAILID") REFERENCES "PerformaInvoiceDetail" ("ID")
);

-- Table: JobworkInHeader
CREATE TABLE IF NOT EXISTS "JobworkInHeader" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "JWINWARDNO" VARCHAR(10) NOT NULL,
    "JWINWARDDATE" DATE NOT NULL,
    "LEDGERID" DECIMAL(10, 0) NOT NULL,
    "JWOUTWARDNO" VARCHAR(10),
    "TOTALAMOUNT" DECIMAL(12, 2) DEFAULT 0,
    "REMARK" VARCHAR(100),
    "CREATEDBY" VARCHAR(40) NOT NULL,
    "UPDATEDBY" VARCHAR(40),
    "Bill" INTEGER DEFAULT 1,
    CONSTRAINT "UQ_JobworkInHeader_JWINWARDNO" UNIQUE ("JWINWARDNO"),
    FOREIGN KEY ("LEDGERID") REFERENCES "LedgerMaster" ("Id")
);

-- Table: JobworkInDetail
CREATE TABLE IF NOT EXISTS "JobworkInDetail" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "JWINWARDID" DECIMAL(8, 0) NOT NULL,
    "OUTITEMCODE" VARCHAR(50) NOT NULL,
    "OUTSUBCODE" VARCHAR(50) DEFAULT '',
    "INITEMCODE" VARCHAR(50) NOT NULL,
    "INSUBCODE" VARCHAR(50) DEFAULT '',
    "GROSSWT" DECIMAL(10, 3),
    "NETWT" DECIMAL(10, 3),
    "SCRAPITEMCODE" VARCHAR(50),
    "SCRAPSUBCODE" VARCHAR(50) DEFAULT '',
    "SCRAPPCS" DECIMAL(5, 2),
    "SCRAPWT" DECIMAL(10, 3),
    "QUANTITY" DECIMAL(10, 2),
    "PROCESS" VARCHAR(20),
    "UNIT" VARCHAR(10),
    "RATE" DECIMAL(10, 2),
    "AMOUNT" DECIMAL(12, 2),
    "TENPCSWT" DECIMAL(10, 3),
    FOREIGN KEY ("JWINWARDID") REFERENCES "JobworkInHeader" ("ID")
);

-- Table: JobworkOutHeader
CREATE TABLE IF NOT EXISTS "JobworkOutHeader" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "JWOUTWARDNO" VARCHAR(10) NOT NULL,
    "JWOUTWARDDATE" DATE NOT NULL,
    "LEDGERID" DECIMAL(10, 0) NOT NULL,
    "REMARK" VARCHAR(100),
    "CREATEDBY" VARCHAR(40) NOT NULL,
    "UPDATEDBY" VARCHAR(40),
    "Bill" INTEGER DEFAULT 1,
    "DeptID" INTEGER,
    CONSTRAINT "UQ_JobworkOutHeader_JWOUTWARDNO" UNIQUE ("JWOUTWARDNO"),
    FOREIGN KEY ("LEDGERID") REFERENCES "LedgerMaster" ("Id")
);

-- Table: JobworkOutDetail
CREATE TABLE IF NOT EXISTS "JobworkOutDetail" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "JWOUTWARDID" DECIMAL(8, 0) NOT NULL,
    "ITEMCODE" VARCHAR(50) NOT NULL,
    "SUBCODE" VARCHAR(50) DEFAULT '',
    "GROSSWT" DECIMAL(10, 3),
    "NETWT" DECIMAL(10, 3),
    "QUANTITY" DECIMAL(10, 2),
    "UNIT" VARCHAR(10),
    "RATE" DECIMAL(10, 2),
    "PROCESS" VARCHAR(20),
    "TENPCSWT" DECIMAL(10, 3),
    FOREIGN KEY ("JWOUTWARDID") REFERENCES "JobworkOutHeader" ("ID")
);

-- Table: PurchaseOrderHeader
CREATE TABLE IF NOT EXISTS "PurchaseOrderHeader" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "PONO" VARCHAR(50) NOT NULL UNIQUE,
    "PODATE" DATE NOT NULL,
    "LEDGERID" DECIMAL(10, 0) NOT NULL,
    "DELIVERYDATE" DATE,
    "STATUS" VARCHAR(25) NOT NULL DEFAULT 'Pending',
    "TOTALQTY" DECIMAL(12, 3) DEFAULT 0,
    "TOTALAMOUNT" DECIMAL(12, 2) DEFAULT 0,
    "REMARK" VARCHAR(255),
    "CREATEDBY" VARCHAR(40) NOT NULL,
    "UPDATEDBY" VARCHAR(40),
    "CREATEDAT" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("LEDGERID") REFERENCES "LedgerMaster" ("Id")
);

-- Table: PurchaseOrderDetail
CREATE TABLE IF NOT EXISTS "PurchaseOrderDetail" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "POID" INTEGER NOT NULL,
    "ITEMCODE" VARCHAR(50) NOT NULL,
    "SUBCODE" VARCHAR(50) DEFAULT '',
    "QUANTITY" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "DELIVEREDQTY" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "PENDINGQTY" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "UNIT" VARCHAR(10),
    "RATE" DECIMAL(10, 2) DEFAULT 0,
    "AMOUNT" DECIMAL(12, 2) DEFAULT 0,
    "REMARK" VARCHAR(100),
    FOREIGN KEY ("POID") REFERENCES "PurchaseOrderHeader" ("ID")
);

-- Table: OutwardHeader
CREATE TABLE IF NOT EXISTS "OutwardHeader" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "Bill" INTEGER NOT NULL DEFAULT 1,
    "OUTWARDNO" VARCHAR(10) NOT NULL,
    "OUTWARDDATE" DATE NOT NULL,
    "LEDGERID" DECIMAL(10, 0) NOT NULL,
    "EXPENSE" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "SGST" DECIMAL(10, 2) DEFAULT 0,
    "CGST" DECIMAL(10, 2) DEFAULT 0,
    "IGST" DECIMAL(10, 2) DEFAULT 0,
    "GSTPER" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "ROUNDOFF" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "TOTALAMOUNT" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "REMARK" VARCHAR(100),
    "CREATEDBY" VARCHAR(40) NOT NULL,
    "UPDATEDBY" VARCHAR(40),
    "CDPER" DECIMAL(5, 2) DEFAULT 0,
    "CDAMOUNT" DECIMAL(12, 2) DEFAULT 0,
    "POID" INTEGER,
    "PONO" VARCHAR(50),
    "IRN" VARCHAR(64) DEFAULT NULL,
    "AckNo" VARCHAR(30) DEFAULT NULL,
    "AckDate" VARCHAR(30) DEFAULT NULL,
    "SignedQRCode" TEXT DEFAULT NULL,
    "SignedInvoice" TEXT DEFAULT NULL,
    "EInvoiceStatus" VARCHAR(20) DEFAULT 'Pending',
    "EInvoiceCancelReason" VARCHAR(100) DEFAULT NULL,
    "EInvoiceCancelDate" VARCHAR(30) DEFAULT NULL,
    CONSTRAINT "UQ_OutwardHeader_OUTWARDNO" UNIQUE ("OUTWARDNO"),
    FOREIGN KEY ("LEDGERID") REFERENCES "LedgerMaster" ("Id"),
    FOREIGN KEY ("POID") REFERENCES "PurchaseOrderHeader" ("ID")
);

-- Table: OutwardDetail
CREATE TABLE IF NOT EXISTS "OutwardDetail" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "OUTWARDID" DECIMAL(8, 0) NOT NULL,
    "ITEMCODE" VARCHAR(50) NOT NULL,
    "SUBCODE" VARCHAR(50) DEFAULT '',
    "GROSSWT" DECIMAL(10, 3),
    "NETWT" DECIMAL(10, 3),
    "QUANTITY" DECIMAL(10, 2),
    "UNIT" VARCHAR(10),
    "RATE" DECIMAL(10, 2),
    "AMOUNT" DECIMAL(12, 2),
    "DISCOUNT" DECIMAL(5, 2) DEFAULT 0,
    "TENPCSWT" DECIMAL(10, 3),
    "PODETAILID" INTEGER,
    FOREIGN KEY ("OUTWARDID") REFERENCES "OutwardHeader" ("ID"),
    FOREIGN KEY ("PODETAILID") REFERENCES "PurchaseOrderDetail" ("ID")
);

-- Table: EInvoiceSettings (Direct NIC IRP API Credentials & Config)
CREATE TABLE IF NOT EXISTS "EInvoiceSettings" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "IsEnabled" INTEGER DEFAULT 1,
    "Environment" VARCHAR(20) DEFAULT 'sandbox', -- 'sandbox' | 'production' | 'simulation'
    "Gstin" VARCHAR(20),
    "ClientId" VARCHAR(100),
    "ClientSecret" VARCHAR(200),
    "Username" VARCHAR(100),
    "Password" VARCHAR(200),
    "BaseUrl" VARCHAR(255) DEFAULT 'https://einv-apisandbox.nic.in/eivital/v1.03',
    "AuthToken" TEXT DEFAULT NULL,
    "TokenExpiry" VARCHAR(50) DEFAULT NULL,
    "Sek" TEXT DEFAULT NULL,
    "PublicKeyCert" TEXT DEFAULT NULL,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: StockJournal
CREATE TABLE IF NOT EXISTS "StockJournal" (
    "SJID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "SJDate" DATE NOT NULL,
    "SJType" VARCHAR(15) NOT NULL,
    "ItemCode" VARCHAR(50) NOT NULL,
    "SubCode" VARCHAR(50) DEFAULT '',
    "Qty" DECIMAL(10, 3) NOT NULL,
    "Remarks" VARCHAR(50),
    "CreatedBy" VARCHAR(40) NOT NULL,
    "UpdatedBy" VARCHAR(40)
);

-- Table: StockTransfer
CREATE TABLE IF NOT EXISTS "StockTransfer" (
    "MoveID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "TransferID" VARCHAR(10) NOT NULL,
    "MoveDate" DATE NOT NULL,
    "FromDeptID" INTEGER NOT NULL,
    "ToDeptID" INTEGER NOT NULL,
    "OutItemCode" VARCHAR(50),
    "OutSubCode" VARCHAR(50) DEFAULT '',
    "OutPcs" DECIMAL(10, 3) DEFAULT 0,
    "OutWeight" DECIMAL(10, 3) DEFAULT 0,
    "InItemCode" VARCHAR(50),
    "InSubCode" VARCHAR(50) DEFAULT '',
    "InPcs" DECIMAL(10, 3) DEFAULT 0,
    "InWeight" DECIMAL(10, 3) DEFAULT 0,
    "ScrapItemCode" VARCHAR(50),
    "ScrapSubCode" VARCHAR(50) DEFAULT '',
    "ScrapPcs" DECIMAL(8, 3) DEFAULT 0,
    "ScrapWeight" DECIMAL(8, 3) DEFAULT 0,
    "LossWeight" DECIMAL(8, 3) DEFAULT 0,
    "Remarks" VARCHAR(50),
    "CreatedBy" VARCHAR(40),
    "UpdatedBy" VARCHAR(40),
    "Rate" DECIMAL(10, 2) DEFAULT 0,
    "Amount" DECIMAL(12, 2) DEFAULT 0,
    "LossRate" DECIMAL(10, 2) DEFAULT 0,
    "LossAmount" DECIMAL(12, 2) DEFAULT 0,
    "Unit" VARCHAR(20),
    "ManualChallanNo" VARCHAR(50),
    FOREIGN KEY ("ToDeptID") REFERENCES "DepartmentMaster" ("DeptID"),
    FOREIGN KEY ("FromDeptID") REFERENCES "DepartmentMaster" ("DeptID")
);

-- Table: VoucherEntry
CREATE TABLE IF NOT EXISTS "VoucherEntry" (
    "VoucherId" INTEGER PRIMARY KEY AUTOINCREMENT,
    "VoucherType" VARCHAR(10),
    "VoucherNo" DECIMAL(8, 0) NOT NULL,
    "VoucherDate" DATE NOT NULL,
    "Mode" VARCHAR(6) NOT NULL,
    "LedgerId" DECIMAL(10, 0) NOT NULL,
    "Amount" DECIMAL(10, 2) NOT NULL,
    "Through" VARCHAR(30),
    "Remark" VARCHAR(255),
    "CREATEDBY" VARCHAR(40) NOT NULL DEFAULT 'System',
    "UPDATEDBY" VARCHAR(40),
    "Bill" INTEGER DEFAULT 1,
    FOREIGN KEY ("LedgerId") REFERENCES "LedgerMaster" ("Id")
);

-- Table: _Migrations
CREATE TABLE IF NOT EXISTS "_Migrations" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "name" TEXT UNIQUE NOT NULL,
    "executed_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: _SystemSettings
CREATE TABLE IF NOT EXISTS "_SystemSettings" (
    "Key" TEXT PRIMARY KEY,
    "Value" TEXT,
    "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- System Default Initial Seeds (Required for clean installation)
-- =====================================================================

-- Account Groups
INSERT OR IGNORE INTO "AccountGroup" ("Id", "GroupName", "IsSystem") VALUES 
(1, 'Capital Account', 1),
(2, 'Current Assets', 1),
(3, 'Current Liabilities', 1),
(4, 'Sundry Debtors', 0),
(5, 'Sundry Creditors', 0),
(6, 'Bank Accounts', 0),
(7, 'Direct Expenses', 0),
(8, 'Sales Accounts', 0),
(9, 'Purchase Accounts', 0);

-- Units
INSERT OR IGNORE INTO "UnitMaster" ("Unit", "IsSystem") VALUES 
('PCS', 1),
('KGS', 1),
('MTR', 0),
('BOX', 0),
('SET', 0);

-- Item Types
INSERT OR IGNORE INTO "ItemTypeMaster" ("ItemType", "IsSystem") VALUES 
('RAW MATERIAL', 1),
('SEMI-FINISHED', 1),
('FINISHED GOOD', 1),
('CONSUMABLE', 0),
('SCRAP', 1);

-- Default Departments
INSERT OR IGNORE INTO "DepartmentMaster" ("DeptID", "DeptName", "IsSystem") VALUES 
(1, 'Cutting & Sawing', 0),
(2, 'Forging & Casting', 0),
(3, 'Machining & CNC', 0),
(4, 'Polishing & Plating', 0),
(5, 'Assembly & Testing', 0),
(6, 'Finished Goods Store', 0);

-- Default Administrator User (admin / admin123)
INSERT OR IGNORE INTO "Users" ("UserId", "Username", "Password", "MobileNo", "UserRole", "IsActive", "IsAdd", "IsEdit", "IsDelete", "AllowedMenus") VALUES 
(1, 'admin', 'admin123', '9876543210', 'ADMIN', 1, 1, 1, 1, '*');

-- Default Initial Company Profile (if table is empty)
INSERT INTO "CompanyProfile" ("CompanyName", "Address1", "City", "StateName", "CountryName", "Pincode", "EmailID", "GSTIN", "BankName", "AccountNo", "IFSCCode", "UPI", "LogoPath")
SELECT 'FRM Precision Manufacturing Ltd', 'Plot No. 42-45, GIDC Industrial Estate', 'Ahmedabad', 'Gujarat', 'India', '382415', 'contact@frm.demo', '24AAACF1234K1Z5', 'State Bank of India', '33889900112', 'SBIN0004052', 'frm@sbi', '/assets/app_logo.jpeg'
WHERE NOT EXISTS (SELECT 1 FROM "CompanyProfile");

