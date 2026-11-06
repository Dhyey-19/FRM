const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Define routes
router.get('/kpis', dashboardController.getDashboardKPIs);
router.get('/notifications', dashboardController.getDashboardNotifications);
router.get('/logs', dashboardController.getDashboardNotifications);

module.exports = router;
