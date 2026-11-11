const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/signup
router.post('/signup', authController.signup);

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/change-password
router.post('/change-password', authController.changePassword);

// GET /api/auth/registration-status
router.get('/registration-status', authController.getRegistrationStatus);

// POST /api/auth/register
router.post('/register', authController.registerApp);

// POST /api/auth/request-activation
router.post('/request-activation', authController.requestActivation);

// POST /api/auth/surrender
router.post('/surrender', authController.surrenderApp);

// POST /api/auth/share-pdf
router.post('/share-pdf', authController.sharePDF);

// GET /api/auth/backup
router.get('/backup', authController.backupDatabase);

module.exports = router;
