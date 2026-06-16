const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Define routes
router.get('/kpis', dashboardController.getDashboardKPIs);

module.exports = router;
