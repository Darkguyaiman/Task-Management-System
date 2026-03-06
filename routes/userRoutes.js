const express = require('express');
const { listUsers, showCreateForm, showEditForm, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireAdmin, listUsers);
router.get('/create', requireAuth, requireAdmin, showCreateForm);
router.post('/', requireAuth, requireAdmin, createUser);
router.get('/:id/edit', requireAuth, requireAdmin, showEditForm);
router.post('/:id/update', requireAuth, requireAdmin, updateUser);
router.post('/:id/delete', requireAuth, requireAdmin, deleteUser);

module.exports = router;
