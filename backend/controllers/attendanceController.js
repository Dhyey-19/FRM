const fs = require('fs');
const path = require('path');
const { sql, connectDB, getDatabase } = require('../config/db');
const { parseMonthlyAttendancePdf, parseTimeToDecimal, formatDecimalToTime } = require('../services/attendanceParserService');

// POST /api/attendance/upload
// Handles biometric PDF upload and processes all records
exports.uploadAttendance = async (req, res) => {
  try {
    let pdfBuffer = null;
    let fileName = 'attendance_report.pdf';

    if (req.file && req.file.buffer) {
      pdfBuffer = req.file.buffer;
      fileName = req.file.originalname || fileName;
    } else if (req.body && req.body.fileBase64) {
      const base64Data = req.body.fileBase64.replace(/^data:application\/pdf;base64,/, '');
      pdfBuffer = Buffer.from(base64Data, 'base64');
      fileName = req.body.fileName || fileName;
    } else if (req.body && req.body.useSample) {
      // Allow testing with existing sample file in folder
      const samplePath = path.resolve(__dirname, '../../Monthly Attendence Report/rptMonthlyLog.pdf');
      if (fs.existsSync(samplePath)) {
        pdfBuffer = fs.readFileSync(samplePath);
        fileName = 'rptMonthlyLog.pdf';
      }
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      return res.status(400).json({ message: 'No valid PDF file uploaded.' });
    }

    // 1. Parse PDF using Attendance Parser Service
    const parsedData = await parseMonthlyAttendancePdf(pdfBuffer);
    const { organization, monthName, monthYear, totalDaysInMonth, employees } = parsedData;

    if (!employees || employees.length === 0) {
      return res.status(400).json({ message: 'No employee attendance logs could be identified in the uploaded PDF.' });
    }

    const pool = await connectDB();

    // 2. Load existing users to match BiometricCode or FullName
    const usersRes = await pool.request().query(`
      SELECT UserId, Username, FullName, BiometricCode, Department, Designation, 
             SalaryType, MonthlySalary, DailyRate, HourlyRate, OvertimeRatePerHour, StandardWorkingHours 
      FROM Users
    `);
    const existingUsers = usersRes.recordset || [];

    // Helper map for fast lookup
    const userByBioCode = new Map();
    const userByName = new Map();
    for (const u of existingUsers) {
      if (u.BiometricCode) userByBioCode.set(String(u.BiometricCode).trim(), u);
      if (u.FullName) userByName.set(String(u.FullName).trim().toUpperCase(), u);
      if (u.Username) userByName.set(String(u.Username).trim().toUpperCase(), u);
    }

    // 3. Clear any existing records for this month to ensure clean re-upload
    await pool.request()
      .input('MonthYear', sql.VarChar(10), monthYear)
      .query(`
        DELETE FROM AttendanceDailyLog WHERE MonthYear = @MonthYear;
        DELETE FROM AttendanceMonthlySummary WHERE MonthYear = @MonthYear;
      `);

    const summaryResults = [];

    // Process each employee
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const bioCode = String(emp.biometricCode).trim();
      const empName = String(emp.employeeName).trim();
      const empDept = emp.department || 'LABOUR';
      const empDesig = emp.designation || 'Operator';

      let matchedUser = userByBioCode.get(bioCode) || userByName.get(empName.toUpperCase());

      // If user does not exist in Users table, auto-seed them
      if (!matchedUser) {
        try {
          const safeUsername = `emp_${bioCode || (i + 1)}`;
          const defSalaryType = empDept.toUpperCase() === 'OFFICE' ? 'Monthly' : 'Monthly';
          const defMonthlySalary = empDept.toUpperCase() === 'OFFICE' ? 20000.00 : 15000.00;
          const defDailyRate = 600.00;
          const defHourlyRate = 75.00;
          const defOtRate = 100.00;
          const defStdHours = 8.00;

          const createRes = await pool.request()
            .input('Username', sql.VarChar(30), safeUsername)
            .input('Password', sql.VarChar(10), '123456')
            .input('FullName', sql.VarChar(100), empName)
            .input('BiometricCode', sql.VarChar(30), bioCode)
            .input('Department', sql.VarChar(50), empDept)
            .input('Designation', sql.VarChar(50), empDesig)
            .input('UserRole', sql.VarChar(15), 'OPERATOR')
            .input('IsActive', sql.Bit, 1)
            .input('IsAdd', sql.Bit, 0)
            .input('IsEdit', sql.Bit, 0)
            .input('IsDelete', sql.Bit, 0)
            .input('AllowedMenus', sql.NVarChar(sql.MAX), '')
            .input('SalaryType', sql.VarChar(20), defSalaryType)
            .input('MonthlySalary', sql.Decimal(12, 2), defMonthlySalary)
            .input('DailyRate', sql.Decimal(10, 2), defDailyRate)
            .input('HourlyRate', sql.Decimal(10, 2), defHourlyRate)
            .input('OvertimeRatePerHour', sql.Decimal(10, 2), defOtRate)
            .input('StandardWorkingHours', sql.Decimal(4, 2), defStdHours)
            .query(`
              INSERT INTO Users (
                Username, Password, FullName, BiometricCode, Department, Designation,
                UserRole, IsActive, IsAdd, IsEdit, IsDelete, AllowedMenus,
                SalaryType, MonthlySalary, DailyRate, HourlyRate, OvertimeRatePerHour, StandardWorkingHours
              )
              VALUES (
                @Username, @Password, @FullName, @BiometricCode, @Department, @Designation,
                @UserRole, @IsActive, @IsAdd, @IsEdit, @IsDelete, @AllowedMenus,
                @SalaryType, @MonthlySalary, @DailyRate, @HourlyRate, @OvertimeRatePerHour, @StandardWorkingHours
              )
            `);

          matchedUser = {
            UserId: createRes.rowsAffected && createRes.rowsAffected[0] ? null : null,
            FullName: empName,
            BiometricCode: bioCode,
            Department: empDept,
            Designation: empDesig,
            SalaryType: defSalaryType,
            MonthlySalary: defMonthlySalary,
            DailyRate: defDailyRate,
            HourlyRate: defHourlyRate,
            OvertimeRatePerHour: defOtRate,
            StandardWorkingHours: defStdHours
          };
          userByBioCode.set(bioCode, matchedUser);
        } catch (e) {
          // If username collision or insert error, continue with default params
          matchedUser = {
            UserId: null,
            FullName: empName,
            BiometricCode: bioCode,
            Department: empDept,
            Designation: empDesig,
            SalaryType: 'Monthly',
            MonthlySalary: 15000.00,
            DailyRate: 600.00,
            HourlyRate: 75.00,
            OvertimeRatePerHour: 100.00,
            StandardWorkingHours: 8.00
          };
        }
      }

      // Salary Configuration
      const salaryType = matchedUser.SalaryType || 'Monthly';
      const monthlySalary = parseFloat(matchedUser.MonthlySalary) || 15000.00;
      const dailyRate = parseFloat(matchedUser.DailyRate) || 600.00;
      const hourlyRate = parseFloat(matchedUser.HourlyRate) || 75.00;
      const otRate = parseFloat(matchedUser.OvertimeRatePerHour) || 100.00;
      const stdHoursPerDay = parseFloat(matchedUser.StandardWorkingHours) || 8.00;

      // Base Salary depending on SalaryType
      let baseSalary = monthlySalary;
      if (salaryType === 'Daily') baseSalary = dailyRate;
      if (salaryType === 'Hourly') baseSalary = hourlyRate;

      // Payable Days: Present Days + Week-Offs (if present at least 1 day or has gross hours)
      let payableDays = 0;
      if (emp.presentDays > 0 || emp.totalGrossHoursDecimal > 0) {
        payableDays = parseFloat((emp.presentDays + emp.weekOffDays).toFixed(2));
      }

      // Calculated Salary
      let calculatedSalary = 0;
      if (salaryType === 'Monthly') {
        const perDayRate = totalDaysInMonth > 0 ? (monthlySalary / totalDaysInMonth) : 0;
        calculatedSalary = Math.round(perDayRate * payableDays);
      } else if (salaryType === 'Daily') {
        calculatedSalary = Math.round(dailyRate * payableDays);
      } else if (salaryType === 'Hourly') {
        calculatedSalary = Math.round(hourlyRate * emp.totalNetWorkHoursDecimal);
      }

      // Overtime Hours & Pay
      // Overtime is any net work hours exceeding standard working hours for present days
      const expectedStandardHours = emp.presentDays * stdHoursPerDay;
      let otHours = 0;
      if (emp.totalNetWorkHoursDecimal > expectedStandardHours && expectedStandardHours > 0) {
        otHours = parseFloat((emp.totalNetWorkHoursDecimal - expectedStandardHours).toFixed(2));
      }
      const overtimePay = Math.round(otHours * otRate);
      const deductions = 0;
      const netSalary = Math.round(calculatedSalary + overtimePay - deductions);

      // Insert AttendanceMonthlySummary
      const summaryInsert = await pool.request()
        .input('MonthYear', sql.VarChar(10), monthYear)
        .input('MonthName', sql.VarChar(30), monthName)
        .input('TotalDaysInMonth', sql.Int, totalDaysInMonth)
        .input('UserId', sql.Int, matchedUser.UserId || null)
        .input('BiometricCode', sql.VarChar(30), bioCode)
        .input('EmployeeName', sql.VarChar(100), empName)
        .input('Department', sql.VarChar(50), matchedUser.Department || empDept)
        .input('Designation', sql.VarChar(50), matchedUser.Designation || empDesig)
        .input('PresentDays', sql.Decimal(5, 2), emp.presentDays)
        .input('AbsentDays', sql.Decimal(5, 2), emp.absentDays)
        .input('HalfDays', sql.Decimal(5, 2), emp.halfDays)
        .input('WeekOffDays', sql.Decimal(5, 2), emp.weekOffDays)
        .input('PublicHolidays', sql.Decimal(5, 2), emp.publicHolidays || 0)
        .input('PaidLeaveDays', sql.Decimal(5, 2), emp.paidLeaveDays || 0)
        .input('UnpaidLeaveDays', sql.Decimal(5, 2), emp.unpaidLeaveDays || 0)
        .input('PayableDays', sql.Decimal(5, 2), payableDays)
        .input('TotalGrossHours', sql.VarChar(20), emp.totalGrossHours)
        .input('TotalGrossHoursDecimal', sql.Decimal(8, 2), emp.totalGrossHoursDecimal)
        .input('TotalBreakHours', sql.VarChar(20), emp.totalBreakHours)
        .input('TotalBreakHoursDecimal', sql.Decimal(8, 2), emp.totalBreakHoursDecimal)
        .input('TotalNetWorkHoursDecimal', sql.Decimal(8, 2), emp.totalNetWorkHoursDecimal)
        .input('TotalOvertimeHoursDecimal', sql.Decimal(8, 2), otHours)
        .input('SalaryType', sql.VarChar(20), salaryType)
        .input('BaseSalary', sql.Decimal(12, 2), baseSalary)
        .input('CalculatedSalary', sql.Decimal(12, 2), calculatedSalary)
        .input('OvertimePay', sql.Decimal(12, 2), overtimePay)
        .input('Deductions', sql.Decimal(12, 2), deductions)
        .input('NetSalary', sql.Decimal(12, 2), netSalary)
        .input('UploadedFileName', sql.VarChar(255), fileName)
        .query(`
          INSERT INTO AttendanceMonthlySummary (
            MonthYear, MonthName, TotalDaysInMonth, UserId, BiometricCode, EmployeeName,
            Department, Designation, PresentDays, AbsentDays, HalfDays, WeekOffDays,
            PublicHolidays, PaidLeaveDays, UnpaidLeaveDays, PayableDays,
            TotalGrossHours, TotalGrossHoursDecimal, TotalBreakHours, TotalBreakHoursDecimal,
            TotalNetWorkHoursDecimal, TotalOvertimeHoursDecimal, SalaryType, BaseSalary,
            CalculatedSalary, OvertimePay, Deductions, NetSalary, UploadedFileName
          )
          VALUES (
            @MonthYear, @MonthName, @TotalDaysInMonth, @UserId, @BiometricCode, @EmployeeName,
            @Department, @Designation, @PresentDays, @AbsentDays, @HalfDays, @WeekOffDays,
            @PublicHolidays, @PaidLeaveDays, @UnpaidLeaveDays, @PayableDays,
            @TotalGrossHours, @TotalGrossHoursDecimal, @TotalBreakHours, @TotalBreakHoursDecimal,
            @TotalNetWorkHoursDecimal, @TotalOvertimeHoursDecimal, @SalaryType, @BaseSalary,
            @CalculatedSalary, @OvertimePay, @Deductions, @NetSalary, @UploadedFileName
          );
          SELECT last_insert_rowid() AS NewId;
        `);

      const summaryId = (summaryInsert.recordset && summaryInsert.recordset[0] && summaryInsert.recordset[0].NewId)
        ? summaryInsert.recordset[0].NewId
        : (i + 1);

      // Insert daily logs for this employee
      if (emp.dailyLogs && emp.dailyLogs.length > 0) {
        for (const d of emp.dailyLogs) {
          await pool.request()
            .input('SummaryId', sql.Int, summaryId)
            .input('MonthYear', sql.VarChar(10), monthYear)
            .input('BiometricCode', sql.VarChar(30), bioCode)
            .input('AttendanceDate', sql.VarChar(20), d.attendanceDate)
            .input('DayNumber', sql.Int, d.dayNumber)
            .input('DayOfWeek', sql.VarChar(10), d.dayOfWeek)
            .input('Shift', sql.VarChar(20), d.shift)
            .input('FirstIn', sql.VarChar(10), d.firstIn)
            .input('LastOut', sql.VarChar(10), d.lastOut)
            .input('GrossHours', sql.VarChar(10), d.grossHours)
            .input('GrossHoursDecimal', sql.Decimal(5, 2), d.grossHoursDecimal)
            .input('BreakHours', sql.VarChar(10), d.breakHours)
            .input('NetHoursDecimal', sql.Decimal(5, 2), d.netHoursDecimal)
            .input('FirstHalfStatus', sql.VarChar(10), d.firstHalfStatus)
            .input('SecondHalfStatus', sql.VarChar(10), d.secondHalfStatus)
            .input('FinalStatus', sql.VarChar(10), d.finalStatus)
            .query(`
              INSERT INTO AttendanceDailyLog (
                SummaryId, MonthYear, BiometricCode, AttendanceDate, DayNumber,
                DayOfWeek, Shift, FirstIn, LastOut, GrossHours, GrossHoursDecimal,
                BreakHours, NetHoursDecimal, FirstHalfStatus, SecondHalfStatus, FinalStatus
              )
              VALUES (
                @SummaryId, @MonthYear, @BiometricCode, @AttendanceDate, @DayNumber,
                @DayOfWeek, @Shift, @FirstIn, @LastOut, @GrossHours, @GrossHoursDecimal,
                @BreakHours, @NetHoursDecimal, @FirstHalfStatus, @SecondHalfStatus, @FinalStatus
              )
            `);
        }
      }

      summaryResults.push({
        summaryId,
        biometricCode: bioCode,
        employeeName: empName,
        department: empDept,
        presentDays: emp.presentDays,
        absentDays: emp.absentDays,
        weekOffDays: emp.weekOffDays,
        halfDays: emp.halfDays,
        payableDays,
        netSalary
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully processed biometric log for ${monthName}. Inserted ${employees.length} employee records.`,
      organization,
      monthName,
      monthYear,
      totalDaysInMonth,
      processedEmployees: employees.length,
      employees: summaryResults
    });
  } catch (error) {
    console.error('Error uploading and processing biometric attendance PDF:', error);
    res.status(500).json({ message: 'Error processing attendance file: ' + error.message });
  }
};

// GET /api/attendance/summary
// Get monthly summary list with filters and overall statistics
exports.getMonthlySummary = async (req, res) => {
  try {
    const { monthYear, department, search } = req.query;
    const pool = await connectDB();

    // 1. Get available months
    const monthsRes = await pool.request().query(`
      SELECT DISTINCT MonthYear, MonthName, TotalDaysInMonth 
      FROM AttendanceMonthlySummary 
      ORDER BY MonthYear DESC
    `);
    const availableMonths = monthsRes.recordset || [];

    if (availableMonths.length === 0) {
      return res.status(200).json({
        availableMonths: [],
        selectedMonth: null,
        stats: {
          totalEmployees: 0,
          totalPresentDays: 0,
          totalAbsentDays: 0,
          totalWeekOffDays: 0,
          totalNetHours: 0,
          totalCalculatedSalary: 0,
          totalOvertimePay: 0,
          totalNetSalary: 0
        },
        records: []
      });
    }

    const selectedMonth = monthYear || availableMonths[0].MonthYear;

    // 2. Build query for records in selected month
    let query = `
      SELECT s.*, u.Username, u.MobileNo
      FROM AttendanceMonthlySummary s
      LEFT JOIN Users u ON s.BiometricCode = u.BiometricCode OR s.UserId = u.UserId
      WHERE s.MonthYear = @MonthYear
    `;

    const request = pool.request().input('MonthYear', sql.VarChar(10), selectedMonth);

    if (department && department !== 'ALL') {
      request.input('Department', sql.VarChar(50), department);
      query += ` AND UPPER(s.Department) = UPPER(@Department)`;
    }

    if (search && search.trim()) {
      request.input('Search', sql.VarChar(100), `%${search.trim()}%`);
      query += ` AND (s.EmployeeName LIKE @Search OR s.BiometricCode LIKE @Search OR s.Department LIKE @Search)`;
    }

    query += ` ORDER BY CAST(s.BiometricCode AS INTEGER) ASC, s.BiometricCode ASC`;

    const result = await request.query(query);
    const records = result.recordset || [];

    // 3. Compute stats
    let totalEmployees = records.length;
    let totalPresentDays = 0;
    let totalAbsentDays = 0;
    let totalWeekOffDays = 0;
    let totalNetHours = 0;
    let totalCalculatedSalary = 0;
    let totalOvertimePay = 0;
    let totalNetSalary = 0;

    for (const r of records) {
      totalPresentDays += parseFloat(r.PresentDays) || 0;
      totalAbsentDays += parseFloat(r.AbsentDays) || 0;
      totalWeekOffDays += parseFloat(r.WeekOffDays) || 0;
      totalNetHours += parseFloat(r.TotalNetWorkHoursDecimal) || 0;
      totalCalculatedSalary += parseFloat(r.CalculatedSalary) || 0;
      totalOvertimePay += parseFloat(r.OvertimePay) || 0;
      totalNetSalary += parseFloat(r.NetSalary) || 0;
    }

    // Distinct departments in this month
    const deptRes = await pool.request()
      .input('MonthYear', sql.VarChar(10), selectedMonth)
      .query(`SELECT DISTINCT Department FROM AttendanceMonthlySummary WHERE MonthYear = @MonthYear ORDER BY Department`);
    const departments = (deptRes.recordset || []).map(d => d.Department).filter(Boolean);

    res.status(200).json({
      availableMonths,
      selectedMonth,
      departments,
      stats: {
        totalEmployees,
        totalPresentDays: parseFloat(totalPresentDays.toFixed(1)),
        totalAbsentDays: parseFloat(totalAbsentDays.toFixed(1)),
        totalWeekOffDays: parseFloat(totalWeekOffDays.toFixed(1)),
        totalNetHours: parseFloat(totalNetHours.toFixed(2)),
        totalCalculatedSalary: Math.round(totalCalculatedSalary),
        totalOvertimePay: Math.round(totalOvertimePay),
        totalNetSalary: Math.round(totalNetSalary)
      },
      records
    });
  } catch (error) {
    console.error('Error fetching monthly attendance summary:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// GET /api/attendance/matrix/:monthYear
// Matrix View: All employees as rows, days 1..31 as columns with statuses and punches
exports.getAttendanceMatrix = async (req, res) => {
  try {
    const { monthYear } = req.params;
    const pool = await connectDB();

    // 1. Get employees for this month
    const empRes = await pool.request()
      .input('MonthYear', sql.VarChar(10), monthYear)
      .query(`
        SELECT Id, BiometricCode, EmployeeName, Department, Designation, 
               PresentDays, AbsentDays, HalfDays, WeekOffDays, PayableDays,
               TotalGrossHours, TotalNetWorkHoursDecimal, NetSalary, TotalDaysInMonth
        FROM AttendanceMonthlySummary
        WHERE MonthYear = @MonthYear
        ORDER BY CAST(BiometricCode AS INTEGER) ASC, BiometricCode ASC
      `);
    const employees = empRes.recordset || [];

    if (employees.length === 0) {
      return res.status(200).json({ monthYear, daysInMonth: 31, employees: [] });
    }

    const daysInMonth = employees[0].TotalDaysInMonth || 31;

    // 2. Fetch all daily logs for this month
    const dailyRes = await pool.request()
      .input('MonthYear', sql.VarChar(10), monthYear)
      .query(`
        SELECT SummaryId, BiometricCode, DayNumber, DayOfWeek, Shift, FirstIn, LastOut, GrossHours, FinalStatus
        FROM AttendanceDailyLog
        WHERE MonthYear = @MonthYear
        ORDER BY BiometricCode, DayNumber ASC
      `);
    const dailyLogs = dailyRes.recordset || [];

    // Map logs by BiometricCode -> DayNumber -> log
    const logMap = new Map();
    for (const d of dailyLogs) {
      const code = String(d.BiometricCode).trim();
      if (!logMap.has(code)) logMap.set(code, {});
      logMap.get(code)[d.DayNumber] = d;
    }

    const matrix = employees.map(emp => {
      const code = String(emp.BiometricCode).trim();
      const empLogs = logMap.get(code) || {};
      const days = {};
      for (let day = 1; day <= daysInMonth; day++) {
        const log = empLogs[day];
        days[day] = log ? {
          status: log.FinalStatus || 'A',
          firstIn: log.FirstIn || '',
          lastOut: log.LastOut || '',
          gross: log.GrossHours || '00:00',
          dayOfWeek: log.DayOfWeek || ''
        } : {
          status: 'A',
          firstIn: '',
          lastOut: '',
          gross: '00:00',
          dayOfWeek: ''
        };
      }
      return {
        ...emp,
        days
      };
    });

    res.status(200).json({
      monthYear,
      daysInMonth,
      employees: matrix
    });
  } catch (error) {
    console.error('Error fetching attendance matrix:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// GET /api/attendance/daily-log/:biometricCode/:monthYear
// Returns day-by-day punches and details for a single employee
exports.getEmployeeDailyLog = async (req, res) => {
  try {
    const { biometricCode, monthYear } = req.params;
    const pool = await connectDB();

    const summaryRes = await pool.request()
      .input('BiometricCode', sql.VarChar(30), biometricCode)
      .input('MonthYear', sql.VarChar(10), monthYear)
      .query(`
        SELECT * FROM AttendanceMonthlySummary 
        WHERE BiometricCode = @BiometricCode AND MonthYear = @MonthYear
      `);

    const summary = summaryRes.recordset && summaryRes.recordset[0] ? summaryRes.recordset[0] : null;

    const logsRes = await pool.request()
      .input('BiometricCode', sql.VarChar(30), biometricCode)
      .input('MonthYear', sql.VarChar(10), monthYear)
      .query(`
        SELECT * FROM AttendanceDailyLog 
        WHERE BiometricCode = @BiometricCode AND MonthYear = @MonthYear
        ORDER BY DayNumber ASC
      `);

    res.status(200).json({
      summary,
      dailyLogs: logsRes.recordset || []
    });
  } catch (error) {
    console.error('Error fetching employee daily log:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// PUT /api/attendance/summary/:id
// Manual override for salary, payable days, deductions or remarks
exports.updateAttendanceSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const { PayableDays, BaseSalary, CalculatedSalary, OvertimePay, Deductions, NetSalary, Remarks } = req.body;
    const pool = await connectDB();

    await pool.request()
      .input('Id', sql.Int, id)
      .input('PayableDays', sql.Decimal(5, 2), PayableDays !== undefined ? PayableDays : 0)
      .input('BaseSalary', sql.Decimal(12, 2), BaseSalary !== undefined ? BaseSalary : 0)
      .input('CalculatedSalary', sql.Decimal(12, 2), CalculatedSalary !== undefined ? CalculatedSalary : 0)
      .input('OvertimePay', sql.Decimal(12, 2), OvertimePay !== undefined ? OvertimePay : 0)
      .input('Deductions', sql.Decimal(12, 2), Deductions !== undefined ? Deductions : 0)
      .input('NetSalary', sql.Decimal(12, 2), NetSalary !== undefined ? NetSalary : 0)
      .input('Remarks', sql.NVarChar(sql.MAX), Remarks || null)
      .query(`
        UPDATE AttendanceMonthlySummary
        SET PayableDays = @PayableDays,
            BaseSalary = @BaseSalary,
            CalculatedSalary = @CalculatedSalary,
            OvertimePay = @OvertimePay,
            Deductions = @Deductions,
            NetSalary = @NetSalary,
            Remarks = @Remarks
        WHERE Id = @Id
      `);

    res.status(200).json({ message: 'Employee attendance & salary updated successfully' });
  } catch (error) {
    console.error('Error updating attendance summary:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// DELETE /api/attendance/month/:monthYear
// Deletes all records for a month
exports.deleteMonth = async (req, res) => {
  try {
    const { monthYear } = req.params;
    const pool = await connectDB();

    await pool.request()
      .input('MonthYear', sql.VarChar(10), monthYear)
      .query(`
        DELETE FROM AttendanceDailyLog WHERE MonthYear = @MonthYear;
        DELETE FROM AttendanceMonthlySummary WHERE MonthYear = @MonthYear;
      `);

    res.status(200).json({ message: `All attendance records for month ${monthYear} have been deleted.` });
  } catch (error) {
    console.error('Error deleting month attendance records:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};
