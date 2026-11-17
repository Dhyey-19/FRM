const express = require('express');
const router = express.Router();
const costingController = require('../controllers/costingController');

// GET current costing config & full calculation matrix
router.get('/config', costingController.getConfig);

// POST save costing config (raw rates, specs, margins)
router.post('/config', costingController.saveConfig);

// POST apply calculated costing & sale prices to ItemMaster
router.post('/apply-to-item-master', costingController.applyToItemMaster);

// GET dynamic BOM breakdown and calculated costing for any item
router.get('/item-bom-breakdown/:itemCode', costingController.getItemBOMBreakdown);

// GET all items with BOM breakdown and calculated costing
router.get('/items-costing-list', costingController.getItemsCostingList);

// POST update specific item costing & sale price in ItemMaster
router.post('/update-item-price', costingController.updateItemPrice);

// POST update batch items costing & sale price in ItemMaster
router.post('/update-batch-prices', costingController.updateBatchItemPrices);

module.exports = router;
