-- Migration 008: Create EInvoiceSettings table for direct NIC IRP API credentials
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

INSERT INTO "EInvoiceSettings" ("Id", "IsEnabled", "Environment", "Gstin", "ClientId", "ClientSecret", "Username", "Password", "BaseUrl")
SELECT 1, 1, 'sandbox', '24AAACF1234K1Z5', '', '', '', '', 'https://einv-apisandbox.nic.in/eivital/v1.03'
WHERE NOT EXISTS (SELECT 1 FROM "EInvoiceSettings");

