const pool = require('../config/db');

const listUsers = async (req, res, next) => {
  try {
    const [users] = await pool.query(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.created_at
      FROM users u
      ORDER BY u.created_at DESC`
    );

    res.render('users/index', {
      title: 'Users',
      users,
      formError: null,
      oldInput: {}
    });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  const { name, email } = req.body;

  if (!name || !email) {
    try {
      const [users] = await pool.query(
        `SELECT
          u.id,
          u.name,
          u.email,
          u.created_at
        FROM users u
        ORDER BY u.created_at DESC`
      );
      return res.status(400).render('users/index', {
        title: 'Users',
        users,
        formError: 'Name and email are required.',
        oldInput: { name, email }
      });
    } catch (error) {
      return next(error);
    }
  }

  try {
    await pool.query(
      `INSERT INTO users (name, email)
       VALUES (?, ?)`,
      [name.trim(), email.trim()]
    );

    res.redirect('/users');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      try {
        const [users] = await pool.query(
          `SELECT
            u.id,
            u.name,
            u.email,
            u.created_at
          FROM users u
          ORDER BY u.created_at DESC`
        );
        return res.status(400).render('users/index', {
          title: 'Users',
          users,
          formError: 'Email already exists.',
          oldInput: { name, email }
        });
      } catch (queryError) {
        return next(queryError);
      }
    }
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).send('Invalid user id');
  }

  try {
    await pool.query(
      `DELETE FROM users
       WHERE id = ?`,
      [userId]
    );

    res.redirect('/users');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers,
  createUser,
  deleteUser
};