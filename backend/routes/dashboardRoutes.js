const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Define routes
router.get('/kpis', dashboardController.getDashboardKPIs);
router.get('/notifications', dashboardController.getDashboardNotifications);
router.get('/logs', dashboardController.getDashboardNotifications);
router.post('/notifications/:id/close', dashboardController.closeNotification);
router.post('/notifications/:id/reopen', dashboardController.reopenNotification);
router.delete('/notifications/:id', dashboardController.deleteNotification);
router.post('/notifications/:id/delete', dashboardController.deleteNotification);
router.post('/notifications/delete-all', dashboardController.deleteAllNotifications);
router.delete('/notifications', dashboardController.deleteAllNotifications);

module.exports = router;
