const express = require('express');
const router = express.Router();
const stockTransferController = require('../controllers/stockTransferController');

router.get('/', stockTransferController.getStockTransfers);
router.get('/available-stock/:deptId', stockTransferController.getAvailableStock);
router.post('/', stockTransferController.createStockTransfers);
router.put('/:id', stockTransferController.updateStockTransfer);
router.delete('/:id', stockTransferController.deleteStockTransfer);

module.exports = router;
