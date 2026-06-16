const { connectDB } = require('./config/db');
connectDB().then(async pool => {
  const r = await pool.request().query("SELECT * FROM DepartmentMaster");
  console.log('DepartmentMaster:', r.recordset);
  process.exit();
});
