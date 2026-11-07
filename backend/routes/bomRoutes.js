const express = require('express');
const router = express.Router();
const bomController = require('../controllers/bomController');

router.get('/report', bomController.getAllBOMReport);
router.get('/shortfall-breakup/:parentCode', bomController.getShortfallBOMBreakup);
router.post('/shortfall-breakup/batch', bomController.getBatchShortfallBOMBreakup);
router.get('/:parentCode', bomController.getBOMByParent);
router.post('/', bomController.saveBOM);
router.post('/bulk', bomController.bulkCreateBOM);
router.delete('/:parentCode', bomController.deleteBOM);

module.exports = router;
