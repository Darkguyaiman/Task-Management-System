const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const getProfile = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, role, created_at FROM users WHERE id = ? LIMIT 1`,
      [req.session.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'User not found.',
        error: null,
      });
    }

    res.render('profile', {
      title: 'Profile',
      profile: rows[0],
      success: null,
      formError: null,
    });
  } catch (error) {
    next(error);
  }
};

const updatePassword = async (req, res, next) => {
  const { current_password, new_password, confirm_password } = req.body;
  const userId = req.session.user.id;

  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, role, password, created_at FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'User not found.',
        error: null,
      });
    }

    const user = rows[0];

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).render('profile', {
        title: 'Profile',
        profile: user,
        success: null,
        formError: 'All password fields are required.',
      });
    }

    const match = await bcrypt.compare(current_password, user.password);
    if (!match) {
      return res.status(400).render('profile', {
        title: 'Profile',
        profile: user,
        success: null,
        formError: 'Current password is incorrect.',
      });
    }

    if (new_password.length < 6) {
      return res.status(400).render('profile', {
        title: 'Profile',
        profile: user,
        success: null,
        formError: 'New password must be at least 6 characters.',
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).render('profile', {
        title: 'Profile',
        profile: user,
        success: null,
        formError: 'New password and confirmation do not match.',
      });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query(`UPDATE users SET password = ? WHERE id = ?`, [hash, userId]);

    res.render('profile', {
      title: 'Profile',
      profile: user,
      success: 'Password updated successfully.',
      formError: null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updatePassword,
};
