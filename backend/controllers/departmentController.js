const { sql, connectDB } = require('../config/db');

// GET /api/departments
exports.getDepartments = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .query(`SELECT DeptID, DeptName, IsSystem FROM DepartmentMaster ORDER BY DeptName ASC`);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/departments
exports.createDepartment = async (req, res) => {
  const { DeptName } = req.body;

  if (!DeptName) {
    return res.status(400).json({ message: 'DeptName is required' });
  }

  try {
    const pool = await connectDB();
    
    // Check if department already exists
    const checkDept = await pool.request()
      .input('DeptName', sql.VarChar(20), DeptName)
      .query('SELECT DeptID FROM DepartmentMaster WHERE DeptName = @DeptName');
      
    if (checkDept.recordset.length > 0) {
      return res.status(400).json({ message: 'Department already exists' });
    }

    const result = await pool.request()
      .input('DeptName', sql.VarChar(20), DeptName)
      .query(`INSERT INTO DepartmentMaster (DeptName) VALUES (@DeptName)`);

    res.status(201).json({ message: 'Department created successfully' });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/departments/:id
exports.updateDepartment = async (req, res) => {
  const { id } = req.params;
  const { DeptName } = req.body;

  if (!DeptName) {
    return res.status(400).json({ message: 'DeptName is required' });
  }

  try {
    const pool = await connectDB();

    const checkSys = await pool.request()
      .input('DeptID', sql.Int, id)
      .query(`SELECT IsSystem FROM DepartmentMaster WHERE DeptID = @DeptID`);
      
    if (checkSys.recordset.length === 0) {
      return res.status(404).json({ message: 'Department not found' });
    }
    
    if (checkSys.recordset[0].IsSystem === true || checkSys.recordset[0].IsSystem === 1) {
      return res.status(403).json({ message: 'System departments cannot be edited' });
    }

    const checkDept = await pool.request()
      .input('DeptName', sql.VarChar(20), DeptName)
      .input('DeptID', sql.Int, id)
      .query('SELECT DeptID FROM DepartmentMaster WHERE DeptName = @DeptName AND DeptID != @DeptID');
      
    if (checkDept.recordset.length > 0) {
      return res.status(400).json({ message: 'The new Department name already exists' });
    }

    const result = await pool.request()
      .input('DeptID', sql.Int, id)
      .input('DeptName', sql.VarChar(20), DeptName)
      .query(`
        UPDATE DepartmentMaster 
        SET DeptName = @DeptName
        WHERE DeptID = @DeptID
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Department not found' });
    }

    res.status(200).json({ message: 'Department updated successfully' });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/departments/:id
exports.deleteDepartment = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await connectDB();
    
    const checkSys = await pool.request()
      .input('DeptID', sql.Int, id)
      .query(`SELECT IsSystem FROM DepartmentMaster WHERE DeptID = @DeptID`);
      
    if (checkSys.recordset.length === 0) {
      return res.status(404).json({ message: 'Department not found' });
    }
    
    if (checkSys.recordset[0].IsSystem === true || checkSys.recordset[0].IsSystem === 1) {
      return res.status(403).json({ message: 'System departments cannot be deleted' });
    }

    const result = await pool.request()
      .input('DeptID', sql.Int, id)
      .query(`DELETE FROM DepartmentMaster WHERE DeptID = @DeptID`);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Department not found' });
    }

    res.status(200).json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/departments/stock
exports.getDepartmentStockReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      WITH TransferRates AS (
        SELECT 
          ds.DeptID,
          ds.ItemCode,
          ISNULL(ds.SubCode, '') AS SubCode,
          COALESCE(
            (SELECT TOP 1 st.Rate FROM StockTransfer st WHERE st.ToDeptID = ds.DeptID AND st.InItemCode = ds.ItemCode AND ISNULL(st.InSubCode, '') = ISNULL(ds.SubCode, '') AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
            (SELECT TOP 1 st.Rate FROM StockTransfer st WHERE st.FromDeptID = ds.DeptID AND st.OutItemCode = ds.ItemCode AND ISNULL(st.OutSubCode, '') = ISNULL(ds.SubCode, '') AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
            (SELECT TOP 1 st.Rate FROM StockTransfer st WHERE ((st.InItemCode = ds.ItemCode AND ISNULL(st.InSubCode, '') = ISNULL(ds.SubCode, '')) OR (st.OutItemCode = ds.ItemCode AND ISNULL(st.OutSubCode, '') = ISNULL(ds.SubCode, ''))) AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
            im.Costing,
            0
          ) AS TransferRate,
          COALESCE(
            (SELECT TOP 1 st.Unit FROM StockTransfer st WHERE st.ToDeptID = ds.DeptID AND st.InItemCode = ds.ItemCode AND ISNULL(st.InSubCode, '') = ISNULL(ds.SubCode, '') AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
            (SELECT TOP 1 st.Unit FROM StockTransfer st WHERE st.FromDeptID = ds.DeptID AND st.OutItemCode = ds.ItemCode AND ISNULL(st.OutSubCode, '') = ISNULL(ds.SubCode, '') AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
            (SELECT TOP 1 st.Unit FROM StockTransfer st WHERE ((st.InItemCode = ds.ItemCode AND ISNULL(st.InSubCode, '') = ISNULL(ds.SubCode, '')) OR (st.OutItemCode = ds.ItemCode AND ISNULL(st.OutSubCode, '') = ISNULL(ds.SubCode, ''))) AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
            im.Unit
          ) AS ValuationUnit
        FROM DepartmentStock ds
        JOIN ItemMaster im ON ds.ItemCode = im.ItemCode AND ISNULL(ds.SubCode, '') = ISNULL(im.SubCode, '')
      )
      SELECT 
        ds.DeptID, 
        dm.DeptName, 
        ds.ItemCode, 
        ISNULL(ds.SubCode, '') AS SubCode,
        im.ItemName,
        im.Costing AS MasterCosting,
        tr.TransferRate AS Costing,
        tr.TransferRate AS Rate,
        tr.ValuationUnit AS Unit,
        ISNULL(ds.Pcs, 0) AS Pcs, 
        ISNULL(ds.Weight, 0) AS Weight,
        ROUND(
          (CASE 
            WHEN UPPER(tr.ValuationUnit) IN ('KG', 'KGS') AND ISNULL(ds.Weight, 0) != 0 THEN ISNULL(ds.Weight, 0)
            WHEN UPPER(tr.ValuationUnit) NOT IN ('KG', 'KGS') AND ISNULL(ds.Pcs, 0) != 0 THEN ISNULL(ds.Pcs, 0)
            WHEN ISNULL(ds.Weight, 0) != 0 THEN ISNULL(ds.Weight, 0)
            ELSE ISNULL(ds.Pcs, 0)
          END) * tr.TransferRate,
          2
        ) AS Valuation
      FROM DepartmentStock ds
      LEFT JOIN DepartmentMaster dm ON ds.DeptID = dm.DeptID
      LEFT JOIN ItemMaster im ON ds.ItemCode = im.ItemCode AND ISNULL(ds.SubCode, '') = ISNULL(im.SubCode, '')
      JOIN TransferRates tr ON ds.DeptID = tr.DeptID AND ds.ItemCode = tr.ItemCode AND ISNULL(ds.SubCode, '') = tr.SubCode
      ORDER BY dm.DeptName ASC, im.ItemName ASC
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching department stock report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
