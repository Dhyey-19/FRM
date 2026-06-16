const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');

router.get('/', voucherController.getVouchers);
router.post('/bulk', voucherController.addVouchersBulk);
router.put('/bulk/:voucherNo', voucherController.updateVouchersBulk);
router.post('/', voucherController.addVoucher);
router.put('/:id', voucherController.updateVoucher);
router.delete('/:id', voucherController.deleteVoucher);

module.exports = router;
