const express = require('express');
const router = express.Router();
const bomController = require('../controllers/bomController');

router.get('/report', bomController.getAllBOMReport);
router.get('/:parentCode', bomController.getBOMByParent);
router.post('/', bomController.saveBOM);

module.exports = router;
