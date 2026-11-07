const express = require('express');
const router = express.Router();
const einvoiceController = require('../controllers/einvoiceController');

// GET /api/einvoice/generate-json/:id - Generate official NIC INV-01 JSON payload
router.get('/generate-json/:id', einvoiceController.generateEInvoiceJSON);

// POST /api/einvoice/bulk-json - Generate array of INV-01 payloads for multiple invoices
router.post('/bulk-json', einvoiceController.generateBulkEInvoiceJSON);

// POST /api/einvoice/import-response/:id - Attach IRN, Ack No, Ack Date, Signed QR from Portal response
router.post('/import-response/:id', einvoiceController.importEInvoiceResponse);

// POST /api/einvoice/cancel/:id - Mark e-Invoice as cancelled with reason
router.post('/cancel/:id', einvoiceController.cancelEInvoice);

// GET /api/einvoice/status/:id - Get e-Invoice details/status for an invoice
router.get('/status/:id', einvoiceController.getEInvoiceDetails);

module.exports = router;
