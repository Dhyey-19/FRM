const express = require('express');
const router = express.Router();
const assemblyController = require('../controllers/assemblyController');

router.get('/next-no', assemblyController.getNextAssemblyNo);
router.get('/today', assemblyController.getTodayAssemblies);
router.get('/filter', assemblyController.getFilteredAssemblies);
router.get('/report', assemblyController.getAllAssembliesReport);
router.post('/', assemblyController.createAssembly);
router.put('/:id', assemblyController.updateAssembly);
router.delete('/:id', assemblyController.deleteAssembly);

module.exports = router;
