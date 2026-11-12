const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');

router.get('/', unitController.getUnits);
router.post('/', unitController.createUnit);
router.post('/bulk', unitController.bulkCreateUnits);
router.put('/:id', unitController.updateUnit);
router.delete('/:id', unitController.deleteUnit);

module.exports = router;
