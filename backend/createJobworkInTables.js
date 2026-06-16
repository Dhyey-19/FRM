const { connectDB } = require('./config/db');

async function createTable() {
  try {
    const pool = await connectDB();
    
    // Drop JobworkInDetail first if it exists
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sysobjects WHERE name='JobworkInDetail' and xtype='U')
      BEGIN
          DROP TABLE [dbo].[JobworkInDetail]
          PRINT 'JobworkInDetail table dropped.'
      END
      
      IF EXISTS (SELECT * FROM sysobjects WHERE name='JobworkInHeader' and xtype='U')
      BEGIN
          DROP TABLE [dbo].[JobworkInHeader]
          PRINT 'JobworkInHeader table dropped.'
      END
    `);

    // Create JobworkInHeader
    await pool.request().query(`
      CREATE TABLE [dbo].[JobworkInHeader]
      (
          [ID]            NUMERIC(8,0) IDENTITY(1,1) NOT NULL,
          [JWINWARDNO]    VARCHAR(10) NOT NULL,
          [JWINWARDDATE]  DATE NOT NULL,
          [LEDGERID]      NUMERIC(10,0) NOT NULL,
          [JWOUTWARDNO]   VARCHAR(10) NULL,
          [TOTALAMOUNT]   NUMERIC(12,2) DEFAULT 0,
          [REMARK]        VARCHAR(100) NULL,
          [CREATEDBY]     VARCHAR(40) NOT NULL,
          [UPDATEDBY]     VARCHAR(40) NULL,

          CONSTRAINT [PK_JobworkInHeader]
              PRIMARY KEY CLUSTERED ([ID]),

          CONSTRAINT [UQ_JobworkInHeader_JWINWARDNO]
              UNIQUE ([JWINWARDNO]),

          CONSTRAINT [FK_JobworkInHeader_LedgerMaster]
              FOREIGN KEY ([LEDGERID])
              REFERENCES [dbo].[LedgerMaster]([Id])
      );
      PRINT 'JobworkInHeader table created successfully.';
    `);

    // Create JobworkInDetail
    await pool.request().query(`
      CREATE TABLE [dbo].[JobworkInDetail]
      (
          [ID]            [numeric](10, 0) IDENTITY(1,1) NOT NULL,
          [JWINWARDID]    [numeric](8, 0) NOT NULL,
          [OUTITEMCODE]   [varchar](10) NOT NULL,
          [INITEMCODE]    [varchar](10) NOT NULL,
          [GROSSWT]       [numeric](10, 3) NULL,
          [NETWT]       [numeric](10, 3) NULL,
          [SCRAPITEMCODE] [varchar](10) NULL,
          [SCRAPPCS]      [numeric](5, 2) NULL,
          [SCRAPWT]       [numeric](10, 3) NULL,
          [QUANTITY]      [numeric](10, 2) NULL,
          [PROCESS]       [varchar](20) NULL,
          [UNIT]          [varchar](10) NULL,
          [RATE]          [numeric](10, 2) NULL,
          [AMOUNT]        [numeric](12, 2) NULL,

          CONSTRAINT [PK_JobworkInDetail] PRIMARY KEY CLUSTERED ([ID] ASC),

          CONSTRAINT [FK_JobworkInDetail_InItem] FOREIGN KEY([INITEMCODE])
              REFERENCES [dbo].[ItemMaster] ([ItemCode]),

          CONSTRAINT [FK_JobworkInDetail_JobworkInHeader] FOREIGN KEY([JWINWARDID])
              REFERENCES [dbo].[JobworkInHeader] ([ID]),

          CONSTRAINT [FK_JobworkInDetail_OutItem] FOREIGN KEY([OUTITEMCODE])
              REFERENCES [dbo].[ItemMaster] ([ItemCode]),

          CONSTRAINT [FK_JobworkInDetail_ScrapItem] FOREIGN KEY([SCRAPITEMCODE])
              REFERENCES [dbo].[ItemMaster] ([ItemCode])
      );
      PRINT 'JobworkInDetail table created successfully.';
    `);
    
    console.log("Jobwork In tables created successfully.");
    process.exit(0);
  } catch (err) {
    console.error('Error creating Jobwork In tables:', err);
    process.exit(1);
  }
}

createTable();
