const express = require('express');
const router = express.Router();
const multer = require('multer');
const attendanceController = require('../controllers/attendanceController');

// Memory storage for PDF upload processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
});

// Upload and process biometric machine monthly log PDF
router.post('/upload', upload.single('file'), attendanceController.uploadAttendance);

// Get monthly attendance & salary summary list with stats
router.get('/summary', attendanceController.getMonthlySummary);

// Get monthly matrix grid (days 1..31 per employee)
router.get('/matrix/:monthYear', attendanceController.getAttendanceMatrix);

// Get single employee daily punch details
router.get('/daily-log/:biometricCode/:monthYear', attendanceController.getEmployeeDailyLog);

// Manual override for salary, payable days, deductions
router.put('/summary/:id', attendanceController.updateAttendanceSummary);

// Delete month records
router.delete('/month/:monthYear', attendanceController.deleteMonth);

module.exports = router;
