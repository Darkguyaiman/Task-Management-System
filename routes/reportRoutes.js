const express = require('express');
const { getReportsPage } = require('../controllers/reportController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireAdmin, getReportsPage);

module.exports = router;
