const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// GET all active users
router.get('/', userController.getUsers);

// POST create a new user
router.post('/', userController.createUser);

// PUT update a user
router.put('/:id', userController.updateUser);

// DELETE soft delete a user
router.delete('/:id', userController.deleteUser);

module.exports = router;
