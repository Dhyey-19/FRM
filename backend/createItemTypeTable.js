const { connectDB } = require('./config/db');

const createItemTypeTable = async () => {
  try {
    const pool = await connectDB();
    const request = pool.request();

    const tableCheck = await request.query(`
      SELECT * FROM sysobjects WHERE name='ItemTypeMaster' and xtype='U'
    `);

    if (tableCheck.recordset.length === 0) {
      console.log('Creating ItemTypeMaster table...');
      await request.query(`
        CREATE TABLE [dbo].[ItemTypeMaster] (
            [ItemType] VARCHAR (15) NOT NULL,
            CONSTRAINT [PK_ItemTypeMaster] PRIMARY KEY CLUSTERED ([ItemType] ASC)
        );
      `);
      console.log('ItemTypeMaster table created successfully.');
    } else {
      console.log('ItemTypeMaster table already exists.');
    }
  } catch (err) {
    console.error('Error creating ItemTypeMaster table:', err);
  } finally {
    process.exit();
  }
};

createItemTypeTable();
