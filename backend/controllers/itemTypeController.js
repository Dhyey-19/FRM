const { sql, connectDB } = require('../config/db');

exports.getItemTypes = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query('SELECT ItemType, IsSystem FROM ItemTypeMaster ORDER BY ItemType ASC');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching item types:', error);
    res.status(500).json({ message: 'Server error fetching item types' });
  }
};

exports.createItemType = async (req, res) => {
  const { ItemType } = req.body;
  if (!ItemType) return res.status(400).json({ message: 'ItemType is required' });

  try {
    const pool = await connectDB();
    
    const check = await pool.request().input('ItemType', sql.VarChar(15), ItemType).query('SELECT * FROM ItemTypeMaster WHERE ItemType = @ItemType');
    if (check.recordset.length > 0) return res.status(400).json({ message: 'ItemType already exists' });

    await pool.request()
      .input('ItemType', sql.VarChar(15), ItemType)
      .query('INSERT INTO ItemTypeMaster (ItemType) VALUES (@ItemType)');
      
    res.status(201).json({ message: 'Item Type created successfully' });
  } catch (error) {
    console.error('Error creating item type:', error);
    res.status(500).json({ message: 'Server error creating item type' });
  }
};

exports.updateItemType = async (req, res) => {
  const { id } = req.params; // Old ItemType
  const { ItemType } = req.body; // New ItemType

  if (!ItemType) return res.status(400).json({ message: 'ItemType is required' });

  try {
    const pool = await connectDB();

    const checkSys = await pool.request()
      .input('ItemType', sql.VarChar(15), id)
      .query('SELECT IsSystem FROM ItemTypeMaster WHERE ItemType = @ItemType');
      
    if (checkSys.recordset.length === 0) {
      return res.status(404).json({ message: 'Item Type not found' });
    }
    
    if (checkSys.recordset[0].IsSystem === true || checkSys.recordset[0].IsSystem === 1) {
      return res.status(403).json({ message: 'System Item Types cannot be edited' });
    }

    if (id !== ItemType) {
      const check = await pool.request().input('ItemType', sql.VarChar(15), ItemType).query('SELECT * FROM ItemTypeMaster WHERE ItemType = @ItemType');
      if (check.recordset.length > 0) return res.status(400).json({ message: 'New ItemType already exists' });
    }

    const result = await pool.request()
      .input('OldItemType', sql.VarChar(15), id)
      .input('NewItemType', sql.VarChar(15), ItemType)
      .query('UPDATE ItemTypeMaster SET ItemType = @NewItemType WHERE ItemType = @OldItemType');

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
      return res.status(403).json({ message: 'System Item Types cannot be deleted' });
    }

    const result = await pool.request()
      .input('ItemType', sql.VarChar(15), id)
      .query('DELETE FROM ItemTypeMaster WHERE ItemType = @ItemType');

    if (result.rowsAffected[0] === 0) return res.status(404).json({ message: 'Item Type not found' });
    res.json({ message: 'Item Type deleted successfully' });
  } catch (error) {
    console.error('Error deleting item type:', error);
    // Handle FK constraint violation if any
    if (error.number === 547) {
      return res.status(400).json({ message: 'Cannot delete Item Type because it is in use.' });
    }
    res.status(500).json({ message: 'Server error deleting item type' });
  }
};
