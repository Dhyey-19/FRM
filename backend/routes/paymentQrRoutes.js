const express = require('express');
const router = express.Router();
const paymentQrController = require('../controllers/paymentQrController');

router.get('/', paymentQrController.getAllPaymentQRs);
router.post('/', paymentQrController.createPaymentQR);
router.put('/:id', paymentQrController.updatePaymentQR);
router.delete('/:id', paymentQrController.deletePaymentQR);

module.exports = router;

