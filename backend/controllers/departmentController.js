const { sql, connectDB } = require('../config/db');

// GET /api/departments
exports.getDepartments = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .query(`SELECT DeptID, DeptName, ISNULL(Costing, 0) AS Costing, IsSystem FROM DepartmentMaster ORDER BY DeptName ASC`);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/departments
exports.createDepartment = async (req, res) => {
  const { DeptName, Costing } = req.body;

  if (!DeptName) {
    return res.status(400).json({ message: 'DeptName is required' });
  }

  const numCosting = parseFloat(Costing) || 0;

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
      .input('Costing', sql.Numeric(15, 2), numCosting)
      .query(`INSERT INTO DepartmentMaster (DeptName, Costing) VALUES (@DeptName, @Costing)`);

    res.status(201).json({ message: 'Department created successfully' });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/departments/:id
exports.updateDepartment = async (req, res) => {
  const { id } = req.params;
  const { DeptName, Costing } = req.body;

  if (!DeptName) {
    return res.status(400).json({ message: 'DeptName is required' });
  }

  const numCosting = parseFloat(Costing) || 0;

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
      .input('Costing', sql.Numeric(15, 2), numCosting)
      .query(`
        UPDATE DepartmentMaster 
        SET DeptName = @DeptName, Costing = @Costing
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
      SELECT 
        ds.DeptID, 
        dm.DeptName, 
        ds.ItemCode, 
        ISNULL(ds.SubCode, '') AS SubCode,
        im.ItemName,
        ISNULL(im.Costing, 0) AS MasterCosting,
        ISNULL(dm.Costing, 0) AS Costing,
        ISNULL(dm.Costing, 0) AS Rate,
        im.Unit AS Unit,
        ISNULL(ds.Pcs, 0) AS Pcs, 
        ISNULL(ds.Weight, 0) AS Weight,
        ROUND(
          (CASE 
            WHEN UPPER(im.Unit) IN ('KG', 'KGS') AND ISNULL(ds.Weight, 0) != 0 THEN ISNULL(ds.Weight, 0)
            WHEN UPPER(im.Unit) NOT IN ('KG', 'KGS') AND ISNULL(ds.Pcs, 0) != 0 THEN ISNULL(ds.Pcs, 0)
            WHEN ISNULL(ds.Weight, 0) != 0 THEN ISNULL(ds.Weight, 0)
            ELSE ISNULL(ds.Pcs, 0)
          END) * ISNULL(dm.Costing, 0),
          2
        ) AS Valuation
      FROM DepartmentStock ds
      JOIN DepartmentMaster dm ON ds.DeptID = dm.DeptID
      JOIN ItemMaster im ON ds.ItemCode = im.ItemCode AND ISNULL(ds.SubCode, '') = ISNULL(im.SubCode, '')
      ORDER BY dm.DeptName ASC, im.ItemName ASC
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching department stock report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/departments/bulk
exports.bulkCreateDepartments = async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Array of departments is required' });
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const failed = [];

  try {
    const pool = await connectDB();
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const excelRowNum = item.__rowNum__ || (index + 2);
      const rawName = item.DeptName || item['Department Name'] || item.DepartmentName || item.Department;
      if (!rawName) {
        failed.push({ rowNumber: excelRowNum, reason: `Excel Row #${excelRowNum}: Department Name is missing` });
        skipped++;
        continue;
      }
      const deptName = String(rawName).trim();
      if (!deptName) {
        failed.push({ rowNumber: excelRowNum, reason: `Excel Row #${excelRowNum}: Department Name is blank` });
        skipped++;
        continue;
      }

      const numCosting = parseFloat(item.Costing !== undefined ? item.Costing : item['Costing']) || 0;

      try {
        const check = await pool.request()
          .input('DeptName', sql.VarChar(20), deptName)
          .query('SELECT DeptID FROM DepartmentMaster WHERE DeptName = @DeptName');

        if (check.recordset.length === 0) {
          await pool.request()
            .input('DeptName', sql.VarChar(20), deptName)
            .input('Costing', sql.Numeric(15, 2), numCosting)
            .query('INSERT INTO DepartmentMaster (DeptName, Costing) VALUES (@DeptName, @Costing)');
          added++;
        } else {
          await pool.request()
            .input('DeptName', sql.VarChar(20), deptName)
            .input('Costing', sql.Numeric(15, 2), numCosting)
            .query('UPDATE DepartmentMaster SET Costing = @Costing WHERE DeptName = @DeptName');
          updated++;
        }
      } catch (rowErr) {
        failed.push({ rowNumber: excelRowNum, reason: `Excel Row #${excelRowNum}: ${rowErr.message}` });
        skipped++;
      }
    }

    let summaryMsg = `Processed ${items.length} records. Added: ${added}, Updated: ${updated}`;
    if (failed.length > 0) {
      summaryMsg += `. Failed rows: ${failed.map(f => f.reason).join('; ')}`;
    }

    res.status(200).json({
      message: summaryMsg,
      added,
      updated,
      skipped,
      failed
    });
  } catch (error) {
    console.error('Error bulk creating departments:', error);
    res.status(500).json({ message: error.message || 'Server error bulk creating departments' });
  }
};

