const { connectDB } = require('./config/db');

async function createTable() {
  try {
    const pool = await connectDB();
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sysobjects WHERE name='VoucherEntry' and xtype='U')
      BEGIN
          DROP TABLE [dbo].[VoucherEntry]
      END

      CREATE TABLE [dbo].[VoucherEntry]
      (
          [VoucherId] NUMERIC(8,0) IDENTITY(1,1) PRIMARY KEY,
          [VoucherNo] NUMERIC(8,0) NOT NULL,
          [VoucherDate] DATE NOT NULL,
          [Mode] VARCHAR(6) NOT NULL,      -- Debit / Credit
          [LedgerId] NUMERIC(10, 0) NOT NULL,
          [Amount] NUMERIC(10,2) NOT NULL,
          [Through] VARCHAR(30) NULL,
          [Remark] VARCHAR(255) NULL,

          CONSTRAINT [FK_VoucherEntry_Ledger]
              FOREIGN KEY ([LedgerId])
              REFERENCES [dbo].[LedgerMaster]([Id]),

          CONSTRAINT [CK_VoucherEntry_Mode]
              CHECK ([Mode] IN ('Debit', 'Credit'))
      );
      PRINT 'Table created successfully.';
    `);
    console.log("Creation script ran successfully.");
    process.exit(0);
  } catch (err) {
    console.error('Error creating table:', err);
    process.exit(1);
  }
}

createTable();
