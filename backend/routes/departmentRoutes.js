const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');

router.get('/', departmentController.getDepartments);
router.post('/', departmentController.createDepartment);
router.get('/stock', departmentController.getDepartmentStockReport);
router.put('/:id', departmentController.updateDepartment);
router.delete('/:id', departmentController.deleteDepartment);

module.exports = router;
