const { connectDB } = require('./config/db');

async function createTable() {
  try {
    const pool = await connectDB();
    
    // Drop JobworkOutDetail first if it exists
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sysobjects WHERE name='JobworkOutDetail' and xtype='U')
      BEGIN
          DROP TABLE [dbo].[JobworkOutDetail]
          PRINT 'JobworkOutDetail table dropped.'
      END
      
      IF EXISTS (SELECT * FROM sysobjects WHERE name='JobworkOutHeader' and xtype='U')
      BEGIN
          DROP TABLE [dbo].[JobworkOutHeader]
          PRINT 'JobworkOutHeader table dropped.'
      END
    `);

    // Create JobworkOutHeader
    await pool.request().query(`
      CREATE TABLE [dbo].[JobworkOutHeader]
      (
          [ID]            NUMERIC(8,0) IDENTITY(1,1) NOT NULL,
          [JWOUTWARDNO]   VARCHAR(10) NOT NULL,
          [JWOUTWARDDATE] DATE NOT NULL,
          [LEDGERID]      NUMERIC(10,0) NOT NULL,

          [REMARK]        VARCHAR(100) NULL,
          [CREATEDBY]     VARCHAR(40) NOT NULL,
          [UPDATEDBY]     VARCHAR(40) NULL,

          CONSTRAINT [PK_JobworkOutHeader]
              PRIMARY KEY CLUSTERED ([ID]),

          CONSTRAINT [UQ_JobworkOutHeader_JWOUTWARDNO]
              UNIQUE ([JWOUTWARDNO]),

          CONSTRAINT [FK_JobworkOutHeader_LedgerMaster]
              FOREIGN KEY ([LEDGERID])
              REFERENCES [dbo].[LedgerMaster]([Id])
      );
      PRINT 'JobworkOutHeader table created successfully.';
    `);

    // Create JobworkOutDetail
    await pool.request().query(`
      CREATE TABLE [dbo].[JobworkOutDetail]
      (
          [ID]          NUMERIC(10,0) IDENTITY(1,1) NOT NULL,
          [JWOUTWARDID] NUMERIC(8,0) NOT NULL,
          [ITEMCODE]    VARCHAR(10) NOT NULL,
          [GROSSWT]     NUMERIC(10,3) NULL,
          [NETWT]       NUMERIC(10,3) NULL,
          [QUANTITY]    NUMERIC(10,2) NULL,
          [UNIT]        VARCHAR(10) NULL,
          [RATE]        NUMERIC(10,2) NULL,

          CONSTRAINT [PK_JobworkOutDetail]
              PRIMARY KEY CLUSTERED ([ID]),

          CONSTRAINT [FK_JobworkOutDetail_ItemMaster]
              FOREIGN KEY ([ITEMCODE])
              REFERENCES [dbo].[ItemMaster]([ItemCode]),

          CONSTRAINT [FK_JobworkOutDetail_JobworkOutHeader]
              FOREIGN KEY ([JWOUTWARDID])
              REFERENCES [dbo].[JobworkOutHeader]([ID])
      );
      PRINT 'JobworkOutDetail table created successfully.';
    `);
    
    console.log("Jobwork Out tables created successfully.");
    process.exit(0);
  } catch (err) {
    console.error('Error creating Jobwork Out tables:', err);
    process.exit(1);
  }
}

createTable();
