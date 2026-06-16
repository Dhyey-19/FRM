const express = require('express');
const router = express.Router();
const outwardController = require('../controllers/outwardController');

router.get('/report', outwardController.getOutwardReport);
router.get('/', outwardController.getOutwards);
router.post('/', outwardController.addOutward);
router.put('/:id', outwardController.updateOutward);
router.delete('/:id', outwardController.deleteOutward);

module.exports = router;
