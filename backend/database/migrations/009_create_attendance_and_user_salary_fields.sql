-- Migration 009: Add Biometric and Salary fields to Users, create Attendance tables

ALTER TABLE "Users" ADD COLUMN "FullName" VARCHAR(100) DEFAULT NULL;
ALTER TABLE "Users" ADD COLUMN "BiometricCode" VARCHAR(30) DEFAULT NULL;
ALTER TABLE "Users" ADD COLUMN "Department" VARCHAR(50) DEFAULT 'LABOUR';
ALTER TABLE "Users" ADD COLUMN "Designation" VARCHAR(50) DEFAULT 'Operator';
ALTER TABLE "Users" ADD COLUMN "SalaryType" VARCHAR(20) DEFAULT 'Monthly';
ALTER TABLE "Users" ADD COLUMN "MonthlySalary" DECIMAL(12, 2) DEFAULT 15000.00;
ALTER TABLE "Users" ADD COLUMN "DailyRate" DECIMAL(10, 2) DEFAULT 600.00;
ALTER TABLE "Users" ADD COLUMN "HourlyRate" DECIMAL(10, 2) DEFAULT 75.00;
ALTER TABLE "Users" ADD COLUMN "OvertimeRatePerHour" DECIMAL(10, 2) DEFAULT 100.00;
ALTER TABLE "Users" ADD COLUMN "StandardWorkingHours" DECIMAL(4, 2) DEFAULT 8.00;

CREATE TABLE IF NOT EXISTS "AttendanceMonthlySummary" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "MonthYear" VARCHAR(10) NOT NULL,
    "MonthName" VARCHAR(30),
    "TotalDaysInMonth" INTEGER DEFAULT 31,
    "UserId" INTEGER NULL,
    "BiometricCode" VARCHAR(30) NOT NULL,
    "EmployeeName" VARCHAR(100) NOT NULL,
    "Department" VARCHAR(50),
    "Designation" VARCHAR(50),
    "PresentDays" DECIMAL(5, 2) DEFAULT 0,
    "AbsentDays" DECIMAL(5, 2) DEFAULT 0,
    "HalfDays" DECIMAL(5, 2) DEFAULT 0,
    "WeekOffDays" DECIMAL(5, 2) DEFAULT 0,
    "PublicHolidays" DECIMAL(5, 2) DEFAULT 0,
    "PaidLeaveDays" DECIMAL(5, 2) DEFAULT 0,
    "UnpaidLeaveDays" DECIMAL(5, 2) DEFAULT 0,
    "PayableDays" DECIMAL(5, 2) DEFAULT 0,
    "TotalGrossHours" VARCHAR(20) DEFAULT '00:00',
    "TotalGrossHoursDecimal" DECIMAL(8, 2) DEFAULT 0.00,
    "TotalBreakHours" VARCHAR(20) DEFAULT '00:00',
    "TotalBreakHoursDecimal" DECIMAL(8, 2) DEFAULT 0.00,
    "TotalNetWorkHoursDecimal" DECIMAL(8, 2) DEFAULT 0.00,
    "TotalOvertimeHoursDecimal" DECIMAL(8, 2) DEFAULT 0.00,
    "SalaryType" VARCHAR(20) DEFAULT 'Monthly',
    "BaseSalary" DECIMAL(12, 2) DEFAULT 0.00,
    "CalculatedSalary" DECIMAL(12, 2) DEFAULT 0.00,
    "OvertimePay" DECIMAL(12, 2) DEFAULT 0.00,
    "Deductions" DECIMAL(12, 2) DEFAULT 0.00,
    "NetSalary" DECIMAL(12, 2) DEFAULT 0.00,
    "UploadedFileName" VARCHAR(255),
    "UploadedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "Remarks" TEXT
);

CREATE TABLE IF NOT EXISTS "AttendanceDailyLog" (
    "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "SummaryId" INTEGER NOT NULL,
    "MonthYear" VARCHAR(10) NOT NULL,
    "BiometricCode" VARCHAR(30) NOT NULL,
    "AttendanceDate" VARCHAR(20) NOT NULL,
    "DayNumber" INTEGER NOT NULL,
    "DayOfWeek" VARCHAR(10),
    "Shift" VARCHAR(20),
    "FirstIn" VARCHAR(10),
    "LastOut" VARCHAR(10),
    "GrossHours" VARCHAR(10),
    "GrossHoursDecimal" DECIMAL(5, 2) DEFAULT 0.00,
    "BreakHours" VARCHAR(10),
    "NetHoursDecimal" DECIMAL(5, 2) DEFAULT 0.00,
    "OvertimeHoursDecimal" DECIMAL(5, 2) DEFAULT 0.00,
    "FirstHalfStatus" VARCHAR(10),
    "SecondHalfStatus" VARCHAR(10),
    "FinalStatus" VARCHAR(10)
);

CREATE INDEX IF NOT EXISTS "IX_AttendanceMonthlySummary_MonthYear" ON "AttendanceMonthlySummary" ("MonthYear");
CREATE INDEX IF NOT EXISTS "IX_AttendanceMonthlySummary_BiometricCode" ON "AttendanceMonthlySummary" ("BiometricCode");
CREATE INDEX IF NOT EXISTS "IX_AttendanceDailyLog_SummaryId" ON "AttendanceDailyLog" ("SummaryId");
CREATE INDEX IF NOT EXISTS "IX_AttendanceDailyLog_MonthYear_BiometricCode" ON "AttendanceDailyLog" ("MonthYear", "BiometricCode");
