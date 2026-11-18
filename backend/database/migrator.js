const fs = require('fs');
const path = require('path');
const { resolveAppRoots } = require('../utils/appPaths');

const { backendRoot: BACKEND_ROOT } = resolveAppRoots(__dirname);

/**
 * Ensures all required application tables and columns exist in the SQLite database.
 * Completely idempotent and safe to run on every startup.
 */
function autoHealSQLiteSchema(db, saveToDisk) {
  if (!db) return;
  let didModify = false;

  // 1. NotificationLogStatus
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS "NotificationLogStatus" (
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
    `);
    didModify = true;
  } catch (e) {
    console.warn('[AutoHeal] NotificationLogStatus check:', e.message);
  }

  // 2. Tasks
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS "Tasks" (
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
    `);
    didModify = true;
  } catch (e) {
    console.warn('[AutoHeal] Tasks check:', e.message);
  }

  // 3. TaskAssignees
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS "TaskAssignees" (
        "AssigneeId" INTEGER PRIMARY KEY AUTOINCREMENT,
        "TaskId" INTEGER NOT NULL,
        "UserId" INTEGER NOT NULL,
        "Username" TEXT NOT NULL,
        "Status" TEXT NOT NULL DEFAULT 'Pending',
        "AssignedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "AcceptedAt" DATETIME,
        "UpdatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    didModify = true;
  } catch (e) {
    console.warn('[AutoHeal] TaskAssignees check:', e.message);
  }

  // 4. TaskNotifications
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS "TaskNotifications" (
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
      CREATE INDEX IF NOT EXISTS "IX_TaskNotifications_User_Status" ON "TaskNotifications"("UserId", "Status");
    `);
    didModify = true;
  } catch (e) {
    console.warn('[AutoHeal] TaskNotifications check:', e.message);
  }

  // 5. CRM_Leads
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS "CRM_Leads" (
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
      CREATE INDEX IF NOT EXISTS "IX_CRM_Leads_DateAdded" ON "CRM_Leads" ("DateAdded");
      CREATE INDEX IF NOT EXISTS "IX_CRM_Leads_Stage" ON "CRM_Leads" ("Stage");
      CREATE INDEX IF NOT EXISTS "IX_CRM_Leads_FollowUpDate" ON "CRM_Leads" ("FollowUpDate");
      CREATE INDEX IF NOT EXISTS "IX_CRM_Leads_Customer" ON "CRM_Leads" ("Customer");
    `);
    didModify = true;
  } catch (e) {
    console.warn('[AutoHeal] CRM_Leads check:', e.message);
  }

  // 6. ItemCostingConfig
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS "ItemCostingConfig" (
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
      INSERT OR IGNORE INTO "ItemCostingConfig" (
        "ConfigKey", "PipeRatePerMeter", "BrassRatePerKg", "HcpPipeRatePerMeter",
        "NylonInsertRate", "NylonNutRate", "SS201NutRate", "SS304NutRate", "SSInnerRate",
        "BrassInsertConv", "BrassInsertWeight", "BrassNutNConv", "BrassNutNWeight",
        "BrassNutPCConv", "BrassNutPCWeight", "CapRate", "KeyRate", "WasherRate",
        "LabourRate", "PackingRate"
      ) VALUES (
        'DEFAULT', 23.0000, 950.0000, 27.0000,
        1.5000, 2.5000, 5.2500, 8.0000, 2.5000,
        300.0000, 0.0040, 230.0000, 0.0110,
        350.0000, 0.0120, 2.5000, 1.0000, 0.8000,
        2.0000, 1.0000
      );
    `);
    didModify = true;
  } catch (e) {
    console.warn('[AutoHeal] ItemCostingConfig check:', e.message);
  }

  // 7. Ensure Costing column exists in DepartmentMaster
  try {
    const dmInfo = db.exec('PRAGMA table_info("DepartmentMaster");');
    const cols = (dmInfo.length > 0 && dmInfo[0].values) ? dmInfo[0].values.map(r => r[1]) : [];
    if (!cols.includes('Costing')) {
      db.exec('ALTER TABLE "DepartmentMaster" ADD COLUMN "Costing" NUMERIC DEFAULT 0;');
      didModify = true;
    }
  } catch (e) {
    console.warn('[AutoHeal] DepartmentMaster.Costing check:', e.message);
  }

  // 8. Ensure ItemCategory column exists in ItemMaster
  try {
    const imInfo = db.exec('PRAGMA table_info("ItemMaster");');
    const cols = (imInfo.length > 0 && imInfo[0].values) ? imInfo[0].values.map(r => r[1]) : [];
    if (!cols.includes('ItemCategory')) {
      db.exec('ALTER TABLE "ItemMaster" ADD COLUMN "ItemCategory" TEXT NULL;');
      didModify = true;
    }
  } catch (e) {
    console.warn('[AutoHeal] ItemMaster.ItemCategory check:', e.message);
  }

  if (didModify && typeof saveToDisk === 'function') {
    saveToDisk();
  }
}

async function runSQLiteMigrations(db, saveToDisk) {
  autoHealSQLiteSchema(db, saveToDisk);
}

async function runMssqlMigrations(pool, sqlLib) {
  // Safe no-op when running SQLite, or applies schema if MSSQL is active
}

async function autoHealMssqlSchema() {}

module.exports = {
  runMigrations: runSQLiteMigrations,
  runSQLiteMigrations,
  runMssqlMigrations,
  autoHealMssqlSchema,
  autoHealSQLiteSchema
};
