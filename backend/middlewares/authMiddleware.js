const { sql, connectDB } = require('../config/db');

module.exports = async function (req, res, next) {
  const path = req.path.toLowerCase();

  // Bypassed auth/registration & health routes
  if (
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/signup') ||
    path.startsWith('/auth/registration-status') ||
    path.startsWith('/auth/register') ||
    path.startsWith('/auth/request-activation') ||
    path.startsWith('/health') ||
    path.startsWith('/einvoice') ||
    path.startsWith('/attendance')
  ) {
    return next();
  }

  // Bypass GET / OPTIONS read-only requests
  if (req.method === 'GET' || req.method === 'OPTIONS') {
    return next();
  }

  const userId = req.headers['x-user-id'];
  const username = req.headers['x-username'];

  if (!userId && !username) {
    return res.status(401).json({ message: 'Authentication required. No credentials provided in headers.' });
  }

  try {
    const pool = await connectDB();
    let query = 'SELECT UserRole, IsActive, IsAdd, IsEdit, IsDelete FROM Users WHERE ';
    let request = pool.request();

    if (userId) {
      request = request.input('UserId', sql.Int, parseInt(userId, 10));
      query += 'UserId = @UserId';
    } else {
      request = request.input('Username', sql.VarChar(30), username);
      query += 'Username = @Username';
    }

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'User not found or invalid credentials.' });
    }

    const dbUser = result.recordset[0];
    
    // Check if account is inactive
    if (!dbUser.IsActive) {
      return res.status(401).json({ message: 'Account is deactivated.' });
    }

    const role = String(dbUser.UserRole || '').toUpperCase();

    // Admins bypass checks
    if (role === 'ADMIN' || role === 'ADMINISTRATOR') {
      return next();
    }

    // Restrict Add actions
    if (req.method === 'POST') {
      const isAddAllowed = dbUser.IsAdd === true || dbUser.IsAdd === 1;
      if (!isAddAllowed) {
        return res.status(403).json({ message: 'Access denied: You do not have permission to add records.' });
      }
    }

    // Restrict Edit actions
    if (req.method === 'PUT') {
      const isEditAllowed = dbUser.IsEdit === true || dbUser.IsEdit === 1;
      if (!isEditAllowed) {
        return res.status(403).json({ message: 'Access denied: You do not have permission to edit records.' });
      }
    }

    // Restrict Delete actions
    if (req.method === 'DELETE') {
      const isDeleteAllowed = dbUser.IsDelete === true || dbUser.IsDelete === 1;
      if (!isDeleteAllowed) {
        return res.status(403).json({ message: 'Access denied: You do not have permission to delete records.' });
      }
    }

    next();
  } catch (error) {
    console.error('Authorization Middleware Error:', error);
    res.status(500).json({ message: 'Internal server error verifying permissions.' });
  }
};
