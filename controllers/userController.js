const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const fetchUsers = async () => {
  const [users] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.created_at
     FROM users u
     ORDER BY u.created_at DESC`
  );
  return users;
};

const listUsers = async (req, res, next) => {
  try {
    const users = await fetchUsers();
    res.render('users/index', {
      title: 'Users',
      users,
      formError: null,
      oldInput: {},
    });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    try {
      const users = await fetchUsers();
      return res.status(400).render('users/index', {
        title: 'Users',
        users,
        formError: 'Name, email, and password are required.',
        oldInput: { name, email },
      });
    } catch (error) {
      return next(error);
    }
  }

  if (password.length < 6) {
    try {
      const users = await fetchUsers();
      return res.status(400).render('users/index', {
        title: 'Users',
        users,
        formError: 'Password must be at least 6 characters.',
        oldInput: { name, email },
      });
    } catch (error) {
      return next(error);
    }
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'staff')`,
      [name.trim(), email.trim(), hash]
    );
    res.redirect('/users');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      try {
        const users = await fetchUsers();
        return res.status(400).render('users/index', {
          title: 'Users',
          users,
          formError: 'Email already exists.',
          oldInput: { name, email },
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
    await pool.query(`DELETE FROM users WHERE id = ?`, [userId]);
    res.redirect('/users');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers,
  createUser,
  deleteUser,
};
