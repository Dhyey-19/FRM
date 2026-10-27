const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');

// GET all items
router.get('/', itemController.getItems);

// POST create a new item
router.post('/', itemController.createItem);

// POST bulk import items
router.post('/bulk', itemController.bulkCreateItems);

// GET item stock ledger statement
router.get('/stock-ledger', itemController.getItemStockLedger);

// GET combined stock report (main stock + department stock + jobwork stock)
router.get('/combined-stock', itemController.getCombinedStockReport);

// PUT update an item (using ItemCode)
router.put('/:id', itemController.updateItem);

// DELETE hard delete an item (using ItemCode)
router.delete('/:id', itemController.deleteItem);

module.exports = router;
