const express = require('express');
const router = express.Router();
const inwardController = require('../controllers/inwardController');

router.get('/report', inwardController.getInwardReport);
router.get('/next-no', inwardController.getNextInwardNo);
router.get('/', inwardController.getInwards);
router.post('/', inwardController.addInward);
router.put('/:id', inwardController.updateInward);
router.delete('/:id', inwardController.deleteInward);

module.exports = router;
