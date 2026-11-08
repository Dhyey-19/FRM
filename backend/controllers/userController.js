const { sql, connectDB } = require('../config/db');
const { calculateEmployeeSalary } = require('./attendanceController');

// GET /api/users
exports.getUsers = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .query(`
        SELECT UserId, Username, Password, MobileNo, UserRole, IsActive, IsAdd, IsEdit, IsDelete, AllowedMenus,
               FullName, BiometricCode, Department, Designation, SalaryType, 
               MonthlySalary, DailyRate, HourlyRate, OvertimeRatePerHour, StandardWorkingHours
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
        SELECT UserId, Username, MobileNo, UserRole, IsActive, IsAdd, IsEdit, IsDelete, AllowedMenus,
               FullName, BiometricCode, Department, Designation, SalaryType, 
               MonthlySalary, DailyRate, HourlyRate, OvertimeRatePerHour, StandardWorkingHours
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
  const { 
    Username, Password, MobileNo, UserRole, IsActive, IsAdd, IsEdit, IsDelete, AllowedMenus,
    FullName, BiometricCode, Department, Designation, SalaryType, 
    MonthlySalary, DailyRate, HourlyRate, OvertimeRatePerHour, StandardWorkingHours
  } = req.body;
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
      .input('FullName', sql.VarChar(100), FullName || null)
      .input('BiometricCode', sql.VarChar(30), BiometricCode || null)
      .input('Department', sql.VarChar(50), Department || 'LABOUR')
      .input('Designation', sql.VarChar(50), Designation || 'Operator')
      .input('SalaryType', sql.VarChar(20), SalaryType || 'Monthly')
      .input('MonthlySalary', sql.Decimal(12, 2), MonthlySalary !== undefined && MonthlySalary !== null && MonthlySalary !== '' ? parseFloat(MonthlySalary) : 15000.00)
      .input('DailyRate', sql.Decimal(10, 2), DailyRate !== undefined && DailyRate !== null && DailyRate !== '' ? parseFloat(DailyRate) : 600.00)
      .input('HourlyRate', sql.Decimal(10, 2), HourlyRate !== undefined && HourlyRate !== null && HourlyRate !== '' ? parseFloat(HourlyRate) : 75.00)
      .input('OvertimeRatePerHour', sql.Decimal(10, 2), OvertimeRatePerHour !== undefined && OvertimeRatePerHour !== null && OvertimeRatePerHour !== '' ? parseFloat(OvertimeRatePerHour) : 0.00)
      .input('StandardWorkingHours', sql.Decimal(4, 2), StandardWorkingHours !== undefined && StandardWorkingHours !== null && StandardWorkingHours !== '' ? parseFloat(StandardWorkingHours) : 8.00)
      .query(`
        INSERT INTO Users (
          Username, Password, MobileNo, UserRole, IsActive, IsAdd, IsEdit, IsDelete, AllowedMenus,
          FullName, BiometricCode, Department, Designation, SalaryType,
          MonthlySalary, DailyRate, HourlyRate, OvertimeRatePerHour, StandardWorkingHours
        )
        VALUES (
          @Username, @Password, @MobileNo, @UserRole, @IsActive, @IsAdd, @IsEdit, @IsDelete, @AllowedMenus,
          @FullName, @BiometricCode, @Department, @Designation, @SalaryType,
          @MonthlySalary, @DailyRate, @HourlyRate, @OvertimeRatePerHour, @StandardWorkingHours
        )
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
  const { 
    Username, Password, MobileNo, UserRole, IsActive, IsAdd, IsEdit, IsDelete, AllowedMenus,
    FullName, BiometricCode, Department, Designation, SalaryType, 
    MonthlySalary, DailyRate, HourlyRate, OvertimeRatePerHour, StandardWorkingHours
  } = req.body;
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
      .input('FullName', sql.VarChar(100), FullName || null)
      .input('BiometricCode', sql.VarChar(30), BiometricCode || null)
      .input('Department', sql.VarChar(50), Department || 'LABOUR')
      .input('Designation', sql.VarChar(50), Designation || 'Operator')
      .input('SalaryType', sql.VarChar(20), SalaryType || 'Monthly')
      .input('MonthlySalary', sql.Decimal(12, 2), MonthlySalary !== undefined && MonthlySalary !== null && MonthlySalary !== '' ? parseFloat(MonthlySalary) : 15000.00)
      .input('DailyRate', sql.Decimal(10, 2), DailyRate !== undefined && DailyRate !== null && DailyRate !== '' ? parseFloat(DailyRate) : 600.00)
      .input('HourlyRate', sql.Decimal(10, 2), HourlyRate !== undefined && HourlyRate !== null && HourlyRate !== '' ? parseFloat(HourlyRate) : 75.00)
      .input('OvertimeRatePerHour', sql.Decimal(10, 2), OvertimeRatePerHour !== undefined && OvertimeRatePerHour !== null && OvertimeRatePerHour !== '' ? parseFloat(OvertimeRatePerHour) : 0.00)
      .input('StandardWorkingHours', sql.Decimal(4, 2), StandardWorkingHours !== undefined && StandardWorkingHours !== null && StandardWorkingHours !== '' ? parseFloat(StandardWorkingHours) : 8.00)
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
            AllowedMenus = @AllowedMenus,
            FullName = @FullName,
            BiometricCode = @BiometricCode,
            Department = @Department,
            Designation = @Designation,
            SalaryType = @SalaryType,
            MonthlySalary = @MonthlySalary,
            DailyRate = @DailyRate,
            HourlyRate = @HourlyRate,
            OvertimeRatePerHour = @OvertimeRatePerHour,
            StandardWorkingHours = @StandardWorkingHours
        WHERE UserId = @UserId
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Auto-sync updated salary parameters with any existing AttendanceMonthlySummary records for this employee
    try {
      const bioCode = BiometricCode ? String(BiometricCode).trim() : '';
      const checkAtt = await pool.request()
        .input('BiometricCode', sql.VarChar(30), bioCode)
        .input('UserId', sql.Int, id)
        .query(`
          SELECT * FROM AttendanceMonthlySummary 
          WHERE UserId = @UserId OR (BiometricCode = @BiometricCode AND @BiometricCode != '')
        `);

      if (checkAtt.recordset && checkAtt.recordset.length > 0) {
        const userSalaryConfig = {
          UserId: id,
          FullName: FullName,
          BiometricCode: bioCode,
          Department: Department || 'LABOUR',
          Designation: Designation || 'Operator',
          SalaryType: SalaryType || 'Monthly',
          MonthlySalary: MonthlySalary !== undefined && MonthlySalary !== null && MonthlySalary !== '' ? parseFloat(MonthlySalary) : 15000.00,
          DailyRate: DailyRate !== undefined && DailyRate !== null && DailyRate !== '' ? parseFloat(DailyRate) : 600.00,
          HourlyRate: HourlyRate !== undefined && HourlyRate !== null && HourlyRate !== '' ? parseFloat(HourlyRate) : 75.00,
          OvertimeRatePerHour: OvertimeRatePerHour !== undefined && OvertimeRatePerHour !== null && OvertimeRatePerHour !== '' ? parseFloat(OvertimeRatePerHour) : 0.00,
          StandardWorkingHours: StandardWorkingHours !== undefined && StandardWorkingHours !== null && StandardWorkingHours !== '' ? parseFloat(StandardWorkingHours) : 8.00
        };

        for (const record of checkAtt.recordset) {
          const calc = calculateEmployeeSalary(record, userSalaryConfig, record.TotalDaysInMonth || 31);
          await pool.request()
            .input('Id', sql.Int, record.Id)
            .input('UserId', sql.Int, id)
            .input('Department', sql.VarChar(50), userSalaryConfig.Department)
            .input('Designation', sql.VarChar(50), userSalaryConfig.Designation)
            .input('SalaryType', sql.VarChar(20), calc.salaryType)
            .input('BaseSalary', sql.Decimal(12, 2), calc.baseSalary)
            .input('PayableDays', sql.Decimal(5, 2), calc.payableDays)
            .input('CalculatedSalary', sql.Decimal(12, 2), calc.calculatedSalary)
            .input('TotalOvertimeHoursDecimal', sql.Decimal(8, 2), calc.otHours)
            .input('OvertimePay', sql.Decimal(12, 2), calc.overtimePay)
            .input('NetSalary', sql.Decimal(12, 2), calc.netSalary)
            .query(`
              UPDATE AttendanceMonthlySummary
              SET UserId = @UserId,
                  Department = @Department,
                  Designation = @Designation,
                  SalaryType = @SalaryType,
                  BaseSalary = @BaseSalary,
                  PayableDays = @PayableDays,
                  CalculatedSalary = @CalculatedSalary,
                  TotalOvertimeHoursDecimal = @TotalOvertimeHoursDecimal,
                  OvertimePay = @OvertimePay,
                  NetSalary = @NetSalary
              WHERE Id = @Id
            `);
        }
      }
    } catch (syncErr) {
      console.warn('Could not auto-sync attendance records on user update:', syncErr.message);
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
