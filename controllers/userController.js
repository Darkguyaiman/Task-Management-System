const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const fetchUsers = async (filters = {}) => {
  let sql = `SELECT u.id, u.name, u.email, u.role, u.designation, u.created_at
             FROM users u WHERE 1=1`;
  const params = [];

  if (filters.search) {
    sql += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.designation LIKE ?)`;
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }
  if (filters.role) {
    sql += ` AND u.role = ?`;
    params.push(filters.role);
  }
  if (filters.designation) {
    sql += ` AND u.designation = ?`;
    params.push(filters.designation);
  }

  sql += ` ORDER BY u.created_at DESC`;
  const [users] = await pool.query(sql, params);
  return users;
};

const fetchDesignations = async () => {
  const [rows] = await pool.query(
    `SELECT DISTINCT designation FROM users WHERE designation IS NOT NULL AND designation != '' ORDER BY designation`
  );
  return rows.map(r => r.designation);
};

const listUsers = async (req, res, next) => {
  try {
    const filters = {
      search: req.query.search || '',
      role: req.query.role || '',
      designation: req.query.designation || '',
    };
    const [users, designations] = await Promise.all([
      fetchUsers(filters),
      fetchDesignations(),
    ]);
    res.render('users/index', {
      title: 'Users',
      users,
      designations,
      filters,
    });
  } catch (error) {
    next(error);
  }
};

const showCreateForm = (req, res) => {
  res.render('users/form', {
    title: 'Create User',
    user: null,
    formError: null,
    oldInput: {},
  });
};

const showEditForm = async (req, res, next) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).send('Invalid user id');
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, role, designation FROM users WHERE id = ?`,
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).render('error', { title: 'Not Found', message: 'User not found.' });
    }
    res.render('users/form', {
      title: 'Edit User',
      user: rows[0],
      formError: null,
      oldInput: {},
    });
  } catch (error) {
    next(error);
  }
};

const renderFormWithError = (res, statusCode, error, oldInput, user = null) => {
  const title = user ? 'Edit User' : 'Create User';
  return res.status(statusCode).render('users/form', {
    title,
    user,
    formError: error,
    oldInput,
  });
};

const createUser = async (req, res, next) => {
  const { name, email, password, role, designation } = req.body;
  const old = { name, email, role, designation };

  if (!name || !email || !password) {
    return renderFormWithError(res, 400, 'Name, email, and password are required.', old);
  }

  if (password.length < 6) {
    return renderFormWithError(res, 400, 'Password must be at least 6 characters.', old);
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (name, email, password, role, designation) VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), email.trim(), hash, role === 'admin' ? 'admin' : 'staff', (designation || '').trim() || null]
    );
    res.redirect('/users');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return renderFormWithError(res, 400, 'Email already exists.', old);
    }
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).send('Invalid user id');
  }

  const { name, email, password, role, designation } = req.body;
  const old = { name, email, role, designation };
  const editUser = { id: userId, name, email, role, designation };

  if (!name || !email) {
    return renderFormWithError(res, 400, 'Name and email are required.', old, editUser);
  }

  if (password && password.length < 6) {
    return renderFormWithError(res, 400, 'Password must be at least 6 characters.', old, editUser);
  }

  const desig = (designation || '').trim() || null;

  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE users SET name = ?, email = ?, password = ?, role = ?, designation = ? WHERE id = ?`,
        [name.trim(), email.trim(), hash, role === 'admin' ? 'admin' : 'staff', desig, userId]
      );
    } else {
      await pool.query(
        `UPDATE users SET name = ?, email = ?, role = ?, designation = ? WHERE id = ?`,
        [name.trim(), email.trim(), role === 'admin' ? 'admin' : 'staff', desig, userId]
      );
    }
    res.redirect('/users');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return renderFormWithError(res, 400, 'Email already exists.', old, editUser);
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
  showCreateForm,
  showEditForm,
  createUser,
  updateUser,
  deleteUser,
};
