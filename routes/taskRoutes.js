const express = require('express');
const {
  listTasks,
  createTask,
  getEditTask,
  updateTask,
  deleteTask,
} = require('../controllers/taskController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listTasks);
router.post('/', requireAuth, createTask);
router.get('/:id/edit', requireAuth, getEditTask);
router.post('/:id/update', requireAuth, updateTask);
router.post('/:id/delete', requireAuth, deleteTask);

module.exports = router;
