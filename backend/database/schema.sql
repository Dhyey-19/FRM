-- FRM-BBP Initial Database Schema
PRAGMA foreign_keys = ON;

CREATE TABLE "AccountGroup" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "GroupName" VARCHAR(30) NOT NULL,
    "IsSystem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UQ_AccountGroup_GroupName" UNIQUE ("GroupName")
);

CREATE TABLE "DepartmentMaster" (
    "DeptID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "DeptName" VARCHAR(20) NOT NULL,
    "IsSystem" INTEGER NOT NULL DEFAULT 0
, "Costing" NUMERIC DEFAULT 0);

CREATE TABLE "BrandMaster" (
    "BrandId" INTEGER PRIMARY KEY AUTOINCREMENT,
    "BrandName" VARCHAR(15) NOT NULL,
    CONSTRAINT "UQ_BrandMaster_BrandName" UNIQUE ("BrandName")
);

CREATE TABLE "ItemTypeMaster" (
    "ItemType" VARCHAR(15) PRIMARY KEY NOT NULL,
    "IsSystem" INTEGER NOT NULL DEFAULT 0
, Description TEXT NULL);

CREATE TABLE "UnitMaster" (
    "Unit" VARCHAR(10) PRIMARY KEY NOT NULL,
    "IsSystem" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "CompanyProfile" (
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

CREATE TABLE "Users" (
    "UserId" INTEGER PRIMARY KEY AUTOINCREMENT,
    "Username" VARCHAR(30) NOT NULL,
    "Password" VARCHAR(10) NOT NULL,
    "MobileNo" VARCHAR(10),
    "UserRole" VARCHAR(15) NOT NULL DEFAULT 'OPERATOR',
    "IsActive" INTEGER NOT NULL DEFAULT 0,
    "IsAdd" INTEGER NOT NULL DEFAULT 0,
    "IsEdit" INTEGER NOT NULL DEFAULT 0,
    "IsDelete" INTEGER NOT NULL DEFAULT 0,
    "AllowedMenus" TEXT, "FullName" VARCHAR(100) DEFAULT NULL, "BiometricCode" VARCHAR(30) DEFAULT NULL, "Department" VARCHAR(50) DEFAULT 'LABOUR', "Designation" VARCHAR(50) DEFAULT 'Operator', "SalaryType" VARCHAR(20) DEFAULT 'Monthly', "MonthlySalary" DECIMAL(12, 2) DEFAULT 15000.00, "DailyRate" DECIMAL(10, 2) DEFAULT 600.00, "HourlyRate" DECIMAL(10, 2) DEFAULT 75.00, "OvertimeRatePerHour" DECIMAL(10, 2) DEFAULT 100.00, "StandardWorkingHours" DECIMAL(4, 2) DEFAULT 8.00,
    CONSTRAINT "UQ_Users_Username" UNIQUE ("Username")
);

CREATE TABLE "Assets" (
    "AssetId" INTEGER PRIMARY KEY AUTOINCREMENT,
    "AssetName" VARCHAR(30) NOT NULL,
    "Quantity" INTEGER NOT NULL DEFAULT 0,
    "UnitValue" DECIMAL(15, 0) NOT NULL DEFAULT 0,
    "TotalValue" DECIMAL(26, 0)
);

CREATE TABLE "LedgerMaster" (
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
    "OpeningBalance" DECIMAL(12, 2),
    "ClosingBalance" DECIMAL(12, 2),
    "Remark" VARCHAR(100), "DeliveryDays" INTEGER DEFAULT 0,
    CONSTRAINT "UQ_LedgerMaster_LedgerName" UNIQUE ("LedgerName"),
    FOREIGN KEY ("AccountGroupID") REFERENCES "AccountGroup" ("Id")
);

CREATE TABLE "AssemblyTransactions" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "AssemblyNo" DECIMAL(8, 0) NOT NULL,
    "AssemblyDate" DATE NOT NULL,
    "ItemCode" VARCHAR(10) NOT NULL,
    "Quantity" DECIMAL(8, 0) NOT NULL,
    "Remark" VARCHAR(50),
    "CreatedBy" VARCHAR(40),
    "UpdatedBy" VARCHAR(40), "SubCode" VARCHAR(50) DEFAULT '',
    FOREIGN KEY ("ItemCode") REFERENCES "ItemMaster" ("ItemCode")
);

CREATE TABLE "InwardHeader" (
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
    "UPDATEDBY" VARCHAR(40), "PIID" INTEGER, "PINO" VARCHAR(50),
    CONSTRAINT "UQ_InwardHeader_INWARDNO" UNIQUE ("INWARDNO"),
    FOREIGN KEY ("LEDGERID") REFERENCES "LedgerMaster" ("Id")
);

CREATE TABLE "InwardDetail" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "INWARDID" DECIMAL(8, 0) NOT NULL,
    "ITEMCODE" VARCHAR(10) NOT NULL,
    "GROSSWT" DECIMAL(10, 3),
    "NETWT" DECIMAL(10, 3),
    "QUANTITY" DECIMAL(10, 2),
    "UNIT" VARCHAR(10),
    "RATE" DECIMAL(10, 2),
    "AMOUNT" DECIMAL(12, 2),
    "TENPCSWT" DECIMAL(10, 3), "SUBCODE" VARCHAR(50) DEFAULT '', "PIDETAILID" INTEGER,
    FOREIGN KEY ("INWARDID") REFERENCES "InwardHeader" ("ID"),
    FOREIGN KEY ("ITEMCODE") REFERENCES "ItemMaster" ("ItemCode")
);

CREATE TABLE "JobworkInHeader" (
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

CREATE TABLE "JobworkInDetail" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "JWINWARDID" DECIMAL(8, 0) NOT NULL,
    "OUTITEMCODE" VARCHAR(10) NOT NULL,
    "INITEMCODE" VARCHAR(10) NOT NULL,
    "GROSSWT" DECIMAL(10, 3),
    "NETWT" DECIMAL(10, 3),
    "SCRAPITEMCODE" VARCHAR(10),
    "SCRAPPCS" DECIMAL(5, 2),
    "SCRAPWT" DECIMAL(10, 3),
    "QUANTITY" DECIMAL(10, 2),
    "PROCESS" VARCHAR(20),
    "UNIT" VARCHAR(10),
    "RATE" DECIMAL(10, 2),
    "AMOUNT" DECIMAL(12, 2),
    "TENPCSWT" DECIMAL(10, 3), "OUTSUBCODE" VARCHAR(50) DEFAULT '', "INSUBCODE" VARCHAR(50) DEFAULT '', "SCRAPSUBCODE" VARCHAR(50) DEFAULT '',
    FOREIGN KEY ("OUTITEMCODE") REFERENCES "ItemMaster" ("ItemCode"),
    FOREIGN KEY ("SCRAPITEMCODE") REFERENCES "ItemMaster" ("ItemCode"),
    FOREIGN KEY ("JWINWARDID") REFERENCES "JobworkInHeader" ("ID"),
    FOREIGN KEY ("INITEMCODE") REFERENCES "ItemMaster" ("ItemCode")
);

CREATE TABLE "JobworkOutHeader" (
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

CREATE TABLE "JobworkOutDetail" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "JWOUTWARDID" DECIMAL(8, 0) NOT NULL,
    "ITEMCODE" VARCHAR(10) NOT NULL,
    "GROSSWT" DECIMAL(10, 3),
    "NETWT" DECIMAL(10, 3),
    "QUANTITY" DECIMAL(10, 2),
    "UNIT" VARCHAR(10),
    "RATE" DECIMAL(10, 2),
    "PROCESS" VARCHAR(20),
    "TENPCSWT" DECIMAL(10, 3), "SUBCODE" VARCHAR(50) DEFAULT '',
    FOREIGN KEY ("JWOUTWARDID") REFERENCES "JobworkOutHeader" ("ID"),
    FOREIGN KEY ("ITEMCODE") REFERENCES "ItemMaster" ("ItemCode")
);

CREATE TABLE "OutwardHeader" (
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
    "CDAMOUNT" DECIMAL(12, 2) DEFAULT 0, "POID" INTEGER, "PONO" VARCHAR(50), "IRN" VARCHAR(64) DEFAULT NULL, "AckNo" VARCHAR(30) DEFAULT NULL, "AckDate" VARCHAR(30) DEFAULT NULL, "SignedQRCode" TEXT DEFAULT NULL, "SignedInvoice" TEXT DEFAULT NULL, "EInvoiceStatus" VARCHAR(20) DEFAULT 'Pending', "EInvoiceCancelReason" VARCHAR(100) DEFAULT NULL, "EInvoiceCancelDate" VARCHAR(30) DEFAULT NULL, "CourierCompany" VARCHAR(100) DEFAULT NULL, "AwbNo" VARCHAR(100) DEFAULT NULL, "TransportMode" VARCHAR(50) DEFAULT NULL, "DateOfPod" VARCHAR(20) DEFAULT NULL, "PodRemarks" VARCHAR(255) DEFAULT NULL,
    CONSTRAINT "UQ_OutwardHeader_OUTWARDNO" UNIQUE ("OUTWARDNO"),
    FOREIGN KEY ("LEDGERID") REFERENCES "LedgerMaster" ("Id")
);

CREATE TABLE "OutwardDetail" (
    "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "OUTWARDID" DECIMAL(8, 0) NOT NULL,
    "ITEMCODE" VARCHAR(10) NOT NULL,
    "GROSSWT" DECIMAL(10, 3),
    "NETWT" DECIMAL(10, 3),
    "QUANTITY" DECIMAL(10, 2),
    "UNIT" VARCHAR(10),
    "RATE" DECIMAL(10, 2),
    "AMOUNT" DECIMAL(12, 2),
    "DISCOUNT" DECIMAL(5, 2) DEFAULT 0,
    "TENPCSWT" DECIMAL(10, 3), "SUBCODE" VARCHAR(50) DEFAULT '', "PODETAILID" INTEGER,
    FOREIGN KEY ("OUTWARDID") REFERENCES "OutwardHeader" ("ID"),
    FOREIGN KEY ("ITEMCODE") REFERENCES "ItemMaster" ("ItemCode")
);

CREATE TABLE "StockJournal" (
    "SJID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "SJDate" DATE NOT NULL,
    "SJType" VARCHAR(15) NOT NULL,
    "ItemCode" VARCHAR(10) NOT NULL,
    "Qty" DECIMAL(10, 3) NOT NULL,
    "Remarks" VARCHAR(50),
    "CreatedBy" VARCHAR(40) NOT NULL,
    "UpdatedBy" VARCHAR(40), "SubCode" VARCHAR(50) DEFAULT '',
    FOREIGN KEY ("ItemCode") REFERENCES "ItemMaster" ("ItemCode")
);

CREATE TABLE "StockTransfer" (
    "MoveID" INTEGER PRIMARY KEY AUTOINCREMENT,
    "TransferID" VARCHAR(10) NOT NULL,
    "MoveDate" DATE NOT NULL,
    "FromDeptID" INTEGER NOT NULL,
    "ToDeptID" INTEGER NOT NULL,
    "OutItemCode" VARCHAR(10),
    "OutPcs" DECIMAL(10, 3) DEFAULT 0,
    "OutWeight" DECIMAL(10, 3) DEFAULT 0,
    "InItemCode" VARCHAR(10),
    "InPcs" DECIMAL(10, 3) DEFAULT 0,
    "InWeight" DECIMAL(10, 3) DEFAULT 0,
    "ScrapItemCode" VARCHAR(10),
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
    "ManualChallanNo" VARCHAR(50), "OutSubCode" VARCHAR(50) DEFAULT '', "InSubCode" VARCHAR(50) DEFAULT '', "ScrapSubCode" VARCHAR(50) DEFAULT '',
    FOREIGN KEY ("ToDeptID") REFERENCES "DepartmentMaster" ("DeptID"),
    FOREIGN KEY ("FromDeptID") REFERENCES "DepartmentMaster" ("DeptID"),
    FOREIGN KEY ("ScrapItemCode") REFERENCES "ItemMaster" ("ItemCode"),
    FOREIGN KEY ("InItemCode") REFERENCES "ItemMaster" ("ItemCode"),
    FOREIGN KEY ("OutItemCode") REFERENCES "ItemMaster" ("ItemCode")
);

CREATE TABLE "VoucherEntry" (
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

CREATE TABLE "_Migrations" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT UNIQUE NOT NULL,
        "executed_at" DATETIME DEFAULT CURRENT_TIMESTAMP
      );

CREATE TABLE "_SystemSettings" (
  "Key" TEXT PRIMARY KEY,
  "Value" TEXT,
  "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PaymentQR" (
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

CREATE TABLE "ItemMaster" (
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
    "ReorderLevel" DECIMAL(12, 3) DEFAULT 0, "DeadStockType" VARCHAR(20) DEFAULT 'None', "DeadStockDays" INTEGER DEFAULT 0, "IsDeadStock" INTEGER DEFAULT 0, ItemCategory VARCHAR(100),
    PRIMARY KEY ("ItemCode", "SubCode")
);

CREATE TABLE "BOM_Master" (
    "ParentItemCode" VARCHAR(50) NOT NULL,
    "ParentSubCode" VARCHAR(50) NOT NULL DEFAULT '',
    "ChildItemCode" VARCHAR(50) NOT NULL,
    "ChildSubCode" VARCHAR(50) NOT NULL DEFAULT '',
    "Quantity" DECIMAL(5, 3) NOT NULL DEFAULT 0,
    PRIMARY KEY ("ParentItemCode", "ParentSubCode", "ChildItemCode", "ChildSubCode")
);

CREATE TABLE "DepartmentStock" (
    "DeptID" INTEGER NOT NULL,
    "ItemCode" VARCHAR(50) NOT NULL,
    "SubCode" VARCHAR(50) NOT NULL DEFAULT '',
    "Pcs" DECIMAL(10, 3) NOT NULL DEFAULT 0,
    "Weight" DECIMAL(10, 3) NOT NULL DEFAULT 0,
    PRIMARY KEY ("DeptID", "ItemCode", "SubCode")
);

CREATE TABLE "PurchaseOrderHeader" (
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

CREATE TABLE "PurchaseOrderDetail" (
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

CREATE TABLE "PerformaInvoiceHeader" (
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

CREATE TABLE "PerformaInvoiceDetail" (
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

CREATE TABLE "EInvoiceSettings" (
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

CREATE TABLE "AttendanceMonthlySummary" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "MonthYear" VARCHAR(10) NOT NULL,
    "MonthName" VARCHAR(30),
    "TotalDaysInMonth" INTEGER DEFAULT 31,
    "UserId" INTEGER NULL,
    "BiometricCode" VARCHAR(30) NOT NULL,
    "EmployeeName" VARCHAR(100) NOT NULL,
    "Department" VARCHAR(50),
    "Designation" VARCHAR(50),
    "PresentDays" DECIMAL(5, 2) DEFAULT 0,
    "AbsentDays" DECIMAL(5, 2) DEFAULT 0,
    "HalfDays" DECIMAL(5, 2) DEFAULT 0,
    "WeekOffDays" DECIMAL(5, 2) DEFAULT 0,
    "PublicHolidays" DECIMAL(5, 2) DEFAULT 0,
    "PaidLeaveDays" DECIMAL(5, 2) DEFAULT 0,
    "UnpaidLeaveDays" DECIMAL(5, 2) DEFAULT 0,
    "PayableDays" DECIMAL(5, 2) DEFAULT 0,
    "TotalGrossHours" VARCHAR(20) DEFAULT '00:00',
    "TotalGrossHoursDecimal" DECIMAL(8, 2) DEFAULT 0.00,
    "TotalBreakHours" VARCHAR(20) DEFAULT '00:00',
    "TotalBreakHoursDecimal" DECIMAL(8, 2) DEFAULT 0.00,
    "TotalNetWorkHoursDecimal" DECIMAL(8, 2) DEFAULT 0.00,
    "TotalOvertimeHoursDecimal" DECIMAL(8, 2) DEFAULT 0.00,
    "SalaryType" VARCHAR(20) DEFAULT 'Monthly',
    "BaseSalary" DECIMAL(12, 2) DEFAULT 0.00,
    "CalculatedSalary" DECIMAL(12, 2) DEFAULT 0.00,
    "OvertimePay" DECIMAL(12, 2) DEFAULT 0.00,
    "Deductions" DECIMAL(12, 2) DEFAULT 0.00,
    "NetSalary" DECIMAL(12, 2) DEFAULT 0.00,
    "UploadedFileName" VARCHAR(255),
    "UploadedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "Remarks" TEXT
);

CREATE TABLE "AttendanceDailyLog" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "SummaryId" INTEGER NOT NULL,
    "MonthYear" VARCHAR(10) NOT NULL,
    "BiometricCode" VARCHAR(30) NOT NULL,
    "AttendanceDate" VARCHAR(20) NOT NULL,
    "DayNumber" INTEGER NOT NULL,
    "DayOfWeek" VARCHAR(10),
    "Shift" VARCHAR(20),
    "FirstIn" VARCHAR(10),
    "LastOut" VARCHAR(10),
    "GrossHours" VARCHAR(10),
    "GrossHoursDecimal" DECIMAL(5, 2) DEFAULT 0.00,
    "BreakHours" VARCHAR(10),
    "NetHoursDecimal" DECIMAL(5, 2) DEFAULT 0.00,
    "OvertimeHoursDecimal" DECIMAL(5, 2) DEFAULT 0.00,
    "FirstHalfStatus" VARCHAR(10),
    "SecondHalfStatus" VARCHAR(10),
    "FinalStatus" VARCHAR(10)
);

CREATE INDEX "IX_AttendanceMonthlySummary_MonthYear" ON "AttendanceMonthlySummary" ("MonthYear");

CREATE INDEX "IX_AttendanceMonthlySummary_BiometricCode" ON "AttendanceMonthlySummary" ("BiometricCode");

CREATE INDEX "IX_AttendanceDailyLog_SummaryId" ON "AttendanceDailyLog" ("SummaryId");

CREATE INDEX "IX_AttendanceDailyLog_MonthYear_BiometricCode" ON "AttendanceDailyLog" ("MonthYear", "BiometricCode");

CREATE TABLE "NotificationLogStatus" (
        "NotificationId" TEXT NOT NULL PRIMARY KEY,
        "NotificationType" TEXT,
        "Title" TEXT,
        "Message" TEXT,
        "Status" TEXT NOT NULL DEFAULT 'Open',
        "GeneratedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "ClosedAt" DATETIME,
        "ClosedBy" TEXT,
        "ClosedReason" TEXT,
        "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
      );

CREATE TABLE "Tasks" (
        "TaskId" INTEGER PRIMARY KEY AUTOINCREMENT,
        "Title" TEXT NOT NULL,
        "Description" TEXT,
        "Priority" TEXT NOT NULL DEFAULT 'Medium',
        "Deadline" TEXT,
        "Status" TEXT NOT NULL DEFAULT 'Pending',
        "CreatedByUserId" INTEGER NOT NULL,
        "CreatedByUsername" TEXT NOT NULL,
        "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "CompletedAt" DATETIME,
        "CompletedByUserId" INTEGER,
        "CompletedByUsername" TEXT
      );

CREATE TABLE "TaskAssignees" (
        "AssigneeId" INTEGER PRIMARY KEY AUTOINCREMENT,
        "TaskId" INTEGER NOT NULL,
        "UserId" INTEGER NOT NULL,
        "Username" TEXT NOT NULL,
        "Status" TEXT NOT NULL DEFAULT 'Pending',
        "AssignedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "AcceptedAt" DATETIME,
        "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
      );

CREATE TABLE "TaskNotifications" (
        "NotificationId" INTEGER PRIMARY KEY AUTOINCREMENT,
        "TaskId" INTEGER NOT NULL,
        "UserId" INTEGER NOT NULL,
        "FromUserId" INTEGER NOT NULL,
        "FromUsername" TEXT NOT NULL,
        "Type" TEXT NOT NULL,
        "Title" TEXT NOT NULL,
        "Message" TEXT NOT NULL,
        "Status" TEXT NOT NULL DEFAULT 'Open',
        "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "ClosedAt" DATETIME,
        "ClosedBy" TEXT
      );

CREATE INDEX "IX_TaskNotifications_User_Status" ON "TaskNotifications"("UserId", "Status");

CREATE TABLE "CRM_Leads" (
        "LeadID" INTEGER PRIMARY KEY AUTOINCREMENT,
        "DateAdded" DATE NOT NULL DEFAULT (CURRENT_DATE),
        "Customer" TEXT NOT NULL,
        "Country" TEXT DEFAULT 'India',
        "Contact" TEXT,
        "ProductRequirement" TEXT,
        "ItemCode" TEXT,
        "Stage" TEXT NOT NULL DEFAULT 'New',
        "NextAction" TEXT,
        "FollowUpDate" DATE,
        "DealValue" NUMERIC NOT NULL DEFAULT 0,
        "Remarks" TEXT,
        "Source" TEXT,
        "QtyAsked" NUMERIC,
        "OurPrice" NUMERIC,
        "TargetPrice" NUMERIC,
        "BuyerType" TEXT,
        "CanWeMake" TEXT,
        "LostReason" TEXT,
        "CreatedBy" TEXT DEFAULT 'Admin',
        "UpdatedBy" TEXT DEFAULT 'Admin',
        "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
      );

CREATE INDEX "IX_CRM_Leads_DateAdded" ON "CRM_Leads" ("DateAdded");

CREATE INDEX "IX_CRM_Leads_Stage" ON "CRM_Leads" ("Stage");

CREATE INDEX "IX_CRM_Leads_FollowUpDate" ON "CRM_Leads" ("FollowUpDate");

CREATE INDEX "IX_CRM_Leads_Customer" ON "CRM_Leads" ("Customer");

CREATE TABLE "ItemCostingConfig" (
        "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "ConfigKey" TEXT NOT NULL UNIQUE,
        "PipeRatePerMeter" NUMERIC NOT NULL DEFAULT 23.0000,
        "BrassRatePerKg" NUMERIC NOT NULL DEFAULT 950.0000,
        "HcpPipeRatePerMeter" NUMERIC NOT NULL DEFAULT 27.0000,
        "NylonInsertRate" NUMERIC NOT NULL DEFAULT 1.5000,
        "NylonNutRate" NUMERIC NOT NULL DEFAULT 2.5000,
        "SS201NutRate" NUMERIC NOT NULL DEFAULT 5.2500,
        "SS304NutRate" NUMERIC NOT NULL DEFAULT 8.0000,
        "SSInnerRate" NUMERIC NOT NULL DEFAULT 2.5000,
        "BrassInsertConv" NUMERIC NOT NULL DEFAULT 300.0000,
        "BrassInsertWeight" NUMERIC NOT NULL DEFAULT 0.0040,
        "BrassNutNConv" NUMERIC NOT NULL DEFAULT 230.0000,
        "BrassNutNWeight" NUMERIC NOT NULL DEFAULT 0.0110,
        "BrassNutPCConv" NUMERIC NOT NULL DEFAULT 350.0000,
        "BrassNutPCWeight" NUMERIC NOT NULL DEFAULT 0.0120,
        "CapRate" NUMERIC NOT NULL DEFAULT 2.5000,
        "KeyRate" NUMERIC NOT NULL DEFAULT 1.0000,
        "WasherRate" NUMERIC NOT NULL DEFAULT 0.8000,
        "LabourRate" NUMERIC NOT NULL DEFAULT 2.0000,
        "PackingRate" NUMERIC NOT NULL DEFAULT 1.0000,
        "MarginsJson" TEXT,
        "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
      );


-- Default Administrator User (admin / admin123)
INSERT OR IGNORE INTO Users (UserId, Username, Password, MobileNo, UserRole, IsActive, IsAdd, IsEdit, IsDelete, AllowedMenus)
VALUES (1, 'admin', 'admin123', '9876543210', 'ADMIN', 1, 1, 1, 1, '*');

-- Default Company Profile
INSERT INTO CompanyProfile (CompanyName, Address1, City, StateName, CountryName, Pincode, EmailID, GSTIN, BankName, AccountNo, IFSCCode, UPI, LogoPath)
SELECT 'FRM-BBP', NULL, NULL, NULL, 'India', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '/assets/app_logo.jpeg'
WHERE NOT EXISTS (SELECT 1 FROM CompanyProfile);
