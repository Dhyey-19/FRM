const { sql, connectDB } = require('../config/db');

// GET /api/units
exports.getUnits = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .query(`SELECT Unit, IsSystem FROM UnitMaster ORDER BY Unit ASC`);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/units
exports.createUnit = async (req, res) => {
  const { Unit } = req.body;

  if (!Unit) {
    return res.status(400).json({ message: 'Unit is required' });
  }

  try {
    const pool = await connectDB();
    
    // Check if unit already exists
    const checkUnit = await pool.request()
      .input('Unit', sql.VarChar(10), Unit)
      .query('SELECT Unit FROM UnitMaster WHERE Unit = @Unit');
      
    if (checkUnit.recordset.length > 0) {
      return res.status(400).json({ message: 'Unit already exists' });
    }

    const result = await pool.request()
      .input('Unit', sql.VarChar(10), Unit)
      .query(`INSERT INTO UnitMaster (Unit) VALUES (@Unit)`);

    res.status(201).json({ message: 'Unit created successfully' });
  } catch (error) {
    console.error('Error creating unit:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/units/:id
exports.updateUnit = async (req, res) => {
  const { id } = req.params;
  const { Unit } = req.body;

  if (!Unit) {
    return res.status(400).json({ message: 'Unit is required' });
  }

  try {
    const pool = await connectDB();

    // Check if the unit being edited is a system unit
    const checkSys = await pool.request()
      .input('OldUnit', sql.VarChar(10), id)
      .query(`SELECT IsSystem FROM UnitMaster WHERE Unit = @OldUnit`);
      
    if (checkSys.recordset.length === 0) {
      return res.status(404).json({ message: 'Unit not found' });
    }
    
    if (checkSys.recordset[0].IsSystem === true || checkSys.recordset[0].IsSystem === 1) {
      return res.status(403).json({ message: 'System units cannot be edited' });
    }

    if (id !== Unit) {
      const checkUnit = await pool.request()
        .input('NewUnit', sql.VarChar(10), Unit)
        .query('SELECT Unit FROM UnitMaster WHERE Unit = @NewUnit');
        
      if (checkUnit.recordset.length > 0) {
        return res.status(400).json({ message: 'The new Unit already exists' });
      }
    }

    const result = await pool.request()
      .input('OldUnit', sql.VarChar(10), id)
      .input('NewUnit', sql.VarChar(10), Unit)
      .query(`
        UPDATE UnitMaster 
        SET Unit = @NewUnit
        WHERE Unit = @OldUnit
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    res.status(200).json({ message: 'Unit updated successfully' });
  } catch (error) {
    console.error('Error updating unit:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/units/:id
exports.deleteUnit = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await connectDB();
    
    // Check if the unit is a system unit
    const checkSys = await pool.request()
      .input('Unit', sql.VarChar(10), id)
      .query(`SELECT IsSystem FROM UnitMaster WHERE Unit = @Unit`);
      
    if (checkSys.recordset.length === 0) {
      return res.status(404).json({ message: 'Unit not found' });
    }
    
    if (checkSys.recordset[0].IsSystem === true || checkSys.recordset[0].IsSystem === 1) {
      return res.status(403).json({ message: 'System units cannot be deleted' });
    }

    const result = await pool.request()
      .input('Unit', sql.VarChar(10), id)
      .query(`DELETE FROM UnitMaster WHERE Unit = @Unit`);

    res.status(200).json({ message: 'Unit deleted successfully' });
  } catch (error) {
    console.error('Error deleting unit:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/units/bulk
exports.bulkCreateUnits = async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Array of units is required' });
  }

  let added = 0;
  let skipped = 0;

  try {
    const pool = await connectDB();
    for (const item of items) {
      const rawUnit = item.Unit || item['Unit Name'] || item['Unit'];
      if (!rawUnit) continue;
      const unitCode = String(rawUnit).trim().toUpperCase();
      if (!unitCode) continue;

      const check = await pool.request()
        .input('Unit', sql.VarChar(10), unitCode)
        .query('SELECT Unit FROM UnitMaster WHERE Unit = @Unit');

      if (check.recordset.length === 0) {
        await pool.request()
          .input('Unit', sql.VarChar(10), unitCode)
          .query('INSERT INTO UnitMaster (Unit, IsSystem) VALUES (@Unit, 0)');
        added++;
      } else {
        skipped++;
      }
    }

    res.status(200).json({
      message: `Processed ${items.length} records. Added: ${added}, Skipped (Already existed): ${skipped}`,
      added,
      skipped
    });
  } catch (error) {
    console.error('Error bulk creating units:', error);
    res.status(500).json({ message: error.message || 'Server error bulk creating units' });
  }
};

