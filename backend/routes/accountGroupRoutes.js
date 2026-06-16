const express = require('express');
const router = express.Router();
const accountGroupController = require('../controllers/accountGroupController');

router.get('/', accountGroupController.getAccountGroups);
router.post('/', accountGroupController.addAccountGroup);
router.put('/:id', accountGroupController.updateAccountGroup);
router.delete('/:id', accountGroupController.deleteAccountGroup);

module.exports = router;
