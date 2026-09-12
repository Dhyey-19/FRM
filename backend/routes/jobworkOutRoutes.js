const express = require('express');
const router = express.Router();
const jobworkOutController = require('../controllers/jobworkOutController');

router.get('/next-no', jobworkOutController.getNextJobworkOutNo);
router.get('/report', jobworkOutController.getJobworkOutReport);
router.get('/', jobworkOutController.getJobworkOuts);
router.post('/', jobworkOutController.addJobworkOut);
router.put('/:id', jobworkOutController.updateJobworkOut);
router.delete('/:id', jobworkOutController.deleteJobworkOut);

module.exports = router;
