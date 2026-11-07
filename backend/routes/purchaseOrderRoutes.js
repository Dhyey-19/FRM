const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');

// Next PO Number
router.get('/next-no', purchaseOrderController.getNextPONo);

// Stock Availability & Commitment Analysis
router.get('/stock-availability', purchaseOrderController.getStockAvailability);

// Pending PO Report (Vendor-wise, Item-wise, Summary)
router.get('/pending-report', purchaseOrderController.getPendingPOReport);

// PO Fulfillment & Shortfall Report
router.get('/fulfillment-report', purchaseOrderController.getPOFulfillmentReport);

// Standard CRUD
router.get('/', purchaseOrderController.getPurchaseOrders);
router.post('/', purchaseOrderController.createPurchaseOrder);
router.put('/:id', purchaseOrderController.updatePurchaseOrder);
router.delete('/:id', purchaseOrderController.deletePurchaseOrder);

module.exports = router;

