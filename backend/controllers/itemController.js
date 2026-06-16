const { sql, connectDB } = require('../config/db');

// GET /api/items
exports.getItems = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .query(`
        SELECT ItemCode, ItemName, ItemType, BrandName, Unit, MRP, COSTING, OpeningStock, ClosingStock 
        FROM ItemMaster 
        ORDER BY ItemCode ASC
      `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/items
exports.createItem = async (req, res) => {
  const { ItemCode, ItemName, ItemType, BrandName, Unit, MRP, COSTING, OpeningStock, ClosingStock } = req.body;

  if (!ItemCode || !ItemName || !Unit) {
    return res.status(400).json({ message: 'ItemCode, ItemName, and Unit are required' });
  }

  try {
    const pool = await connectDB();
    
    // Check if item already exists (ItemCode is PRIMARY KEY)
    const checkItem = await pool.request()
      .input('ItemCode', sql.VarChar(10), ItemCode)
      .query('SELECT ItemCode FROM ItemMaster WHERE ItemCode = @ItemCode');
      
    if (checkItem.recordset.length > 0) {
      return res.status(400).json({ message: 'ItemCode already exists' });
    }

    const result = await pool.request()
      .input('ItemCode', sql.VarChar(10), ItemCode)
      .input('ItemName', sql.VarChar(50), ItemName)
      .input('ItemType', sql.VarChar(15), ItemType || null)
      .input('BrandName', sql.VarChar(15), BrandName || null)
      .input('Unit', sql.VarChar(10), Unit || null)
      .input('MRP', sql.Numeric(10, 0), MRP || 0)
      .input('COSTING', sql.Numeric(10, 0), COSTING || 0)
      .input('OpeningStock', sql.Numeric(12, 3), OpeningStock || 0)
      .input('ClosingStock', sql.Numeric(12, 3), ClosingStock !== undefined && ClosingStock !== null && ClosingStock !== '' ? ClosingStock : (OpeningStock || 0))
      .query(`
        INSERT INTO ItemMaster (ItemCode, ItemName, ItemType, BrandName, Unit, MRP, Costing, OpeningStock, ClosingStock)
        VALUES (@ItemCode, @ItemName, @ItemType, @BrandName, @Unit, @MRP, @COSTING, @OpeningStock, @ClosingStock)
      `);

    res.status(201).json({ message: 'Item created successfully' });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/items/:id
exports.updateItem = async (req, res) => {
  // Using original ItemCode as the ID parameter
  const { id } = req.params;
  const { ItemCode, ItemName, ItemType, BrandName, Unit, MRP, COSTING, OpeningStock, ClosingStock } = req.body;

  if (!ItemCode || !ItemName || !Unit) {
    return res.status(400).json({ message: 'ItemCode, ItemName, and Unit are required' });
  }

  try {
    const pool = await connectDB();

    // If they are trying to change the ItemCode, ensure the new one doesn't already exist
    if (id !== ItemCode) {
      const checkItem = await pool.request()
        .input('NewItemCode', sql.VarChar(10), ItemCode)
        .query('SELECT ItemCode FROM ItemMaster WHERE ItemCode = @NewItemCode');
        
      if (checkItem.recordset.length > 0) {
        return res.status(400).json({ message: 'The new ItemCode already exists' });
      }
    }

    const result = await pool.request()
      .input('OldItemCode', sql.VarChar(10), id)
      .input('NewItemCode', sql.VarChar(10), ItemCode)
      .input('ItemName', sql.VarChar(50), ItemName)
      .input('ItemType', sql.VarChar(15), ItemType || null)
      .input('BrandName', sql.VarChar(15), BrandName || null)
      .input('Unit', sql.VarChar(10), Unit || null)
      .input('MRP', sql.Numeric(10, 0), MRP || 0)
      .input('COSTING', sql.Numeric(10, 0), COSTING || 0)
      .input('OpeningStock', sql.Numeric(12, 3), OpeningStock || 0)
      .input('ClosingStock', sql.Numeric(12, 3), ClosingStock !== undefined && ClosingStock !== null && ClosingStock !== '' ? ClosingStock : (OpeningStock || 0))
      .query(`
        UPDATE ItemMaster 
        SET ItemCode = @NewItemCode,
            ItemName = @ItemName,
            ItemType = @ItemType,
            BrandName = @BrandName,
            Unit = @Unit,
            MRP = @MRP,
            Costing = @COSTING,
            OpeningStock = @OpeningStock,
            ClosingStock = @ClosingStock
        WHERE ItemCode = @OldItemCode
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.status(200).json({ message: 'Item updated successfully' });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/items/:id
exports.deleteItem = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('ItemCode', sql.VarChar(10), id)
      .query(`
        DELETE FROM ItemMaster 
        WHERE ItemCode = @ItemCode
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/items/bulk
exports.bulkCreateItems = async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Items array is required' });
  }

  try {
    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);

      for (const item of items) {
        const { ItemCode, ItemName, ItemType, BrandName, Unit, MRP, COSTING, OpeningStock, ClosingStock } = item;

        if (!ItemCode || !ItemName || !Unit) {
          throw new Error(`ItemCode, ItemName, and Unit are required for item: ${ItemCode || 'Unknown'}`);
        }

        // Check if exists
        const checkItem = await request
          .input('CheckItemCode', sql.VarChar(10), ItemCode)
          .query('SELECT ItemCode FROM ItemMaster WHERE ItemCode = @CheckItemCode');

        // Clear parameter to avoid conflict in next iteration
        request.parameters = {};

        if (checkItem.recordset.length > 0) {
          // Update existing
          await request
            .input('UpdItemCode', sql.VarChar(10), ItemCode)
            .input('UpdItemName', sql.VarChar(50), ItemName)
            .input('UpdItemType', sql.VarChar(15), ItemType || null)
            .input('UpdBrandName', sql.VarChar(15), BrandName || null)
            .input('UpdUnit', sql.VarChar(10), Unit || null)
            .input('UpdMRP', sql.Numeric(10, 0), MRP || 0)
            .input('UpdCOSTING', sql.Numeric(10, 0), COSTING || 0)
            .input('UpdOpeningStock', sql.Numeric(12, 3), OpeningStock || 0)
            .input('UpdClosingStock', sql.Numeric(12, 3), ClosingStock !== undefined && ClosingStock !== null && ClosingStock !== '' ? ClosingStock : (OpeningStock || 0))
            .query(`
              UPDATE ItemMaster 
              SET ItemName = @UpdItemName, ItemType = @UpdItemType, BrandName = @UpdBrandName, Unit = @UpdUnit,
                  MRP = @UpdMRP, Costing = @UpdCOSTING, OpeningStock = @UpdOpeningStock, ClosingStock = @UpdClosingStock
              WHERE ItemCode = @UpdItemCode
            `);
          request.parameters = {};
        } else {
          // Insert new
          await request
            .input('InsItemCode', sql.VarChar(10), ItemCode)
            .input('InsItemName', sql.VarChar(50), ItemName)
            .input('InsItemType', sql.VarChar(15), ItemType || null)
            .input('InsBrandName', sql.VarChar(15), BrandName || null)
            .input('InsUnit', sql.VarChar(10), Unit || null)
            .input('InsMRP', sql.Numeric(10, 0), MRP || 0)
            .input('InsCOSTING', sql.Numeric(10, 0), COSTING || 0)
            .input('InsOpeningStock', sql.Numeric(12, 3), OpeningStock || 0)
            .input('InsClosingStock', sql.Numeric(12, 3), ClosingStock !== undefined && ClosingStock !== null && ClosingStock !== '' ? ClosingStock : (OpeningStock || 0))
            .query(`
              INSERT INTO ItemMaster (ItemCode, ItemName, ItemType, BrandName, Unit, MRP, Costing, OpeningStock, ClosingStock)
              VALUES (@InsItemCode, @InsItemName, @InsItemType, @InsBrandName, @InsUnit, @InsMRP, @InsCOSTING, @InsOpeningStock, @InsClosingStock)
            `);
          request.parameters = {};
        }
      }

      await transaction.commit();
      res.status(200).json({ message: 'Items imported successfully' });
    } catch (err) {
      await transaction.rollback();
      console.error('Transaction Error:', err);
      res.status(400).json({ message: err.message || 'Error processing items' });
    }
  } catch (error) {
    console.error('Error in bulk import:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
