const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');

// GET all brands
router.get('/', brandController.getBrands);

// POST create a new brand
router.post('/', brandController.createBrand);

// POST bulk import brands
router.post('/bulk', brandController.bulkCreateBrands);

// PUT update a brand
router.put('/:id', brandController.updateBrand);

// DELETE hard delete a brand
router.delete('/:id', brandController.deleteBrand);

module.exports = router;
