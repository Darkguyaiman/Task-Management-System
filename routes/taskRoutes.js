const express = require('express');
const {
  listTasks,
  createTask,
  getEditTask,
  updateTask,
  deleteTask
} = require('../controllers/taskController');

const router = express.Router();

router.get('/', listTasks);
router.post('/', createTask);
router.get('/:id/edit', getEditTask);
router.post('/:id/update', updateTask);
router.post('/:id/delete', deleteTask);

module.exports = router;