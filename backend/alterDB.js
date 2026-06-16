const { sql, connectDB } = require('./config/db');

async function alterTable() {
  try {
    const pool = await connectDB();
    await pool.request().query('ALTER TABLE ItemMaster ALTER COLUMN BrandName VARCHAR(15) NULL;');
    console.log('Successfully altered table');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

alterTable();
