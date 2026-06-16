const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');

// GET all assets
router.get('/', assetController.getAssets);

// POST create a new asset
router.post('/', assetController.createAsset);

// POST bulk import assets
router.post('/bulk', assetController.bulkCreateAssets);

// PUT update an asset
router.put('/:id', assetController.updateAsset);

// DELETE hard delete an asset
router.delete('/:id', assetController.deleteAsset);

module.exports = router;
