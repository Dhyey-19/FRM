const { sql, connectDB } = require('../config/db');

// GET /api/users
exports.getUsers = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .query(`
        SELECT UserId, Username, Password, MobileNo, UserRole, IsActive, IsAdd, IsEdit, IsDelete, AllowedMenus 
        FROM Users 
        ORDER BY UserId DESC
      `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/users/:id
exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('UserId', sql.Int, id)
      .query(`
        SELECT UserId, Username, MobileNo, UserRole, IsActive, IsAdd, IsEdit, IsDelete, AllowedMenus 
        FROM Users 
        WHERE UserId = @UserId
      `);
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching user by id:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/users
exports.createUser = async (req, res) => {
  const { Username, Password, MobileNo, UserRole, IsActive, IsAdd, IsEdit, IsDelete, AllowedMenus } = req.body;
  const isAdmin = UserRole === 'ADMIN';

  try {
    const pool = await connectDB();
    
    // Check if user already exists
    const checkUser = await pool.request()
      .input('Username', sql.VarChar(30), Username)
      .query('SELECT UserId FROM Users WHERE Username = @Username');
      
    if (checkUser.recordset.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const result = await pool.request()
      .input('Username', sql.VarChar(30), Username)
      .input('Password', sql.VarChar(10), Password)
      .input('MobileNo', sql.VarChar(10), MobileNo)
      .input('UserRole', sql.VarChar(15), UserRole || 'OPERATOR')
      .input('IsActive', sql.Bit, IsActive || 0)
      .input('IsAdd', sql.Bit, isAdmin ? 1 : (IsAdd ? 1 : 0))
      .input('IsEdit', sql.Bit, isAdmin ? 1 : (IsEdit ? 1 : 0))
      .input('IsDelete', sql.Bit, isAdmin ? 1 : (IsDelete ? 1 : 0))
      .input('AllowedMenus', sql.NVarChar(sql.MAX), AllowedMenus || '')
      .query(`
        INSERT INTO Users (Username, Password, MobileNo, UserRole, IsActive, IsAdd, IsEdit, IsDelete, AllowedMenus)
        VALUES (@Username, @Password, @MobileNo, @UserRole, @IsActive, @IsAdd, @IsEdit, @IsDelete, @AllowedMenus)
      `);

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/users/:id
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { Username, Password, MobileNo, UserRole, IsActive, IsAdd, IsEdit, IsDelete, AllowedMenus } = req.body;
  const isAdmin = UserRole === 'ADMIN';

  try {
    const pool = await connectDB();
    
    // Check if username is taken by another user
    const checkUser = await pool.request()
      .input('Username', sql.VarChar(30), Username)
      .input('UserId', sql.Int, id)
      .query('SELECT UserId FROM Users WHERE Username = @Username AND UserId != @UserId');
      
    if (checkUser.recordset.length > 0) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    const result = await pool.request()
      .input('UserId', sql.Int, id)
      .input('Username', sql.VarChar(30), Username)
      .input('Password', sql.VarChar(10), Password)
      .input('MobileNo', sql.VarChar(10), MobileNo)
      .input('UserRole', sql.VarChar(15), UserRole)
      .input('IsActive', sql.Bit, IsActive)
      .input('IsAdd', sql.Bit, isAdmin ? 1 : (IsAdd ? 1 : 0))
      .input('IsEdit', sql.Bit, isAdmin ? 1 : (IsEdit ? 1 : 0))
      .input('IsDelete', sql.Bit, isAdmin ? 1 : (IsDelete ? 1 : 0))
      .input('AllowedMenus', sql.NVarChar(sql.MAX), AllowedMenus || '')
      .query(`
        UPDATE Users 
        SET Username = @Username, 
            Password = @Password,
            MobileNo = @MobileNo, 
            UserRole = @UserRole, 
            IsActive = @IsActive, 
            IsAdd = @IsAdd,
            IsEdit = @IsEdit,
            IsDelete = @IsDelete,
            AllowedMenus = @AllowedMenus
        WHERE UserId = @UserId
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('UserId', sql.Int, id)
      .query(`
        DELETE FROM Users 
        WHERE UserId = @UserId
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/users/:id/access
exports.updateUserAccess = async (req, res) => {
  const { id } = req.params;
  const { allowedMenus } = req.body;

  try {
    const pool = await connectDB();
    const menusStr = Array.isArray(allowedMenus) 
      ? allowedMenus.join(',') 
      : (allowedMenus !== undefined && allowedMenus !== null ? String(allowedMenus) : '');

    const result = await pool.request()
      .input('UserId', sql.Int, id)
      .input('AllowedMenus', sql.NVarChar(sql.MAX), menusStr)
      .query(`
        UPDATE Users 
        SET AllowedMenus = @AllowedMenus 
        WHERE UserId = @UserId
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ 
      message: 'User access updated successfully', 
      userId: id,
      allowedMenus: menusStr 
    });
  } catch (error) {
    console.error('Error updating user access:', error);
    res.status(500).json({ message: 'Server error updating user access: ' + error.message });
  }
};
