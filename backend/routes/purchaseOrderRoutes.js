const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');

// Next PO Number
router.get('/next-no', purchaseOrderController.getNextPONo);

// Pending PO Report (Vendor-wise, Item-wise, Summary)
router.get('/pending-report', purchaseOrderController.getPendingPOReport);

// Standard CRUD
router.get('/', purchaseOrderController.getPurchaseOrders);
router.post('/', purchaseOrderController.createPurchaseOrder);
router.put('/:id', purchaseOrderController.updatePurchaseOrder);
router.delete('/:id', purchaseOrderController.deletePurchaseOrder);

module.exports = router;
