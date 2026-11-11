const express = require('express');
const os = require('os');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const systemController = require('../controllers/systemController');

const updateUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      const safeExt = path.extname(file.originalname || '').toLowerCase() === '.zip' ? '.zip' : '.upload';
      cb(null, `frm-pkg-upload-${Date.now()}${safeExt}`);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.originalname || !file.originalname.toLowerCase().endsWith('.zip')) {
      return cb(new Error('Only .zip server update packages are supported.'));
    }
    cb(null, true);
  }
});

// Status & diagnostics
router.get('/status', systemController.getSystemStatus);

// Database Backups
router.get('/backups', systemController.getBackups);
router.post('/backup', systemController.createBackup);
router.get('/backups/download/:filename', systemController.downloadBackup);
router.delete('/backups/:filename', systemController.deleteBackup);

// Offline compiled package update upload
router.post('/upload-update', (req, res, next) => {
  updateUpload.single('updatePackage')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Invalid update package file.' });
    }
    next();
  });
}, systemController.uploadAndApplyUpdate);

module.exports = router;
