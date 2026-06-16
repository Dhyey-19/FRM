const { sql, connectDB } = require('../config/db');

exports.getAccountGroups = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query('SELECT Id, GroupName, IsSystem FROM AccountGroup ORDER BY GroupName ASC');
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching account groups:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addAccountGroup = async (req, res) => {
  const { GroupName } = req.body;
  if (!GroupName) return res.status(400).json({ message: 'Group Name is required' });

  try {
    const pool = await connectDB();
    
    // Check if exists
    const check = await pool.request()
      .input('GroupName', sql.VarChar(30), GroupName)
      .query('SELECT * FROM AccountGroup WHERE GroupName = @GroupName');
      
    if (check.recordset.length > 0) {
      return res.status(400).json({ message: 'Account Group already exists' });
    }

    await pool.request()
      .input('GroupName', sql.VarChar(30), GroupName)
      .query('INSERT INTO AccountGroup (GroupName) VALUES (@GroupName)');
      
    res.status(201).json({ message: 'Account Group added successfully' });
  } catch (error) {
    console.error('Error adding account group:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateAccountGroup = async (req, res) => {
  const { id } = req.params;
  const { GroupName } = req.body;
  if (!GroupName) return res.status(400).json({ message: 'Group Name is required' });

  try {
    const pool = await connectDB();
    
    const checkSys = await pool.request()
      .input('Id', sql.Int, parseInt(id))
      .query('SELECT IsSystem FROM AccountGroup WHERE Id = @Id');
      
    if (checkSys.recordset.length === 0) {
      return res.status(404).json({ message: 'Account Group not found' });
    }
    
    if (checkSys.recordset[0].IsSystem === true || checkSys.recordset[0].IsSystem === 1) {
      return res.status(403).json({ message: 'System Account Groups cannot be edited' });
    }

    await pool.request()
      .input('Id', sql.Int, parseInt(id))
      .input('GroupName', sql.VarChar(30), GroupName)
      .query('UPDATE AccountGroup SET GroupName = @GroupName WHERE Id = @Id');
      
    res.status(200).json({ message: 'Account Group updated successfully' });
  } catch (error) {
    console.error('Error updating account group:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteAccountGroup = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await connectDB();
    
    const checkSys = await pool.request()
      .input('Id', sql.Int, parseInt(id))
      .query('SELECT IsSystem FROM AccountGroup WHERE Id = @Id');
      
    if (checkSys.recordset.length === 0) {
      return res.status(404).json({ message: 'Account Group not found' });
    }
    
    if (checkSys.recordset[0].IsSystem === true || checkSys.recordset[0].IsSystem === 1) {
      return res.status(403).json({ message: 'System Account Groups cannot be deleted' });
    }

    await pool.request()
      .input('Id', sql.Int, parseInt(id))
      .query('DELETE FROM AccountGroup WHERE Id = @Id');
      
    res.status(200).json({ message: 'Account Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting account group:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
