const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

// Task Manager routes
router.get('/', taskController.getTasks);
router.get('/kpis', taskController.getTaskKpis);
router.get('/users', taskController.getActiveUsers);
router.post('/', taskController.createTask);
router.put('/:id/status', taskController.updateTaskStatus);
router.delete('/:id', taskController.deleteTask);

module.exports = router;

