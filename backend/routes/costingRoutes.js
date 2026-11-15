const express = require('express');
const router = express.Router();
const costingController = require('../controllers/costingController');

// GET current costing config & full calculation matrix
router.get('/config', costingController.getConfig);

// POST save costing config (raw rates, specs, margins)
router.post('/config', costingController.saveConfig);

// POST apply calculated costing & sale prices to ItemMaster
router.post('/apply-to-item-master', costingController.applyToItemMaster);

module.exports = router;
