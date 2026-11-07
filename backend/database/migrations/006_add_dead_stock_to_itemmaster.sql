-- Migration 006: Add Dead Stock declaration fields to ItemMaster
-- DeadStockType: 'None', 'Auto', 'Manual'
-- DeadStockDays: Inactivity threshold days for Auto detection (e.g. 30, 60, 90, 180, 365)
-- IsDeadStock: Flag (1 = Dead Stock, 0 = Active / Normal)

ALTER TABLE "ItemMaster" ADD COLUMN "DeadStockType" VARCHAR(20) DEFAULT 'None';
ALTER TABLE "ItemMaster" ADD COLUMN "DeadStockDays" INTEGER DEFAULT 0;
ALTER TABLE "ItemMaster" ADD COLUMN "IsDeadStock" INTEGER DEFAULT 0;

