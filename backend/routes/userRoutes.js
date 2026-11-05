const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// GET all active users
router.get('/', userController.getUsers);

// GET single user by id
router.get('/:id', userController.getUserById);

// POST create a new user
router.post('/', userController.createUser);

// PUT update a user
router.put('/:id', userController.updateUser);

// PUT update user menu access permissions
router.put('/:id/access', userController.updateUserAccess);

// DELETE soft delete a user
router.delete('/:id', userController.deleteUser);

module.exports = router;
