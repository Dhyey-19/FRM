-- Migration 003: Add SubCode, Category, WarehouseNo, Location to ItemMaster and create composite primary key (ItemCode, SubCode)
-- Also propagate SubCode to all related transaction & master tables

-- 1. Recreate ItemMaster with composite primary key (ItemCode, SubCode)
CREATE TABLE IF NOT EXISTS "ItemMaster_new" (
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
    PRIMARY KEY ("ItemCode", "SubCode")
);

INSERT INTO "ItemMaster_new" (
    "ItemCode", "SubCode", "ItemName", "ItemType", "Category", "WarehouseNo", "Location",
    "Series", "StdWeight", "Costing", "MRP", "Unit", "OpeningStock", "ClosingStock", "HSNCode", "ReorderLevel"
)
SELECT 
    "ItemCode", 
    '', 
    "ItemName", 
    "ItemType", 
    CASE 
      WHEN "ItemCode" LIKE 'SF%' THEN 'SubContract'
      WHEN "ItemCode" LIKE 'RM%' THEN 'BOP'
      ELSE 'Inhouse'
    END,
    'WH-1',
    'Rack-A',
    "Series", 
    "StdWeight", 
    "Costing", 
    "MRP", 
    "Unit", 
    "OpeningStock", 
    "ClosingStock", 
    "HSNCode", 
    "ReorderLevel"
FROM "ItemMaster";

DROP TABLE "ItemMaster";
ALTER TABLE "ItemMaster_new" RENAME TO "ItemMaster";

-- 2. Add SubCode to InwardDetail
ALTER TABLE "InwardDetail" ADD COLUMN "SUBCODE" VARCHAR(50) DEFAULT '';

-- 3. Add SubCode to OutwardDetail
ALTER TABLE "OutwardDetail" ADD COLUMN "SUBCODE" VARCHAR(50) DEFAULT '';

-- 4. Add SubCodes to JobworkInDetail
ALTER TABLE "JobworkInDetail" ADD COLUMN "OUTSUBCODE" VARCHAR(50) DEFAULT '';
ALTER TABLE "JobworkInDetail" ADD COLUMN "INSUBCODE" VARCHAR(50) DEFAULT '';
ALTER TABLE "JobworkInDetail" ADD COLUMN "SCRAPSUBCODE" VARCHAR(50) DEFAULT '';

-- 5. Add SubCode to JobworkOutDetail
ALTER TABLE "JobworkOutDetail" ADD COLUMN "SUBCODE" VARCHAR(50) DEFAULT '';

-- 6. Add SubCode to AssemblyTransactions
ALTER TABLE "AssemblyTransactions" ADD COLUMN "SubCode" VARCHAR(50) DEFAULT '';

-- 7. Add SubCode to StockJournal
ALTER TABLE "StockJournal" ADD COLUMN "SubCode" VARCHAR(50) DEFAULT '';

-- 8. Add SubCodes to StockTransfer
ALTER TABLE "StockTransfer" ADD COLUMN "OutSubCode" VARCHAR(50) DEFAULT '';
ALTER TABLE "StockTransfer" ADD COLUMN "InSubCode" VARCHAR(50) DEFAULT '';
ALTER TABLE "StockTransfer" ADD COLUMN "ScrapSubCode" VARCHAR(50) DEFAULT '';

-- 9. Recreate BOM_Master with composite keys
CREATE TABLE IF NOT EXISTS "BOM_Master_new" (
    "ParentItemCode" VARCHAR(50) NOT NULL,
    "ParentSubCode" VARCHAR(50) NOT NULL DEFAULT '',
    "ChildItemCode" VARCHAR(50) NOT NULL,
    "ChildSubCode" VARCHAR(50) NOT NULL DEFAULT '',
    "Quantity" DECIMAL(5, 3) NOT NULL DEFAULT 0,
    PRIMARY KEY ("ParentItemCode", "ParentSubCode", "ChildItemCode", "ChildSubCode")
);

INSERT INTO "BOM_Master_new" ("ParentItemCode", "ParentSubCode", "ChildItemCode", "ChildSubCode", "Quantity")
SELECT "ParentItemCode", '', "ChildItemCode", '', "Quantity" FROM "BOM_Master";

DROP TABLE "BOM_Master";
ALTER TABLE "BOM_Master_new" RENAME TO "BOM_Master";

-- 10. Recreate DepartmentStock with composite key
CREATE TABLE IF NOT EXISTS "DepartmentStock_new" (
    "DeptID" INTEGER NOT NULL,
    "ItemCode" VARCHAR(50) NOT NULL,
    "SubCode" VARCHAR(50) NOT NULL DEFAULT '',
    "Pcs" DECIMAL(10, 3) NOT NULL DEFAULT 0,
    "Weight" DECIMAL(10, 3) NOT NULL DEFAULT 0,
    PRIMARY KEY ("DeptID", "ItemCode", "SubCode")
);

INSERT INTO "DepartmentStock_new" ("DeptID", "ItemCode", "SubCode", "Pcs", "Weight")
SELECT "DeptID", "ItemCode", '', "Pcs", "Weight" FROM "DepartmentStock";

DROP TABLE "DepartmentStock";
ALTER TABLE "DepartmentStock_new" RENAME TO "DepartmentStock";
