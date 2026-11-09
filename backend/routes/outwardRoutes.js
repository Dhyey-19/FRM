const express = require('express');
const router = express.Router();
const outwardController = require('../controllers/outwardController');

router.get('/pending-pod', outwardController.getPendingPodReport);
router.get('/report', outwardController.getOutwardReport);
router.get('/next-no', outwardController.getNextOutwardNo);
router.get('/', outwardController.getOutwards);
router.post('/', outwardController.addOutward);
router.patch('/:id/pod', outwardController.updateOutwardPod);
router.put('/:id/pod', outwardController.updateOutwardPod);
router.put('/:id', outwardController.updateOutward);
router.delete('/:id', outwardController.deleteOutward);

module.exports = router;
