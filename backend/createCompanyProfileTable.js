const { connectDB } = require('./config/db');

async function createTable() {
  try {
    const pool = await connectDB();
    
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CompanyProfile' and xtype='U')
      BEGIN
        CREATE TABLE [dbo].[CompanyProfile]
        (
            [CompanyName]   VARCHAR(200) NOT NULL,
            [Address1]      VARCHAR(250),
            [Address2]      VARCHAR(250),
            [City]          VARCHAR(100),
            [StateName]     VARCHAR(100),
            [CountryName]   VARCHAR(100),
            [Pincode]       VARCHAR(20),

            [ContactPerson] VARCHAR(100),
            [PhoneNo]       VARCHAR(50),
            [MobileNo]      VARCHAR(50),
            [EmailID]       VARCHAR(150),
            [Website]       VARCHAR(200),

            [GSTIN]         VARCHAR(20),
            [PANNo]         VARCHAR(20),

            [BankName]      VARCHAR(150),
            [BranchName]    VARCHAR(150),
            [AccountNo]     VARCHAR(50),
            [IFSCCode]      VARCHAR(20),
            [UPI]           VARCHAR(50)
        );
        PRINT 'CompanyProfile table created successfully.';
      END
      ELSE
      BEGIN
        PRINT 'CompanyProfile table already exists.';
      END
    `);
    
    console.log("CompanyProfile table check/creation script ran successfully.");
    process.exit(0);
  } catch (err) {
    console.error('Error creating CompanyProfile table:', err);
    process.exit(1);
  }
}

createTable();
