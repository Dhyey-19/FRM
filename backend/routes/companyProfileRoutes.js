const express = require('express');
const router = express.Router();
const companyProfileController = require('../controllers/companyProfileController');

router.get('/', companyProfileController.getProfile);
router.post('/', companyProfileController.addProfile);
router.put('/', companyProfileController.updateProfile);

module.exports = router;
