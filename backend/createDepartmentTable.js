const { connectDB, sql } = require('./config/db');

const createDepartmentTable = async () => {
  try {
    const pool = await connectDB();
    const query = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DepartmentMaster' and xtype='U')
      BEGIN
        CREATE TABLE [dbo].[DepartmentMaster](
          [DeptID] [int] IDENTITY(1,1) NOT NULL,
          [DeptName] [varchar](20) NOT NULL
        ) ON [PRIMARY];
        
        ALTER TABLE [dbo].[DepartmentMaster] ADD PRIMARY KEY CLUSTERED 
        (
          [DeptID] ASC
        ) WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY];
        
        PRINT 'DepartmentMaster table created successfully.';
      END
      ELSE
      BEGIN
        PRINT 'DepartmentMaster table already exists.';
      END
    `;
    await pool.request().query(query);
    console.log('Department Master migration completed.');
  } catch (err) {
    console.error('Error creating DepartmentMaster table:', err);
  } finally {
    process.exit(0);
  }
};

createDepartmentTable();
