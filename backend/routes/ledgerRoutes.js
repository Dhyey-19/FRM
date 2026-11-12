const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledgerController');

router.get('/payable', ledgerController.getPayableReport);
router.get('/receivable', ledgerController.getReceivableReport);
router.get('/profit-loss', ledgerController.getProfitLossReport);
router.get('/balance-sheet', ledgerController.getBalanceSheetReport);
router.get('/invoice-wise-payable', ledgerController.getInvoiceWisePayableReport);
router.get('/invoice-wise-receivable', ledgerController.getInvoiceWiseReceivableReport);
router.get('/', ledgerController.getLedgers);
router.post('/', ledgerController.addLedger);
router.post('/bulk', ledgerController.bulkCreateLedgers);
router.put('/:id', ledgerController.updateLedger);
router.delete('/:id', ledgerController.deleteLedger);

module.exports = router;
