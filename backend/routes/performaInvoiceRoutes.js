const express = require('express');
const router = express.Router();
const performaInvoiceController = require('../controllers/performaInvoiceController');

// Next PI Number
router.get('/next-no', performaInvoiceController.getNextPINo);

// Direct stock receive
router.post('/:id/receive-stock', performaInvoiceController.receiveStockDirectly);

// Standard CRUD
router.get('/', performaInvoiceController.getPerformaInvoices);
router.post('/', performaInvoiceController.createPerformaInvoice);
router.put('/:id', performaInvoiceController.updatePerformaInvoice);
router.delete('/:id', performaInvoiceController.deletePerformaInvoice);

module.exports = router;

