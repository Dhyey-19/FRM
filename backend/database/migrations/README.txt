=====================================================================
            FRM - DATABASE MIGRATIONS FOLDER
=====================================================================

HOW TO MAKE DATABASE SCHEMA & DATA CHANGES ON LIVE PRODUCTION:
--------------------------------------------------------------
Whenever you need to add a new table, add a new column, alter data, or create
an index, DO NOT replace the live "FRM-BBP.db" file!

Instead, simply create a new SQL file in this folder with a sequential number:

Examples:
  001_add_notes_to_items.sql
  002_create_purchase_order_table.sql
  003_add_discount_to_inward.sql

SAMPLE MIGRATION SQL SYNTAX:
----------------------------
1. Add a new column to an existing table:
   ALTER TABLE "ItemMaster" ADD COLUMN "ItemNotes" TEXT;

2. Add a new numeric column with a default value:
   ALTER TABLE "ItemMaster" ADD COLUMN "DiscountPercentage" REAL DEFAULT 0.0;

3. Create a new table:
   CREATE TABLE IF NOT EXISTS "AuditLog" (
     "LogId" INTEGER PRIMARY KEY AUTOINCREMENT,
     "Action" TEXT NOT NULL,
     "Timestamp" DATETIME DEFAULT CURRENT_TIMESTAMP
   );

4. Insert or update default system lookup data:
   INSERT OR IGNORE INTO "UnitMaster" ("Unit", "IsSystem") VALUES ('DRUM', 0);

HOW IT WORKS:
-------------
- When FRM starts (locally or on GoDaddy), it checks this folder.
- It compares against the "_Migrations" table in the database.
- Any new SQL file is executed ONCE inside a safe transaction.
- All existing customer invoices, ledgers, vouchers, and users are 100% PRESERVED.
- You can safely deploy code updates without wiping customer data!
=====================================================================

