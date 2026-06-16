const express = require('express');
const router = express.Router();
const stockJournalController = require('../controllers/stockJournalController');

router.get('/', stockJournalController.getJournals);
router.post('/', stockJournalController.createJournal);
router.put('/:id', stockJournalController.updateJournal);
router.delete('/:id', stockJournalController.deleteJournal);

module.exports = router;
