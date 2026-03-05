const express = require('express');
const { listUsers, createUser, deleteUser } = require('../controllers/userController');

const router = express.Router();

router.get('/', listUsers);
router.post('/', createUser);
router.post('/:id/delete', deleteUser);

module.exports = router;