const { sql, connectDB } = require('../config/db');

// GET /api/bom/report
exports.getAllBOMReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
        b.ParentItemCode,
        p.ItemName AS ParentItemName,
        p.Series AS ParentBrandName,
        b.ChildItemCode,
        c.ItemName AS ChildItemName,
        b.Quantity,
        ISNULL(c.Costing, 0) AS ChildCosting,
        CAST((b.Quantity * ISNULL(c.Costing, 0)) AS NUMERIC(15,2)) AS TotalChildCost
      FROM BOM_Master b
      INNER JOIN ItemMaster p ON b.ParentItemCode = p.ItemCode
      INNER JOIN ItemMaster c ON b.ChildItemCode = c.ItemCode
      ORDER BY b.ParentItemCode ASC, b.ChildItemCode ASC
    `);
    
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching BOM Report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/bom/:parentCode
exports.getBOMByParent = async (req, res) => {
  const { parentCode } = req.params;

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('ParentItemCode', sql.VarChar(10), parentCode)
      .query(`
        SELECT b.ChildItemCode, i.ItemName, i.Unit, b.Quantity
        FROM BOM_Master b
        INNER JOIN ItemMaster i ON b.ChildItemCode = i.ItemCode
        WHERE b.ParentItemCode = @ParentItemCode
        ORDER BY b.ChildItemCode ASC
      `);
      
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching BOM:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/bom
exports.saveBOM = async (req, res) => {
  const { ParentItemCode, items } = req.body;

  if (!ParentItemCode || !Array.isArray(items)) {
    return res.status(400).json({ message: 'ParentItemCode and an array of items are required' });
  }

  try {
    const pool = await connectDB();
    
    // Start a transaction for deleting existing and inserting new
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);

      // 1. Delete existing BOM for this parent
      await request
        .input('ParentItemCode', sql.VarChar(10), ParentItemCode)
        .query('DELETE FROM BOM_Master WHERE ParentItemCode = @ParentItemCode');

      // 2. Insert new child items
      for (const item of items) {
        if (!item.ChildItemCode || item.Quantity === undefined) continue;
        
        const insertReq = new sql.Request(transaction);
        await insertReq
          .input('ParentItemCode', sql.VarChar(10), ParentItemCode)
          .input('ChildItemCode', sql.VarChar(10), item.ChildItemCode)
          .input('Quantity', sql.Numeric(5, 3), parseFloat(item.Quantity) || 0)
          .query(`
            INSERT INTO BOM_Master (ParentItemCode, ChildItemCode, Quantity)
            VALUES (@ParentItemCode, @ChildItemCode, @Quantity)
          `);
      }

      await transaction.commit();
      res.status(200).json({ message: 'BOM saved successfully' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error saving BOM:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/bom/:parentCode
exports.deleteBOM = async (req, res) => {
  const { parentCode } = req.params;

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('ParentItemCode', sql.VarChar(10), parentCode)
      .query('DELETE FROM BOM_Master WHERE ParentItemCode = @ParentItemCode');

    if (result.rowsAffected && result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'BOM not found for this item' });
    }

    res.status(200).json({ message: 'BOM deleted successfully' });
  } catch (error) {
    console.error('Error deleting BOM:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/bom/bulk
exports.bulkCreateBOM = async (req, res) => {
  const boms = req.body;
  if (!Array.isArray(boms) || boms.length === 0) {
    return res.status(400).json({ message: 'BOM array is required' });
  }

  const results = {
    added: [],
    updated: [],
    failed: []
  };

  try {
    const pool = await connectDB();
    const request = new sql.Request(pool);

    for (const bom of boms) {
      const { ParentItemCode, ChildItemCode, Quantity } = bom;

      if (!ParentItemCode || !ChildItemCode || Quantity === undefined) {
        results.failed.push({ item: bom, reason: 'ParentItemCode, ChildItemCode, and Quantity are required' });
        continue;
      }

      try {
        const checkBOM = await request
          .input('CheckParent', sql.VarChar(10), ParentItemCode)
          .input('CheckChild', sql.VarChar(10), ChildItemCode)
          .query('SELECT ParentItemCode FROM BOM_Master WHERE ParentItemCode = @CheckParent AND ChildItemCode = @CheckChild');
        
        request.parameters = {};

        if (checkBOM.recordset.length > 0) {
          // Update
          await request
            .input('UpdParent', sql.VarChar(10), ParentItemCode)
            .input('UpdChild', sql.VarChar(10), ChildItemCode)
            .input('UpdQty', sql.Numeric(10, 3), parseFloat(Quantity) || 0)
            .query('UPDATE BOM_Master SET Quantity = @UpdQty WHERE ParentItemCode = @UpdParent AND ChildItemCode = @UpdChild');
          request.parameters = {};
          results.updated.push(bom);
        } else {
          // Insert
          await request
            .input('InsParent', sql.VarChar(10), ParentItemCode)
            .input('InsChild', sql.VarChar(10), ChildItemCode)
            .input('InsQty', sql.Numeric(10, 3), parseFloat(Quantity) || 0)
            .query('INSERT INTO BOM_Master (ParentItemCode, ChildItemCode, Quantity) VALUES (@InsParent, @InsChild, @InsQty)');
          request.parameters = {};
          results.added.push(bom);
        }
      } catch (err) {
        request.parameters = {};
        results.failed.push({ item: bom, reason: err.message });
      }
    }
    
    res.status(200).json(results);
  } catch (error) {
    console.error('Error in bulk BOM import:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
