const express = require('express');
const router = express.Router();
const itemTypeController = require('../controllers/itemTypeController');

router.get('/', itemTypeController.getItemTypes);
router.post('/', itemTypeController.createItemType);
router.put('/:id', itemTypeController.updateItemType);
router.delete('/:id', itemTypeController.deleteItemType);

module.exports = router;
