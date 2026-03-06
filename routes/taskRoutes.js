const express = require('express');
const {
  listTasks,
  getAddTask,
  createTask,
  getEditTask,
  getTaskDetail,
  getTaskSubmissions,
  updateTask,
  deleteTask,
  uploadCompletionProofChunk,
  reopenStaffSubmission,
  submitCompletionWithoutFile,
} = require('../controllers/taskController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listTasks);
router.get('/new', requireAdmin, getAddTask);
router.post('/', requireAdmin, createTask);
router.get('/:id/edit', requireAdmin, getEditTask);
router.get('/:id/submissions', requireAdmin, getTaskSubmissions);
router.get('/:id', requireAuth, getTaskDetail);
router.post('/:id/update', requireAdmin, updateTask);
router.post('/:id/delete', requireAdmin, deleteTask);
router.post('/:id/staff/:userId/reopen', requireAdmin, reopenStaffSubmission);
router.post('/:id/completion/submit', requireAuth, submitCompletionWithoutFile);
router.post('/:id/completion/chunk', requireAuth, uploadCompletionProofChunk);

module.exports = router;
