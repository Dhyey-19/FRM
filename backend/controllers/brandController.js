const { sql, connectDB } = require('../config/db');

// GET /api/brands
exports.getBrands = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .query(`
        SELECT BrandId, BrandName 
        FROM BrandMaster 
        ORDER BY BrandId ASC
      `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/brands
exports.createBrand = async (req, res) => {
  const { BrandName } = req.body;

  if (!BrandName || BrandName.trim() === '') {
    return res.status(400).json({ message: 'BrandName is required' });
  }

  try {
    const pool = await connectDB();
    
    // Check if brand already exists (BrandName is UNIQUE in schema)
    const checkBrand = await pool.request()
      .input('BrandName', sql.VarChar(15), BrandName)
      .query('SELECT BrandId FROM BrandMaster WHERE BrandName = @BrandName');
      
    if (checkBrand.recordset.length > 0) {
      return res.status(400).json({ message: 'Brand name already exists' });
    }

    const result = await pool.request()
      .input('BrandName', sql.VarChar(15), BrandName)
      .query(`
        INSERT INTO BrandMaster (BrandName)
        VALUES (@BrandName)
      `);

    res.status(201).json({ message: 'Brand created successfully' });
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/brands/:id
exports.updateBrand = async (req, res) => {
  const { id } = req.params;
  const { BrandName } = req.body;

  if (!BrandName || BrandName.trim() === '') {
    return res.status(400).json({ message: 'BrandName is required' });
  }

  try {
    const pool = await connectDB();

    // Check for duplicate names (excluding current brand)
    const checkBrand = await pool.request()
      .input('BrandId', sql.Int, id)
      .input('BrandName', sql.VarChar(15), BrandName)
      .query('SELECT BrandId FROM BrandMaster WHERE BrandName = @BrandName AND BrandId != @BrandId');
      
    if (checkBrand.recordset.length > 0) {
      return res.status(400).json({ message: 'Brand name already exists' });
    }

    const result = await pool.request()
      .input('BrandId', sql.Int, id)
      .input('BrandName', sql.VarChar(15), BrandName)
      .query(`
        UPDATE BrandMaster 
        SET BrandName = @BrandName
        WHERE BrandId = @BrandId
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    res.status(200).json({ message: 'Brand updated successfully' });
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/brands/:id
exports.deleteBrand = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('BrandId', sql.Int, id)
      .query(`
        DELETE FROM BrandMaster 
        WHERE BrandId = @BrandId
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    res.status(200).json({ message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/brands/bulk
exports.bulkCreateBrands = async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Array of series/brands is required' });
  }

  let added = 0;
  let skipped = 0;

  try {
    const pool = await connectDB();
    for (const item of items) {
      const rawName = item.BrandName || item['Series Name'] || item['Brand Name'] || item.Series;
      if (!rawName) continue;
      const brandName = String(rawName).trim();
      if (!brandName) continue;

      const check = await pool.request()
        .input('BrandName', sql.VarChar(15), brandName)
        .query('SELECT BrandId FROM BrandMaster WHERE BrandName = @BrandName');

      if (check.recordset.length === 0) {
        await pool.request()
          .input('BrandName', sql.VarChar(15), brandName)
          .query('INSERT INTO BrandMaster (BrandName) VALUES (@BrandName)');
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
    console.error('Error bulk creating brands:', error);
    res.status(500).json({ message: error.message || 'Server error bulk creating series' });
  }
};

