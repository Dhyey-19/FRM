const { sql, connectDB } = require('../config/db');

// GET /api/assets
exports.getAssets = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .query(`
        SELECT AssetId, AssetName, Quantity, UnitValue, 
               (ISNULL(Quantity, 0) * ISNULL(UnitValue, 0)) AS TotalValue 
        FROM Assets 
        ORDER BY AssetId ASC
      `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/assets
exports.createAsset = async (req, res) => {
  const { AssetName, Quantity, UnitValue } = req.body;

  const qty = parseInt(Quantity, 10) || 0;
  const unitVal = parseFloat(UnitValue) || 0;
  const totalVal = qty * unitVal;

  try {
    const pool = await connectDB();
    await pool.request()
      .input('AssetName', sql.VarChar(100), AssetName)
      .input('Quantity', sql.Int, qty)
      .input('UnitValue', sql.Numeric(15, 2), unitVal)
      .input('TotalValue', sql.Numeric(26, 2), totalVal)
      .query(`
        INSERT INTO Assets (AssetName, Quantity, UnitValue, TotalValue)
        VALUES (@AssetName, @Quantity, @UnitValue, @TotalValue)
      `);

    res.status(201).json({ message: 'Asset created successfully', TotalValue: totalVal });
  } catch (error) {
    console.error('Error creating asset:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/assets/:id
exports.updateAsset = async (req, res) => {
  const { id } = req.params;
  const { AssetName, Quantity, UnitValue } = req.body;

  const qty = parseInt(Quantity, 10) || 0;
  const unitVal = parseFloat(UnitValue) || 0;
  const totalVal = qty * unitVal;

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('AssetId', sql.Int, id)
      .input('AssetName', sql.VarChar(100), AssetName)
      .input('Quantity', sql.Int, qty)
      .input('UnitValue', sql.Numeric(15, 2), unitVal)
      .input('TotalValue', sql.Numeric(26, 2), totalVal)
      .query(`
        UPDATE Assets 
        SET AssetName = @AssetName, 
            Quantity = @Quantity, 
            UnitValue = @UnitValue,
            TotalValue = @TotalValue
        WHERE AssetId = @AssetId
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    res.status(200).json({ message: 'Asset updated successfully', TotalValue: totalVal });
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/assets/:id
exports.deleteAsset = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('AssetId', sql.Int, id)
      .query(`
        DELETE FROM Assets 
        WHERE AssetId = @AssetId
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    res.status(200).json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/assets/bulk
exports.bulkCreateAssets = async (req, res) => {
  const assets = req.body;
  if (!Array.isArray(assets) || assets.length === 0) {
    return res.status(400).json({ message: 'Assets array is required' });
  }

  try {
    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);

      for (const asset of assets) {
        const { AssetName, Quantity, UnitValue } = asset;

        if (!AssetName) {
          throw new Error('Asset Name is required');
        }

        const qty = parseInt(Quantity, 10) || 0;
        const unitVal = parseFloat(UnitValue) || 0;
        const totalVal = qty * unitVal;

        // Check if exists
        const checkAsset = await request
          .input('CheckAssetName', sql.VarChar(100), AssetName)
          .query('SELECT AssetId FROM Assets WHERE AssetName = @CheckAssetName');

        request.parameters = {};

        if (checkAsset.recordset.length > 0) {
          // Update existing
          await request
            .input('UpdAssetName', sql.VarChar(100), AssetName)
            .input('UpdQuantity', sql.Int, qty)
            .input('UpdUnitValue', sql.Numeric(15, 2), unitVal)
            .input('UpdTotalValue', sql.Numeric(26, 2), totalVal)
            .query(`
              UPDATE Assets 
              SET Quantity = @UpdQuantity, 
                  UnitValue = @UpdUnitValue,
                  TotalValue = @UpdTotalValue
              WHERE AssetName = @UpdAssetName
            `);
          request.parameters = {};
        } else {
          // Insert new
          await request
            .input('InsAssetName', sql.VarChar(100), AssetName)
            .input('InsQuantity', sql.Int, qty)
            .input('InsUnitValue', sql.Numeric(15, 2), unitVal)
            .input('InsTotalValue', sql.Numeric(26, 2), totalVal)
            .query(`
              INSERT INTO Assets (AssetName, Quantity, UnitValue, TotalValue)
              VALUES (@InsAssetName, @InsQuantity, @InsUnitValue, @InsTotalValue)
            `);
          request.parameters = {};
        }
      }

      await transaction.commit();
      res.status(200).json({ message: 'Assets imported successfully' });
    } catch (err) {
      await transaction.rollback();
      console.error('Transaction Error:', err);
      res.status(400).json({ message: err.message || 'Error processing assets' });
    }
  } catch (error) {
    console.error('Error in bulk import:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
