const { connectDB } = require('./config/db');

async function createTable() {
  try {
    const pool = await connectDB();
    
    // Create InwardHeader table
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sysobjects WHERE name='InwardDetail' and xtype='U')
      BEGIN
          DROP TABLE [dbo].[InwardDetail]
      END
      
      IF EXISTS (SELECT * FROM sysobjects WHERE name='InwardHeader' and xtype='U')
      BEGIN
          DROP TABLE [dbo].[InwardHeader]
      END

      CREATE TABLE [dbo].[InwardHeader]
      (
          [ID] NUMERIC(8,0) IDENTITY(1,1) PRIMARY KEY,
          [INWARDNO] VARCHAR(10) NOT NULL UNIQUE,
          [INWARDDATE] DATE NOT NULL,
          [LEDGERID] NUMERIC(10,0) NOT NULL,
          [EXPENSE] NUMERIC(10,2) DEFAULT 0,
          [GST] NUMERIC(10,2) DEFAULT 0,
          [GSTAMOUNT] NUMERIC(10,2) DEFAULT 0,
          [ROUNDOFF] NUMERIC(10,2) DEFAULT 0,
          [TOTALAMOUNT] NUMERIC(12,2) DEFAULT 0,
          [REMARK] VARCHAR(100),
          [CREATEDBY] VARCHAR(40) NOT NULL,
          [UPDATEDBY] VARCHAR(40),

          CONSTRAINT [FK_InwardHeader_LedgerMaster]
              FOREIGN KEY ([LEDGERID])
              REFERENCES [dbo].[LedgerMaster]([ID])
      );
      PRINT 'InwardHeader table created successfully.';
    `);

    // Create InwardDetail table
    await pool.request().query(`
      CREATE TABLE [dbo].[InwardDetail]
      (
          [ID] NUMERIC(10,0) IDENTITY(1,1) PRIMARY KEY,
          [INWARDID] NUMERIC(8,0) NOT NULL,
          [ITEMCODE] VARCHAR(10) NOT NULL,
          [GROSSWT] NUMERIC(10,3),
          [NETWT] NUMERIC(10,3),
          [SAMPLEPCS] NUMERIC(5,2),
          [SAMPLEWT] NUMERIC(10,3),
          [QUANTITY] NUMERIC(10,2),
          [UNIT] VARCHAR(10),
          [RATE] NUMERIC(10,2),
          [AMOUNT] NUMERIC(12,2),

          CONSTRAINT [FK_InwardDetail_InwardHeader]
              FOREIGN KEY ([INWARDID])
              REFERENCES [dbo].[InwardHeader]([ID]),

          CONSTRAINT [FK_InwardDetail_ItemMaster]
              FOREIGN KEY ([ITEMCODE])
              REFERENCES [dbo].[ItemMaster]([ITEMCODE])
      );
      PRINT 'InwardDetail table created successfully.';
    `);
    
    console.log("Inward tables creation script ran successfully.");
    process.exit(0);
  } catch (err) {
    console.error('Error creating inward tables:', err);
    process.exit(1);
  }
}

createTable();
