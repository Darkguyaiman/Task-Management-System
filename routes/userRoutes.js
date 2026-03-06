const express = require('express');
const { listUsers, createUser, deleteUser } = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireAdmin, listUsers);
router.post('/', requireAuth, requireAdmin, createUser);
router.post('/:id/delete', requireAuth, requireAdmin, deleteUser);

module.exports = router;
