const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crmController');

// Leads CRUD
router.get('/leads', crmController.getLeads);
router.get('/leads/:id', crmController.getLeadById);
router.post('/leads', crmController.createLead);
router.put('/leads/:id', crmController.updateLead);
router.delete('/leads/:id', crmController.deleteLead);

// Direct root shortcuts
router.get('/', crmController.getLeads);
router.post('/', crmController.createLead);

// Executive Sales Dashboard & KPIs
router.get('/dashboard', crmController.getSalesDashboard);

// Excel Bulk Import
router.post('/bulk', crmController.bulkCreateLeads);

module.exports = router;
