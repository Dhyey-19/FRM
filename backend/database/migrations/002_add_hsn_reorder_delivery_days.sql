-- Migration 002: Add HSNCode & ReorderLevel to ItemMaster, DeliveryDays to LedgerMaster
ALTER TABLE "ItemMaster" ADD COLUMN "HSNCode" VARCHAR(8);
ALTER TABLE "ItemMaster" ADD COLUMN "ReorderLevel" DECIMAL(12, 3) DEFAULT 0;
ALTER TABLE "LedgerMaster" ADD COLUMN "DeliveryDays" INTEGER DEFAULT 0;

