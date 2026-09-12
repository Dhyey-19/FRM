const express = require('express');
const router = express.Router();
const jobworkInController = require('../controllers/jobworkInController');

router.get('/next-no', jobworkInController.getNextJobworkInNo);
router.get('/report', jobworkInController.getJobworkInReport);
router.get('/stock-report', jobworkInController.getJobworkStockReport);
router.get('/', jobworkInController.getJobworkIns);
router.post('/', jobworkInController.addJobworkIn);
router.put('/:id', jobworkInController.updateJobworkIn);
router.delete('/:id', jobworkInController.deleteJobworkIn);

module.exports = router;
