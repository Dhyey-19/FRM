const { sql, connectDB } = require('../config/db');

exports.getItemTypes = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT ItemType, Description, IsSystem 
      FROM ItemTypeMaster 
      ORDER BY 
        CASE UPPER(LTRIM(RTRIM(ItemType)))
          WHEN 'FG' THEN 1
          WHEN 'RM' THEN 2
          WHEN 'SF' THEN 3
          WHEN 'BOP' THEN 4
          ELSE 5
        END,
        ItemType ASC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching item types:', error);
    res.status(500).json({ message: 'Server error fetching item types' });
  }
};

exports.createItemType = async (req, res) => {
  const { ItemType, Description } = req.body;
  if (!ItemType) return res.status(400).json({ message: 'ItemType is required' });

  const cleanCode = ItemType.trim().toUpperCase();
  const cleanDesc = (Description || '').trim();

  try {
    const pool = await connectDB();
    
    const check = await pool.request()
      .input('ItemType', sql.VarChar(15), cleanCode)
      .query('SELECT * FROM ItemTypeMaster WHERE ItemType = @ItemType');
    if (check.recordset.length > 0) return res.status(400).json({ message: 'ItemType already exists' });

    await pool.request()
      .input('ItemType', sql.VarChar(15), cleanCode)
      .input('Description', sql.NVarChar(100), cleanDesc || null)
      .query('INSERT INTO ItemTypeMaster (ItemType, Description, IsSystem) VALUES (@ItemType, @Description, 0)');
      
    res.status(201).json({ message: 'Item Type created successfully' });
  } catch (error) {
    console.error('Error creating item type:', error);
    res.status(500).json({ message: 'Server error creating item type' });
  }
};

exports.updateItemType = async (req, res) => {
  const { id } = req.params; // Old ItemType
  const { ItemType, Description } = req.body; // New ItemType & Description

  if (!ItemType) return res.status(400).json({ message: 'ItemType is required' });

  const cleanCode = ItemType.trim().toUpperCase();
  const cleanDesc = (Description || '').trim();

  try {
    const pool = await connectDB();

    const checkSys = await pool.request()
      .input('ItemType', sql.VarChar(15), id)
      .query('SELECT IsSystem FROM ItemTypeMaster WHERE ItemType = @ItemType');
      
    if (checkSys.recordset.length === 0) {
      return res.status(404).json({ message: 'Item Type not found' });
    }
    
    const isSystem = checkSys.recordset[0].IsSystem === true || checkSys.recordset[0].IsSystem === 1;
    if (isSystem && cleanCode !== id) {
      return res.status(403).json({ message: 'System Item Type codes (FG, RM, SF, BOP) cannot be changed' });
    }

    if (id !== cleanCode) {
      const check = await pool.request()
        .input('ItemType', sql.VarChar(15), cleanCode)
        .query('SELECT * FROM ItemTypeMaster WHERE ItemType = @ItemType');
      if (check.recordset.length > 0) return res.status(400).json({ message: 'New ItemType already exists' });
    }

    const result = await pool.request()
      .input('OldItemType', sql.VarChar(15), id)
      .input('NewItemType', sql.VarChar(15), cleanCode)
      .input('Description', sql.NVarChar(100), cleanDesc || null)
      .query(`
        UPDATE ItemTypeMaster 
        SET ItemType = @NewItemType, Description = @Description 
        WHERE ItemType = @OldItemType;

        IF @OldItemType <> @NewItemType
        BEGIN
          UPDATE ItemMaster SET ItemType = @NewItemType WHERE ItemType = @OldItemType;
        END
      `);

    if (result.rowsAffected[0] === 0) return res.status(404).json({ message: 'Item Type not found' });
    res.json({ message: 'Item Type updated successfully' });
  } catch (error) {
    console.error('Error updating item type:', error);
    res.status(500).json({ message: 'Server error updating item type' });
  }
};

exports.deleteItemType = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await connectDB();
    
    const checkSys = await pool.request()
      .input('ItemType', sql.VarChar(15), id)
      .query('SELECT IsSystem FROM ItemTypeMaster WHERE ItemType = @ItemType');
      
    if (checkSys.recordset.length === 0) {
      return res.status(404).json({ message: 'Item Type not found' });
    }
    
    if (checkSys.recordset[0].IsSystem === true || checkSys.recordset[0].IsSystem === 1) {
      return res.status(403).json({ message: 'System Item Types (FG, RM, SF, BOP) cannot be deleted' });
    }

    // Check if in use in ItemMaster
    const inUseCheck = await pool.request()
      .input('ItemType', sql.VarChar(15), id)
      .query('SELECT COUNT(*) as cnt FROM ItemMaster WHERE ItemType = @ItemType');
    if (inUseCheck.recordset[0].cnt > 0) {
      return res.status(400).json({ 
        message: `Cannot delete Item Type "${id}" because it is currently assigned to ${inUseCheck.recordset[0].cnt} item(s) in Item Master.` 
      });
    }

    const result = await pool.request()
      .input('ItemType', sql.VarChar(15), id)
      .query('DELETE FROM ItemTypeMaster WHERE ItemType = @ItemType');

    if (result.rowsAffected[0] === 0) return res.status(404).json({ message: 'Item Type not found' });
    res.json({ message: 'Item Type deleted successfully' });
  } catch (error) {
    console.error('Error deleting item type:', error);
    res.status(500).json({ message: 'Server error deleting item type' });
  }
};

// POST /api/item-types/bulk
exports.bulkCreateItemTypes = async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Array of item types is required' });
  }

  let added = 0;
  let updated = 0;

  try {
    const pool = await connectDB();
    for (const item of items) {
      const rawCode = item.ItemType || item['Item Type'] || item.Type;
      if (!rawCode) continue;
      const itemType = String(rawCode).trim().toUpperCase();
      if (!itemType) continue;
      const description = String(item.Description || item['Description'] || '').trim();

      const check = await pool.request()
        .input('ItemType', sql.VarChar(15), itemType)
        .query('SELECT ItemType, IsSystem FROM ItemTypeMaster WHERE ItemType = @ItemType');

      if (check.recordset.length === 0) {
        await pool.request()
          .input('ItemType', sql.VarChar(15), itemType)
          .input('Description', sql.NVarChar(100), description || null)
          .query('INSERT INTO ItemTypeMaster (ItemType, Description, IsSystem) VALUES (@ItemType, @Description, 0)');
        added++;
      } else {
        // If description is provided and not empty, update it
        if (description) {
          await pool.request()
            .input('ItemType', sql.VarChar(15), itemType)
            .input('Description', sql.NVarChar(100), description)
            .query('UPDATE ItemTypeMaster SET Description = @Description WHERE ItemType = @ItemType');
          updated++;
        }
      }
    }

    res.status(200).json({
      message: `Processed ${items.length} records. Added: ${added}, Updated: ${updated}`,
      added,
      updated
    });
  } catch (error) {
    console.error('Error bulk creating item types:', error);
    res.status(500).json({ message: error.message || 'Server error bulk creating item types' });
  }
};

