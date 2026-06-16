const { connectDB } = require('./config/db');
connectDB().then(async pool => {
  const r = await pool.request().query('SELECT TOP 5 ItemCode, ItemName, ClosingStock FROM ItemMaster');
  console.log('ItemMaster:', r.recordset);
  const r2 = await pool.request().query('SELECT * FROM DepartmentStock');
  console.log('DepartmentStock:', r2.recordset);
  process.exit();
});



















