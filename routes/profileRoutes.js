const express = require('express');
const { getProfile, updatePassword } = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, getProfile);
router.post('/password', requireAuth, updatePassword);

module.exports = router;
