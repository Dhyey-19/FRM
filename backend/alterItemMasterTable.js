const { connectDB } = require('./config/db');

const alterItemMaster = async () => {
  try {
    const pool = await connectDB();
    const request = pool.request();

    // Check if column exists
    const colCheck = await request.query(`
      SELECT * FROM sys.columns 
      WHERE Name = N'ItemType' AND Object_ID = Object_ID(N'ItemMaster')
    `);

    if (colCheck.recordset.length === 0) {
      console.log('Adding ItemType column to ItemMaster...');
      await request.query(`ALTER TABLE ItemMaster ADD ItemType VARCHAR(15) NULL`);
      console.log('Column added successfully.');
    } else {
      console.log('ItemType column already exists in ItemMaster.');
    }
  } catch (err) {
    console.error('Error altering ItemMaster table:', err);
  } finally {
    process.exit();
  }
};

alterItemMaster();
