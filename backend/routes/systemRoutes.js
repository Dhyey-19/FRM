const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');

// Status & diagnostics
router.get('/status', systemController.getSystemStatus);

// Database Backups
router.get('/backups', systemController.getBackups);
router.post('/backup', systemController.createBackup);
router.get('/backups/download/:filename', systemController.downloadBackup);
router.delete('/backups/:filename', systemController.deleteBackup);

// Updates
router.get('/check-updates', systemController.checkUpdates);
router.post('/apply-update', systemController.applyUpdate);
router.post('/update-config', systemController.saveUpdateConfig);

module.exports = router;

